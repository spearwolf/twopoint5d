import {emit, type EventizedObject, eventize, off, once, retain} from '@spearwolf/eventize';
import type { Effect, Signal} from '@spearwolf/signalize';
import {batch, createEffect, createSignal, SignalGroup, touch} from '@spearwolf/signalize';
import type { WebGPURenderer} from 'three/webgpu';
import {ImageLoader, type Texture} from 'three/webgpu';
import {FrameBasedAnimations, type AnimationTimingOptions} from './FrameBasedAnimations.js';
import type {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import {TexturePackerJson, type TexturePackerJsonData} from './TexturePackerJson.js';
import {TileSet, type TileSetOptions} from './TileSet.js';
import type {FrameBasedAnimationsData, FrameBasedAnimationsDataByTileCount, FrameBasedAnimationsDataMap} from './types.ts';

/**
 * Extracts timing options from frame-based animation data.
 * Returns AnimationTimingOptions object with either duration or frameRate.
 * @throws Error if neither duration nor frameRate is provided
 */
const getTimingOptions = (data: FrameBasedAnimationsData): AnimationTimingOptions => {
  if ('frameRate' in data && data.frameRate !== undefined) {
    return {frameRate: data.frameRate};
  }
  if ('duration' in data && data.duration !== undefined) {
    return {duration: data.duration};
  }
  throw new Error('Either duration or frameRate must be provided in animation data');
};

export type TextureResourceType = 'image' | 'atlas' | 'tileset';
export type TextureResourceSubType = 'imageCoords' | 'atlas' | 'tileSet' | 'texture' | 'frameBasedAnimations';

/**
 * Constants for the subtypes emitted by `TextureResource` (and accepted by `TextureStore.on(id, type, ...)`).
 *
 * Prefer these over raw string literals when subscribing — the values are
 * declared as a `const`-typed record so they remain assignable to
 * `TextureResourceSubType`.
 */
export const TextureResourceSubtypes = {
  ImageCoords: 'imageCoords',
  Atlas: 'atlas',
  TileSet: 'tileSet',
  Texture: 'texture',
  FrameBasedAnimations: 'frameBasedAnimations',
} as const satisfies Record<string, TextureResourceSubType>;

/**
 * Public event-name constants emitted by `TextureResource`.
 *
 * The per-subtype events (`imageCoords`, `atlas`, `tileSet`, `texture`,
 * `frameBasedAnimations`) are retained — late subscribers see the latest value.
 *
 * `error` carries `{source: 'image'|'atlas', url, error}`.
 * `dispose` fires once at the start of `dispose()`.
 */
export const TextureResourceEvents = {
  ImageCoords: TextureResourceSubtypes.ImageCoords,
  Atlas: TextureResourceSubtypes.Atlas,
  TileSet: TextureResourceSubtypes.TileSet,
  Texture: TextureResourceSubtypes.Texture,
  FrameBasedAnimations: TextureResourceSubtypes.FrameBasedAnimations,
  Dispose: 'dispose',
  Error: 'error',
} as const;

const cmpTexClasses = (a: TextureOptionClasses[] | undefined, b: TextureOptionClasses[] | undefined): boolean => {
  if (a === b) {
    return true;
  }
  return `${a?.join() ?? ''}` === `${b?.join() ?? ''}`;
};

const cmpTexCoords = (a: TextureCoords | undefined, b: TextureCoords | undefined): boolean => {
  if (a === b) {
    return true;
  }
  if (a && b) {
    return (
      a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.flip === b.flip && a.parent === b.parent
    );
  }
  return false;
};

const cmpTileSetOptions = (a: TileSetOptions | undefined, b: TileSetOptions | undefined): boolean => {
  if (a === b) {
    return true;
  }
  if (a && b) {
    return (
      a.tileWidth === b.tileWidth &&
      a.tileHeight === b.tileHeight &&
      a.margin === b.margin &&
      a.spacing === b.spacing &&
      a.padding === b.padding &&
      a.tileCount === b.tileCount &&
      a.firstId === b.firstId
    );
  }
  return false;
};

const OnDispose = TextureResourceEvents.Dispose;
const OnError = TextureResourceEvents.Error;

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface TextureResource extends EventizedObject {}

export class TextureResource {
  static fromImage(id: string, imageUrl: string, textureClasses?: TextureOptionClasses[]): TextureResource {
    const resource = new TextureResource(id, 'image');

    batch(() => {
      resource.imageUrl = imageUrl;
      resource.textureClasses = textureClasses?.slice();
    });

    return resource;
  }

  static fromTileSet(
    id: string,
    imageUrl: string,
    tileSetOptions: TileSetOptions,
    textureClasses?: TextureOptionClasses[],
    frameBasedAnimations?: FrameBasedAnimationsDataMap,
  ): TextureResource {
    const resource = new TextureResource(id, 'tileset');

    batch(() => {
      resource.imageUrl = imageUrl;
      resource.#tileSetOptions = createSignal(tileSetOptions, {compare: cmpTileSetOptions, attach: resource});
      resource.#tileSet = createSignal(undefined, {attach: resource});
      resource.#atlas = createSignal(undefined, {attach: resource});
      resource.textureClasses = textureClasses?.slice();
      resource.frameBasedAnimationsData = frameBasedAnimations;
    });

    return resource;
  }

  static fromAtlas(
    id: string,
    atlasUrl: string,
    overrideImageUrl?: string,
    textureClasses?: TextureOptionClasses[],
    frameBasedAnimations?: FrameBasedAnimationsDataMap,
  ): TextureResource {
    const resource = new TextureResource(id, 'atlas');

    batch(() => {
      resource.#atlasUrl = createSignal(atlasUrl, {attach: resource});
      resource.#atlasJson = createSignal(undefined, {attach: resource});
      resource.#atlas = createSignal(undefined, {attach: resource});
      resource.#overrideImageUrl = createSignal(overrideImageUrl, {attach: resource});
      resource.textureClasses = textureClasses?.slice();
      resource.frameBasedAnimationsData = frameBasedAnimations;
    });

    return resource;
  }

  #atlasUrl?: Signal<string | undefined>;
  #atlasJson?: Signal<TexturePackerJsonData | undefined>;
  #overrideImageUrl?: Signal<string | undefined>;
  #atlas?: Signal<TextureAtlas | undefined>;
  #tileSetOptions?: Signal<TileSetOptions | undefined>;
  #tileSet?: Signal<TileSet | undefined>;

  #frameBasedAnimations = createSignal<FrameBasedAnimations | undefined>(undefined, {attach: this});
  #frameBasedAnimationsData = createSignal<FrameBasedAnimationsDataMap | undefined>(undefined, {attach: this});

  #textureClasses = createSignal<TextureOptionClasses[] | undefined>(undefined, {compare: cmpTexClasses, attach: this});
  #imageUrl = createSignal<string | undefined>(undefined, {attach: this});
  #imageCoords = createSignal<TextureCoords | undefined>(undefined, {compare: cmpTexCoords, attach: this});

  #textureFactory = createSignal<TextureFactory | undefined>(undefined, {attach: this});
  #texture = createSignal<Texture | undefined>(undefined, {attach: this});
  #renderer = createSignal<WebGPURenderer | undefined>(undefined, {attach: this});

  readonly id: string;
  readonly type: TextureResourceType;

  refCount: number = 0;

  get imageUrl(): string | undefined {
    return this.#imageUrl.value;
  }

  set imageUrl(val: string | undefined) {
    this.#imageUrl.set(val);
  }

  get imageCoords(): TextureCoords | undefined {
    return this.#imageCoords.value;
  }

  set imageCoords(val: TextureCoords | undefined) {
    this.#imageCoords.set(val);
  }

  get atlasUrl(): string | undefined {
    return this.#atlasUrl?.value;
  }

  set atlasUrl(value: string | undefined) {
    this.#atlasUrl?.set(value);
  }

  get atlasJson(): TexturePackerJsonData | undefined {
    return this.#atlasJson?.value;
  }

  set atlasJson(value: TexturePackerJsonData | undefined) {
    this.#atlasJson?.set(value);
  }

  get overrideImageUrl(): string | undefined {
    return this.#overrideImageUrl?.value;
  }

  set overrideImageUrl(value: string | undefined) {
    this.#overrideImageUrl?.set(value);
  }

  get atlas(): TextureAtlas | undefined {
    return this.#atlas?.value;
  }

  set atlas(value: TextureAtlas | undefined) {
    this.#atlas?.set(value);
  }

  get tileSetOptions(): TileSetOptions | undefined {
    return this.#tileSetOptions?.value;
  }

  set tileSetOptions(value: TileSetOptions | undefined) {
    this.#tileSetOptions?.set(value);
  }

  get tileSet(): TileSet | undefined {
    return this.#tileSet?.value;
  }

  set tileSet(value: TileSet | undefined) {
    this.#tileSet?.set(value);
  }

  get frameBasedAnimations(): FrameBasedAnimations | undefined {
    return this.#frameBasedAnimations.value;
  }

  set frameBasedAnimations(value: FrameBasedAnimations | undefined) {
    this.#frameBasedAnimations.set(value);
  }

  get frameBasedAnimationsData(): FrameBasedAnimationsDataMap | undefined {
    return this.#frameBasedAnimationsData.value;
  }

  set frameBasedAnimationsData(value: FrameBasedAnimationsDataMap | undefined) {
    this.#frameBasedAnimationsData.set(value);
  }

  get textureClasses(): TextureOptionClasses[] | undefined {
    return this.#textureClasses.value;
  }

  set textureClasses(value: TextureOptionClasses[] | undefined) {
    if (Array.isArray(value) && value.length === 0) {
      value = undefined;
    }
    this.#textureClasses.set(value);
  }

  get textureFactory(): TextureFactory | undefined {
    return this.#textureFactory.value;
  }

  set textureFactory(value: TextureFactory | undefined) {
    this.#textureFactory.set(value);
  }

  get texture(): Texture | undefined {
    return this.#texture.value;
  }

  set texture(value: Texture | undefined) {
    this.#texture.set(value);
  }

  get renderer(): WebGPURenderer | undefined {
    return this.#renderer.value;
  }

  set renderer(value: WebGPURenderer | undefined) {
    this.#renderer.set(value);
  }

  #load = false;
  #disposed = false;

  constructor(id: string, type: TextureResourceType) {
    eventize(this);

    this.id = id;
    this.type = type;

    retain(this, ['imageCoords', 'atlas', 'tileSet', 'texture', 'frameBasedAnimations']);
  }

  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;
    emit(this, OnDispose);
    SignalGroup.delete(this);
    off(this);
  }

  load(): TextureResource {
    if (!this.#load) {
      this.#load = true;

      this.#imageCoords.onChange((value) => {
        emit(this, 'imageCoords', value);
      });

      this.#atlas?.onChange((value) => {
        emit(this, 'atlas', value);
      });

      this.#tileSet?.onChange((value) => {
        emit(this, 'tileSet', value);
      });

      this.#frameBasedAnimations.onChange((value) => {
        emit(this, 'frameBasedAnimations', value);
      });

      this.#texture.onChange((value) => {
        emit(this, 'texture', value);
      });

      const unsubscribeOnDispose = (effect: Effect) => {
        once(this, OnDispose, () => {
          effect.destroy();
        });
      };

      // auto-tracking effect (no static deps) so it autoruns at registration
      // — load() is typically called AFTER `textureFactory` and `imageUrl` are
      // already set on the resource (by the store's parse-time injection), and
      // a static-dep effect would otherwise never fire because no dep changes
      // post-registration.
      unsubscribeOnDispose(
        createEffect(() => {
          const factory = this.#textureFactory.get();
          const url = this.#imageUrl.get();
          const classes = this.#textureClasses.get();
          if (!factory || !url) return;

          let aborted = false;
          let texture: Texture | undefined;

          new ImageLoader()
            .loadAsync(url)
            .then((image) => {
              if (aborted) return;
              texture = factory.create(image, ...(classes ?? []));
              texture.name = this.id;
              batch(() => {
                this.imageCoords = new TextureCoords(0, 0, image.width, image.height);
                this.texture = texture;
              });
            })
            .catch((error) => {
              if (aborted) return;
              emit(this, OnError, {source: 'image', url, error});
            });

          return () => {
            aborted = true;
            texture?.dispose();
          };
        }),
      );

      if (this.tileSetOptions) {
        unsubscribeOnDispose(
          createEffect(() => {
            if (this.imageCoords && this.tileSetOptions) {
              this.tileSet = new TileSet(this.imageCoords, this.tileSetOptions);
              this.atlas = this.tileSet.atlas;
            }
          }, [this.#imageCoords, this.#tileSetOptions]),
        );

        unsubscribeOnDispose(
          createEffect(() => {
            if (this.tileSet && this.frameBasedAnimationsData) {
              this.frameBasedAnimations = new FrameBasedAnimations();
              for (const [name, data] of Object.entries(this.frameBasedAnimationsData)) {
                const timing = getTimingOptions(data);
                if ('tileIds' in data) {
                  this.frameBasedAnimations.add(name, timing, this.tileSet, data.tileIds);
                } else {
                  const _data = data as FrameBasedAnimationsDataByTileCount;
                  this.frameBasedAnimations.add(name, timing, this.tileSet, _data.firstTileId, _data.tileCount);
                }
              }
            }
          }, [this.#tileSet, this.#frameBasedAnimationsData]),
        );
      }

      if (this.atlasUrl) {
        unsubscribeOnDispose(
          createEffect(() => {
            const atlasUrl = this.atlasUrl;
            if (!atlasUrl) return;
            const ac = new AbortController();
            let aborted = false;
            (async () => {
              try {
                const response = await fetch(atlasUrl, {signal: ac.signal});
                const atlasJson = await response.json();
                if (aborted) return;
                this.atlasJson = atlasJson;
              } catch (error) {
                if (aborted) return;
                emit(this, OnError, {source: 'atlas', url: atlasUrl, error});
              }
            })();
            return () => {
              aborted = true;
              ac.abort();
            };
          }, [this.#atlasUrl]),
        );

        unsubscribeOnDispose(
          createEffect(() => {
            if (this.atlasJson) {
              this.imageUrl = this.overrideImageUrl ?? this.atlasJson.meta.image;
            }
          }, [this.#atlasJson, this.#overrideImageUrl]),
        );

        unsubscribeOnDispose(
          createEffect(() => {
            if (this.atlasJson && this.imageCoords) {
              const [atlas] = TexturePackerJson.parse(this.atlasJson, this.imageCoords);
              this.atlas = atlas;
            }
          }, [this.#atlasJson, this.#imageCoords]),
        );

        unsubscribeOnDispose(
          createEffect(() => {
            if (this.atlas && this.frameBasedAnimationsData) {
              this.frameBasedAnimations = new FrameBasedAnimations();
              for (const [name, data] of Object.entries(this.frameBasedAnimationsData)) {
                if ('frameNameQuery' in data) {
                  const timing = getTimingOptions(data);
                  this.frameBasedAnimations.add(name, timing, this.atlas, data.frameNameQuery);
                }
              }
            }
          }, [this.#atlas, this.#frameBasedAnimationsData]),
        );

        touch(this.#atlasUrl);
      }

      // Standalone fallback: if a user assigns `renderer` directly on this resource
      // (i.e. without going through a `TextureStore`), spin up a per-resource
      // `TextureFactory`. When the resource is managed by a store, the store
      // injects its shared factory and this branch never fires.
      unsubscribeOnDispose(
        createEffect(() => {
          const renderer = this.#renderer.get();
          if (renderer && !this.#textureFactory.value) {
            this.textureFactory = new TextureFactory(renderer);
          }
        }),
      );
    }
    return this;
  }
}

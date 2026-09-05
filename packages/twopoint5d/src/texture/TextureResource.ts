import {emit, type EventizedObject, eventize, off, retain} from '@spearwolf/eventize';
import type {Signal} from '@spearwolf/signalize';
import {batch, createEffect, createSignal, SignalGroup, touch} from '@spearwolf/signalize';
import type {WebGPURenderer} from 'three/webgpu';
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
    imageUrl: string | undefined,
    tileSetOptions: TileSetOptions,
    textureClasses?: TextureOptionClasses[],
    frameBasedAnimations?: FrameBasedAnimationsDataMap,
  ): TextureResource {
    const resource = new TextureResource(id, 'tileset');

    batch(() => {
      resource.imageUrl = imageUrl;
      resource.#tileSetOptions = createSignal<TileSetOptions | undefined>(tileSetOptions, {
        compare: cmpTileSetOptions,
        attach: resource,
      });
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
      resource.#atlasUrl = createSignal<string | undefined>(atlasUrl, {attach: resource});
      resource.#atlasJson = createSignal(undefined, {attach: resource});
      resource.#atlas = createSignal(undefined, {attach: resource});
      resource.#overrideImageUrl = createSignal<string | undefined>(overrideImageUrl, {attach: resource});
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

  /**
   * The texture of this resource, or `undefined` while none has been built or assigned.
   *
   * Answers `undefined` once {@link TextureResource.dispose} has run.
   */
  get texture(): Texture | undefined {
    return this.#texture.value;
  }

  /**
   * A texture assigned here belongs to the caller: this resource publishes it, but never
   * releases it — neither when the next texture replaces it nor in
   * {@link TextureResource.dispose}.
   */
  set texture(value: Texture | undefined) {
    this.#texture.set(value);
  }

  get renderer(): WebGPURenderer | undefined {
    return this.#renderer.value;
  }

  set renderer(value: WebGPURenderer | undefined) {
    this.#renderer.set(value);
  }

  // the texture this resource built for itself and therefore owns; a texture assigned
  // through the public setter never lands here and is never released by this class
  #ownTexture?: Texture;

  #load = false;
  #disposed = false;

  constructor(id: string, type: TextureResourceType) {
    eventize(this);

    this.id = id;
    this.type = type;

    retain(this, ['imageCoords', 'atlas', 'tileSet', 'texture', 'frameBasedAnimations']);
  }

  /**
   * Release this resource.
   *
   * Disposes the texture this resource built for itself. A texture that came in through
   * the {@link TextureResource.texture} setter belongs to the caller and is left alone,
   * as are the atlas, the tile set and the texture factory.
   *
   * Afterwards {@link TextureResource.texture} answers `undefined`; every other member
   * keeps the last value it had. A second call does nothing.
   */
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true;

    emit(this, OnDispose);

    // the dispose event above is how subscribers learn this resource is gone; muting
    // keeps the clean-up below from following it with a texture update that would hand
    // a subscriber an undefined where the event type promises a Texture
    this.#texture.muted = true;
    this.#texture.set(undefined);

    // released only after the signal has given it up, so no reader can ever reach a
    // texture that is already freed
    this.#ownTexture?.dispose();
    this.#ownTexture = undefined;

    SignalGroup.delete(this);
    off(this);
  }

  load(): TextureResource {
    if (!this.#load) {
      this.#load = true;

      // these bridges end with the signals they read: the signals are attached to this
      // resource, and SignalGroup.delete(this) in dispose() destroys them
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

      // auto-tracking effect (no static deps) so it autoruns at registration
      // — load() is typically called AFTER `textureFactory` and `imageUrl` are
      // already set on the resource (by the store's parse-time injection), and
      // a static-dep effect would otherwise never fire because no dep changes
      // post-registration.
      createEffect(
        () => {
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
              // the predecessor stayed alive while it was still the published value; now that
              // the successor is on the signal, no reader can reach the old one any more
              const previous = this.#ownTexture;
              this.#ownTexture = texture;
              previous?.dispose();
            })
            .catch((error) => {
              if (aborted) return;
              emit(this, OnError, {source: 'image', url, error});
            });

          return () => {
            // a texture that reached the signal outlives this run and is released by the run
            // that replaces it, or by dispose() — freeing it here would leave the signal
            // pointing at a texture that is already gone
            aborted = true;
          };
        },
        {attach: this},
      );

      if (this.tileSetOptions) {
        // A tileset resource creates these signals in the same batch() that received the value the guard just read.
        const tileSetOptionsSignal = this.#tileSetOptions!;
        const tileSetSignal = this.#tileSet!;

        createEffect(
          () => {
            if (this.imageCoords && this.tileSetOptions) {
              this.tileSet = new TileSet(this.imageCoords, this.tileSetOptions);
              this.atlas = this.tileSet.atlas;
            }
          },
          [this.#imageCoords, tileSetOptionsSignal],
          {attach: this},
        );

        createEffect(
          () => {
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
          },
          [tileSetSignal, this.#frameBasedAnimationsData],
          {attach: this},
        );
      }

      if (this.atlasUrl) {
        // An atlas resource creates these signals in the same batch() that received the value the guard just read.
        const atlasUrlSignal = this.#atlasUrl!;
        const atlasJsonSignal = this.#atlasJson!;
        const overrideImageUrlSignal = this.#overrideImageUrl!;
        const atlasSignal = this.#atlas!;

        createEffect(
          () => {
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
          },
          [atlasUrlSignal],
          {attach: this},
        );

        createEffect(
          () => {
            if (this.atlasJson) {
              this.imageUrl = this.overrideImageUrl ?? this.atlasJson.meta.image;
            }
          },
          [atlasJsonSignal, overrideImageUrlSignal],
          {attach: this},
        );

        createEffect(
          () => {
            if (this.atlasJson && this.imageCoords) {
              const [atlas] = TexturePackerJson.parse(this.atlasJson, this.imageCoords);
              this.atlas = atlas;
            }
          },
          [atlasJsonSignal, this.#imageCoords],
          {attach: this},
        );

        createEffect(
          () => {
            if (this.atlas && this.frameBasedAnimationsData) {
              this.frameBasedAnimations = new FrameBasedAnimations();
              for (const [name, data] of Object.entries(this.frameBasedAnimationsData)) {
                if ('frameNameQuery' in data) {
                  const timing = getTimingOptions(data);
                  this.frameBasedAnimations.add(name, timing, this.atlas, data.frameNameQuery);
                }
              }
            }
          },
          [atlasSignal, this.#frameBasedAnimationsData],
          {attach: this},
        );

        touch(atlasUrlSignal);
      }

      // Standalone fallback: if a user assigns `renderer` directly on this resource
      // (i.e. without going through a `TextureStore`), spin up a per-resource
      // `TextureFactory`. When the resource is managed by a store, the store
      // injects its shared factory and this branch never fires.
      createEffect(
        () => {
          const renderer = this.#renderer.get();
          if (renderer && !this.#textureFactory.value) {
            this.textureFactory = new TextureFactory(renderer);
          }
        },
        {attach: this},
      );
    }
    return this;
  }
}

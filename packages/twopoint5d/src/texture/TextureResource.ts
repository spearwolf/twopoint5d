import {emit, eventize, off, once, retain} from '@spearwolf/eventize';
import {batch, createEffect, createSignal, Effect, Signal, SignalGroup, touch} from '@spearwolf/signalize';
import {ImageLoader, WebGPURenderer, type Texture} from 'three/webgpu';
import {FrameBasedAnimations} from './FrameBasedAnimations.js';
import type {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import {TexturePackerJson, type TexturePackerJsonData} from './TexturePackerJson.js';
import {TileSet, type TileSetOptions} from './TileSet.js';
import type {FrameBasedAnimationsDataByTileCount, FrameBasedAnimationsDataMap} from './types.ts';

export type TextureResourceType = 'image' | 'atlas' | 'tileset';
export type TextureResourceSubType = 'imageCoords' | 'atlas' | 'tileSet' | 'texture' | 'frameBasedAnimations';

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

const OnDispose = 'dispose';

export class TextureResource {
  static fromImage(id: string, imageUrl: string, textureClasses?: TextureOptionClasses[]): TextureResource {
    const resource = new TextureResource(id, 'image');

    batch(() => {
      resource.imageUrl = imageUrl;
      resource.textureClasses = textureClasses?.splice(0);
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
      resource.textureClasses = textureClasses?.splice(0);
      resource.#frameBasedAnimations = createSignal(undefined, {attach: resource});
      resource.#frameBasedAnimationsData = createSignal(frameBasedAnimations, {attach: resource});
    });

    return resource;
  }

  static fromAtlas(
    id: string,
    atlasUrl: string,
    overrideImageUrl?: string,
    textureClasses?: TextureOptionClasses[],
  ): TextureResource {
    const resource = new TextureResource(id, 'atlas');

    batch(() => {
      resource.#atlasUrl = createSignal(atlasUrl, {attach: resource});
      resource.#atlasJson = createSignal(undefined, {attach: resource});
      resource.#atlas = createSignal(undefined, {attach: resource});
      resource.#overrideImageUrl = createSignal(overrideImageUrl, {attach: resource});
      resource.textureClasses = textureClasses?.splice(0);
    });

    return resource;
  }

  #atlasUrl?: Signal<string | undefined>;
  #atlasJson?: Signal<TexturePackerJsonData | undefined>;
  #overrideImageUrl?: Signal<string | undefined>;
  #atlas?: Signal<TextureAtlas | undefined>;
  #tileSetOptions?: Signal<TileSetOptions | undefined>;
  #tileSet?: Signal<TileSet | undefined>;
  #frameBasedAnimations?: Signal<FrameBasedAnimations | undefined>;
  #frameBasedAnimationsData?: Signal<FrameBasedAnimationsDataMap | undefined>;

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
    return this.#frameBasedAnimations?.value;
  }

  set frameBasedAnimations(value: FrameBasedAnimations | undefined) {
    this.#frameBasedAnimations?.set(value);
  }

  get frameBasedAnimationsData(): FrameBasedAnimationsDataMap | undefined {
    return this.#frameBasedAnimationsData?.value;
  }

  set frameBasedAnimationsData(value: FrameBasedAnimationsDataMap | undefined) {
    this.#frameBasedAnimationsData?.set(value);
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

  constructor(id: string, type: TextureResourceType) {
    eventize(this);

    this.id = id;
    this.type = type;

    retain(this, ['imageCoords', 'atlas', 'tileSet', 'texture', 'frameBasedAnimations']);
  }

  dispose() {
    emit(this, OnDispose);
    SignalGroup.get(this).destroy();
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

      this.#frameBasedAnimations?.onChange((value) => {
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

      unsubscribeOnDispose(
        createEffect(() => {
          let texture: Texture | undefined;

          if (this.textureFactory && this.imageUrl) {
            new ImageLoader().loadAsync(this.imageUrl).then((image) => {
              batch(() => {
                this.imageCoords = new TextureCoords(0, 0, image.width, image.height);

                texture = this.textureFactory.create(image);
                texture.name = this.id;
                this.texture = texture;
              });
            });
          }

          return () => {
            texture?.dispose();
          };
        }, [this.#textureFactory, this.#imageUrl]),
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
                if ('tileIds' in data) {
                  this.frameBasedAnimations.add(name, data.duration, this.tileSet, data.tileIds);
                } else {
                  const _data = data as FrameBasedAnimationsDataByTileCount;
                  this.frameBasedAnimations.add(name, data.duration, this.tileSet, _data.firstTileId, _data.tileCount);
                }
              }
            }
          }, [this.#tileSet, this.#frameBasedAnimationsData]),
        );
      }

      if (this.atlasUrl) {
        unsubscribeOnDispose(
          createEffect(() => {
            if (this.atlasUrl) {
              fetch(this.atlasUrl)
                .then((response) => response.json())
                .then((atlasJson) => {
                  this.atlasJson = atlasJson;
                });
            }
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
                  this.frameBasedAnimations.add(name, data.duration, this.atlas, data.frameNameQuery);
                }
              }
            }
          }, [this.#atlas, this.#frameBasedAnimationsData]),
        );

        touch(this.#atlasUrl);
      }

      unsubscribeOnDispose(
        createEffect(() => {
          const renderer = this.#renderer.get();
          if (renderer) {
            this.textureFactory = new TextureFactory(renderer, this.#textureClasses.get());
          }
        }),
      );
    }
    return this;
  }
}

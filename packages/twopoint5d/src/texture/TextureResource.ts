import {emit, eventize, retain} from '@spearwolf/eventize';
import {batch, createEffect, createSignal, Signal, touch} from '@spearwolf/signalize';
import {ImageLoader, type Texture, type WebGLRenderer} from 'three';
import type {WebGPURenderer} from 'three/webgpu';
import type {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import {TexturePackerJson, type TexturePackerJsonData} from './TexturePackerJson.js';
import {TileSet, type TileSetOptions} from './TileSet.js';

export type TextureResourceType = 'image' | 'atlas' | 'tileset';
export type TextureResourceSubType = 'imageCoords' | 'atlas' | 'tileSet' | 'texture';

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
  ): TextureResource {
    const resource = new TextureResource(id, 'tileset');

    batch(() => {
      resource.imageUrl = imageUrl;
      resource.#tileSetOptions = createSignal(tileSetOptions, {compare: cmpTileSetOptions});
      resource.#tileSet = createSignal();
      resource.#atlas = createSignal();
      resource.textureClasses = textureClasses?.splice(0);
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
      resource.#atlasUrl = createSignal(atlasUrl);
      resource.#atlasJson = createSignal();
      resource.#atlas = createSignal();
      resource.#overrideImageUrl = createSignal(overrideImageUrl);
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

  #textureClasses: Signal<TextureOptionClasses[] | undefined> = createSignal(undefined, {compare: cmpTexClasses});
  #imageUrl = createSignal<string | undefined>();
  #imageCoords = createSignal<TextureCoords | undefined>(undefined, {compare: cmpTexCoords});

  #textureFactory = createSignal<TextureFactory | undefined>();
  #texture = createSignal<Texture | undefined>();
  #renderer = createSignal<WebGLRenderer | WebGPURenderer | undefined>();

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

  get renderer(): WebGLRenderer | WebGPURenderer | undefined {
    return this.#renderer.value;
  }

  set renderer(value: WebGLRenderer | WebGPURenderer | undefined) {
    this.#renderer.set(value);
  }

  #load = false;

  constructor(id: string, type: TextureResourceType) {
    eventize(this);

    this.id = id;
    this.type = type;

    retain(this, ['imageCoords', 'atlas', 'tileSet', 'texture']);
  }

  /**
   * is called by the TextureStore
   */
  rendererChanged(renderer: WebGLRenderer | WebGPURenderer | undefined) {
    this.renderer = renderer;
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

      this.#texture.onChange((value) => {
        emit(this, 'texture', value);
      });

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
          // TODO test
          if (texture) {
            // eslint-disable-next-line no-console
            console.log('dispose texture', texture);
            texture.dispose();
          }
        };
      }, [this.#textureFactory, this.#imageUrl]);

      if (this.tileSetOptions) {
        createEffect(() => {
          if (this.imageCoords && this.tileSetOptions) {
            this.tileSet = new TileSet(this.imageCoords, this.tileSetOptions);
          }
        }, [this.#imageCoords, this.#tileSetOptions]);
      }

      if (this.atlasUrl) {
        createEffect(() => {
          if (this.atlasUrl) {
            fetch(this.atlasUrl)
              .then((response) => response.json())
              .then((atlasJson) => {
                this.atlasJson = atlasJson;
              });
          }
        }, [this.#atlasUrl]);

        createEffect(() => {
          if (this.atlasJson) {
            this.imageUrl = this.overrideImageUrl ?? this.atlasJson.meta.image;
          }
        }, [this.#atlasJson, this.#overrideImageUrl]);

        createEffect(() => {
          if (this.atlasJson && this.imageCoords) {
            const [atlas] = TexturePackerJson.parse(this.atlasJson, this.imageCoords);
            this.atlas = atlas;
          }
        }, [this.#atlasJson, this.#imageCoords]);

        touch(this.#atlasUrl);
      }

      // this effect is dynamic and comes last,
      // because it can trigger the others and it is quite possible
      // that the renderer has already been set
      createEffect(() => {
        if (this.renderer) {
          this.textureFactory = new TextureFactory(this.#renderer.get(), this.#textureClasses.get());
        }
      });
    }
    return this;
  }
}

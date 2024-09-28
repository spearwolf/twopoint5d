import {emit, eventize, retain} from '@spearwolf/eventize';
import {batch, createEffect, createSignal, SignalObject, touch, value, type SignalReader} from '@spearwolf/signalize';
import {signal, signalReader} from '@spearwolf/signalize/decorators';
import {ImageLoader, type Texture, type WebGLRenderer} from 'three';
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
      resource.#createTileSetOptionsSignal(tileSetOptions);
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

  #atlasUrl?: SignalObject<string | undefined>;
  #atlasJson?: SignalObject<TexturePackerJsonData | undefined>;
  #overrideImageUrl?: SignalObject<string | undefined>;
  #atlas?: SignalObject<TextureAtlas | undefined>;
  #tileSetOptions?: SignalObject<TileSetOptions | undefined>;
  #tileSet?: SignalObject<TileSet | undefined>;
  #textureClasses: SignalObject<TextureOptionClasses[] | undefined> = createSignal(undefined, {compareFn: cmpTexClasses});

  #createTileSetOptionsSignal(tileSetOptions: TileSetOptions | undefined) {
    if (this.#tileSetOptions == null) {
      this.#tileSetOptions = createSignal(tileSetOptions, {compareFn: cmpTileSetOptions});
    }
  }

  readonly id: string;
  readonly type: TextureResourceType;

  refCount: number = 0;

  @signal({readAsValue: true}) accessor imageUrl: string | undefined;
  @signalReader() accessor imageUrl$: SignalReader<string | undefined>;

  @signal({readAsValue: true, compareFn: cmpTexCoords}) accessor imageCoords: TextureCoords | undefined;
  @signalReader() accessor imageCoords$: SignalReader<TextureCoords | undefined>;

  get atlasUrl(): string | undefined {
    return this.#atlasUrl && value(this.#atlasUrl[0]);
  }

  get atlasUrl$(): SignalReader<string | undefined> | undefined {
    return this.#atlasUrl && this.#atlasUrl[0];
  }

  set atlasUrl(value: string | undefined) {
    if (this.#atlasUrl) {
      this.#atlasUrl[1](value);
    }
  }

  get atlasJson(): TexturePackerJsonData | undefined {
    return this.#atlasJson && value(this.#atlasJson[0]);
  }

  get atlasJson$(): SignalReader<TexturePackerJsonData | undefined> | undefined {
    return this.#atlasJson && this.#atlasJson[0];
  }

  set atlasJson(value: TexturePackerJsonData | undefined) {
    if (this.#atlasJson) {
      this.#atlasJson[1](value);
    }
  }

  get overrideImageUrl(): string | undefined {
    return this.#overrideImageUrl && value(this.#overrideImageUrl[0]);
  }

  get overrideImageUrl$(): SignalReader<string | undefined> | undefined {
    return this.#overrideImageUrl && this.#overrideImageUrl[0];
  }

  set overrideImageUrl(value: string | undefined) {
    if (this.#overrideImageUrl) {
      this.#overrideImageUrl[1](value);
    }
  }

  get atlas(): TextureAtlas | undefined {
    return this.#atlas && value(this.#atlas[0]);
  }

  get atlas$(): SignalReader<TextureAtlas | undefined> | undefined {
    return this.#atlas && this.#atlas[0];
  }

  set atlas(value: TextureAtlas | undefined) {
    if (this.#atlas) {
      this.#atlas[1](value);
    }
  }

  get tileSetOptions(): TileSetOptions | undefined {
    return this.#tileSetOptions && value(this.#tileSetOptions[0]);
  }

  get tileSetOptions$(): SignalReader<TileSetOptions | undefined> | undefined {
    return this.#tileSetOptions && this.#tileSetOptions[0];
  }

  set tileSetOptions(value: TileSetOptions | undefined) {
    if (this.#tileSetOptions) {
      this.#tileSetOptions[1](value);
    }
  }

  get tileSet(): TileSet | undefined {
    return this.#tileSet && value(this.#tileSet[0]);
  }

  get tileSet$(): SignalReader<TileSet | undefined> | undefined {
    return this.#tileSet && this.#tileSet[0];
  }

  set tileSet(value: TileSet | undefined) {
    if (this.#tileSet) {
      this.#tileSet[1](value);
    }
  }

  get textureClasses(): TextureOptionClasses[] | undefined {
    return value(this.#textureClasses[0]);
  }

  get textureClasses$(): SignalReader<TextureOptionClasses[] | undefined> {
    return this.#textureClasses[0];
  }

  set textureClasses(value: TextureOptionClasses[] | undefined) {
    if (Array.isArray(value) && value.length === 0) {
      value = undefined;
    }
    this.#textureClasses[1](value);
  }

  @signal({readAsValue: true}) accessor textureFactory: TextureFactory | undefined;
  @signalReader() accessor textureFactory$: SignalReader<TextureFactory | undefined>;

  @signal({readAsValue: true}) accessor texture: Texture | undefined;
  @signalReader() accessor texture$: SignalReader<Texture | undefined>;

  @signal({readAsValue: true}) accessor renderer: WebGLRenderer | undefined;
  @signalReader() accessor renderer$: SignalReader<WebGLRenderer | undefined>;

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
  rendererChanged(renderer: WebGLRenderer | undefined) {
    this.renderer = renderer;
  }

  load(): TextureResource {
    if (!this.#load) {
      this.#load = true;

      this.imageCoords$((value) => {
        emit(this, 'imageCoords', value);
      });

      this.atlas$?.((value) => {
        emit(this, 'atlas', value);
      });

      this.tileSet$?.((value) => {
        emit(this, 'tileSet', value);
      });

      this.texture$((value) => {
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
            console.log('dispose texture', texture);
            texture.dispose();
          }
        };
      }, [this.textureFactory$, this.imageUrl$]);

      if (this.tileSetOptions) {
        createEffect(() => {
          if (this.imageCoords && this.tileSetOptions) {
            this.tileSet = new TileSet(this.imageCoords, this.tileSetOptions);
          }
        }, [this.imageCoords$, this.tileSetOptions$]);
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
        }, [this.atlasUrl$]);

        createEffect(() => {
          if (this.atlasJson) {
            this.imageUrl = this.overrideImageUrl ?? this.atlasJson.meta.image;
          }
        }, [this.atlasJson$, this.overrideImageUrl$]);

        createEffect(() => {
          if (this.atlasJson && this.imageCoords) {
            const [atlas] = TexturePackerJson.parse(this.atlasJson, this.imageCoords);
            this.atlas = atlas;
          }
        }, [this.atlasJson$, this.imageCoords$]);

        touch(this.atlasUrl$);
      }

      // this effect is dynamic and comes last,
      // because it can trigger the others and it is quite possible
      // that the renderer has already been set
      createEffect(() => {
        if (this.renderer) {
          this.textureFactory = new TextureFactory(this.renderer$(), this.textureClasses$());
        }
      });
    }
    return this;
  }
}

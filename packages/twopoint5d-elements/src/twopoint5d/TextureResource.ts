import {eventize, type Eventize} from '@spearwolf/eventize';
import {batch, createEffect, createSignal, value, type SignalFuncs, type SignalReader} from '@spearwolf/signalize';
import {
  TextureCoords,
  TextureFactory,
  TileSet,
  type TextureAtlas,
  type TextureOptionClasses,
  type TileSetOptions,
} from '@spearwolf/twopoint5d';
import {ImageLoader, type Texture, type WebGLRenderer} from 'three';

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

export interface TextureResource extends Eventize {}

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

  // TODO static fromAtlas()

  #renderer = createSignal<WebGLRenderer | undefined>();
  #imageUrl: SignalFuncs<string | undefined> = createSignal();
  #imageCoords: SignalFuncs<TextureCoords | undefined> = createSignal(undefined, {compareFn: cmpTexCoords});
  #atlasUrl?: SignalFuncs<string | undefined>;
  #atlas?: SignalFuncs<TextureAtlas | undefined>;
  #tileSetOptions?: SignalFuncs<TileSetOptions | undefined>;
  #tileSet?: SignalFuncs<TileSet | undefined>;
  #textureClasses: SignalFuncs<TextureOptionClasses[] | undefined> = createSignal(undefined, {compareFn: cmpTexClasses});
  #textureFactory: SignalFuncs<TextureFactory | undefined> = createSignal();
  #texture: SignalFuncs<Texture | undefined> = createSignal();

  #createTileSetOptionsSignal(tileSetOptions: TileSetOptions | undefined) {
    if (this.#tileSetOptions == null) {
      this.#tileSetOptions = createSignal(tileSetOptions, {compareFn: cmpTileSetOptions});
    }
  }

  readonly id: string;
  readonly type: TextureResourceType;

  refCount: number = 0;

  get imageUrl(): string | undefined {
    return value(this.#imageUrl[0]);
  }

  get imageUrl$(): SignalReader<string | undefined> {
    return this.#imageUrl[0];
  }

  set imageUrl(value: string | undefined) {
    this.#imageUrl[1](value);
  }

  get imageCoords(): TextureCoords | undefined {
    return value(this.#imageCoords[0]);
  }

  get imageCoords$(): SignalReader<TextureCoords | undefined> {
    return this.#imageCoords[0];
  }

  set imageCoords(value: TextureCoords | undefined) {
    this.#imageCoords[1](value);
  }

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

  get textureFactory(): TextureFactory | undefined {
    return value(this.#textureFactory[0]);
  }

  get textureFactory$(): SignalReader<TextureFactory | undefined> {
    return this.#textureFactory[0];
  }

  set textureFactory(value: TextureFactory | undefined) {
    this.#textureFactory[1](value);
  }

  get texture(): Texture | undefined {
    return value(this.#texture[0]);
  }

  get texture$(): SignalReader<Texture | undefined> {
    return this.#texture[0];
  }

  set texture(value: Texture | undefined) {
    this.#texture[1](value);
  }

  get renderer(): WebGLRenderer | undefined {
    return value(this.#renderer[0]);
  }

  get renderer$(): SignalReader<WebGLRenderer | undefined> {
    return this.#renderer[0];
  }

  set renderer(value: WebGLRenderer | undefined) {
    this.#renderer[1](value);
  }

  #load = false;

  constructor(id: string, type: TextureResourceType) {
    eventize(this);

    this.id = id;
    this.type = type;

    this.retain(['imageCoords', 'atlas', 'tileSet', 'texture']);
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
        this.emit('imageCoords', value);
      });

      this.atlas$?.((value) => {
        this.emit('atlas', value);
      });

      this.tileSet$?.((value) => {
        this.emit('tileSet', value);
      });

      this.texture$((value) => {
        this.emit('texture', value);
      });

      createEffect(async () => {
        if (this.textureFactory && this.imageUrl) {
          const image = await new ImageLoader().loadAsync(this.imageUrl);
          let texture: Texture | undefined;

          batch(() => {
            this.imageCoords = new TextureCoords(0, 0, image.width, image.height);

            texture = this.textureFactory.create(image);
            texture.name = this.id;
            this.texture = texture;
          });

          if (texture) {
            return () => {
              console.log('dispose texture', texture);
              texture.dispose();
            };
          }
        }
      }, [this.textureFactory$, this.imageUrl$]);

      if (this.#tileSetOptions) {
        createEffect(async () => {
          if (this.#imageCoords && this.#tileSetOptions) {
            this.tileSet = new TileSet(this.imageCoords, this.tileSetOptions);
          }
        }, [this.imageCoords$, this.tileSetOptions$]);
      }

      // TODO load atlas

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

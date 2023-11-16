import {eventize, type Eventize} from '@spearwolf/eventize';
import {batch, createEffect, createSignal, value, type SignalFuncs, type SignalReader} from '@spearwolf/signalize';
import {signal, signalReader} from '@spearwolf/signalize/decorators';
import {ImageLoader, type Texture, type WebGLRenderer} from 'three';
import type {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
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

  #atlasUrl?: SignalFuncs<string | undefined>;
  #atlas?: SignalFuncs<TextureAtlas | undefined>;
  #tileSetOptions?: SignalFuncs<TileSetOptions | undefined>;
  #tileSet?: SignalFuncs<TileSet | undefined>;
  #textureClasses: SignalFuncs<TextureOptionClasses[] | undefined> = createSignal(undefined, {compareFn: cmpTexClasses});

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

      if (this.tileSetOptions) {
        createEffect(async () => {
          if (this.imageCoords && this.tileSetOptions) {
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

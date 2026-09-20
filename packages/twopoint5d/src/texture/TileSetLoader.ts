import {Texture} from 'three/webgpu';
import {PowerOf2ImageLoader} from './PowerOf2ImageLoader.js';
import type {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import {TileSet, type TileSetOptions} from './TileSet.js';
import type {TextureSource} from './types.js';

export interface TileSetData {
  tileSet: TileSet;
  texture: Texture;
  imgEl: TextureSource;
  texCoords: TextureCoords;
}

export type TileSetLoadCallback = (tileSetData: TileSetData) => void;
export type TileSetLoadErrorCallback = ((err: unknown) => void) | undefined;

export class TileSetLoader {
  imageLoader: PowerOf2ImageLoader;
  textureFactory: TextureFactory;

  constructor(
    textureFactory: TextureFactory = new TextureFactory(),
    imageLoader: PowerOf2ImageLoader = new PowerOf2ImageLoader(),
  ) {
    this.textureFactory = textureFactory;
    this.imageLoader = imageLoader;
  }

  load(
    url: string,
    tileSetOptions: TileSetOptions,
    textureClasses: Array<TextureOptionClasses> | null | undefined,
    onLoadCallback: TileSetLoadCallback,
    onErrorCallback?: TileSetLoadErrorCallback,
  ): void {
    this.imageLoader.load(
      url,
      (imageData) => {
        // this callback runs inside the `load` event of the image, a path with no way back into
        // the promise `loadAsync()` wraps around `load()` — a throw here would leave that promise
        // pending forever, so it is turned into a call of `onErrorCallback`. The call of `onLoadCallback` stays
        // outside: a throw of the caller's own callback is no failure of the load. The texture was
        // built here and never handed out, so a failure frees it
        let texture: Texture | undefined;
        let tileSet: TileSet;
        try {
          texture = new Texture(imageData.imgEl);
          texture.name = url;

          this.textureFactory.update(texture, ...(textureClasses ?? []));

          tileSet = new TileSet(imageData.texCoords, tileSetOptions);
        } catch (error) {
          texture?.dispose();
          onErrorCallback?.(error);
          return;
        }

        onLoadCallback({
          texture,
          tileSet,
          imgEl: imageData.imgEl,
          texCoords: imageData.texCoords,
        });
      },
      onErrorCallback,
    );
  }

  loadAsync(
    url: string,
    tileSetOptions: TileSetOptions,
    textureClasses?: Array<TextureOptionClasses> | null,
  ): Promise<TileSetData> {
    return new Promise((resolve, reject) => {
      this.load(url, tileSetOptions, textureClasses, resolve, reject);
    });
  }
}

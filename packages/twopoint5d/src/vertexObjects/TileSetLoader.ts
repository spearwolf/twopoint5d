import {Texture} from 'three';

import type {TextureSource} from '../texture/types.js';
import {PowerOf2ImageLoader} from './PowerOf2ImageLoader.js';
import {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import {TileSet, type TileSetOptions} from './TileSet.js';

export interface TileSetData {
  tileSet: TileSet;
  texture: Texture;
  imgEl: TextureSource;
  texCoords: TextureCoords;
}

type OnLoadCallback = (tileSetData: TileSetData) => void;
type OnErrorCallback = ((event: Event) => void) | undefined;

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
    onLoadCallback: OnLoadCallback,
    onErrorCallback?: OnErrorCallback,
  ): void {
    this.imageLoader.load(
      url,
      (imageData) => {
        const texture = new Texture(imageData.imgEl);
        texture.name = url;

        this.textureFactory.update(texture, ...(textureClasses ?? []));

        const tileSet = new TileSet(imageData.texCoords, tileSetOptions);

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

  loadAsync(url: string, tileSetOptions: TileSetOptions, textureClasses?: Array<TextureOptionClasses>): Promise<TileSetData> {
    return new Promise((resolve, reject) => {
      this.load(url, tileSetOptions, textureClasses, resolve, reject);
    });
  }
}

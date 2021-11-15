import {Texture} from 'three';

import {PowerOf2ImageLoader} from './PowerOf2ImageLoader';
import {TextureCoords} from './TextureCoords';
import {TextureFactory} from './TextureFactory';
import {TileSet, TileSetOptions} from './TileSet';
import {TextureSource} from './types';

/**
 * @category Texture Mapping
 */
export interface TileSetData {
  tileSet: TileSet;
  texture: Texture;
  imgEl: TextureSource;
  texCoords: TextureCoords;
}

type OnLoadCallback = (tileSetData: TileSetData) => void;
type OnErrorCallback = ((event: Event) => void) | undefined;

/**
 * @category Texture Mapping
 */
export class TileSetLoader {
  imageLoader: PowerOf2ImageLoader;
  textureFactory: TextureFactory;

  constructor(textureFactory: TextureFactory, imageLoader?: PowerOf2ImageLoader) {
    this.textureFactory = textureFactory;
    this.imageLoader = imageLoader ?? new PowerOf2ImageLoader();
  }

  load(url: string, tileSetOptions: TileSetOptions, onLoadCallback: OnLoadCallback, onErrorCallback?: OnErrorCallback): void {
    this.imageLoader.load(
      url,
      (imageData) => {
        const texture = new Texture(imageData.imgEl);
        texture.name = url;

        this.textureFactory.update(texture);

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

  loadAsync(url: string, tileSetOptions: TileSetOptions): Promise<TileSetData> {
    return new Promise((resolve, reject) => {
      this.load(url, tileSetOptions, resolve, reject);
    });
  }
}

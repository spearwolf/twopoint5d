import {Texture} from 'three';

import {PowerOf2ImageLoader} from './PowerOf2ImageLoader';
import {TextureCoords} from './TextureCoords';
import {TextureFactory, TextureOptionClasses} from './TextureFactory';
import {TextureSource} from './types';

/**
 * @category Texture Mapping
 */
export interface TextureImage {
  texture: Texture;
  imgEl: TextureSource;
  texCoords: TextureCoords;
}

type OnLoadCallback = (textureData: TextureImage) => void;
type OnErrorCallback = ((event: Event) => void) | undefined;

/**
 * @category Texture Mapping
 */
export class TextureImageLoader {
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
    textureClasses: Array<TextureOptionClasses>,
    onLoadCallback: OnLoadCallback,
    onErrorCallback?: OnErrorCallback,
  ): void {
    this.imageLoader.load(
      url,
      (imageData) => {
        const texture = new Texture(imageData.imgEl);
        this.textureFactory.update(texture, ...(textureClasses ?? []));

        onLoadCallback({
          texture,
          imgEl: imageData.imgEl,
          texCoords: imageData.texCoords,
        });
      },
      onErrorCallback,
    );
  }

  loadAsync(url: string, textureClasses: Array<TextureOptionClasses>): Promise<TextureImage> {
    return new Promise((resolve, reject) => {
      this.load(url, textureClasses, resolve, reject);
    });
  }
}

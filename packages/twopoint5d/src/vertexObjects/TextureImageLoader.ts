import {Texture} from 'three';
import {TextureCoords} from '../texture/TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from '../texture/TextureFactory.js';
import type {TextureSource} from '../texture/types.js';
import {PowerOf2ImageLoader} from './PowerOf2ImageLoader.js';

export interface TextureImage {
  texture: Texture;
  imgEl: TextureSource;
  texCoords: TextureCoords;
}

type OnLoadCallback = (textureData: TextureImage) => void;
type OnErrorCallback = ((event: Event) => void) | undefined;

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

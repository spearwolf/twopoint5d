import {Texture} from 'three/webgpu';
import {PowerOf2ImageLoader} from './PowerOf2ImageLoader.js';
import type {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import type {TextureSource} from './types.js';

export interface TextureImage {
  texture: Texture;
  imgEl: TextureSource;
  texCoords: TextureCoords;
}

export type TextureImageLoadCallback = (textureData: TextureImage) => void;
export type TextureImageLoadErrorCallback = ((err: unknown) => void) | undefined;

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
    textureClasses: Array<TextureOptionClasses> | null | undefined,
    onLoadCallback: TextureImageLoadCallback,
    onErrorCallback?: TextureImageLoadErrorCallback,
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
        try {
          texture = new Texture(imageData.imgEl);
          this.textureFactory.update(texture, ...(textureClasses ?? []));
        } catch (error) {
          texture?.dispose();
          onErrorCallback?.(error);
          return;
        }

        onLoadCallback({
          texture,
          imgEl: imageData.imgEl,
          texCoords: imageData.texCoords,
        });
      },
      onErrorCallback,
    );
  }

  loadAsync(url: string, textureClasses?: Array<TextureOptionClasses> | null): Promise<TextureImage> {
    return new Promise((resolve, reject) => {
      this.load(url, textureClasses, resolve, reject);
    });
  }
}

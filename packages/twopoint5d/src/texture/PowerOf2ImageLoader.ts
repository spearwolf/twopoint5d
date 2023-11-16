import {ImageLoader} from 'three';
import {findNextPowerOf2} from '../utils/findNextPowerOf2.js';
import {isPowerOf2} from '../utils/isPowerOf2.js';
import {TextureCoords} from './TextureCoords.js';

export interface ImageWithTexCoords {
  imgEl: HTMLImageElement | HTMLCanvasElement;
  texCoords: TextureCoords;
}

type OnImageLoadCallback = (image: ImageWithTexCoords) => void;
type OnErrorCallback = ((event: Event) => void) | undefined;

export class PowerOf2ImageLoader {
  #imageLoader?: ImageLoader;

  get imageLoader(): ImageLoader {
    if (!this.#imageLoader) {
      this.#imageLoader = new ImageLoader();
    }
    return this.#imageLoader;
  }

  set imageLoader(loader: ImageLoader) {
    this.#imageLoader = loader;
  }

  load(url: string, onLoadCallback: OnImageLoadCallback, onErrorCallback?: OnErrorCallback): void {
    this.imageLoader.load(
      url,
      (img: HTMLImageElement) => {
        if (!isPowerOf2(img.width) || !isPowerOf2(img.height)) {
          const width = findNextPowerOf2(img.width);
          const height = findNextPowerOf2(img.height);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          canvas.getContext('2d')!.drawImage(img, 0, 0);

          const imgTexCoords = new TextureCoords(0, 0, width, height);
          const texCoords = new TextureCoords(imgTexCoords, 0, 0, img.width, img.height);

          onLoadCallback({imgEl: canvas, texCoords});
        } else {
          onLoadCallback({
            imgEl: img,
            texCoords: new TextureCoords(0, 0, img.width, img.height),
          });
        }
      },
      undefined,
      onErrorCallback,
    );
  }

  loadAsync(url: string): Promise<ImageWithTexCoords> {
    return new Promise((resolve, reject) => {
      this.load(url, resolve, reject);
    });
  }
}

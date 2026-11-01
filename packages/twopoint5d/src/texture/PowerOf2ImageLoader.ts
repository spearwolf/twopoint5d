import {describeValue} from '../utils/describeValue.js';
import {ImageLoader} from 'three/webgpu';
import {findNextPowerOf2} from '../utils/findNextPowerOf2.js';
import {isPowerOf2} from '../utils/isPowerOf2.js';
import {TextureCoords} from './TextureCoords.js';

/** @deprecated Belongs to the deprecated {@link PowerOf2ImageLoader}, which a `TextureStore` replaces. */
export interface ImageWithTexCoords {
  imgEl: HTMLImageElement | HTMLCanvasElement;
  texCoords: TextureCoords;
}

/** @deprecated Belongs to the deprecated {@link PowerOf2ImageLoader}, which a `TextureStore` replaces. */
export type PowerOf2ImageLoadCallback = (image: ImageWithTexCoords) => void;
/** @deprecated Belongs to the deprecated {@link PowerOf2ImageLoader}, which a `TextureStore` replaces. */
export type PowerOf2ImageLoadErrorCallback = ((err: unknown) => void) | undefined;

/**
 * Loads an image and pads it onto a canvas whose sides are powers of 2, when its own sides
 * are not.
 *
 * @deprecated Load the image through a `TextureStore` instead: a catalog item with an
 *   `imageUrl`. The padding to powers of 2 has no counterpart there — the store loads the image
 *   as it is. The class stays until a breaking release removes it.
 */
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

  /**
   * Loads the image of `url` and calls `onLoadCallback` with the image — or, when its sides are no
   * powers of 2, a canvas it is drawn onto whose sides are — and the `texCoords` of the image in it.
   * A failure goes to `onErrorCallback`. Without `onErrorCallback`, a failure — an image that does
   * not load, a padding that fails — is written to the console, and `onLoadCallback` is not called.
   */
  load(url: string, onLoadCallback: PowerOf2ImageLoadCallback, onErrorCallback?: PowerOf2ImageLoadErrorCallback): void {
    // a failure without a callback goes to the console rather than nowhere. It is not thrown: a throw
    // out of the load callback would skip the other callbacks three's ImageLoader holds for the same
    // image, and its manager.itemEnd()
    this.imageLoader.load(
      url,
      (img: HTMLImageElement) => {
        // this callback runs inside the `load` event of the image, a path with no way back into the promise
        // `loadAsync()` wraps around `load()` — a throw here would leave that promise pending forever, so it is
        // turned into a call of `onErrorCallback`. The call of `onLoadCallback` stays outside: a throw of the
        // caller's own callback is no failure of the load
        let result: ImageWithTexCoords;
        try {
          if (!isPowerOf2(img.width) || !isPowerOf2(img.height)) {
            const width = findNextPowerOf2(img.width);
            const height = findNextPowerOf2(img.height);

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const context = canvas.getContext('2d');
            if (!context) {
              throw new Error(`PowerOf2ImageLoader: no 2d context to pad ${describeValue(url)} to a power of 2`);
            }
            context.drawImage(img, 0, 0);

            const imgTexCoords = new TextureCoords(0, 0, width, height);
            const texCoords = new TextureCoords(imgTexCoords, 0, 0, img.width, img.height);

            result = {imgEl: canvas, texCoords};
          } else {
            result = {
              imgEl: img,
              texCoords: new TextureCoords(0, 0, img.width, img.height),
            };
          }
        } catch (error) {
          if (onErrorCallback) {
            onErrorCallback(error);
          } else {
            // biome-ignore lint/suspicious/noConsole: load() was given no onErrorCallback, and the failure must not vanish
            console.error(
              `PowerOf2ImageLoader: the image ${describeValue(url)} could not be padded to a power of 2, and load() was given no onErrorCallback`,
              error,
            );
          }
          return;
        }

        onLoadCallback(result);
      },
      undefined,
      onErrorCallback ??
        ((event) => {
          // biome-ignore lint/suspicious/noConsole: load() was given no onErrorCallback, and the failure must not vanish
          console.error(
            `PowerOf2ImageLoader: the image ${describeValue(url)} did not load, and load() was given no onErrorCallback`,
            event,
          );
        }),
    );
  }

  loadAsync(url: string): Promise<ImageWithTexCoords> {
    return new Promise((resolve, reject) => {
      this.load(url, resolve, reject);
    });
  }
}

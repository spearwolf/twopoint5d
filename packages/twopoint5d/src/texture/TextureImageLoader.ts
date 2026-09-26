import {Texture} from 'three/webgpu';
import {PowerOf2ImageLoader} from './PowerOf2ImageLoader.js';
import type {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import type {TextureSource} from './types.js';

/** @deprecated Belongs to the deprecated {@link TextureImageLoader}, which a `TextureStore` replaces. */
export interface TextureImage {
  texture: Texture;
  imgEl: TextureSource;
  texCoords: TextureCoords;
}

/** @deprecated Belongs to the deprecated {@link TextureImageLoader}, which a `TextureStore` replaces. */
export type TextureImageLoadCallback = (textureData: TextureImage) => void;
/** @deprecated Belongs to the deprecated {@link TextureImageLoader}, which a `TextureStore` replaces. */
export type TextureImageLoadErrorCallback = ((err: unknown) => void) | undefined;

/**
 * Loads an image and builds a texture of it, padded to powers of 2 by a
 * {@link PowerOf2ImageLoader}.
 *
 * @deprecated Use a `TextureStore`: a catalog item with an `imageUrl`, read with
 *   `getAsync(id, ['texture', 'imageCoords'])`. The store loads the image without padding it, its
 *   `imageCoords` are the root of the image, and it starts from no texture class where this
 *   loader starts from `nearest`; the texture belongs to the store. The class stays until a
 *   breaking release removes it.
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

  /**
   * Load the image at `url` and call `onLoadCallback` with a texture of it, the texture
   * classes applied, the image and its coordinates. A load that fails reaches the caller
   * through `onErrorCallback`.
   *
   * The texture handed out is built for this call and kept by no one else: the caller owns
   * it and disposes it.
   */
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
          texture.name = url;
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

  /**
   * {@link TextureImageLoader.load} as a promise: it resolves with the texture, the image and
   * its coordinates, and rejects when the load fails.
   *
   * The texture handed out is built for this call and kept by no one else: the caller owns
   * it and disposes it.
   */
  loadAsync(url: string, textureClasses?: Array<TextureOptionClasses> | null): Promise<TextureImage> {
    return new Promise((resolve, reject) => {
      this.load(url, textureClasses, resolve, reject);
    });
  }
}

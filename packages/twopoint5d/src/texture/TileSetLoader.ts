import {Texture} from 'three/webgpu';
import {PowerOf2ImageLoader} from './PowerOf2ImageLoader.js';
import type {TextureCoords} from './TextureCoords.js';
import {TextureFactory, type TextureOptionClasses} from './TextureFactory.js';
import {TileSet, type TileSetOptions} from './TileSet.js';
import type {TextureSource} from './types.js';

/** @deprecated Belongs to the deprecated {@link TileSetLoader}, which a `TextureStore` replaces. */
export interface TileSetData {
  tileSet: TileSet;
  texture: Texture;
  imgEl: TextureSource;
  texCoords: TextureCoords;
}

/** @deprecated Belongs to the deprecated {@link TileSetLoader}, which a `TextureStore` replaces. */
export type TileSetLoadCallback = (tileSetData: TileSetData) => void;
/** @deprecated Belongs to the deprecated {@link TileSetLoader}, which a `TextureStore` replaces. */
export type TileSetLoadErrorCallback = ((err: unknown) => void) | undefined;

/**
 * Loads an image and lays a tile set over it, with a texture of the image.
 *
 * @deprecated Use a `TextureStore`: a catalog item with an `imageUrl` and a `tileSet`, read
 *   with `getAsync(id, ['tileSet', 'texture'])`. The store loads the image without padding it to
 *   powers of 2, lays the tiles out from the root of the image, and starts from no texture class
 *   where this loader starts from `nearest`; the texture belongs to the store. The class stays
 *   until a breaking release removes it.
 */
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

  /**
   * Load the image at `url` and call `onLoadCallback` with a tile set laid out over it, a
   * texture of it with the texture classes applied, the image and its coordinates. A load
   * that fails, and tile set options that `TileSet` refuses, reach the caller through
   * `onErrorCallback`.
   *
   * The texture handed out is built for this call and kept by no one else: the caller owns
   * it and disposes it.
   */
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

  /**
   * {@link TileSetLoader.load} as a promise: it resolves with the tile set, the texture, the
   * image and its coordinates, and rejects when the load fails or `TileSet` refuses the
   * options.
   *
   * The texture handed out is built for this call and kept by no one else: the caller owns
   * it and disposes it.
   */
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

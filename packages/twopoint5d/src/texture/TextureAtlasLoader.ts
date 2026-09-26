import {FileLoader} from 'three/webgpu';
import {isAtlasJsonResponse} from './isAtlasJsonResponse.js';
import {resolveRelativeUrl} from './resolveRelativeUrl.js';
import type {TextureAtlas} from './TextureAtlas.js';
import type {TextureOptionClasses} from './TextureFactory.js';
import {TextureImageLoader, type TextureImage} from './TextureImageLoader.js';
import {TexturePackerJson, type TexturePackerJsonData, type TexturePackerMetaData} from './TexturePackerJson.js';

/** @deprecated Belongs to the deprecated {@link TextureAtlasLoader}, which a `TextureStore` replaces. */
export interface TextureAtlasData extends TextureImage {
  atlas: TextureAtlas;
  /** The meta block of the atlas json, with `image` naming the image url the texture was loaded from. */
  meta: TexturePackerMetaData;
}

/** @deprecated Belongs to the deprecated {@link TextureAtlasLoader}, which a `TextureStore` replaces. */
export interface TextureAtlasLoadOptions {
  /** The image url to load, instead of the one the atlas json names — taken as written, not resolved against the atlas url. */
  overrideImageUrl?: string;
}

/** @deprecated Belongs to the deprecated {@link TextureAtlasLoader}, which a `TextureStore` replaces. */
export type TextureAtlasLoadCallback = (textureData: TextureAtlasData) => void;
/** @deprecated Belongs to the deprecated {@link TextureAtlasLoader}, which a `TextureStore` replaces. */
export type TextureAtlasLoadErrorCallback = ((err: unknown) => void) | undefined;

const makeFileLoader = () => {
  const loader = new FileLoader();
  loader.setResponseType('json');
  return loader;
};

/**
 * Loads a TexturePacker atlas json and the image it names, and builds the atlas and a texture.
 *
 * @deprecated Use a `TextureStore`: a catalog item with an `atlasUrl` — and an
 *   `overrideImageUrl` in place of `options.overrideImageUrl` —, read with
 *   `getAsync(id, ['atlas', 'texture'])`. The store loads the image without padding it to powers
 *   of 2 and starts from no texture class where this loader starts from `nearest`; the texture
 *   belongs to the store. The class stays until a breaking release removes it.
 */
export class TextureAtlasLoader {
  fileLoader: FileLoader;
  textureImageLoader: TextureImageLoader;

  constructor(defaults?: {fileLoader?: FileLoader; textureImageLoader?: TextureImageLoader}) {
    this.fileLoader = defaults?.fileLoader ?? makeFileLoader();
    this.textureImageLoader = defaults?.textureImageLoader ?? new TextureImageLoader();
  }

  /**
   * Load the atlas json at `url` and the image it names, and call `onLoadCallback` with the
   * atlas, the `meta` of the json, the texture and the image. A relative `meta.image` is
   * resolved against the url the json came from — the `path` of the `fileLoader` followed by
   * `url` —, so it names the file next to the json; an `overrideImageUrl` is taken as written.
   * A load that fails reaches the caller through `onErrorCallback`.
   *
   * A directory both files lie in belongs on the `fileLoader`, as its `path`. The image loader
   * behind `textureImageLoader` stays without one: three.js puts a loader's `path` in front of
   * every url it loads, the resolved one included, which is already absolute.
   *
   * The texture handed out is built for this call and kept by no one else: the caller owns
   * it and disposes it.
   */
  load(
    url: string,
    textureClasses: Array<TextureOptionClasses> | null | undefined,
    options: TextureAtlasLoadOptions | undefined,
    onLoadCallback: TextureAtlasLoadCallback,
    onErrorCallback?: TextureAtlasLoadErrorCallback,
  ): void {
    this.fileLoader.load(
      url,
      // the guard needs an `unknown` to work on: `FileLoader#load` declares its callback as
      // `(data: string | ArrayBuffer)`, and narrowing that declaration leaves an intersection with
      // `string` standing, out of which no object can be built
      (jsonData: unknown) => {
        if (!isAtlasJsonResponse(jsonData)) {
          onErrorCallback?.(new Error(`TextureAtlasLoader: the response of "${url}" is no texture atlas json`));
          return;
        }

        // the json came from here: three.js puts the `path` of a loader in front of the url it
        // is asked for, and that `path` is an empty string unless one was set
        const jsonUrl = this.fileLoader.path + url;
        const imageUrl =
          options?.overrideImageUrl ??
          (typeof jsonData.meta.image === 'string' ? resolveRelativeUrl(jsonData.meta.image, jsonUrl) : undefined);
        if (typeof imageUrl !== 'string') {
          onErrorCallback?.(
            new Error(`TextureAtlasLoader: the response of "${url}" names no image and no overrideImageUrl was given`),
          );
          return;
        }

        // the resolved url goes into the json, so the `meta` handed to the caller names the image
        // the texture was built from, whether the json or an override picked it
        const atlasJson: TexturePackerJsonData = {...jsonData, meta: {...jsonData.meta, image: imageUrl}};

        this.textureImageLoader.load(
          imageUrl,
          textureClasses,
          ({texture, imgEl, texCoords}) => {
            // this callback runs inside the `load` event of the image, a path with no way
            // back into the promise `loadAsync()` wraps around `load()` — a throw here would
            // leave that promise pending forever, so it is turned into a call instead
            let parsed: ReturnType<typeof TexturePackerJson.parse>;
            try {
              parsed = TexturePackerJson.parse(atlasJson, texCoords);
            } catch (error) {
              // the loader holds this texture and hands it out with the atlas beside it: on this
              // path no atlas is built, nobody else gets to see the texture — `onErrorCallback`
              // carries the error, not the texture — so it is released here
              texture.dispose();
              onErrorCallback?.(error);
              return;
            }

            const [atlas, meta] = parsed;
            onLoadCallback({atlas, meta, texture, imgEl, texCoords});
          },
          onErrorCallback,
        );
      },
      undefined,
      onErrorCallback,
    );
  }

  /**
   * {@link TextureAtlasLoader.load} as a promise: it resolves with the atlas, the `meta` of
   * the json, the texture and the image, and rejects when the load fails. A relative
   * `meta.image` is resolved against the url the json came from, the `path` of the
   * `fileLoader` followed by `url`; an `overrideImageUrl` is taken as written. A directory
   * both files lie in belongs on the `fileLoader`, and the image loader stays without a
   * `path`, as {@link TextureAtlasLoader.load} sets out.
   *
   * The texture handed out is built for this call and kept by no one else: the caller owns
   * it and disposes it.
   */
  loadAsync(
    url: string,
    textureClasses?: Array<TextureOptionClasses> | null,
    options?: TextureAtlasLoadOptions,
  ): Promise<TextureAtlasData> {
    return new Promise((resolve, reject) => {
      this.load(url, textureClasses, options, resolve, reject);
    });
  }
}

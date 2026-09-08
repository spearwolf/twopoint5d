import {FileLoader} from 'three/webgpu';
import {isAtlasJsonResponse} from './isAtlasJsonResponse.js';
import type {TextureAtlas} from './TextureAtlas.js';
import type {TextureOptionClasses} from './TextureFactory.js';
import {TextureImageLoader, type TextureImage} from './TextureImageLoader.js';
import {TexturePackerJson, type TexturePackerJsonData, type TexturePackerMetaData} from './TexturePackerJson.js';

export interface TextureAtlasData extends TextureImage {
  atlas: TextureAtlas;
  /** The meta block of the atlas json, with `image` naming the image url the texture was loaded from. */
  meta: TexturePackerMetaData;
}

export interface TextureAtlasLoadOptions {
  /** The image url to load, instead of the one the atlas json names. */
  overrideImageUrl?: string;
}

export type TextureAtlasLoadCallback = (textureData: TextureAtlasData) => void;
export type TextureAtlasLoadErrorCallback = ((err: unknown) => void) | undefined;

const makeFileLoader = () => {
  const loader = new FileLoader();
  loader.setResponseType('json');
  return loader;
};

export class TextureAtlasLoader {
  fileLoader: FileLoader;
  textureImageLoader: TextureImageLoader;

  constructor(defaults?: {fileLoader?: FileLoader; textureImageLoader?: TextureImageLoader}) {
    this.fileLoader = defaults?.fileLoader ?? makeFileLoader();
    this.textureImageLoader = defaults?.textureImageLoader ?? new TextureImageLoader();
  }

  load(
    url: string,
    textureClasses: Array<TextureOptionClasses> | undefined,
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

        const imageUrl = options?.overrideImageUrl ?? jsonData.meta.image;
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
          textureClasses ?? [],
          ({texture, imgEl, texCoords}) => {
            // this callback runs inside the `load` event of the image, a path with no way
            // back into the promise `loadAsync()` wraps around `load()` — a throw here would
            // leave that promise pending forever, so it is turned into a call instead
            let parsed: ReturnType<typeof TexturePackerJson.parse>;
            try {
              parsed = TexturePackerJson.parse(atlasJson, texCoords);
            } catch (error) {
              onErrorCallback?.(error);
              return;
            }

            const [atlas, meta] = parsed;
            onLoadCallback({atlas, meta, texture, imgEl, texCoords});
          },
          onErrorCallback,
        );
      },
      (_xhr) => {
        // TODO add optional onProgressCallback parameter?
        // console.log(`${(xhr.loaded / xhr.total) * 100}% loaded`);
      },
      onErrorCallback,
    );
  }

  loadAsync(
    url: string,
    textureClasses?: Array<TextureOptionClasses>,
    options?: TextureAtlasLoadOptions,
  ): Promise<TextureAtlasData> {
    return new Promise((resolve, reject) => {
      this.load(url, textureClasses, options, resolve, reject);
    });
  }
}

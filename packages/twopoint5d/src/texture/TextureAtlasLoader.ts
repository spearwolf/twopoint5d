import {FileLoader} from 'three/webgpu';
import type {TextureAtlas} from './TextureAtlas.js';
import type {TextureOptionClasses} from './TextureFactory.js';
import {TextureImageLoader, type TextureImage} from './TextureImageLoader.js';
import {
  TexturePackerJson,
  type TexturePackerFrameData,
  type TexturePackerJsonData,
  type TexturePackerMetaData,
} from './TexturePackerJson.js';

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

// The atlas json as it arrives from a url: everything a texture packer json carries, except that
// the image url may be missing — an `overrideImageUrl` answers for it just as well. Once the url
// is resolved the response becomes a full `TexturePackerJsonData`.
type AtlasJsonResponse = Omit<TexturePackerJsonData, 'meta'> & {
  meta: Omit<TexturePackerMetaData, 'image'> & {image?: string};
};

// `setResponseType('json')` hands the callback a parsed object, and what that object carries is
// whatever the url answered with — so it is checked before it is read. Every property the check
// lets through is one the loader and its callers may rely on afterwards.
const isFrameData = (value: unknown): value is TexturePackerFrameData => {
  if (typeof value !== 'object' || value == null) return false;
  const {frame} = value as Partial<TexturePackerFrameData>;
  if (typeof frame !== 'object' || frame == null) return false;
  return typeof frame.x === 'number' && typeof frame.y === 'number' && typeof frame.w === 'number' && typeof frame.h === 'number';
};

const isAtlasJsonResponse = (value: unknown): value is AtlasJsonResponse => {
  if (typeof value !== 'object' || value == null) return false;
  const {frames, meta} = value as Partial<AtlasJsonResponse>;
  if (typeof frames !== 'object' || frames == null) return false;
  if (!Object.values(frames).every(isFrameData)) return false;
  if (typeof meta !== 'object' || meta == null) return false;
  const {size} = meta;
  return typeof size === 'object' && size != null && typeof size.w === 'number' && typeof size.h === 'number';
};

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
            const [atlas, meta] = TexturePackerJson.parse(atlasJson, texCoords);

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

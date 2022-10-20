import {FileLoader} from 'three';
import {TextureAtlas} from './TextureAtlas';
import {TextureOptionClasses} from './TextureFactory';
import {TextureImage, TextureImageLoader} from './TextureImageLoader';
import {TexturePackerJson, TexturePackerJsonData, TexturePackerMetaData} from './TexturePackerJson';

/**
 * @category Texture Mapping
 */
export interface TextureAtlasData extends TextureImage {
  atlas: TextureAtlas;
  meta: TexturePackerMetaData;
}

/**
 * @category Texture Mapping
 */
export interface TextureAtlasLoadOptions {
  overrideImageUrl?: string;
}

type OnLoadCallback = (textureData: TextureAtlasData) => void;
type OnErrorCallback = ((event: Event) => void) | undefined;

const makeFileLoader = () => {
  const loader = new FileLoader();
  loader.setResponseType('json');
  return loader;
};

/**
 * @category Texture Mapping
 */
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
    onLoadCallback: OnLoadCallback,
    onErrorCallback?: OnErrorCallback,
  ): void {
    this.fileLoader.load(
      url,
      (jsonData: any) => {
        const imageUrl = options?.overrideImageUrl ?? (jsonData as TexturePackerJsonData).meta.image;

        this.textureImageLoader.load(
          imageUrl,
          textureClasses,
          ({texture, imgEl, texCoords}) => {
            const [atlas, meta] = TexturePackerJson.parse(jsonData, texCoords);

            onLoadCallback({atlas, meta, texture, imgEl, texCoords});
          },
          onErrorCallback,
        );
      },
      (_xhr) => {
        // TODO progress callback?
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

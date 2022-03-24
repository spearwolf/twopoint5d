import {TextureAtlasData, TextureAtlasLoader, TextureAtlasLoadOptions, TextureOptionClasses} from '@spearwolf/vertex-objects';
import {useState} from 'react';
import {useAsyncEffect} from './useAsyncEffect';

export const useTextureAtlas = (
  url: string,
  textureClasses?: Array<TextureOptionClasses>,
  options?: TextureAtlasLoadOptions,
): Partial<TextureAtlasData> => {
  const [atlasData, setAtlasData] = useState<Partial<TextureAtlasData>>({});

  const overrideImageUrl = options?.overrideImageUrl;

  useAsyncEffect(
    async () =>
      url
        ? new TextureAtlasLoader().loadAsync(url, textureClasses, {
            overrideImageUrl,
          })
        : undefined,
    {
      next(data) {
        setAtlasData(data ?? {});
      },
      cancel(data) {
        console.log('cancel texture-atlas', data);
        data.texture?.dispose();
      },
      dispose(data) {
        console.log('dispose texture-atlas', data);
        data.texture?.dispose();
      },
    },
    [url, overrideImageUrl],
  );

  // TODO update on textureClasses
  // - add textureFactory to TextureAtlasData -> TextureAtlasLoaderResult
  // - update texture
  // - effect deps: [atlasData.texture, atlasData.textureFactory, textureClasses?.join()]

  return atlasData;
};

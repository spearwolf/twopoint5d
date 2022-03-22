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

  useAsyncEffect(async () => {
    if (url) {
      // TODO handle updates ... ?
      const data = await new TextureAtlasLoader().loadAsync(url, textureClasses, {
        overrideImageUrl,
      });
      setAtlasData(data);
      // TODO dispose?!
    }
  }, [url, overrideImageUrl]);

  return atlasData;
};

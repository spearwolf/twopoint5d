import {TextureAtlas} from '@spearwolf/vertex-objects';
import {useContext, useEffect, useState} from 'react';
import {AssetName, TextureStoreContext} from '../context/TextureStore';

export function useTextureAtlas(name: AssetName): TextureAtlas | undefined {
  const textureStore = useContext(TextureStoreContext);
  const [curTextureAtlas, setTextureAtlas] = useState<TextureAtlas>();

  useEffect(() => {
    const atlas = textureStore.getTextureAtlas(name);
    if (atlas) {
      setTextureAtlas(atlas);
    }
    return textureStore.on('asset:insert', (assetName: AssetName) => {
      if (name === assetName) {
        const nextAtlas = textureStore.getTextureAtlas(name);
        if (nextAtlas !== curTextureAtlas) {
          setTextureAtlas(nextAtlas);
        }
      }
    });
  }, [textureStore, name]);

  return curTextureAtlas;
}

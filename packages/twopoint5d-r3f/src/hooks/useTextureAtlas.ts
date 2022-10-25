import {TextureAtlas} from 'twopoint5d';
import {useContext, useEffect, useState} from 'react';
import {AssetName, AssetStoreContext} from '../context/AssetStore';

export function useTextureAtlas(name: AssetName): TextureAtlas | undefined {
  const assetStore = useContext(AssetStoreContext);
  const [curTextureAtlas, setTextureAtlas] = useState<TextureAtlas>();

  useEffect(() => {
    const atlas = assetStore.getTextureAtlas(name);
    if (atlas) {
      setTextureAtlas(atlas);
    }
    return assetStore.on('asset:insert', (assetName: AssetName) => {
      if (name === assetName) {
        const nextAtlas = assetStore.getTextureAtlas(name);
        if (nextAtlas !== curTextureAtlas) {
          setTextureAtlas(nextAtlas);
        }
      }
    });
  }, [assetStore, name]);

  return curTextureAtlas;
}

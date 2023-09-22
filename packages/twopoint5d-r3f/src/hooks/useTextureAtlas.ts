import {TextureAtlas} from '@spearwolf/twopoint5d';
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
    return assetStore.onAssetInsert(name, () => {
      const nextAtlas = assetStore.getTextureAtlas(name);
      if (nextAtlas !== curTextureAtlas) {
        setTextureAtlas(nextAtlas);
      }
    });
  }, [assetStore, name]);

  return curTextureAtlas;
}

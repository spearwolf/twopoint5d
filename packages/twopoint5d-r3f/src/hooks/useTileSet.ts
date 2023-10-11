import {TileSet} from '@spearwolf/twopoint5d';
import {useContext, useEffect, useState} from 'react';
import {AssetStoreContext, type AssetName} from '../context/AssetStore.js';

export function useTileSet(name: AssetName): TileSet | undefined {
  const assetStore = useContext(AssetStoreContext);
  const [curTileSet, setTileSet] = useState<TileSet>();

  useEffect(() => {
    const tileSet = assetStore.getTileSet(name);
    if (tileSet) {
      setTileSet(tileSet);
    }
    return assetStore.onAssetInsert(name, () => {
      const nextTileSet = assetStore.getTileSet(name);
      if (nextTileSet !== curTileSet) {
        setTileSet(nextTileSet);
      }
    });
  }, [assetStore, name]);

  return curTileSet;
}

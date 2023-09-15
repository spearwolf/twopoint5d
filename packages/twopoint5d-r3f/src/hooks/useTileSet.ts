import {TileSet} from '@twopoint5d/core';
import {useContext, useEffect, useState} from 'react';
import {AssetName, AssetStoreContext} from '../context/AssetStore';

export function useTileSet(name: AssetName): TileSet | undefined {
  const assetStore = useContext(AssetStoreContext);
  const [curTileSet, setTileSet] = useState<TileSet>();

  useEffect(() => {
    const tileSet = assetStore.getTileSet(name);
    if (tileSet) {
      setTileSet(tileSet);
    }
    return assetStore.on('asset:insert', (assetName: AssetName) => {
      if (name === assetName) {
        const nextTileSet = assetStore.getTileSet(name);
        if (nextTileSet !== curTileSet) {
          setTileSet(nextTileSet);
        }
      }
    });
  }, [assetStore, name]);

  return curTileSet;
}

import {TileSet} from '@spearwolf/vertex-objects';
import {useContext, useEffect, useState} from 'react';
import {AssetName, TextureStoreContext} from '../context/TextureStore';

export function useTileSet(name: AssetName): TileSet | undefined {
  const textureStore = useContext(TextureStoreContext);
  const [curTileSet, setTileSet] = useState<TileSet>();

  useEffect(() => {
    const tileSet = textureStore.getTileSet(name);
    if (tileSet) {
      setTileSet(tileSet);
    }
    return textureStore.on('asset:insert', (assetName: AssetName) => {
      if (name === assetName) {
        const nextTileSet = textureStore.getTileSet(name);
        if (nextTileSet !== curTileSet) {
          setTileSet(nextTileSet);
        }
      }
    });
  }, [textureStore, name]);

  return curTileSet;
}

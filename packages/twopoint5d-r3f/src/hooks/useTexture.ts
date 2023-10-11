import {useContext, useEffect, useRef, useState} from 'react';
import {Texture} from 'three';
import {AssetStore, AssetStoreContext, type AssetName} from '../context/AssetStore.js';

interface TextureState {
  lastName: AssetName | undefined;
  lastAssetStore: AssetStore | undefined;
}

export function useTexture(name: AssetName): Texture | undefined {
  const stateRef = useRef<TextureState>({lastName: undefined, lastAssetStore: undefined});
  const assetStore = useContext(AssetStoreContext);
  const [curTexture, setTexture] = useState<Texture>();

  useEffect(() => {
    const texture = assetStore.getTextureRef(name);
    const state_ = stateRef.current;

    if (state_.lastName && (state_.lastName !== name || (state_.lastAssetStore && state_.lastAssetStore !== assetStore))) {
      state_.lastAssetStore?.disposeTextureRef(state_.lastName);
      state_.lastName = undefined;
    }

    if (texture) {
      if (name !== state_.lastName) {
        state_.lastName = name;
        assetStore.incTextureRefCount(name);
      }
      state_.lastAssetStore = assetStore;
      setTexture(texture);
    } else if (state_.lastName) {
      assetStore.disposeTextureRef(state_.lastName);
      state_.lastName = undefined;
    }

    // TODO assetStore -> on asset destroy?
    // TODO decTextureRefCount ?
    return assetStore.onAssetInsert(name, () => {
      const nextTexture = assetStore.getTextureRef(name);
      if (nextTexture !== curTexture) {
        if (name !== state_.lastName) {
          state_.lastName = name;
          assetStore.incTextureRefCount(name);
        }
        state_.lastAssetStore = assetStore;
        setTexture(nextTexture);
      }
    });
  }, [assetStore, name]);

  useEffect(
    () => () => {
      if (stateRef.current.lastName) {
        stateRef.current.lastAssetStore?.disposeTextureRef(stateRef.current.lastName);
        stateRef.current.lastName = undefined;
      }
    },
    [],
  );

  return curTexture;
}

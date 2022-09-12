import {useContext, useEffect, useRef, useState} from 'react';
import {Texture} from 'three';
import {AssetName, TextureStore, TextureStoreContext} from '../context/TextureStore';

interface TextureState {
  lastName: AssetName | undefined;
  lastTextureStore: TextureStore | undefined;
}

export function useTexture(name: AssetName): Texture | undefined {
  const stateRef = useRef<TextureState>({lastName: undefined, lastTextureStore: undefined});
  const textureStore = useContext(TextureStoreContext);
  const [curTexture, setTexture] = useState<Texture>();

  useEffect(() => {
    const texture = textureStore.getTextureRef(name);
    const state_ = stateRef.current;

    if (state_.lastName && (state_.lastName !== name || (state_.lastTextureStore && state_.lastTextureStore !== textureStore))) {
      state_.lastTextureStore?.disposeTextureRef(state_.lastName);
      state_.lastName = undefined;
    }

    if (texture) {
      if (name !== state_.lastName) {
        state_.lastName = name;
        textureStore.incTextureRefCount(name);
      }
      state_.lastTextureStore = textureStore;
      setTexture(texture);
    } else if (state_.lastName) {
      textureStore.disposeTextureRef(state_.lastName);
      state_.lastName = undefined;
    }

    // TODO textureStore -> on asset destroy?
    return textureStore.on('asset:insert', (assetName: AssetName) => {
      if (name === assetName) {
        const nextTexture = textureStore.getTextureRef(name);
        if (nextTexture !== curTexture) {
          if (name !== state_.lastName) {
            state_.lastName = name;
            textureStore.incTextureRefCount(name);
          }
          state_.lastTextureStore = textureStore;
          setTexture(nextTexture);
        }
      }
    });
  }, [textureStore, name]);

  useEffect(
    () => () => {
      if (stateRef.current.lastName) {
        stateRef.current.lastTextureStore?.disposeTextureRef(stateRef.current.lastName);
        stateRef.current.lastName = undefined;
      }
    },
    [],
  );

  return curTexture;
}

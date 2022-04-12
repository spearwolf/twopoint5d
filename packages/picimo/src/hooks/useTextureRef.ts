import {useContext, useEffect, useState} from 'react';
import {Texture} from 'three';
import {AssetName, TextureStoreContext} from '../context/TextureStore';

export function useTextureRef(name: AssetName): Texture | undefined {
  const textureStore = useContext(TextureStoreContext);
  const [curTexture, setTexture] = useState<Texture>();

  useEffect(() => {
    const texture = textureStore.getTextureRef(name);
    if (texture) {
      setTexture(texture);
    }
    return textureStore.on('asset:insert', (assetName: AssetName) => {
      if (name === assetName) {
        const nextTexture = textureStore.getTextureRef(name);
        if (nextTexture !== curTexture) {
          setTexture(nextTexture);
        }
      }
    });
  }, [textureStore, name]);

  useEffect(
    () => () => {
      if (curTexture) {
        textureStore?.disposeTextureRef(curTexture.name);
      }
    },
    [textureStore, curTexture],
  );

  return curTexture;
}

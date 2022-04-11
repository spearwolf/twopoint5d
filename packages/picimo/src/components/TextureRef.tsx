import '@react-three/fiber';
import {ForwardedRef, forwardRef, useContext, useEffect, useState} from 'react';
import {Texture} from 'three';
import {AssetName, TextureStoreContext} from '../context/TextureStore';

export type TextureRefProps = JSX.IntrinsicElements['texture'] & {
  name: string | symbol;
};

function Component({name, children, ...props}: TextureRefProps, ref: ForwardedRef<Texture>) {
  const textureStore = useContext(TextureStoreContext);
  const [texture, setTexture] = useState<Texture>();

  useEffect(() => {
    const tex = textureStore.getTextureRef(name);
    if (tex) {
      setTexture(tex);
    }
    return textureStore.on(['asset:create', 'asset:update'], (assetName: AssetName) => {
      if (name === assetName) {
        setTexture(textureStore.getTextureRef(name));
      }
    });
  }, [textureStore, name]);

  useEffect(
    () => () => {
      if (texture) {
        textureStore?.disposeTextureRef(texture.name);
      }
    },
    [textureStore, texture],
  );

  return texture ? (
    <primitive object={texture} ref={ref} {...props}>
      {children}
    </primitive>
  ) : null;
}

Component.displayName = 'TextureRef';

export const TextureRef = forwardRef<Texture, TextureRefProps>(Component);

import '@react-three/fiber';
import {forwardRef, type ForwardedRef} from 'react';
import {Texture} from 'three';
import {useTexture} from '../hooks/useTexture.js';

export type TextureRefProps = JSX.IntrinsicElements['texture'] & {
  name: string | symbol;
};

function Component({name, children, ...props}: TextureRefProps, ref: ForwardedRef<Texture>) {
  const texture = useTexture(name);

  return texture ? (
    <primitive object={texture} ref={ref} {...props}>
      {children}
    </primitive>
  ) : null;
}

Component.displayName = 'TextureRef';

export const TextureRef = forwardRef<Texture, TextureRefProps>(Component);

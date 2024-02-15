import {extend, ReactThreeFiber, useFrame} from '@react-three/fiber';
import {TexturedSprites as __TexturedSprites} from '@spearwolf/twopoint5d';
import {forwardRef, useRef, type ForwardedRef} from 'react';
import {mergeRefs} from '../utils/mergeRefs.js';

extend({TexturedSprites: __TexturedSprites});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      texturedSprites: ReactThreeFiber.Object3DNode<__TexturedSprites, typeof __TexturedSprites>;
    }
  }
}

export type TexturedSpritesProps = JSX.IntrinsicElements['texturedSprites'];

function Component({children, ...props}: TexturedSpritesProps, ref: ForwardedRef<__TexturedSprites>) {
  const texturedSpritesRef = useRef<__TexturedSprites>(null);

  useFrame(() => {
    texturedSpritesRef.current?.update();
  });

  return (
    <texturedSprites {...props} ref={mergeRefs(texturedSpritesRef, ref)}>
      {children}
    </texturedSprites>
  );
}

Component.displayName = 'TexturedSprites';

export const TexturedSprites = forwardRef<__TexturedSprites, TexturedSpritesProps>(Component);

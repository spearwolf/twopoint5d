import {extend, ReactThreeFiber} from '@react-three/fiber';
import {TexturedSprites as __TexturedSprites} from '@twopoint5d/core';
import {ForwardedRef, forwardRef} from 'react';

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
  return (
    <texturedSprites {...props} ref={ref}>
      {children}
    </texturedSprites>
  );
}

Component.displayName = 'TexturedSprites';

export const TexturedSprites = forwardRef<__TexturedSprites, TexturedSpritesProps>(Component);

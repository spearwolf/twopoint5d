import {extend, ReactThreeFiber} from '@react-three/fiber';
import {TexturedSprites as __TexturedSprites} from '@spearwolf/textured-sprites';
import {forwardRef, Ref} from 'react';

extend({TexturedSprites: __TexturedSprites});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      texturedSprites: ReactThreeFiber.Object3DNode<__TexturedSprites, typeof __TexturedSprites & JSX.IntrinsicElements['mesh']>;
    }
  }
}

export type TexturedSpritesParams = JSX.IntrinsicElements['texturedSprites'];

function Component({children, ...props}: TexturedSpritesParams, ref: Ref<__TexturedSprites>) {
  return (
    <texturedSprites {...props} ref={ref}>
      {children}
    </texturedSprites>
  );
}

Component.displayName = 'TexturedSprites';

export const TexturedSprites = forwardRef<__TexturedSprites, TexturedSpritesParams>(Component);

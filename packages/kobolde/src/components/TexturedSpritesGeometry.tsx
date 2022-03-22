import {extend, ReactThreeFiber} from '@react-three/fiber';
import {TexturedSpritesGeometry as __TexturedSpritesGeometry} from '@spearwolf/textured-sprites';
import {forwardRef, Ref} from 'react';

extend({TexturedSpritesGeometry: __TexturedSpritesGeometry});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      texturedSpritesGeometry: ReactThreeFiber.Object3DNode<
        __TexturedSpritesGeometry,
        typeof __TexturedSpritesGeometry & JSX.IntrinsicElements['instancedBufferGeometry']
      >;
    }
  }
}

export type TexturedSpritesGeometryParams = {
  capacity: number;
} & JSX.IntrinsicElements['texturedSpritesGeometry'];

function Component({capacity, children, ...props}: TexturedSpritesGeometryParams, ref: Ref<__TexturedSpritesGeometry>) {
  return (
    <texturedSpritesGeometry args={[capacity]} ref={ref} {...props}>
      {children}
    </texturedSpritesGeometry>
  );
}

Component.displayName = 'TexturedSpritesGeometry';

export const TexturedSpritesGeometry = forwardRef<__TexturedSpritesGeometry, TexturedSpritesGeometryParams>(Component);

import {extend, ReactThreeFiber} from '@react-three/fiber';
import {TexturedSpritesGeometry as __TexturedSpritesGeometry} from '@spearwolf/textured-sprites';
import {ForwardedRef, forwardRef} from 'react';

extend({TexturedSpritesGeometry: __TexturedSpritesGeometry});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      texturedSpritesGeometry: ReactThreeFiber.BufferGeometryNode<__TexturedSpritesGeometry, typeof __TexturedSpritesGeometry>;
    }
  }
}

export type TexturedSpritesGeometryProps = JSX.IntrinsicElements['texturedSpritesGeometry'] & {
  capacity: number;
};

function Component({capacity, children, ...props}: TexturedSpritesGeometryProps, ref: ForwardedRef<__TexturedSpritesGeometry>) {
  return (
    <texturedSpritesGeometry args={[capacity]} ref={ref as any} {...props}>
      {children}
    </texturedSpritesGeometry>
  );
}

Component.displayName = 'TexturedSpritesGeometry';

export const TexturedSpritesGeometry = forwardRef<__TexturedSpritesGeometry, TexturedSpritesGeometryProps>(Component);

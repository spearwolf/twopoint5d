import {extend, ReactThreeFiber} from '@react-three/fiber';
import {TileSpritesMaterial as __TileSpritesMaterial} from '@twopoint5d/core';
import {ForwardedRef, forwardRef} from 'react';

extend({TileSpritesMaterial: __TileSpritesMaterial});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      tileSpritesMaterial: ReactThreeFiber.MaterialNode<__TileSpritesMaterial, typeof __TileSpritesMaterial>;
    }
  }
}

export type TileSpritesMaterialProps = JSX.IntrinsicElements['tileSpritesMaterial'];

function Component({children, ...props}: TileSpritesMaterialProps, ref: ForwardedRef<__TileSpritesMaterial>) {
  return (
    <tileSpritesMaterial ref={ref} {...props}>
      {children}
    </tileSpritesMaterial>
  );
}

Component.displayName = 'TileSpritesMaterial';

export const TileSpritesMaterial = forwardRef<__TileSpritesMaterial, TileSpritesMaterialProps>(Component);

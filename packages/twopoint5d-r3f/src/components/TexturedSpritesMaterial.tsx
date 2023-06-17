import {extend, ReactThreeFiber} from '@react-three/fiber';
import {TexturedSpritesMaterial as __TexturedSpritesMaterial} from '@spearwolf/twopoint5d';
import {ForwardedRef, forwardRef} from 'react';

extend({TexturedSpritesMaterial: __TexturedSpritesMaterial});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      texturedSpritesMaterial: ReactThreeFiber.MaterialNode<__TexturedSpritesMaterial, typeof __TexturedSpritesMaterial>;
    }
  }
}

export type TexturedSpritesMaterialProps = JSX.IntrinsicElements['texturedSpritesMaterial'];

function Component({children, ...props}: TexturedSpritesMaterialProps, ref: ForwardedRef<__TexturedSpritesMaterial>) {
  return (
    <texturedSpritesMaterial ref={ref} {...props}>
      {children}
    </texturedSpritesMaterial>
  );
}

Component.displayName = 'TexturedSpritesMaterial';

export const TexturedSpritesMaterial = forwardRef<__TexturedSpritesMaterial, TexturedSpritesMaterialProps>(Component);

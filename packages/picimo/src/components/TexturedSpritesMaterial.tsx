import {extend, ReactThreeFiber} from '@react-three/fiber';
import {TexturedSpritesMaterial as __TexturedSpritesMaterial} from '@spearwolf/textured-sprites';
import {forwardRef, Ref} from 'react';

extend({TexturedSpritesMaterial: __TexturedSpritesMaterial});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      texturedSpritesMaterial: ReactThreeFiber.Object3DNode<
        __TexturedSpritesMaterial,
        typeof __TexturedSpritesMaterial & JSX.IntrinsicElements['shaderMaterial']
      >;
    }
  }
}

export type TexturedSpritesMaterialParams = JSX.IntrinsicElements['texturedSpritesMaterial'];

function Component({children, ...props}: TexturedSpritesMaterialParams, ref: Ref<__TexturedSpritesMaterial>) {
  return (
    <texturedSpritesMaterial ref={ref} {...props}>
      {children}
    </texturedSpritesMaterial>
  );
}

Component.displayName = 'TexturedSpritesMaterial';

export const TexturedSpritesMaterial = forwardRef<__TexturedSpritesMaterial, TexturedSpritesMaterialParams>(Component);

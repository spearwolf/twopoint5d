import {extend, ReactThreeFiber} from '@react-three/fiber';
import {Map2DTileSprites as __Map2DTileSprites, type IMap2DLayer} from '@spearwolf/twopoint5d';
import {forwardRef, type ForwardedRef} from 'react';
import {Object3D} from 'three';

extend({Map2DTileSprites: __Map2DTileSprites});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      map2DTileSprites: ReactThreeFiber.Node<__Map2DTileSprites, typeof __Map2DTileSprites>;
    }
  }
}

export type Map2DTileSpritesProps = JSX.IntrinsicElements['map2DTileSprites']; // & {};

const attach: any = (parent: Object3D & IMap2DLayer, self: __Map2DTileSprites) => {
  // eslint-disable-next-line no-console
  console.log('<Map2DTileSprites> attach: addTileRenderer', {parent, self});

  parent.add(self);

  if (typeof parent.addTileRenderer === 'function') {
    parent.addTileRenderer(self);
  }

  return () => {
    // eslint-disable-next-line no-console
    console.log('<Map2DTileSprites> attach: removeTileRenderer', {parent, self});

    if (typeof parent.removeTileRenderer === 'function') {
      parent.removeTileRenderer(self);
    }

    self.removeFromParent();
  };
};

function Component({children, ...props}: Map2DTileSpritesProps, ref: ForwardedRef<__Map2DTileSprites>) {
  return (
    <map2DTileSprites attach={attach} ref={ref} {...props}>
      {children}
    </map2DTileSprites>
  );
}

Component.displayName = 'Map2DTileSprites';

export const Map2DTileSprites = forwardRef<__Map2DTileSprites, Map2DTileSpritesProps>(Component);

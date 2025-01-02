import {extend, ReactThreeFiber} from '@react-three/fiber';
import {TileSpritesGeometry as __TileSpritesGeometry} from '@spearwolf/twopoint5d';
import {forwardRef, useEffect, useState, type ForwardedRef} from 'react';

extend({TileSpritesGeometry: __TileSpritesGeometry});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      tileSpritesGeometry: ReactThreeFiber.BufferGeometryNode<__TileSpritesGeometry, typeof __TileSpritesGeometry>;
    }
  }
}

export type TileSpritesGeometryProps = JSX.IntrinsicElements['tileSpritesGeometry'] & {
  capacity: number;
};

function Component({capacity, children, ...props}: TileSpritesGeometryProps, ref: ForwardedRef<__TileSpritesGeometry>) {
  const [initialCapacity, setInitialCapacity] = useState(capacity ?? 0);

  useEffect(() => {
    if (initialCapacity === 0) {
      if (capacity > 0) {
        setInitialCapacity(capacity);
      }
    } else if (capacity !== initialCapacity) {
      console.warn('TileSpritesGeometry: capacity cannot be changed after initialization');
    }
  }, [initialCapacity, capacity]);

  if (initialCapacity === 0) return null;

  return (
    <tileSpritesGeometry args={[initialCapacity]} attach="geometry" ref={ref} {...props}>
      {children}
    </tileSpritesGeometry>
  );
}

Component.displayName = 'TileSpritesGeometry';

export const TileSpritesGeometry = forwardRef<__TileSpritesGeometry, TileSpritesGeometryProps>(Component);

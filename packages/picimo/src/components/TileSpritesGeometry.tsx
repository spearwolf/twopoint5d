import {extend, ReactThreeFiber} from '@react-three/fiber';
import {TileSpritesGeometry as __TileSpritesGeometry} from 'twopoint5d';
import {ForwardedRef, forwardRef, useEffect, useState} from 'react';

extend({TileSpritesGeometry: __TileSpritesGeometry});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
      // eslint-disable-next-line no-console
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

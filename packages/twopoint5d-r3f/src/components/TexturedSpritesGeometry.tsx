import {extend, ReactThreeFiber} from '@react-three/fiber';
import {TexturedSpritesGeometry as __TexturedSpritesGeometry} from '@spearwolf/twopoint5d';
import {forwardRef, useEffect, useState, type ForwardedRef} from 'react';

extend({TexturedSpritesGeometry: __TexturedSpritesGeometry});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      texturedSpritesGeometry: ReactThreeFiber.BufferGeometryNode<__TexturedSpritesGeometry, typeof __TexturedSpritesGeometry>;
    }
  }
}

export type TexturedSpritesGeometryProps = JSX.IntrinsicElements['texturedSpritesGeometry'] & {
  capacity: number;
};

function Component(
  {capacity, name, children, ...props}: TexturedSpritesGeometryProps,
  ref: ForwardedRef<__TexturedSpritesGeometry>,
) {
  const [initialCapacity, setInitialCapacity] = useState(capacity ?? 0);

  useEffect(() => {
    if (initialCapacity === 0) {
      if (capacity > 0) {
        setInitialCapacity(capacity);
      }
    } else if (capacity !== initialCapacity) {
      console.warn('TexturedSpritesGeometry: capacity cannot be changed after initialization');
    }
  }, [initialCapacity, capacity]);

  if (initialCapacity === 0) return null;

  return (
    <texturedSpritesGeometry args={[initialCapacity]} name={name ?? 'TexturedSpritesGeometry'} ref={ref} {...props}>
      {children}
    </texturedSpritesGeometry>
  );
}

Component.displayName = 'TexturedSpritesGeometry';

export const TexturedSpritesGeometry = forwardRef<__TexturedSpritesGeometry, TexturedSpritesGeometryProps>(Component);

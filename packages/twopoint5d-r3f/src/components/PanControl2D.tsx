import {extend, ReactThreeFiber, useFrame} from '@react-three/fiber';
import {on} from '@spearwolf/eventize';
import {PanControl2D as __PanControl2D} from '@spearwolf/twopoint5d';
import {forwardRef, memo, useEffect, useRef, useState, type ForwardedRef} from 'react';
import {mergeRefs} from '../utils/mergeRefs.js';

extend({PanControl2D: __PanControl2D});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      panControl2D: ReactThreeFiber.Node<__PanControl2D, typeof __PanControl2D>;
    }
  }
}

export type Map2DPanControlProps = JSX.IntrinsicElements['panControl2D'] & {
  onUpdate?: (pan: {x: number; y: number}) => void;
};

function Component({onUpdate, children, ...props}: Map2DPanControlProps, ref: ForwardedRef<__PanControl2D>) {
  const panControlRef = useRef<__PanControl2D>();
  const [panControl, setPanControl] = useState<__PanControl2D | undefined>(panControlRef.current);

  useFrame((_state, delta) => {
    panControlRef.current?.update(delta);
  });

  useEffect(() => {
    if (panControl && onUpdate) {
      return panControl ? on(panControl, 'update', onUpdate) : undefined;
    }
  }, [panControl, onUpdate]);

  return (
    <panControl2D {...props} ref={mergeRefs(panControlRef, setPanControl, ref)}>
      {children}
    </panControl2D>
  );
}

Component.displayName = 'PanControl2D';

export const PanControl2D = memo(forwardRef<__PanControl2D, Map2DPanControlProps>(Component));

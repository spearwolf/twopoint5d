import {extend, ReactThreeFiber, useFrame} from '@react-three/fiber';
import {PanControl2D as __PanControl2D} from '@spearwolf/tiled-maps';
import {ForwardedRef, forwardRef, memo, useEffect, useRef, useState} from 'react';
import {mergeRefs} from '../utils/mergeRefs';

extend({PanControl2D: __PanControl2D});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
  const [panControl, setPanControl] = useState<__PanControl2D>(panControlRef.current);

  useFrame((_state, delta) => {
    panControlRef.current?.update(delta);
  });

  useEffect(() => {
    if (panControl && onUpdate) {
      return panControl.on('update', onUpdate);
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

import {extend, ReactThreeFiber, useFrame} from '@react-three/fiber';
import {Map2DPanControl as __Map2DPanControl} from '@spearwolf/tiled-maps';
import {ForwardedRef, forwardRef, useRef, memo} from 'react';
import {mergeRefs} from '../utils/mergeRefs';

extend({Map2DPanControl: __Map2DPanControl});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      map2DPanControl: ReactThreeFiber.Node<__Map2DPanControl, typeof __Map2DPanControl>;
    }
  }
}

export type Map2DPanControlProps = JSX.IntrinsicElements['map2DPanControl'] & {};

function Component({children, ...props}: Map2DPanControlProps, ref: ForwardedRef<__Map2DPanControl>) {
  const panControlRef = useRef<__Map2DPanControl>();

  useFrame((_state, delta) => {
    panControlRef.current?.update(delta);
  });

  return (
    <map2DPanControl {...props} ref={mergeRefs(panControlRef, ref)}>
      {children}
    </map2DPanControl>
  );
}

Component.displayName = 'Map2DPanControl';

export const Map2DPanControl = memo(forwardRef<__Map2DPanControl, Map2DPanControlProps>(Component));

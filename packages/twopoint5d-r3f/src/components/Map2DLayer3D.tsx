import {extend, ReactThreeFiber, useFrame} from '@react-three/fiber';
import {Map2DLayer3D as __Map2DLayer3D} from '@spearwolf/twopoint5d';
import {forwardRef, memo, useCallback, useEffect, useState, type ForwardedRef} from 'react';
import {mergeRefs} from '../utils/mergeRefs.js';

extend({Map2DLayer3D: __Map2DLayer3D});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      map2DLayer3D: ReactThreeFiber.Node<__Map2DLayer3D, typeof __Map2DLayer3D>;
    }
  }
}

export type Map2DLayer3DProps = JSX.IntrinsicElements['map2DLayer3D'] & {
  centerX?: number;
  centerY?: number;
  tileWidth?: number;
  tileHeight?: number;
  xOffset?: number;
  yOffset?: number;
  updateOnFrame?: boolean;
};

function Component(
  {centerX, centerY, tileWidth, tileHeight, xOffset, yOffset, updateOnFrame, children, ...props}: Map2DLayer3DProps,
  ref: ForwardedRef<__Map2DLayer3D>,
) {
  const [layer, setLayer] = useState<__Map2DLayer3D | null>(null);

  useEffect(() => {
    if (!updateOnFrame && layer?.visible) {
      layer?.update();
    }
  }, [layer, updateOnFrame, centerX, centerY, tileWidth, tileHeight, xOffset, yOffset]);

  const onFrame = useCallback(() => {
    if (layer != null && updateOnFrame) {
      layer.update();
    }
  }, [layer, updateOnFrame]);

  useFrame(onFrame);

  return (
    <map2DLayer3D
      centerX={centerX}
      centerY={centerY}
      tileWidth={tileWidth}
      tileHeight={tileHeight}
      xOffset={xOffset}
      yOffset={yOffset}
      {...props}
      ref={mergeRefs(setLayer, ref)}
    >
      {children}
    </map2DLayer3D>
  );
}

Component.displayName = 'Map2DLayer3D';

export const Map2DLayer3D = memo(forwardRef<__Map2DLayer3D, Map2DLayer3DProps>(Component));

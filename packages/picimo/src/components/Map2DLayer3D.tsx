import {extend, ReactThreeFiber} from '@react-three/fiber';
import {Map2DLayer3D as __Map2DLayer3D} from '@spearwolf/tiled-maps';
import {ForwardedRef, forwardRef, useEffect, useState, memo} from 'react';
import {mergeRefs} from '../utils/mergeRefs';

extend({Map2DLayer3D: __Map2DLayer3D});

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      map2DLayer3D: ReactThreeFiber.Node<__Map2DLayer3D, typeof __Map2DLayer3D>;
    }
  }
}

export type Map2DLayer3DProps = JSX.IntrinsicElements['map2DLayer3D'] & {
  width?: number;
  height?: number;
  centerX?: number;
  centerY?: number;
  tileWidth?: number;
  tileHeight?: number;
  xOffset?: number;
  yOffset?: number;
};

function Component(
  {width, height, centerX, centerY, tileWidth, tileHeight, xOffset, yOffset, children, ...props}: Map2DLayer3DProps,
  ref: ForwardedRef<__Map2DLayer3D>,
) {
  const [layer, setLayer] = useState<__Map2DLayer3D>(null);

  useEffect(() => {
    layer?.update();
  }, [layer, width, height, centerX, centerY, tileWidth, tileHeight, xOffset, yOffset]);

  return (
    <map2DLayer3D
      width={width}
      height={height}
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

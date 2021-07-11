import {extend, ReactThreeFiber} from '@react-three/fiber';
import {FunctionComponent} from 'react';
import {Map2dLayer} from 'three-tiled-maps';

extend({Map2dLayer});

declare global {
  namespace JSX {
    interface IntrinsicElements {
      map2dLayer: ReactThreeFiber.Object3DNode<Map2dLayer, typeof Map2dLayer>;
    }
  }
}

export type Map2DLayerProps = {
  width?: number;
  height?: number;
  centerX?: number;
  centerY?: number;
  tileWidth?: number;
  tileHeight?: number;
  xOffset?: number;
  yOffset?: number;
};

export const Map2DLayer: FunctionComponent<Map2DLayerProps> = ({
  width,
  height,
  centerX,
  centerY,
  tileWidth,
  tileHeight,
  xOffset,
  yOffset,
  children,
}) => {
  return (
    <map2dLayer
      width={width}
      height={height}
      centerX={centerX}
      centerY={centerY}
      tileWidth={tileWidth}
      tileHeight={tileHeight}
      xOffset={xOffset}
      yOffset={yOffset}
      attachFns={['addLayer', 'removeLayer']}
    >
      {children}
    </map2dLayer>
  );
};

Map2DLayer.defaultProps = {
  width: 320,
  height: 240,
  centerX: 0,
  centerY: 0,
  tileWidth: 16,
  tileHeight: 16,
  xOffset: 0,
  yOffset: 0,
};

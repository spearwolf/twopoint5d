import { extend } from "@react-three/fiber";
import { Map2dLayer } from "three-tiled-maps";
import React from "react";

extend({ Map2dLayer });

export const Map2DLayer = ({
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
      attachFns={["addLayer", "removeLayer"]}
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

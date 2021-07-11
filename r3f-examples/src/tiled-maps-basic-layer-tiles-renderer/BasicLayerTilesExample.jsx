import { extend } from "@react-three/fiber";
import { Map2D, Map2DLayer } from "r3f-tiled-maps";
import { useTileSetLoader } from "r3f-vertex-objects";
import React from "react";
import { RepeatingTilesProvider } from "three-tiled-maps";
import { BasicLayerTilesRenderer } from "./BasicLayerTilesRenderer";

extend({ BasicLayerTilesRenderer, RepeatingTilesProvider });

const TILE_PATTERN = [
  [1, 2],
  [3, 4],
];

export const BasicLayerTilesExample = () => {
  const { tileSet, texture } = useTileSetLoader(
    "/assets/map2d-debug-tiles_4x256x256.png",
    {
      tileWidth: 256,
      tileHeight: 256,
    }
  );

  return (
    <Map2D>
      <Map2DLayer
        width={640}
        height={480}
        centerX={0}
        centerY={0}
        tileWidth={256}
        tileHeight={256}
        xOffset={-128}
        yOffset={-128}
      >
        <basicLayerTilesRenderer
          attach="tilesRenderer"
          tileSet={tileSet}
          texture={texture}
        >
          <repeatingTilesProvider
            args={[TILE_PATTERN]}
            attach="tilesData"
          ></repeatingTilesProvider>
        </basicLayerTilesRenderer>
      </Map2DLayer>
    </Map2D>
  );
};

import {
  Map2DLayer3D,
  Map2DPanControl,
  Map2DTileSprites,
  RepeatingTilesProvider,
  TextureRef,
  TileSet,
  TileSetRef,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from "@spearwolf/picimo";
import { Map2DVisibleRect2 } from "@spearwolf/tiled-maps";
import { useState } from "react";
import { WiredBox } from "../utils/WiredBox";

const TILES = [
  [1, 2],
  [3, 4],
];

export const HowToMap2DTileSpritesLayer = () => {
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const [visibilitor] = useState(() => new Map2DVisibleRect2(640, 480));

  return (
    <>
      <Map2DPanControl onUpdate={setCenter} />

      <WiredBox width={640} height={30} depth={480} />

      <TileSet
        name="tiles"
        url="/examples/assets/map2d-debug-tiles_4x256x256.png"
        tileWidth={256}
        tileHeight={256}
      />

      <Map2DLayer3D
        name="Map2DLayer3D"
        tileWidth={256}
        tileHeight={256}
        xOffset={-128}
        yOffset={-128}
        visibilitor={visibilitor}
        centerX={center.x}
        centerY={center.y}
      >
        <WiredBox width={256} height={40} depth={256} color={0xff0066} />

        <Map2DTileSprites>
          <RepeatingTilesProvider tiles={TILES} />
          <TileSetRef name="tiles" attach="tileSet" />
          <TileSpritesGeometry capacity={1000} />
          <TileSpritesMaterial>
            <TextureRef name="tiles" attach="colorMap" />
          </TileSpritesMaterial>
        </Map2DTileSprites>
      </Map2DLayer3D>
    </>
  );
};

/* eslint-disable no-console */
import {
  Map2DLayer3D,
  Map2DTileSprites,
  RepeatingTilesProvider,
  TextureRef,
  TileSet,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from "@spearwolf/picimo";
import { useEffect, useState } from "react";
import { WiredBox } from "../utils/WiredBox";

const TILES = [
  [1, 2],
  [3, 4],
];

export const HowToMap2DTileSpritesLayer = () => {
  const [tileSet, setTileSet] = useState(null);
  const [map2DLayer, setMap2DLayer] = useState(null);
  const [tileSpritesRenderer, setTileSpritesRenderer] = useState(null);

  useEffect(() => {
    if (tileSpritesRenderer && tileSet) {
      tileSpritesRenderer.tileSet = tileSet.tileSet;
      if (map2DLayer) {
        map2DLayer.update();
      }
    }
  }, [map2DLayer, tileSpritesRenderer, tileSet]);

  return (
    <>
      <WiredBox width={100} height={100} depth={100} />

      <TileSet
        name="tiles"
        url="/examples/assets/map2d-debug-tiles_4x256x256.png"
        tileWidth={256}
        tileHeight={256}
        ref={setTileSet}
      />

      <Map2DLayer3D
        name="Map2DLayer3D"
        tileWidth={256}
        tileHeight={256}
        xOffset={-128}
        yOffset={-128}
        width={640}
        height={480}
        centerX={0}
        centerY={0}
        ref={setMap2DLayer}
      >
        <WiredBox
          width={10}
          height={10}
          depth={10}
          color={0xff9900}
          name="box-B"
        />

        <Map2DTileSprites ref={setTileSpritesRenderer}>
          <RepeatingTilesProvider tiles={TILES} />

          <TileSpritesGeometry capacity={1000} />

          <TileSpritesMaterial depthTest={true} depthWrite={true}>
            <TextureRef name="tiles" attach="colorMap" />
          </TileSpritesMaterial>
        </Map2DTileSprites>
      </Map2DLayer3D>
    </>
  );
};

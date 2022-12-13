/* eslint-disable no-console */
import { useEffect, useState } from "react";
import { AABB2, Map2DTile } from "twopoint5d";
import {
  Map2DTileSprites,
  RepeatingTilesProvider,
  TextureRef,
  TileSet,
  TileSetRef,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from "twopoint5d-r3f";
import { WiredBox } from "../utils/WiredBox";

const TILES = [
  [1, 2],
  [3, 4],
];

export const DemoOrDie = () => {
  const [sprites, setSprites] = useState(null);

  useEffect(() => {
    if (sprites) {
      sprites.beginUpdate(0, 0);
      sprites.addTile(new Map2DTile(0, 0, new AABB2(0, 0, 256, 256)));
      sprites.addTile(new Map2DTile(-1, 0, new AABB2(-256, 0, 256, 256)));
      sprites.addTile(new Map2DTile(-1, -1, new AABB2(-256, -256, 256, 256)));
      sprites.addTile(new Map2DTile(0, -1, new AABB2(0, -256, 256, 256)));
      sprites.endUpdate();
    }
  }, [sprites]);

  return (
    <>
      <WiredBox width={512} height={20} depth={512} />

      <TileSet
        name="tiles"
        url="/examples/assets/map2d-debug-tiles_4x256x256.png"
        tileWidth={256}
        tileHeight={256}
      />

      <Map2DTileSprites ref={setSprites}>
        <RepeatingTilesProvider tiles={TILES} />

        <TileSetRef name="tiles" attach="tileSet" />

        <TileSpritesGeometry capacity={4} />

        <TileSpritesMaterial
          fogNear={350}
          fogFar={1100}
          fogColor={[1, 0, 0.5, 0.1]}
        >
          <TextureRef name="tiles" attach="colorMap" />
        </TileSpritesMaterial>
      </Map2DTileSprites>
    </>
  );
};

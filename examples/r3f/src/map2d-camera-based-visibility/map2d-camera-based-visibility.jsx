import { extend } from "@react-three/fiber";
import { useState } from "react";
import { PerspectiveCamera, CameraHelper } from "three";
import { CameraBasedVisibility } from "twopoint5d";
import {
  Map2DLayer3D,
  Map2DTileSprites,
  PanControl2D,
  RepeatingTilesProvider,
  TextureRef,
  TileSet,
  TileSetRef,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from "twopoint5d-r3f";
import { WiredBox } from "../utils/WiredBox";
import { useDemoStore } from "./useDemoStore";

extend({ CameraBasedVisibility, CameraHelper });

const TILES = [
  [1, 2],
  [3, 4],
];

const map2dCamera = new PerspectiveCamera(75, 4 / 3, 0.1, 500);
map2dCamera.position.set(0, 200, 200);
map2dCamera.updateMatrix();
map2dCamera.lookAt(0, 0, 0);
map2dCamera.updateProjectionMatrix();

export const DemoOrDie = () => {
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const activeCamera = useDemoStore((state) => state.activeCameraName);

  const pointerPanDisabled = activeCamera !== "cam0";

  return (
    <>
      <PanControl2D
        onUpdate={setCenter}
        pointerDisabled={pointerPanDisabled}
        pixelsPerSecond={300}
      />

      <cameraHelper args={[map2dCamera]} />

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
        centerX={center.x}
        centerY={center.y}
      >
        <WiredBox width={256} height={10} depth={256} color={0xff0066} />

        <cameraBasedVisibility camera={map2dCamera} attach="visibilitor" />

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

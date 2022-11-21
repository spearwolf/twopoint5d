import { OrbitControls } from "@react-three/drei";
import { extend, useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { CameraHelper, PerspectiveCamera } from "three";
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
  const setThree = useThree((state) => state.set);
  const camera = useThree((state) => state.camera);
  const [defaultCamera] = useState(camera);

  const pointerPanDisabled = activeCamera !== "cam0";
  const orbitAround = activeCamera === "cam1";
  const controlMap2DCamera = activeCamera === "cam2" || activeCamera === "cam3";

  useEffect(() => {
    if (activeCamera === "cam3") {
      setThree({ camera: map2dCamera });
    } else {
      setThree({ camera: defaultCamera });
    }
  }, [activeCamera]);

  return (
    <>
      <PanControl2D
        onUpdate={setCenter}
        pointerDisabled={pointerPanDisabled}
        pixelsPerSecond={300}
      />

      {orbitAround && <OrbitControls makeDefault />}
      {controlMap2DCamera && <OrbitControls camera={map2dCamera} makeDefault />}

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
        <cameraBasedVisibility
          camera={map2dCamera}
          depth={10}
          attach="visibilitor"
        />

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

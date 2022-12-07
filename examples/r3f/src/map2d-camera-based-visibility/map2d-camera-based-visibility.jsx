import { OrbitControls } from "@react-three/drei";
import { extend, useThree } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { CameraHelper, PerspectiveCamera } from "three";
import { CameraBasedVisibility } from "twopoint5d";
import { useControls } from "leva";
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
  [1, 1, 1, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3],
  [1, 0, 1, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4],
  [1, 1, 1, 3, 4, 3, 4, 3, 2, 2, 2, 3, 4, 3, 4, 3],
  [3, 4, 3, 4, 3, 4, 3, 4, 2, 0, 2, 4, 3, 4, 3, 4],
  [4, 3, 4, 3, 4, 3, 4, 3, 2, 2, 2, 3, 4, 3, 4, 3],
  [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4],
  [4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3],
  [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4],
  [2, 2, 2, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3],
  [2, 0, 2, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4],
  [2, 2, 2, 3, 4, 3, 4, 3, 1, 1, 1, 3, 4, 3, 4, 3],
  [3, 4, 3, 4, 3, 4, 3, 4, 1, 0, 1, 4, 3, 4, 3, 4],
  [4, 3, 4, 3, 4, 3, 4, 3, 1, 1, 1, 3, 4, 3, 4, 3],
  [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4],
  [4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3],
  [3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4, 3, 4],
];

const map2dCamera = new PerspectiveCamera(75, 4 / 3, 0.1, 4000);
map2dCamera.position.set(0, 200, 200);
map2dCamera.lookAt(0, 0, 0);
map2dCamera.updateMatrixWorld(true);
map2dCamera.updateProjectionMatrix();

export const DemoOrDie = () => {
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const activeCamera = useDemoStore((state) => state.activeCameraName);
  const setThree = useThree((state) => state.set);
  const camera = useThree((state) => state.camera);
  const [defaultCamera] = useState(camera);

  const { lookAtCenter } = useControls({ lookAtCenter: false });
  const { tiles: showTileBoxes, camera: showCameraHelper } = useControls(
    "show helpers",
    {
      tiles: false,
      camera: true,
    }
  );

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

      {showCameraHelper && <cameraHelper args={[map2dCamera]} />}

      <TileSet
        name="tiles"
        url="/examples/assets/ball-patterns.png"
        tileWidth={128}
        tileHeight={128}
      />

      <Map2DLayer3D
        name="Map2DLayer3D"
        tileWidth={256}
        tileHeight={256}
        xOffset={-128}
        yOffset={-128}
        centerX={center.x}
        centerY={center.y}
        updateOnFrame
      >
        <cameraBasedVisibility
          showHelpers={showTileBoxes}
          camera={map2dCamera}
          lookAtCenter={lookAtCenter}
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

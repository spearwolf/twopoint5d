import { OrbitControls } from "@react-three/drei";
import { extend, useThree } from "@react-three/fiber";
import { useControls } from "leva";
import { useEffect, useState } from "react";
import { RectangularVisibilityArea } from "twopoint5d";
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

extend({ RectangularVisibilityArea });

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

export const DemoOrDie = () => {
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const activeCamera = useDemoStore((state) => state.activeCameraName);
  const setThree = useThree((state) => state.set);
  const camera = useThree((state) => state.camera);
  const [defaultCamera] = useState(camera);
  const { viewRect: showHelpers } = useControls("show helpers", {
    viewRect: true,
  });

  const pointerPanDisabled = activeCamera !== "cam0";
  const orbitAround = activeCamera === "cam1";
  // const controlMap2DCamera = activeCamera === "cam2" || activeCamera === "cam3";

  useEffect(() => {
    if (activeCamera === "cam3") {
      // setThree({ camera: map2dCamera });
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
      {/* {controlMap2DCamera && <OrbitControls camera={map2dCamera} makeDefault />} */}

      {/* {showCameraHelper && <cameraHelper args={[map2dCamera]} />} */}

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
        <rectangularVisibilityArea
          width={1024}
          height={768}
          showHelpers={showHelpers}
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

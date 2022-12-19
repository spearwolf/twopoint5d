import { OrbitControls } from "@react-three/drei";
import { extend, useThree } from "@react-three/fiber";
import { useControls } from "leva";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  CameraHelper,
  Euler,
  MathUtils,
  Matrix4,
  PerspectiveCamera,
} from "three";
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
  {
    name: "pixelart",

    tilesUrl: "/examples/assets/ball-patterns.png",

    tileWidth: 128,
    tileHeight: 128,

    map2dTileWidth: 256,
    map2dTileHeight: 256,

    map2dTileOffsetX: -128,
    map2dTileOffsetY: -128,

    tilesData: [
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
    ],
  },
  {
    name: "heilstätten tiles",

    tilesUrl: "/examples/assets/fliesen-tile-1000x579.png",

    tileWidth: 1000,
    tileHeight: 579,

    map2dTileWidth: 1000,
    map2dTileHeight: 579,

    map2dTileOffsetX: 0,
    map2dTileOffsetY: 0,

    tilesData: [[1]],
  },
  {
    name: "a random tile",

    tilesUrl: "/examples/assets/tiles-made-with-sd.png",

    tileWidth: 512,
    tileHeight: 512,

    map2dTileWidth: 512,
    map2dTileHeight: 512,

    map2dTileOffsetX: 0,
    map2dTileOffsetY: 0,

    tilesData: () => [[1 + ((Math.random() * 9) | 0)]],
  },
];

const map2dCamera = new PerspectiveCamera(75, 4 / 3, 0.1, 4000);
map2dCamera.position.set(0, 200, 200);
map2dCamera.lookAt(0, 0, 0);
map2dCamera.updateMatrixWorld(true);
map2dCamera.updateProjectionMatrix();

// TODO remove me
const map2dMatrix = new Matrix4().makeRotationFromEuler(
  new Euler(MathUtils.degToRad(-5), 0, 0)
).multiply(new Matrix4().makeTranslation(100, 0, 0));

export const DemoOrDie = () => {
  const [center, setCenter] = useState({ x: 0, y: 0 });
  const activeCamera = useDemoStore((state) => state.activeCameraName);
  const setThree = useThree((state) => state.set);
  const camera = useThree((state) => state.camera);
  const [defaultCamera] = useState(camera);
  const [tileSprites, setTileSprites] = useState();
  const map2dLayerRef = useRef();

  const { lookAtCenter, tiles } = useControls({
    lookAtCenter: false,
    tiles: { options: TILES.map((t) => t.name) },
  });

  const { tiles: showTileBoxes, camera: showCameraHelper } = useControls(
    "show helpers",
    {
      tiles: false,
      camera: true,
    }
  );

  const {
    tilesUrl,
    tileWidth,
    tileHeight,
    map2dTileWidth,
    map2dTileHeight,
    map2dTileOffsetX,
    map2dTileOffsetY,
    tilesData,
  } = useMemo(() => {
    const tile = TILES.find((t) => t.name === tiles);
    return {
      ...tile,
      tilesData:
        typeof tile.tilesData === "function"
          ? tile.tilesData()
          : tile.tilesData,
    };
  }, [tiles]);

  useEffect(
    () =>
      tileSprites?.on(["tileSetChanged", "tileDataChanged"], () => {
        map2dLayerRef.current?.resetTiles();
      }),
    [tileSprites]
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
        url={tilesUrl}
        tileWidth={tileWidth}
        tileHeight={tileHeight}
        anisotrophy
      />

      <Map2DLayer3D
        name="Map2DLayer3D"
        ref={map2dLayerRef}
        matrix={map2dMatrix}
        matrixAutoUpdate={false}
        tileWidth={map2dTileWidth}
        tileHeight={map2dTileHeight}
        xOffset={map2dTileOffsetX}
        yOffset={map2dTileOffsetY}
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

        <Map2DTileSprites ref={setTileSprites}>
          <RepeatingTilesProvider tiles={tilesData} />
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

import {OrbitControls} from '@react-three/drei';
import {extend, useThree} from '@react-three/fiber';
import {useControls} from 'leva';
import {useEffect, useState} from 'react';
import {RectangularVisibilityArea} from '@spearwolf/twopoint5d';
import {
  Map2DLayer3D,
  Map2DTileSprites,
  PanControl2D,
  ParallaxProjection,
  RepeatingTilesProvider,
  Stage2D,
  TextureRef,
  TileSet,
  TileSetRef,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from '@spearwolf/twopoint5d-r3f';
import assetsUrl from '../../../demos/utils/assetsUrl.ts';
import {useDemoStore} from './useDemoStore';

extend({RectangularVisibilityArea});

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

const VIEW_WIDTH = 'view width';
const VIEW_HEIGHT = 'view height';
const VIEW_FIT = 'view fit';
const VIEW_RECT = 'view rect';

export const Map2DRectVisiAreaDemo = () => {
  const [center, setCenter] = useState({x: 0, y: 0});
  const activeCamera = useDemoStore((state) => state.activeCameraName);
  const setThree = useThree((state) => state.set);
  const camera = useThree((state) => state.camera);
  const [defaultCamera] = useState(camera);

  const {
    [VIEW_WIDTH]: viewWidth,
    [VIEW_HEIGHT]: viewHeight,
    [VIEW_FIT]: viewFit,
  } = useControls({
    [VIEW_WIDTH]: 1024,
    [VIEW_HEIGHT]: 768,
    [VIEW_FIT]: {options: ['cover', 'contain']},
  });

  const {[VIEW_RECT]: showHelpers} = useControls('show helpers', {
    [VIEW_RECT]: true,
  });

  const pointerPanDisabled = activeCamera === 'cam1';
  const orbitAround = activeCamera === 'cam1';
  const showMap2DCamera = activeCamera === 'cam3';

  useEffect(() => {
    if (activeCamera !== 'cam3') {
      setThree({camera: defaultCamera});
    }
  }, [activeCamera]);

  return (
    <>
      <PanControl2D onUpdate={setCenter} pointerDisabled={pointerPanDisabled} pixelsPerSecond={300} />

      {orbitAround && <OrbitControls makeDefault />}

      <Stage2D noAutoRender defaultCamera={showMap2DCamera}>
        <ParallaxProjection plane="xz" origin="top left" width={viewWidth} height={viewHeight} fit={viewFit} />
      </Stage2D>

      <TileSet name="tiles" url={assetsUrl('ball-patterns.png')} tileWidth={128} tileHeight={128} />

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
        <rectangularVisibilityArea width={viewWidth} height={viewHeight} showHelpers={showHelpers} attach="visibilitor" />

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

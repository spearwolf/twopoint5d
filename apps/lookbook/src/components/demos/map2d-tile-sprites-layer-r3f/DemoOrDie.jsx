import {extend} from '@react-three/fiber';
import {RectangularVisibilityArea} from '@spearwolf/twopoint5d';
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
} from '@spearwolf/twopoint5d-r3f';
import {useState} from 'react';
import assetsUrl from '~demos/utils/assetsUrl.ts';
import {WiredBox} from '../WiredBox.tsx';

extend({RectangularVisibilityArea});

const TILES = [
  [1, 2],
  [3, 4],
];

export const DemoOrDie = () => {
  const [center, setCenter] = useState({x: 0, y: 0});

  return (
    <>
      <PanControl2D onUpdate={setCenter} pixelsPerSecond={300} />

      <WiredBox width={640} height={30} depth={480} />

      <TileSet name="tiles" url={assetsUrl('map2d-debug-tiles_4x256x256.png')} tileWidth={256} tileHeight={256} />

      <Map2DLayer3D
        name="Map2DLayer3D"
        tileWidth={256}
        tileHeight={256}
        xOffset={-128}
        yOffset={-128}
        centerX={center.x}
        centerY={center.y}
      >
        <WiredBox width={256} height={40} depth={256} color={0xff0066} />

        <rectangularVisibilityArea width={640} height={480} attach="visibilitor" />

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

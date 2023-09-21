import {AABB2, Map2DTile} from '@spearwolf/twopoint5d';
import {
  Map2DTileSprites,
  RepeatingTilesProvider,
  TextureRef,
  TileSet,
  TileSetRef,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from '@spearwolf/twopoint5d-r3f';
import {useEffect, useState} from 'react';
import {Vector2, Vector3} from 'three';
import assetsUrl from '../../../demos/utils/assetsUrl.ts';
import {WiredBox} from '../WiredBox.tsx';

const TILES = [
  [1, 2],
  [3, 4],
];

export const Map2DTileSpritesDemo = () => {
  const [sprites, setSprites] = useState(null);

  useEffect(() => {
    if (sprites) {
      sprites.beginUpdate(new Vector2(), new Vector3());
      sprites.addTile(new Map2DTile(0, 0, new AABB2(0, 0, 256, 256)));
      sprites.addTile(new Map2DTile(-1, 0, new AABB2(-256, 0, 256, 256)));
      sprites.addTile(new Map2DTile(-1, -1, new AABB2(-256, -256, 256, 256)));
      sprites.addTile(new Map2DTile(0, -1, new AABB2(0, -256, 256, 256)));
      sprites.endUpdate();

      console.log('twopoint5d.Map2DTileSprites', sprites);
    }
  }, [sprites]);

  return (
    <>
      <WiredBox width={512} height={20} depth={512} />

      <TileSet name="tiles" url={assetsUrl('map2d-debug-tiles_4x256x256.png')} tileWidth={256} tileHeight={256} />

      <Map2DTileSprites ref={setSprites}>
        <RepeatingTilesProvider tiles={TILES} />

        <TileSetRef name="tiles" attach="tileSet" />

        <TileSpritesGeometry capacity={4} />

        <TileSpritesMaterial fogNear={350} fogFar={1100} fogColor={[1, 0, 0.5, 0.1]}>
          <TextureRef name="tiles" attach="colorMap" />
        </TileSpritesMaterial>
      </Map2DTileSprites>
    </>
  );
};

/* eslint-disable no-console */
import {
  AABB2,
  Map2DTileCoords,
  Map2DTileRenderer,
  RepeatingTilesProvider,
  TileSetLoader,
  TileSprites,
  TileSpritesFactory,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from '@spearwolf/twopoint5d';
import {BoxGeometry, EdgesGeometry, Fog, LineBasicMaterial, LineSegments, Vector3} from 'three/webgpu';
import assetsUrl from './utils/assetsUrl';
import type {PerspectiveOrbitDemo} from './utils/PerspectiveOrbitDemo';

export const run = (demo: PerspectiveOrbitDemo) =>
  demo.start(async () => {
    const {scene, camera} = demo;

    camera.position.set(0, 350, 500);
    camera.far = 8000;

    scene.fog = new Fog(0x458497, 300, 1500);

    const geometry = new BoxGeometry(512, 20, 512);
    const edges = new EdgesGeometry(geometry);
    const line = new LineSegments(edges, new LineBasicMaterial({color: 0xf0f0f0}));

    scene.add(line);

    // ------------------------------------------------------

    const {tileSet, texture} = await new TileSetLoader().loadAsync(
      assetsUrl('map2d-debug-tiles_4x256x256.png'),
      {
        tileWidth: 256,
        tileHeight: 256,
      },
      ['srgb'],
    );

    const tileDataProvider = new RepeatingTilesProvider([
      [1, 2],
      [3, 4],
    ]);

    const tileSprites = new TileSprites(
      new TileSpritesGeometry(4),
      new TileSpritesMaterial({
        colorMap: texture,
      }),
    );

    // ------------------------------------------------------

    const tiles = new Map2DTileRenderer(new TileSpritesFactory(tileSprites, tileSet, tileDataProvider));

    scene.add(tiles.node);

    tiles.beginUpdatingTiles(new Vector3());

    tiles.addTile(new Map2DTileCoords(0, 0, new AABB2(0, 0, 256, 256)));
    tiles.addTile(new Map2DTileCoords(-1, 0, new AABB2(-256, 0, 256, 256)));
    tiles.addTile(new Map2DTileCoords(-1, -1, new AABB2(-256, -256, 256, 256)));
    tiles.addTile(new Map2DTileCoords(0, -1, new AABB2(0, -256, 256, 256)));

    tiles.endUpdatingTiles();

    // ------------------------------------------------------

    console.log('tileRenderer', tiles);
  });

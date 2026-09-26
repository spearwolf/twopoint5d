/* eslint-disable no-console */
import {once} from '@spearwolf/eventize';
import {
  AABB2,
  Map2DTileCoords,
  Map2DTileRenderer,
  OnDisplayDispose,
  RepeatingTilesProvider,
  TextureStore,
  TileSprites,
  TileSpritesFactory,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from '@spearwolf/twopoint5d';
import {BoxGeometry, EdgesGeometry, Fog, LineBasicMaterial, LineSegments, Vector3} from 'three/webgpu';
import assetsUrl from '../utils/assetsUrl';
import type {PerspectiveOrbitDemo} from '../utils/PerspectiveOrbitDemo';

export const run = (demo: PerspectiveOrbitDemo) =>
  demo.start(async ({renderer}) => {
    const {scene, camera} = demo;

    camera.position.set(0, 350, 500);
    camera.far = 8000;

    scene.fog = new Fog(0x458497, 300, 1500);

    const geometry = new BoxGeometry(512, 20, 512);
    const edges = new EdgesGeometry(geometry);
    const line = new LineSegments(edges, new LineBasicMaterial({color: 0xf0f0f0}));

    scene.add(line);

    // ------------------------------------------------------

    const store = new TextureStore(renderer);
    // the catalog of the lookbook, public/assets/textures.json, names the image, tile set and texture classes of each item
    await store.loadAsync(assetsUrl('textures.json'));
    const [tileSet, texture] = await store.getAsync('map2dDebugTiles', ['tileSet', 'texture']);

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

    // the display carries the lifetime of everything this demo built, so its end is where they go
    once(demo, OnDisplayDispose, () => {
      // in this order: the renderer gives its tile slots back to the factory, and only then do the
      // geometry and the material behind those slots fall
      tiles.dispose();
      tileSprites.geometry?.dispose();
      tileSprites.material?.dispose();
      // the texture belongs to the store, which releases it with its resource
      store.dispose();
      // the frame around the map
      edges.dispose();
      geometry.dispose();
      line.material.dispose();
    });
  });

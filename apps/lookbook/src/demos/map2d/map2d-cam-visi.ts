/* eslint-disable no-console */
import {
  CameraBasedVisibility,
  Map2D,
  Map2DTileRenderer,
  OnDisplayDispose,
  PanControl2D,
  RepeatingTilesProvider,
  TileSprites,
  TileSpritesFactory,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from '@spearwolf/twopoint5d';
import {Fog} from 'three/webgpu';
import {loadTextureCatalog} from '../utils/loadTextureCatalog';
import type {PerspectiveOrbitDemo} from '../utils/PerspectiveOrbitDemo';
import {on, once} from '@spearwolf/eventize';

export const run = (demo: PerspectiveOrbitDemo) =>
  demo.start(async ({renderer}) => {
    const {scene, camera} = demo;

    camera.position.set(0, 350, 500);
    camera.far = 4000;
    camera.updateProjectionMatrix();

    scene.fog = new Fog(0x001020, 300, 3000);

    // -------------------------------------

    const map2d = new Map2D();

    scene.add(map2d);

    map2d.tileWidth = 256;
    map2d.tileHeight = 256;
    map2d.xOffset = -128;
    map2d.yOffset = -128;

    const cameraBasedVisibility = new CameraBasedVisibility(camera);

    map2d.visibilitor = cameraBasedVisibility;

    map2d.centerX = 0;
    map2d.centerY = 0;

    const store = await loadTextureCatalog(renderer);
    const [tileSet, texture] = await store.getAsync('ballPatternTiles', ['tileSet', 'texture']);

    const tileData = new RepeatingTilesProvider([
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
    ]);

    const tileSprites = new TileSprites(
      new TileSpritesGeometry(5000),
      new TileSpritesMaterial({
        colorMap: texture,
      }),
    );

    const tileRenderer = new Map2DTileRenderer(new TileSpritesFactory(tileSprites, tileSet, tileData));

    map2d.addTileRenderer(tileRenderer);

    // ------------------------------------------------------

    const panControl = new PanControl2D({
      disablePointer: true,
      speed: 200,
    });

    on(demo, 'enablePanControl', (enabled) => {
      panControl.pointerDisabled = !enabled;
    });

    demo.onRenderFrame(({deltaTime}) => {
      panControl.update(deltaTime);

      map2d.centerX = panControl.panView.x;
      map2d.centerY = panControl.panView.y;
      map2d.update();
    });

    // ------------------------------------------------------

    (window as any).map2d = map2d;
    console.log('map2d', map2d);

    (window as any).tileRenderer = tileRenderer;
    console.log('tileRenderer', tileRenderer);

    // the display carries the lifetime of everything this demo built, so its end is where they go
    once(demo, OnDisplayDispose, () => {
      // in this order: the renderer gives its tile slots back to the factory, the map lets the
      // renderer go, and only then do the geometry and the material behind those slots fall
      tileRenderer.dispose();
      map2d.dispose();
      tileSprites.geometry?.dispose();
      tileSprites.material?.dispose();
      // the texture belongs to the store, which releases it with its resource
      store.dispose();
      panControl.dispose();
    });
  });

// biome-ignore-all lint/suspicious/noConsole: the demo logs to the devtools on purpose
import {
  Map2D,
  Map2DTileRenderer,
  PanControl2D,
  RectangularVisibilityArea,
  RectangularVisibilityAreaHelpers,
  RepeatingTilesProvider,
  TileSprites,
  TileSpritesFactory,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from '@spearwolf/twopoint5d';
import {Fog} from 'three/webgpu';
import {DemoParts} from '../utils/demoParts';
import {loadTextureCatalog} from '../utils/loadTextureCatalog';
import {makePoints} from '../utils/makePoints';
import type {PerspectiveOrbitDemo} from '../utils/PerspectiveOrbitDemo';

export const run = (demo: PerspectiveOrbitDemo) =>
  demo.start(async ({renderer}) => {
    // the display lives here, and what is built before the await goes with it as well when the load fails
    const parts = new DemoParts(demo);
    const {scene, camera} = demo;

    camera.position.set(0, 350, 500);
    camera.far = 8000;

    scene.fog = new Fog(0x458497, 300, 1500);

    // biome-ignore format: the line breaks lay the numbers out row by row
    const points = makePoints([
      -384, 11, -384,
      -128, 11, -384,
      128, 11, -384,
      384, 11, -384,

      -384, 11, -128,
      -128, 11, -128,
      128, 11, -128,
      384, 11, -128,

      -384, 11, 128,
      -128, 11, 128,
      128, 11, 128,
      384, 11, 128,

      -384, 11, 384,
      -128, 11, 384,
      128, 11, 384,
      384, 11, 384,
    ]);
    // the markers of the tile corners
    parts.onDispose(() => {
      points.geometry.dispose();
      points.material.dispose();
    });
    scene.add(points);

    // -------------------------------------

    const map2d = parts.keep(new Map2D());

    scene.add(map2d);

    map2d.tileWidth = 256;
    map2d.tileHeight = 256;
    map2d.xOffset = -128;
    map2d.yOffset = -128;

    const rectVisiArea = new RectangularVisibilityArea(640, 480);
    map2d.visibilitor = rectVisiArea;

    const rectVisiAreaHelpers = parts.keep(new RectangularVisibilityAreaHelpers(rectVisiArea));
    rectVisiAreaHelpers.add(map2d);
    rectVisiAreaHelpers.show = true;

    map2d.centerX = 0;
    map2d.centerY = 0;

    const store = await loadTextureCatalog(renderer);
    const [tileSet, texture] = await store.getAsync('map2dDebugTiles', ['tileSet', 'texture']).catch((error: unknown) => {
      // a loader that fails disposes the store it built
      store.dispose();
      throw error;
    });
    // a dispose() while the tiles loaded has gone out already, and with it everything built before the
    // await: only the store is left
    if (demo.isDisposed) {
      store.dispose();
      return;
    }

    // the texture belongs to the store, which releases it with its resource
    parts.keep(store);

    const tileData = new RepeatingTilesProvider([
      [1, 2],
      [3, 4],
    ]);

    const tileSprites = new TileSprites(
      new TileSpritesGeometry(1000),
      new TileSpritesMaterial({
        colorMap: texture,
      }),
    );
    parts.onDispose(() => {
      tileSprites.geometry?.dispose();
      tileSprites.material?.dispose();
    });

    // the renderer gives its tile slots back to the factory before the geometry and the material behind
    // those slots fall: kept after them
    const tileRenderer = parts.keep(new Map2DTileRenderer(new TileSpritesFactory(tileSprites, tileSet, tileData)));

    map2d.addTileRenderer(tileRenderer);

    // ------------------------------------------------------

    const panControl = parts.keep(
      new PanControl2D({
        disablePointer: true,
        speed: 200,
      }),
    );

    demo.onRenderFrame(({deltaTime}) => {
      panControl.update(deltaTime);

      map2d.centerX = panControl.panView.x;
      map2d.centerY = panControl.panView.y;
      map2d.update();

      rectVisiAreaHelpers.update();
    });

    // ------------------------------------------------------

    (window as any).map2d = map2d;
    console.log('map2d', map2d);

    (window as any).tileRenderer = tileRenderer;
    console.log('tileRenderer', tileRenderer);
  });

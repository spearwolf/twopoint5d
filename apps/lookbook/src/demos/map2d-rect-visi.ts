/* eslint-disable no-console */
import {
  Map2D,
  Map2DTileRenderer,
  PanControl2D,
  RectangularVisibilityArea,
  RectangularVisibilityAreaHelpers,
  RepeatingTilesProvider,
  TileSetLoader,
  TileSprites,
  TileSpritesFactory,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from '@spearwolf/twopoint5d';
import {Fog} from 'three/webgpu';
import assetsUrl from './utils/assetsUrl';
import {makePoints} from './utils/makePoints';
import type {PerspectiveOrbitDemo} from './utils/PerspectiveOrbitDemo';

export const run = (demo: PerspectiveOrbitDemo) =>
  demo.start(async () => {
    const {scene, camera} = demo;

    camera.position.set(0, 350, 500);
    camera.far = 8000;

    scene.fog = new Fog(0x458497, 300, 1500);

    // prettier-ignore
    scene.add(makePoints([
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
    ]));

    // -------------------------------------

    const map2d = new Map2D();

    scene.add(map2d);

    map2d.tileWidth = 256;
    map2d.tileHeight = 256;
    map2d.xOffset = -128;
    map2d.yOffset = -128;

    const rectVisiArea = new RectangularVisibilityArea(640, 480);
    map2d.visibilitor = rectVisiArea;

    const rectVisiAreaHelpers = new RectangularVisibilityAreaHelpers(rectVisiArea);
    rectVisiAreaHelpers.add(map2d);

    map2d.centerX = 0;
    map2d.centerY = 0;

    const {tileSet, texture} = await new TileSetLoader().loadAsync(
      assetsUrl('map2d-debug-tiles_4x256x256.png'),
      {
        tileWidth: 256,
        tileHeight: 256,
      },
      ['srgb'],
    );

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

    const tileRenderer = new Map2DTileRenderer(new TileSpritesFactory(tileSprites, tileSet, tileData));

    map2d.addTileRenderer(tileRenderer);

    // ------------------------------------------------------

    const panControl = new PanControl2D({
      disablePointer: true,
      speed: 200,
    });

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

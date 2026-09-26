import {expect} from '@esm-bundle/chai';
import {
  AABB2,
  Display,
  Map2DTileCoords,
  RepeatingTilesProvider,
  TextureCoords,
  TileSet,
  TileSprites,
  TileSpritesFactory,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {disposeDisplay, isNearColor, makeContainer, makeSheetWithTurnedCopy, renderToPixels, rgbAt} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;

// a tile of 2 × 2 texels, four colors
const TILE_SIZE = 2;
// prettier-ignore
const IMAGE = [
  [255, 0, 0, 255], [0, 255, 0, 255],
  [0, 0, 255, 255], [255, 255, 0, 255],
];

// the two tiles lie side by side on the ground plane, each drawn one unit per texel
const UPRIGHT_X = -2;
const TURNED_X = 2;

/**
 * The colors at the middles of the four cells of the tile whose middle is at `tileX`, each read
 * relative to that middle — so the two tiles are compared cell by cell, whichever way a backend
 * orders the rows it reads back.
 */
function cellColors(pixels, tileX) {
  const colors = [];
  for (let row = 0; row < TILE_SIZE; row++) {
    for (let column = 0; column < TILE_SIZE; column++) {
      const dx = column - (TILE_SIZE - 1) / 2;
      const dy = row - (TILE_SIZE - 1) / 2;
      const x = Math.floor(CENTER + (tileX + dx) * PIXELS_PER_UNIT);
      const y = Math.floor(CENTER + dy * PIXELS_PER_UNIT);
      colors.push(rgbAt(pixels, TARGET_SIZE, x, y));
    }
  }
  return colors;
}

/** Whether no two of the colors lie within the tolerance of {@link isNearColor} of each other. */
function allDifferent(colors) {
  return colors.every((a, i) => colors.every((b, j) => i === j || !isNearColor(a, b)));
}

describe('map2d — TileSprites draws a turned tile upright', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {RenderTarget | undefined} */
  let target;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
  });

  afterEach(() => {
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  it('draws the tile of a frame with FLIP_DIAGONAL | FLIP_VERTICAL as the upright tile', async function () {
    const {texture, json} = makeSheetWithTurnedCopy(IMAGE, TILE_SIZE, TILE_SIZE);

    // tile 1 is the upright image, tile 2 the turned copy, which its frame turns back
    const tileSet = new TileSet(new TextureCoords(0, 0, json.meta.size.w, json.meta.size.h), {
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
    });
    tileSet.atlas.get(tileSet.frameId(2)).coords.flip = TextureCoords.FLIP_DIAGONAL | TextureCoords.FLIP_VERTICAL;

    const geometry = new TileSpritesGeometry(2);
    const material = new TileSpritesMaterial({colorMap: texture});
    const tileSprites = new TileSprites(geometry, material);
    tileSprites.frustumCulled = false;

    const factory = new TileSpritesFactory(tileSprites, tileSet, new RepeatingTilesProvider([[1, 2]]));
    const half = TILE_SIZE / 2;
    factory.createTile(new Map2DTileCoords(0, 0, new AABB2(UPRIGHT_X - half, -half, TILE_SIZE, TILE_SIZE)));
    factory.createTile(new Map2DTileCoords(1, 0, new AABB2(TURNED_X - half, -half, TILE_SIZE, TILE_SIZE)));
    factory.update();

    // from above onto the XZ plane: x runs to the right, z down the target
    const extent = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-extent, extent, extent, -extent, 0.1, 100);
    camera.position.set(0, 10, 0);
    camera.up.set(0, 0, -1);
    camera.lookAt(0, 0, 0);

    const scene = new Scene();
    scene.add(tileSprites);

    const pixels = await renderToPixels(display.renderer, scene, camera, target);

    // a TileSprites owns neither its geometry nor its material; both, like the texture, are the caller's
    scene.remove(tileSprites);
    geometry.dispose();
    material.dispose();
    texture.dispose();

    const upright = cellColors(pixels, UPRIGHT_X);
    const turned = cellColors(pixels, TURNED_X);

    expect(upright, 'the four cells of the upright tile, all different').to.satisfy(allDifferent);
    turned.forEach((rgb, i) => {
      expect(rgb, `cell ${i} of the turned tile, against ${upright[i]} of the upright one`).to.satisfy((c) =>
        isNearColor(c, upright[i]),
      );
    });
  });
});

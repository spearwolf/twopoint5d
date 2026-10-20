import {expect} from '@esm-bundle/chai';
import {
  Anchor,
  AsepriteJson,
  AtlasFrame,
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  Flip,
  gridBase,
  InstancePosition,
  NineSlice,
  QuadSize,
  TextureColor,
  TexturePackerJson,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  disposeDisplay,
  isNearColor,
  makeColorTexture,
  makeContainer,
  makeSheetWithTurnedCopy,
  readsTopDown,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

// one unit a pixel
const TARGET_SIZE = 64;
const BLACK = [0, 0, 0];

const Panel = defineSprite({
  base: gridBase({columns: 3, rows: 3}),
  features: [InstancePosition, FlatPlacement, QuadSize, Anchor, NineSlice, AtlasFrame, TextureColor, Flip],
});

// a frame of 24 × 24 texels: nine blocks of 8 × 8, a color each, row by row from the top left — the
// border of a panel is 8 texels on every side
const BLOCKS = [
  [255, 0, 0, 255],
  [0, 255, 0, 255],
  [0, 0, 255, 255],
  [255, 255, 0, 255],
  [255, 255, 255, 255],
  [255, 0, 255, 255],
  [0, 255, 255, 255],
  [255, 128, 0, 255],
  [128, 0, 255, 255],
];
const blockAt = (column, row) => BLOCKS[row * 3 + column].slice(0, 3);
const blockTexels = () => {
  const texels = [];
  for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) texels.push(BLOCKS[Math.floor(y / 8) * 3 + Math.floor(x / 8)]);
  return texels;
};

/** The block a point `(x, y)` units from the top left of a panel `width × height` shows, its border `border` units. */
const expectedBlock = (x, y, width, height, border) => {
  const band = (value, size) => (value < border ? 0 : value < size - border ? 1 : 2);
  return blockAt(band(x, width), band(y, height));
};

describe('sprites — NineSlice', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  let display;
  let host;
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
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  /**
   * Renders one panel `width × height` at the origin, `setUp(sprite)` writing its frame and border,
   * and answers the color at `(x, y)` units from its top left.
   */
  async function renderPanel(colorMap, width, height, setUp) {
    const topDown = await readsTopDown(display.renderer, target);
    const sprites = new FeatureSprites(Panel, {capacity: 1, textures: {colorMap}});
    const sprite = sprites.createSprite();
    sprite.setSize(width, height);
    setUp(sprite);
    const camera = new OrthographicCamera(-TARGET_SIZE / 2, TARGET_SIZE / 2, TARGET_SIZE / 2, -TARGET_SIZE / 2, 0.1, 100);
    camera.position.z = 10;
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const pixels = await renderToPixels(display.renderer, scene, camera, target);
    sprites.dispose();
    return (x, y) => {
      const column = Math.floor(TARGET_SIZE / 2 - width / 2 + x);
      const fromTop = Math.floor(TARGET_SIZE / 2 - height / 2 + y);
      return rgbAt(pixels, TARGET_SIZE, column, topDown ? fromTop : TARGET_SIZE - 1 - fromTop);
    };
  }

  /** Points half a unit inside each band of a panel with a border of `border` units, and in the middle of it. */
  const pointsAcross = (size, border) => [
    0.5,
    border - 0.5,
    border + 0.5,
    size / 2,
    size - border - 0.5,
    size - border + 0.5,
    size - 0.5,
  ];

  function expectBorder(colorAt, width, height, border, what) {
    for (const y of pointsAcross(height, border)) {
      for (const x of pointsAcross(width, border)) {
        const expected = expectedBlock(x, y, width, height, border);
        expect(colorAt(x, y), `${what} at (${x}, ${y})`).to.satisfy((c) => isNearColor(c, expected, 3));
      }
    }
  }

  for (const [width, height] of [
    [40, 32],
    [56, 48],
  ]) {
    it(`keeps the 8-pixel border of a 24 × 24 frame at 8 units on a panel of ${width} × ${height}`, async function () {
      const colorMap = makeColorTexture(blockTexels(), 24, 24);
      const colorAt = await renderPanel(colorMap, width, height, (sprite) => {
        sprite.setTexCoords(0, 0, 1, 1);
        sprite.setSliceInsets(8, 8, 8, 8);
      });
      colorMap.dispose();

      expectBorder(colorAt, width, height, 8, `the panel of ${width} × ${height}`);
    });
  }

  it('draws a border of 16 units at a sliceScale of 2', async function () {
    const colorMap = makeColorTexture(blockTexels(), 24, 24);
    const colorAt = await renderPanel(colorMap, 56, 48, (sprite) => {
      sprite.setTexCoords(0, 0, 1, 1);
      sprite.setSliceInsets(8, 8, 8, 8);
      sprite.sliceScale = 2;
    });
    colorMap.dispose();

    expectBorder(colorAt, 56, 48, 16, 'the panel at a sliceScale of 2');
  });

  it('slices a frame the packer turned as its upright copy', async function () {
    const {texture, json} = makeSheetWithTurnedCopy(blockTexels(), 24, 24);
    const [atlas] = TexturePackerJson.parse(json);
    const colorAt = await renderPanel(texture, 40, 32, (sprite) => {
      sprite.setFrame(atlas.frame('turned'));
      sprite.setSliceInsets(8, 8, 8, 8);
    });
    texture.dispose();

    expectBorder(colorAt, 40, 32, 8, 'the turned frame');
  });

  it('splits a panel narrower than its borders between them, squeezed, without a middle', async function () {
    const colorMap = makeColorTexture(blockTexels(), 24, 24);
    const colorAt = await renderPanel(colorMap, 8, 32, (sprite) => {
      sprite.setTexCoords(0, 0, 1, 1);
      sprite.setSliceInsets(8, 8, 8, 8);
    });
    colorMap.dispose();

    // 4 units of each border: the left border on the left half, the right one on the right
    for (const [x, column] of [
      [0.5, 0],
      [3.5, 0],
      [4.5, 2],
      [7.5, 2],
    ]) {
      expect(colorAt(x, 16), `at (${x}, 16)`).to.satisfy((c) => isNearColor(c, blockAt(column, 1), 3));
      expect(colorAt(x, 0.5), `at (${x}, 0.5)`).to.satisfy((c) => isNearColor(c, blockAt(column, 0), 3));
    }
    expect(colorAt(8.5, 16), 'beside the panel').to.satisfy((c) => isNearColor(c, BLACK));
  });

  it('slices a panel of an Aseprite UI kit by the name of its slice', async function () {
    // one canvas of 48 × 24: the panel on the left, white on the right
    const texels = [];
    const blocks = blockTexels();
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 48; x++) texels.push(x < 24 ? blocks[y * 24 + x] : [255, 255, 255, 255]);
    }
    const colorMap = makeColorTexture(texels, 48, 24);
    const [atlas] = AsepriteJson.parse({
      frames: {
        'kit 0.aseprite': {
          frame: {x: 0, y: 0, w: 48, h: 24},
          rotated: false,
          trimmed: false,
          spriteSourceSize: {x: 0, y: 0, w: 48, h: 24},
          sourceSize: {w: 48, h: 24},
          duration: 100,
        },
      },
      meta: {
        app: 'https://www.aseprite.org/',
        image: 'kit.png',
        size: {w: 48, h: 24},
        slices: [
          {name: 'panel', keys: [{frame: 0, bounds: {x: 0, y: 0, w: 24, h: 24}, center: {x: 8, y: 8, w: 8, h: 8}}]},
          {name: 'blank', keys: [{frame: 0, bounds: {x: 24, y: 0, w: 24, h: 24}, center: {x: 4, y: 4, w: 16, h: 16}}]},
        ],
      },
    });
    const colorAt = await renderPanel(colorMap, 40, 32, (sprite) => sprite.setSliceFrame(atlas.frame('kit 0.aseprite'), 'panel'));
    colorMap.dispose();

    expectBorder(colorAt, 40, 32, 8, 'the panel of the kit');
  });

  it('mirrors a panel of unequal borders with Flip, its left border the right one of the frame', async function () {
    const colorMap = makeColorTexture(blockTexels(), 24, 24);
    const setUp = (flipX) => (sprite) => {
      sprite.setTexCoords(0, 0, 1, 1);
      sprite.setSliceInsets(4, 8, 12, 8);
      sprite.flipX = flipX;
    };
    const plain = await renderPanel(colorMap, 48, 32, setUp(0));
    const flipped = await renderPanel(colorMap, 48, 32, setUp(1));
    colorMap.dispose();

    // points away from every edge of a band and a block: the plain panel has its bands at 4 and 36
    for (const x of [1.5, 3, 6, 18, 30, 34, 38, 42, 44, 46.5]) {
      for (const y of [2, 16, 30]) {
        expect(flipped(48 - x, y), `the flipped panel at (${48 - x}, ${y})`).to.satisfy((c) => isNearColor(c, plain(x, y), 3));
      }
    }
    expect(plain(46.5, 16), 'the plain panel, inside its right border').to.satisfy((c) => isNearColor(c, blockAt(2, 1), 3));
    expect(flipped(1.5, 16), 'the flipped panel, inside its left border').to.satisfy((c) => isNearColor(c, blockAt(2, 1), 3));
  });

  it('places a panel anchored at (0, 0) by its top left corner', async function () {
    const colorMap = makeColorTexture(blockTexels(), 24, 24);
    // the panel of 20 × 20 at the origin of the view, its top left corner there: renderPanel() answers
    // points from the top left of a panel of 20 × 20 centred on the origin, 10 units up and to the left
    const colorAt = await renderPanel(colorMap, 20, 20, (sprite) => {
      sprite.setTexCoords(0, 0, 1, 1);
      sprite.setSliceInsets(8, 8, 8, 8);
      sprite.setAnchor(0, 0);
    });
    colorMap.dispose();

    expect(colorAt(10.5, 10.5), 'the top left corner').to.satisfy((c) => isNearColor(c, blockAt(0, 0), 3));
    expect(colorAt(29.5, 29.5), 'the bottom right corner').to.satisfy((c) => isNearColor(c, blockAt(2, 2), 3));
    expect(colorAt(20, 20), 'the middle').to.satisfy((c) => isNearColor(c, blockAt(1, 1), 3));
    expect(colorAt(9.5, 10.5), 'left of the panel').to.satisfy((c) => isNearColor(c, BLACK));
    expect(colorAt(10.5, 9.5), 'above the panel').to.satisfy((c) => isNearColor(c, BLACK));
  });
});

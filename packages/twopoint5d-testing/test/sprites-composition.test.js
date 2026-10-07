import {expect} from '@esm-bundle/chai';
import {
  AtlasFrame,
  BillboardPlacement,
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  Rotation,
  Shear,
  TextureColor,
  TexturedSpriteKind,
  TexturePackerJson,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  diffPixels,
  disposeDisplay,
  isNearColor,
  makeColorTexture,
  makeContainer,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

// 16 world units across 64 pixels: one unit is 4 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 4;

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];
const BLACK = [0, 0, 0, 255];

// the composition every render of this file draws
const WIDTH = 5;
const HEIGHT = 4;
const SHEAR_X = 0.25;
const ROTATION = Math.PI / 6;

const ShearedSprite = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Shear, Rotation, AtlasFrame, TextureColor],
});

/**
 * The sheet of sprites-trimmed-frames.test.js: an untrimmed 5 × 4 frame and the same frame trimmed to 2 × 1.
 * The frame `pair` is the red and the green texel of `trimmed` without its trim: drawn on the whole
 * quad, its colors reach out to the corners, where the order of shear and rotation shows.
 */
function makeTrimmedSheet() {
  const width = 8;
  const height = 4;
  const texels = Array.from({length: width * height}, () => [0, 0, 0, 0]);
  texels[2 * width + 1] = RED;
  texels[2 * width + 2] = GREEN;
  texels[5] = RED;
  texels[6] = GREEN;
  const trim = {trimmed: true, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}};
  return {
    texture: makeColorTexture(texels, width, height),
    json: {
      frames: {
        reference: {frame: {x: 0, y: 0, w: 5, h: 4}},
        trimmed: {frame: {x: 5, y: 0, w: 2, h: 1}, ...trim},
        pair: {frame: {x: 5, y: 0, w: 2, h: 1}},
      },
      meta: {image: 'sheet.png', size: {w: width, h: height}},
    },
  };
}

/** The color each frame shows at `(u, v)` of the frame, `v` counted downwards from its top edge. */
const FRAME_COLORS = {
  reference: (u, v) => {
    const column = Math.floor(u * 5);
    const row = Math.floor(v * 4);
    if (row !== 2) return BLACK;
    return column === 1 ? RED : column === 2 ? GREEN : BLACK;
  },
  pair: (u) => (u < 0.5 ? RED : GREEN),
};

/**
 * The color the sprite at the origin shows at the world point `(x, y)`: the point is taken back
 * through the rotation, then the shear, then the size — the local stages in reverse — onto the unit
 * quad, and the frame is read there. Outside the quad, and on a transparent texel, the clear color.
 */
function colorAt(frameColor, x, y) {
  const cos = Math.cos(ROTATION);
  const sin = Math.sin(ROTATION);
  const turnedX = cos * x + sin * y;
  const turnedY = -sin * x + cos * y;
  const quadX = (turnedX - SHEAR_X * turnedY) / WIDTH;
  const quadY = turnedY / HEIGHT;
  if (quadX < -0.5 || quadX >= 0.5 || quadY < -0.5 || quadY >= 0.5) return BLACK;
  return frameColor(quadX + 0.5, 0.5 - quadY);
}

// a pixel whose centre lies closer than this to an edge of the model is left out: rasterisation may
// put it on either side
const EDGE_MARGIN_PX = 0.75;

/**
 * Compares every pixel of `pixels` against {@link colorAt} that lies at least {@link EDGE_MARGIN_PX}
 * away from every edge of the model, and answers how many it checked, how many of those are lit,
 * and the ones that differ. `topDown` is the row order the backend read the target back in.
 */
function compareWithModel(pixels, frameColor, topDown) {
  const ring = Array.from({length: 16}, (_, i) => [Math.cos((i * Math.PI) / 8), Math.sin((i * Math.PI) / 8)]);
  const worldAt = (px, py) => [(px - TARGET_SIZE / 2) / PIXELS_PER_UNIT, (TARGET_SIZE / 2 - py) / PIXELS_PER_UNIT];
  let checked = 0;
  let lit = 0;
  const differing = [];
  for (let row = 0; row < TARGET_SIZE; row++) {
    for (let column = 0; column < TARGET_SIZE; column++) {
      // row counts from the top of the picture
      const expected = colorAt(frameColor, ...worldAt(column + 0.5, row + 0.5));
      const unambiguous = ring.every(
        ([dx, dy]) =>
          colorAt(frameColor, ...worldAt(column + 0.5 + dx * EDGE_MARGIN_PX, row + 0.5 + dy * EDGE_MARGIN_PX)) === expected,
      );
      if (!unambiguous) continue;
      checked++;
      if (expected !== BLACK) lit++;
      const rgb = rgbAt(pixels, TARGET_SIZE, column, topDown ? row : TARGET_SIZE - 1 - row);
      if (!isNearColor(rgb, expected)) differing.push(`(${column}, ${row}) ${rgb} for ${expected.slice(0, 3)}`);
    }
  }
  return {checked, lit, differing};
}

describe('sprites — a sprite composed of size, shear and rotation on a trimmed frame', function () {
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
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  function makeCamera() {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;
    return camera;
  }

  /**
   * Whether the backend reads a target back from its top row down — WebGPU does, WebGL 2 reads from
   * the bottom up. A sprite above the middle answers it.
   */
  async function readsTopDown() {
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1});
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    sprite.setPosition(0, 4, 0);
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const pixels = await renderToPixels(display.renderer, scene, makeCamera(), target);
    sprites.dispose();

    const upperRow = TARGET_SIZE / 2 - 4 * PIXELS_PER_UNIT;
    const upper = !isNearColor(rgbAt(pixels, TARGET_SIZE, TARGET_SIZE / 2, upperRow), [0, 0, 0]);
    const lower = !isNearColor(rgbAt(pixels, TARGET_SIZE, TARGET_SIZE / 2, TARGET_SIZE - 1 - upperRow), [0, 0, 0]);
    expect(upper !== lower, 'the probe sprite shows in exactly one of the two rows it may land in').to.equal(true);
    return upper;
  }

  /** Renders one sprite of 5 × 4 units, sheared and turned, showing `frameName`, once per placement. */
  async function render(frameName) {
    const {texture, json} = makeTrimmedSheet();
    const [atlas] = TexturePackerJson.parse(json);
    const sprites = new FeatureSprites(ShearedSprite, {capacity: 1, textures: {colorMap: texture}});
    const sprite = sprites.createSprite();
    sprite.setSize(WIDTH, HEIGHT);
    sprite.setShear(SHEAR_X, 0);
    sprite.rotation = ROTATION;
    sprite.setPosition(0, 0, 0);
    sprite.setFrame(atlas.frame(frameName));
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const flat = await renderToPixels(display.renderer, scene, makeCamera(), target);
    // one live material: the swap rebuilds the position graph, the sprite data stays as it is
    sprites.placement = BillboardPlacement;
    const billboard = await renderToPixels(display.renderer, scene, makeCamera(), target);

    // the mesh releases the material it built around the texture; the texture stays the caller's
    sprites.dispose();
    texture.dispose();
    return {flat, billboard};
  }

  it('draws the trimmed frame where the untrimmed one has its texels, flat and as a billboard', async function () {
    const reference = await render('reference');
    const trimmed = await render('trimmed');

    const flat = diffPixels(reference.flat, trimmed.flat);
    const billboard = diffPixels(reference.flat, trimmed.billboard);
    const placementSwap = diffPixels(reference.flat, reference.billboard);

    // the red and the green texel cover two cells of 4 × 4 pixels, sheared and turned
    expect(flat.lit, 'the reference draws its two texels').to.be.greaterThan(20);
    // an edge rasterised from a trimmed corner may fall on the other side of a pixel centre
    expect(flat.differing, 'the trimmed frame against the untrimmed one').to.be.at.most(Math.ceil(flat.lit * 0.1));
    expect(billboard.differing, 'the trimmed frame as a billboard against the untrimmed flat one').to.be.at.most(
      Math.ceil(flat.lit * 0.1),
    );
    // a camera looking straight down -z sees a billboard exactly as the flat sprite
    expect(placementSwap.differing, 'the same sprite flat and as a billboard').to.be.at.most(Math.ceil(flat.lit * 0.1));
  });

  // the comparisons above hold for any order of the local stages, since reference and trimmed frame
  // go through the same one; this one holds the picture to the model of size, then shear, then rotation
  it('places the frame where size, then shear, then rotation put it, flat and as a billboard', async function () {
    const topDown = await readsTopDown();
    // the red and the green texel of the reference lie close to the pivot, where the order of shear
    // and rotation moves them by less than a pixel; the pair reaches out to the corners
    for (const frameName of ['reference', 'pair']) {
      const {flat, billboard} = await render(frameName);
      for (const [placement, pixels] of Object.entries({flat, billboard})) {
        const {checked, lit, differing} = compareWithModel(pixels, FRAME_COLORS[frameName], topDown);
        expect(lit, `the lit pixels of ${frameName} ${placement} the model checks`).to.be.greaterThan(
          frameName === 'pair' ? 200 : 10,
        );
        expect(checked, `the pixels of ${frameName} ${placement} the model checks`).to.be.greaterThan(3500);
        expect(differing, `the pixels of ${frameName} ${placement} against the model`).to.deep.equal([]);
      }
    }
  });
});

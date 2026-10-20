import {expect} from '@esm-bundle/chai';
import {
  AtlasFrame,
  defineFeature,
  defineSprite,
  Display,
  FeatureSprites,
  InstancePosition,
  QuadBase,
  QuadSize,
  RepeatingTextureColor,
  SegmentEnd,
  SegmentPlacement,
  segmentPlacement,
  TextureColor,
  TexturePackerJson,
} from '@spearwolf/twopoint5d';
import {fract, mul, vec2} from 'three/tsl';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  compareWithModel,
  countMixed,
  disposeDisplay,
  makeColorTexture,
  makeContainer,
  makeMipmappedChecker,
  readsTopDown,
  renderToPixels,
} from './helpers/fixtures.js';

const TARGET_SIZE = 64;
const PPU = 4;

const BLACK = [0, 0, 0, 255];
const WHITE = [255, 255, 255, 255];
const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];

const BLUE = [0, 0, 255, 255];

/**
 * @param {import('@spearwolf/twopoint5d').SpriteFeature} placement
 * @param {import('@spearwolf/twopoint5d').SpriteFeature} [colorSource]
 */
const segmentsOf = (placement, colorSource = TextureColor) =>
  defineSprite({base: QuadBase, features: [InstancePosition, SegmentEnd, placement, QuadSize, AtlasFrame, colorSource]});

/** The frame repeated three times along x by a bare fract(): the seam of the smallest mip level at each wrap. */
const BareRepeat = defineFeature({
  name: 'bareRepeat',
  textures: {colorMap: {}},
  colorSource: (_frame, {uv, sample}) => sample('colorMap', /** @type {any} */ (fract(vec2(mul(uv.x, 3), uv.y)))),
});

/**
 * The model of a segment from `start` to `end` in the plane of the view, `width` the caps and
 * `height` the thickness: the across half towards the left of the direction in `top`, the other in
 * `bottom`. A segment of no length is the caps quad along +x.
 */
const segmentModel =
  ([sx, sy], [ex, ey], width, height, top, bottom = top) =>
  (x, y) => {
    const length = Math.hypot(ex - sx, ey - sy);
    const [ux, uy] = length > 0 ? [(ex - sx) / length, (ey - sy) / length] : [1, 0];
    const along = (x - sx) * ux + (y - sy) * uy;
    const across = -(x - sx) * uy + (y - sy) * ux;
    if (along < -width / 2 || along > length + width / 2 || Math.abs(across) > height / 2) return BLACK;
    return across > 0 ? top : bottom;
  };

/** The union of the models: the first that shows anything but black. */
const either =
  (...models) =>
  (x, y) =>
    models.map((model) => model(x, y)).find((color) => color !== BLACK) ?? BLACK;

describe('sprites — segments lie along their ends', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {RenderTarget | undefined} */
  let target;
  /** @type {(() => void)[]} */
  let disposals = [];

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
  });

  afterEach(() => {
    for (const dispose of disposals) dispose();
    disposals = [];
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  /**
   * An orthographic camera on the origin, `PPU` pixels to the unit: from the front, along −z with +y
   * up, or from above, along −y with −z up — both show x to the right.
   *
   * @param {'front' | 'above'} from
   */
  function makeCamera(from) {
    const half = TARGET_SIZE / PPU / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    if (from === 'front') {
      camera.position.set(0, 0, 10);
    } else {
      camera.position.set(0, 10, 0);
      camera.up.set(0, 0, -1);
    }
    camera.lookAt(0, 0, 0);
    return camera;
  }

  /**
   * Segments of `placement`, with the frame `texels` (one column, rows from the top) on all of them.
   *
   * @param {import('@spearwolf/twopoint5d').SpriteFeature} placement
   * @param {number[][]} texels
   * @param {{start: [number, number, number], end: [number, number, number], size: [number, number]}[]} segments
   */
  function makeSegments(placement, texels, segments) {
    const colorMap = makeColorTexture(texels, 1, texels.length);
    const sprites = new FeatureSprites(segmentsOf(placement), {capacity: segments.length, textures: {colorMap}});
    for (const {start, end, size} of segments) {
      const segment = sprites.createSprite();
      segment.setPosition(...start);
      segment.setSegmentEnd(...end);
      segment.setSize(...size);
      segment.setTexCoords(0, 0, 1, 1);
    }
    disposals.push(() => {
      sprites.dispose();
      colorMap.dispose();
    });
    return sprites;
  }

  async function render(sprites, from) {
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const pixels = await renderToPixels(display.renderer, scene, makeCamera(from), target);
    const topDown = await readsTopDown(display.renderer, target);
    return {pixels, topDown};
  }

  function expectModel({pixels, topDown}, colorAt) {
    const {checked, lit, differing} = compareWithModel(pixels, {
      size: TARGET_SIZE,
      pixelsPerUnit: PPU,
      topDown,
      black: BLACK,
      colorAt,
    });
    expect(lit, 'the pixels the model lights').to.be.above(20);
    expect(differing.slice(0, 8), `of ${checked} pixels checked`).to.deep.equal([]);
  }

  describe("in the plane 'xy'", () => {
    it('lays a quad from start to end, its caps beyond both ends and its thickness across', async function () {
      const sprites = makeSegments(
        SegmentPlacement,
        [WHITE],
        [
          {start: [-5, -3, 0], end: [5, 3, 0], size: [1, 2]},
          {start: [-6, 5, 0], end: [2, 5, 0], size: [0, 1]},
        ],
      );

      expectModel(
        await render(sprites, 'front'),
        either(segmentModel([-5, -3], [5, 3], 1, 2, WHITE), segmentModel([-6, 5], [2, 5], 0, 1, WHITE)),
      );
    });

    it('shows the top of the frame on the left of the direction', async function () {
      const sprites = makeSegments(
        SegmentPlacement,
        [RED, GREEN],
        [
          {start: [-5, 3, 0], end: [5, 3, 0], size: [0, 2]},
          {start: [5, -3, 0], end: [-5, -3, 0], size: [0, 2]},
        ],
      );

      expectModel(
        await render(sprites, 'front'),
        either(segmentModel([-5, 3], [5, 3], 0, 2, RED, GREEN), segmentModel([5, -3], [-5, -3], 0, 2, RED, GREEN)),
      );
    });

    it('draws a segment of no length as its caps quad', async function () {
      const sprites = makeSegments(SegmentPlacement, [WHITE], [{start: [-3, 2, 0], end: [-3, 2, 0], size: [4, 2]}]);

      expectModel(await render(sprites, 'front'), segmentModel([-3, 2], [-3, 2], 4, 2, WHITE));
    });
  });

  describe("in the plane 'xz'", () => {
    it('lies on the ground seen from above, the top of the frame towards −z', async function () {
      const sprites = makeSegments(
        segmentPlacement({plane: 'xz'}),
        [RED, GREEN],
        [
          {start: [-5, 0, 2], end: [5, 0, 2], size: [0, 2]},
          {start: [-4, 0, -6], end: [4, 0, -2], size: [1, 1]},
        ],
      );

      // seen from above, the view's y is −z
      expectModel(
        await render(sprites, 'above'),
        either(segmentModel([-5, -2], [5, -2], 0, 2, RED, GREEN), segmentModel([-4, 6], [4, 2], 1, 1, RED, GREEN)),
      );
    });
  });

  describe('facing the camera', () => {
    const FACING = segmentPlacement({facing: 'camera'});

    for (const from of ['front', 'above']) {
      it(`draws its full thickness, its top up, seen from ${from === 'front' ? 'the front' : 'above'}`, async function () {
        const sprites = makeSegments(FACING, [RED, GREEN], [{start: [-5, 0, 0], end: [5, 0, 0], size: [1, 2]}]);

        expectModel(await render(sprites, from), segmentModel([-5, 0], [5, 0], 1, 2, RED, GREEN));
      });
    }

    it('where a segment in the plane, seen from above, is edge on and draws nothing', async function () {
      const sprites = makeSegments(SegmentPlacement, [WHITE], [{start: [-5, 0, 0], end: [5, 0, 0], size: [1, 2]}]);

      const {pixels, topDown} = await render(sprites, 'above');
      const {differing} = compareWithModel(pixels, {
        size: TARGET_SIZE,
        pixelsPerUnit: PPU,
        topDown,
        black: BLACK,
        colorAt: () => BLACK,
      });
      expect(differing.length, 'lit pixels').to.be.below(TARGET_SIZE / 2);
    });

    it('draws a segment of no length as its caps quad, the right of the camera along it', async function () {
      const sprites = makeSegments(FACING, [RED, GREEN], [{start: [-3, 0, -4], end: [-3, 0, -4], size: [4, 2]}]);

      // above (−3, 0, −4) the camera from above sees the point at (−3, 4) of its view
      expectModel(await render(sprites, 'above'), segmentModel([-3, 4], [-3, 4], 4, 2, RED, GREEN));
    });
  });

  describe('RepeatingTextureColor', () => {
    /**
     * Segments of `colorSource` under the plane placement on `colorMap`, each showing `frame` — the tex
     * coords of a frame, or one out of an atlas.
     *
     * @param {import('@spearwolf/twopoint5d').SpriteFeature} colorSource
     * @param {import('three/webgpu').Texture} colorMap
     * @param {[number, number, number, number] | import('@spearwolf/twopoint5d').TextureAtlasFrame} frame
     * @param {{start: [number, number, number], end: [number, number, number], size: [number, number]}[]} segments
     */
    function makeRepeating(colorSource, colorMap, frame, segments) {
      const sprites = new FeatureSprites(segmentsOf(SegmentPlacement, colorSource), {
        capacity: segments.length,
        textures: {colorMap},
      });
      for (const {start, end, size} of segments) {
        const segment = sprites.createSprite();
        segment.setPosition(...start);
        segment.setSegmentEnd(...end);
        segment.setSize(...size);
        if (Array.isArray(frame)) segment.setTexCoords(...frame);
        else segment.setFrame(frame);
      }
      disposals.push(() => sprites.dispose());
      return sprites;
    }

    it('repeats a 64 × 16 frame of an atlas twice along a segment 8 long and 1 thick, no texel of a neighbour drawn', async function () {
      // a sheet of 128 × 32 in blue, the frame at (32, 8): its left half red, its right half green
      const width = 128;
      const height = 32;
      const texels = Array.from({length: width * height}, (_, i) => {
        const x = i % width;
        const y = Math.floor(i / width);
        if (x < 32 || x >= 96 || y < 8 || y >= 24) return BLUE;
        return x < 64 ? RED : GREEN;
      });
      const colorMap = makeColorTexture(texels, width, height);
      disposals.push(() => colorMap.dispose());
      const [atlas] = TexturePackerJson.parse({
        frames: {rope: {frame: {x: 32, y: 8, w: 64, h: 16}}},
        meta: {image: 'rope.png', size: {w: width, h: height}},
      });
      const sprites = makeRepeating(RepeatingTextureColor, colorMap, atlas.frame('rope'), [
        {start: [-4, 2, 0], end: [4, 2, 0], size: [0, 1]},
        // the same rope the other way round: the frame runs from its start
        {start: [4, -2, 0], end: [-4, -2, 0], size: [0, 1]},
      ]);

      // the frame repeats every 4 units, red on its first half
      const repeated = (y0, fromStart) => (x, y) => {
        if (Math.abs(y - y0) > 0.5 || Math.abs(x) > 4) return BLACK;
        const along = fromStart(x);
        return along % 4 < 2 ? RED : GREEN;
      };
      expectModel(
        await render(sprites, 'front'),
        either(
          repeated(2, (x) => x + 4),
          repeated(-2, (x) => 4 - x),
        ),
      );
    });

    it('repeats a mipmapped frame without a seam at its wraps, where a bare fract() shows one', async function () {
      const colorMap = makeMipmappedChecker();
      disposals.push(() => colorMap.dispose());
      // 12 long and 4 thick: the checker of 4 × 4 texels three times. The gpu works the derivatives out
      // over blocks of 2 × 2 pixels, and a seam shows only in a block a wrap runs through: a quarter of
      // a unit — one pixel — off the middle, the wraps lie on odd pixels and cut through blocks
      /** @type {{start: [number, number, number], end: [number, number, number], size: [number, number]}[]} */
      const segments = [{start: [-5.75, 0.25, 0], end: [6.25, 0.25, 0], size: [0, 4]}];

      const repeating = await render(makeRepeating(RepeatingTextureColor, colorMap, [0, 0, 1, 1], segments), 'front');
      const bare = await render(makeRepeating(BareRepeat, colorMap, [0, 0, 1, 1], segments), 'front');

      expect(countMixed(bare.pixels), 'mixed pixels of the bare fract(), the seam the test has to see').to.be.greaterThan(0);
      expect(countMixed(repeating.pixels), 'mixed pixels of RepeatingTextureColor').to.equal(0);
    });
  });
});

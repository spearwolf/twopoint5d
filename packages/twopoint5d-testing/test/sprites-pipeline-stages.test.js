import {expect} from '@esm-bundle/chai';
import {
  AnimatedFrames,
  AtlasFrame,
  ColorOrder,
  defineFeature,
  definePass,
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  FrameBasedAnimations,
  FrameOrder,
  gridBase,
  InstancePosition,
  LocalOrder,
  MeshOrder,
  QuadBase,
  QuadSize,
  TextureColor,
  TexturePackerJson,
  UvOrder,
} from '@spearwolf/twopoint5d';
import {abs, add, div, float, max, min, mix, mul, round, step, sub, vec2, vec3, vec4} from 'three/tsl';
import {OrthographicCamera, RenderTarget, Scene, Texture} from 'three/webgpu';
import {
  cellColors as cellColorsOf,
  disposeDisplay,
  disposeKept,
  expectSameCells,
  isNearColor,
  keep,
  makeColorTexture,
  makeContainer,
  makeSheetWithTurnedCopy,
  makeTrimmedSheet,
  mirroredX,
  mirroredY,
  readsTopDown,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

// The features below are no features of the library: they prove that the frame stages, the uv
// stages, gridBase() and the shared uniforms carry Flip and NineSlice as their spec sketches them
// (docs/proposals/pipeline-stages-and-grid-base.md, §7). The proof for wave() went with the
// feature itself: sprites-wave.test.js holds the real wave() to the same bend and shear.

const TARGET_SIZE = 64;

/** @typedef {import('@spearwolf/twopoint5d').SpriteFeature<{flipX: number, flipY: number}>} FlipFeature */
/**
 * @typedef {import('@spearwolf/twopoint5d').SpriteFeature<{
 *   setSliceInsets(left: number, top: number, right: number, bottom: number): void,
 * }>} NineSliceFeature
 */

/**
 * An attribute of the kind as a TSL vector: the typed `attribute<T>()` of a stage context takes a
 * type argument JavaScript cannot write.
 *
 * @param {import('@spearwolf/twopoint5d').SpriteFrameContext} ctx
 * @param {string} name
 * @returns {any}
 */
const vectorAttribute = (ctx, name) => ctx.attribute(name);

// 1 for a flag of 1, 0 for a flag of 0: mixes without a branch
const flagged = (from, to, flag) => mix(from, to, flag);

/** A mirror of the drawn image in a frame stage: `s` and `s + u` swap, and so do the trim margins left and right. */
const Flip = /** @type {FlipFeature} */ (
  defineFeature({
    name: 'flip',
    attributes: {flip: {components: ['flipX', 'flipY']}},
    /** @this {{flipX: number, flipY: number}} */
    initialize() {
      this.flipX = 0;
      this.flipY = 0;
    },
    frameStage: {
      order: FrameOrder.Flip,
      transform: (frame, ctx) => {
        const flip = vectorAttribute(ctx, 'flip');
        /** @type {any} */
        const c = frame.texCoords;
        /** @type {any} */
        const trim = frame.trim ?? vec4(0, 0, 0, 0);
        const texCoords = vec4(
          add(c.x, mul(c.z, flip.x)),
          add(c.y, mul(c.w, flip.y)),
          mul(c.z, sub(1, mul(2, flip.x))),
          mul(c.w, sub(1, mul(2, flip.y))),
        );
        return {
          ...frame,
          texCoords,
          trim: vec4(
            flagged(trim.x, trim.z, flip.x),
            flagged(trim.y, trim.w, flip.y),
            flagged(trim.z, trim.x, flip.x),
            flagged(trim.w, trim.y, flip.y),
          ),
        };
      },
    },
  })
);

// 1 where `value` is `line`, 0 elsewhere — for the whole numbers round() answers
const onLine = (value, line) => sub(1, min(abs(sub(value, line)), 1));

/**
 * A nine-slice on gridBase({columns: 3, rows: 3}): the inner grid lines of the position move to
 * `sliceInsets` world units from the edges — one unit per pixel of the frame — before QuadSize scales,
 * and those of the uv to as many pixels of the frame.
 */
const NineSlice = /** @type {NineSliceFeature} */ (
  defineFeature({
    name: 'nineSlice',
    requires: ['quadSize'],
    attributes: {sliceInsets: {components: ['insetLeft', 'insetTop', 'insetRight', 'insetBottom']}},
    /** @this {{setSliceInsets(left: number, top: number, right: number, bottom: number): void}} */
    initialize() {
      this.setSliceInsets(0, 0, 0, 0);
    },
    checkKind: ({base}) => {
      if (base !== gridBase({columns: 3, rows: 3})) throw new Error('needs the base gridBase({columns: 3, rows: 3})');
    },
    local: {
      order: LocalOrder.Scale - 20,
      transform: (position, ctx) => {
        const uv = vectorAttribute(ctx, 'uv');
        const insets = vectorAttribute(ctx, 'sliceInsets');
        /** @type {any} */
        const size = max(vectorAttribute(ctx, 'quadSize'), vec2(1e-6, 1e-6));
        /** @type {any} */
        const line = round(mul(uv, 3));
        // the unit quad of the default baseArgs: a vertex lies uv away from the top left
        const left = sub(position.x, uv.x);
        const top = add(position.y, uv.y);
        const x = add(
          position.x,
          add(
            mul(onLine(line.x, 1), sub(add(left, mul(insets.x, size.x.reciprocal())), position.x)),
            mul(onLine(line.x, 2), sub(sub(add(left, 1), mul(insets.z, size.x.reciprocal())), position.x)),
          ),
        );
        const y = add(
          position.y,
          add(
            mul(onLine(line.y, 1), sub(sub(top, mul(insets.y, size.y.reciprocal())), position.y)),
            mul(onLine(line.y, 2), sub(add(sub(top, 1), mul(insets.w, size.y.reciprocal())), position.y)),
          ),
        );
        return vec3(x, y, position.z);
      },
    },
    uv: {
      order: UvOrder.Slice,
      transform: (uv, ctx) => {
        /** @type {any} */
        const size = ctx.textureSize('colorMap');
        const drawn = mix(size.xy, size.yx, step(0.5, ctx.frame.flipDiagonal ?? float(0)));
        /** @type {any} */
        const pixels = max(mul(abs(/** @type {any} */ (ctx.frame.texCoords).zw), drawn), vec2(1, 1));
        const insets = vectorAttribute(ctx, 'sliceInsets');
        /** @type {any} */
        const line = round(mul(vectorAttribute(ctx, 'uv'), 3));
        const u = add(
          uv.x,
          add(
            mul(onLine(line.x, 1), sub(mul(insets.x, pixels.x.reciprocal()), uv.x)),
            mul(onLine(line.x, 2), sub(sub(1, mul(insets.z, pixels.x.reciprocal())), uv.x)),
          ),
        );
        const v = add(
          uv.y,
          add(
            mul(onLine(line.y, 1), sub(mul(insets.y, pixels.y.reciprocal()), uv.y)),
            mul(onLine(line.y, 2), sub(sub(1, mul(insets.w, pixels.y.reciprocal())), uv.y)),
          ),
        );
        return vec2(u, v);
      },
    },
  })
);

/** A bob that declares the time it reads shared: next to AnimatedFrames it reads the same uniform. */
const Bob = defineFeature({
  name: 'bob',
  requires: ['instancePosition'],
  uniforms: {time: {value: 0, shared: true}},
  mesh: {
    order: MeshOrder.Offset,
    transform: (position, {uniform}) => add(position, vec3(0, /** @type {any} */ (uniform('time')), 0)),
  },
});

/** Paints the sprite in the measures of the colorMap of TextureColor, in texels: red the width, green the height. */
const SizeColor = defineFeature({
  name: 'sizeColor',
  color: {
    order: ColorOrder.Pass + 10,
    transform: (_color, {textureSize}) => {
      /** @type {any} */
      const measures = div(textureSize('colorMap'), 255);
      return vec4(measures, 0, 1);
    },
  },
});

const FlipKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Flip],
});
const AnimatedFlipKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AnimatedFrames, TextureColor, Flip],
});
const NineSliceKind = defineSprite({
  base: gridBase({columns: 3, rows: 3}),
  features: [InstancePosition, FlatPlacement, QuadSize, NineSlice, AtlasFrame, TextureColor],
});
const BobKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AnimatedFrames, TextureColor, Bob],
});
const cellColors = (pixels, pixelsPerUnit, topDown, x, y, columns, rows) =>
  cellColorsOf(pixels, TARGET_SIZE, pixelsPerUnit, topDown, x, y, columns, rows);

describe('sprites — the pipeline stages carry flip and nine-slice', function () {
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
    disposeKept();
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  function makeCamera(pixelsPerUnit) {
    const half = TARGET_SIZE / pixelsPerUnit / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;
    return camera;
  }

  async function render(sprites, pixelsPerUnit) {
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    return renderToPixels(display.renderer, scene, makeCamera(pixelsPerUnit), target);
  }

  describe('a flip frame stage', () => {
    // an image of 3 × 2 texels, six colors: not square, so a mix-up of width and height shows
    // biome-ignore format: the line breaks lay the numbers out row by row
    const IMAGE = [
      [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255],
      [255, 255, 0, 255], [0, 255, 255, 255], [255, 0, 255, 255],
    ];
    const PPU = 4;

    it('mirrors an upright and a turned atlas frame along x, along y and along both', async function () {
      const {texture, json} = makeSheetWithTurnedCopy(IMAGE, 3, 2);
      keep(texture);
      const [atlas] = TexturePackerJson.parse(json);
      const sprites = keep(new FeatureSprites(FlipKind, {capacity: 8, textures: {colorMap: texture}}));
      const flips = [
        [0, 0],
        [1, 0],
        [0, 1],
        [1, 1],
      ];
      flips.forEach(([flipX, flipY], i) => {
        ['upright', 'turned'].forEach((name, j) => {
          const sprite = sprites.createSprite();
          sprite.setSize(3, 2);
          sprite.setPosition(-6 + i * 4, j === 0 ? 3 : -3, 0);
          sprite.setFrame(atlas.frame(name));
          sprite.flipX = flipX;
          sprite.flipY = flipY;
        });
      });

      const pixels = await render(sprites, PPU);
      const topDown = await readsTopDown(display.renderer, target);

      for (const [j, name] of ['upright', 'turned'].entries()) {
        const y = j === 0 ? 3 : -3;
        const [plain, flippedX, flippedY, flippedXY] = flips.map((_, i) => cellColors(pixels, PPU, topDown, -6 + i * 4, y, 3, 2));
        expectSameCells(flippedX, mirroredX(plain), `the ${name} frame flipped along x`);
        expectSameCells(flippedY, mirroredY(plain), `the ${name} frame flipped along y`);
        expectSameCells(flippedXY, mirroredY(mirroredX(plain)), `the ${name} frame flipped along both`);
      }
    });

    it('keeps a trimmed frame, also one the packer turned, where the flipped untrimmed sprite has it', async function () {
      const {texture, json} = makeTrimmedSheet();
      keep(texture);
      const [atlas] = TexturePackerJson.parse(json);
      const sprites = keep(new FeatureSprites(FlipKind, {capacity: 4, textures: {colorMap: texture}}));
      const place = (name, x, y, flipX) => {
        const sprite = sprites.createSprite();
        sprite.setSize(5, 4);
        sprite.setPosition(x, y, 0);
        sprite.setFrame(atlas.frame(name));
        sprite.flipX = flipX;
      };
      place('reference', -4, 4, 0);
      place('reference', 4, 4, 1);
      place('trimmed', -4, -4, 1);
      place('trimmed-turned', 4, -4, 1);

      const pixels = await render(sprites, PPU);
      const topDown = await readsTopDown(display.renderer, target);

      const reference = cellColors(pixels, PPU, topDown, -4, 4, 5, 4);
      const flipped = cellColors(pixels, PPU, topDown, 4, 4, 5, 4);
      expectSameCells(flipped, mirroredX(reference), 'the untrimmed sprite flipped');
      expectSameCells(cellColors(pixels, PPU, topDown, -4, -4, 5, 4), flipped, 'the trimmed frame flipped');
      expectSameCells(cellColors(pixels, PPU, topDown, 4, -4, 5, 4), flipped, 'the turned trimmed frame flipped');
    });

    it('mirrors every frame AnimatedFrames picks, a turned one among them', async function () {
      const {texture, json} = makeSheetWithTurnedCopy(IMAGE, 3, 2);
      keep(texture);
      const [atlas] = TexturePackerJson.parse(json);
      const anims = new FrameBasedAnimations();
      anims.add('upright', 1, [atlas.frame('upright').coords]);
      anims.add('turned', 1, [atlas.frame('turned').coords]);
      const animsMap = keep(anims.bakeDataTexture());
      const sprites = keep(new FeatureSprites(AnimatedFlipKind, {capacity: 3, textures: {colorMap: texture, animsMap}}));
      const place = (name, x, flipX) => {
        const sprite = sprites.createSprite();
        sprite.setSize(3, 2);
        sprite.setPosition(x, 0, 0);
        sprite.animId = anims.animId(name);
        sprite.flipX = flipX;
      };
      place('upright', -5, 0);
      place('upright', 0, 1);
      place('turned', 5, 1);

      const pixels = await render(sprites, PPU);
      const topDown = await readsTopDown(display.renderer, target);

      const mirrored = mirroredX(cellColors(pixels, PPU, topDown, -5, 0, 3, 2));
      expectSameCells(cellColors(pixels, PPU, topDown, 0, 0, 3, 2), mirrored, 'the animated upright frame flipped');
      expectSameCells(cellColors(pixels, PPU, topDown, 5, 0, 3, 2), mirrored, 'the animated turned frame flipped');
    });
  });

  describe('a nine-slice on gridBase({columns: 3, rows: 3})', () => {
    const PPU = 3;
    // nine blocks of 3 × 3 texels, a color each, row by row from the top left
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
    const blockAt = (column, row) => BLOCKS[row * 3 + column];

    function makeBlocks() {
      const texels = [];
      for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) texels.push(blockAt(Math.floor(x / 3), Math.floor(y / 3)));
      return makeColorTexture(texels, 9, 9);
    }

    /**
     * The block a point of a sprite `width × height` units large at the origin shows, `(x, y)` in units
     * from its top left: the border is 3 units on every side, the middle stretches.
     */
    const expectedBlock = (x, y, width, height) => {
      const band = (value, size) => (value < 3 ? 0 : value < size - 3 ? 1 : 2);
      return blockAt(band(x, width), band(y, height));
    };

    /** @param {[left: number, top: number, right: number, bottom: number]} insets */
    async function renderPanel(width, height, insets) {
      const colorMap = keep(makeBlocks());
      const sprites = keep(new FeatureSprites(NineSliceKind, {capacity: 1, textures: {colorMap}}));
      const sprite = sprites.createSprite();
      sprite.setSize(width, height);
      sprite.setTexCoords(0, 0, 1, 1);
      sprite.setSliceInsets(...insets);
      const pixels = await render(sprites, PPU);
      const topDown = await readsTopDown(display.renderer, target);
      return {pixels, topDown};
    }

    /** The color of the panel at `(x, y)` units from its top left. */
    const colorOfPanel = ({pixels, topDown}, width, height, x, y) => {
      const center = TARGET_SIZE / 2;
      const column = Math.floor(center + (x - width / 2) * PPU);
      const fromTop = Math.floor(center + (y - height / 2) * PPU);
      return rgbAt(pixels, TARGET_SIZE, column, topDown ? fromTop : TARGET_SIZE - 1 - fromTop);
    };

    for (const [width, height] of [
      [12, 12],
      [18, 9],
    ]) {
      it(`keeps the border of a 9 × 9 frame at 3 units on a panel of ${width} × ${height}`, async function () {
        const panel = await renderPanel(width, height, [3, 3, 3, 3]);

        // points half a unit inside each band, and one in the middle of it
        const points = [0.5, 2.5, 3.5, width / 2, width - 3.5, width - 2.5, width - 0.5];
        const rows = [0.5, 2.5, 3.5, height / 2, height - 3.5, height - 2.5, height - 0.5];
        for (const y of rows) {
          for (const x of points) {
            const expected = expectedBlock(x, y, width, height);
            expect(colorOfPanel(panel, width, height, x, y), `the panel at (${x}, ${y})`).to.satisfy((c) =>
              isNearColor(c, expected, 3),
            );
          }
        }
      });
    }

    it('stretches the frame as a quad does with insets of 0', async function () {
      const panel = await renderPanel(18, 9, [0, 0, 0, 0]);

      // the plain stretch puts the first edge of the middle block 6 units in
      expect(colorOfPanel(panel, 18, 9, 4.5, 4.5)).to.satisfy((c) => isNearColor(c, blockAt(0, 1), 3));
      expect(colorOfPanel(panel, 18, 9, 7.5, 4.5)).to.satisfy((c) => isNearColor(c, blockAt(1, 1), 3));
    });

    it('is refused by its checkKind on a base other than the 3 × 3 grid', () => {
      expect(() =>
        defineSprite({
          base: QuadBase,
          features: [InstancePosition, FlatPlacement, QuadSize, NineSlice, AtlasFrame, TextureColor],
        }),
      ).to.throw('defineSprite: feature "nineSlice": needs the base gridBase({columns: 3, rows: 3})');
    });
  });

  describe('a shared time', () => {
    it('moves a sprite whose bob shares the time of AnimatedFrames, by one setUniform()', async function () {
      const PPU = 4;
      const colorMap = keep(makeColorTexture([[255, 255, 255, 255]], 1, 1));
      const sprites = keep(new FeatureSprites(BobKind, {capacity: 1, textures: {colorMap}}));
      const sprite = sprites.createSprite();
      sprite.setSize(2, 2);

      const rowsLit = (pixels) => {
        const rows = [];
        for (let y = 0; y < TARGET_SIZE; y++)
          if (!isNearColor(rgbAt(pixels, TARGET_SIZE, TARGET_SIZE / 2, y), [0, 0, 0])) rows.push(y);
        return rows;
      };

      sprites.setUniform('time', 0);
      const still = rowsLit(await render(sprites, PPU));
      sprites.setUniform('time', 3);
      const moved = rowsLit(await render(sprites, PPU));

      expect(still).to.have.lengthOf(8);
      expect(moved).to.have.lengthOf(8);
      expect(Math.abs(moved[0] - still[0]), 'the sprite moved by 3 units of 4 pixels').to.equal(12);
    });
  });

  describe("textureSize() of another feature's texture", () => {
    const PPU = 4;

    /** A texture as TextureLoader hands it out: no image until it has loaded. */
    const imageArrivesLater = () => {
      const texture = new Texture();
      return {
        texture,
        arrive(width, height) {
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          texture.image = canvas;
          texture.needsUpdate = true;
        },
      };
    };

    const centerColor = (pixels) => rgbAt(pixels, TARGET_SIZE, TARGET_SIZE / 2, TARGET_SIZE / 2);

    it('follows an image that arrives after setTexture(), and a texture swapped in', async function () {
      const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, TextureColor, SizeColor]});
      const late = imageArrivesLater();
      const other = imageArrivesLater();
      keep(late.texture);
      keep(other.texture);
      const sprites = keep(new FeatureSprites(kind, {capacity: 1, textures: {colorMap: late.texture}}));
      sprites.createSprite().setSize(4, 4);

      await render(sprites, PPU);
      late.arrive(7, 3);
      const arrived = centerColor(await render(sprites, PPU));
      other.arrive(5, 9);
      sprites.setTexture('colorMap', other.texture);
      const swapped = centerColor(await render(sprites, PPU));

      expect(arrived, 'the measures of the image that arrived').to.satisfy((c) => isNearColor(c, [7, 3, 0], 0));
      expect(swapped, 'the measures of the texture swapped in').to.satisfy((c) => isNearColor(c, [5, 9, 0], 0));
    });

    it('follows an image that arrives later in the material of a pass', async function () {
      const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, TextureColor]});
      const late = imageArrivesLater();
      keep(late.texture);
      const sprites = keep(
        new FeatureSprites(kind, {
          capacity: 1,
          textures: {colorMap: late.texture},
          passes: [definePass({name: 'size', features: [SizeColor]})],
        }),
      );
      sprites.material.visible = false;
      sprites.createSprite().setSize(4, 4);

      await render(sprites, PPU);
      late.arrive(6, 2);
      const arrived = centerColor(await render(sprites, PPU));

      expect(arrived).to.satisfy((c) => isNearColor(c, [6, 2, 0], 0));
    });
  });
});

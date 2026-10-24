import {expect} from '@esm-bundle/chai';
import {
  AnimatedFrames,
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  FrameBasedAnimations,
  gridBase,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
  TextureCoords,
  wave,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  disposeDisplay,
  disposeKept,
  isNearColor,
  keep,
  makeColorTexture,
  makeContainer,
  readsTopDown,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

const TARGET_SIZE = 64;
const WHITE = [255, 255, 255, 255];

/** @param {import('@spearwolf/twopoint5d').SpriteBase} base */
const swayingOn = (base) =>
  defineSprite({base, features: [InstancePosition, FlatPlacement, QuadSize, TextureColor, wave({weight: 'top'})]});

const ScrollerKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, TextureColor, wave({weight: 'uniform'})],
});

const AnimatedScrollerKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AnimatedFrames, TextureColor, wave({weight: 'uniform'})],
});

describe('sprites — wave() sways and scrolls', function () {
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
    const pixels = await renderToPixels(display.renderer, scene, makeCamera(pixelsPerUnit), target);
    const topDown = await readsTopDown(display.renderer, target);
    return {pixels, topDown};
  }

  const isLit = (rgb) => !isNearColor(rgb, [0, 0, 0]);

  /** The first and the last lit column of the row `fromTop` pixels below the top of the picture. */
  function litColumns({pixels, topDown}, fromTop) {
    const row = topDown ? fromTop : TARGET_SIZE - 1 - fromTop;
    const lit = [];
    for (let x = 0; x < TARGET_SIZE; x++) if (isLit(rgbAt(pixels, TARGET_SIZE, x, row))) lit.push(x);
    return {from: lit[0], to: lit[lit.length - 1]};
  }

  /** The rows, counted from the top of the picture, lit in the column `x`. */
  function litRows({pixels, topDown}, x) {
    const rows = [];
    for (let fromTop = 0; fromTop < TARGET_SIZE; fromTop++) {
      const row = topDown ? fromTop : TARGET_SIZE - 1 - fromTop;
      if (isLit(rgbAt(pixels, TARGET_SIZE, x, row))) rows.push(fromTop);
    }
    return rows;
  }

  describe("weight 'top'", () => {
    const PPU = 4;

    async function renderSway(base) {
      const colorMap = keep(makeColorTexture([WHITE], 1, 1));
      const sprites = keep(new FeatureSprites(swayingOn(base), {capacity: 1, textures: {colorMap}}));
      // at the origin, a time of -0.25 makes the sine 1: phase 2π · (0 + 0.25)
      sprites.setUniform('waveAmplitude', 4);
      sprites.setUniform('time', -0.25);
      sprites.createSprite().setSize(2, 12);
      const picture = await render(sprites, PPU);
      return picture;
    }

    it('bends a sprite on gridBase({columns: 1, rows: 4}): the top by the amplitude, the middle by a quarter, the foot not', async function () {
      const picture = await renderSway(gridBase({columns: 1, rows: 4}));
      // the sprite spans rows 8 … 55 from the top: 12 units of 4 pixels around the middle
      const top = litColumns(picture, 9);
      const middle = litColumns(picture, 32);
      const foot = litColumns(picture, 54);

      expect(foot, 'the foot').to.deep.equal({from: 28, to: 35});
      expect(top.from - foot.from, 'the top moved by about the amplitude, 16 pixels').to.be.within(14, 16);
      expect(middle.from - foot.from, 'the middle moved by a quarter of it').to.be.within(3, 5);
    });

    it('shears the same sprite on the quad: the top by the amplitude, the middle by half of it', async function () {
      const picture = await renderSway(QuadBase);
      const top = litColumns(picture, 9);
      const middle = litColumns(picture, 32);
      const foot = litColumns(picture, 54);

      expect(foot, 'the foot').to.deep.equal({from: 28, to: 35});
      expect(top.from - foot.from).to.be.within(14, 16);
      expect(middle.from - foot.from).to.be.within(7, 9);
    });
  });

  describe("weight 'uniform'", () => {
    const PPU = 2;
    const XS = [-8, -4, 0, 4, 8];

    it('moves each glyph of a row up or down by the sine of its x, whole', async function () {
      const colorMap = keep(makeColorTexture([WHITE], 1, 1));
      const sprites = keep(
        new FeatureSprites(ScrollerKind, {
          capacity: XS.length,
          textures: {colorMap},
          // one wave per 16 units, standing still
          uniforms: {waveAmplitude: 4, waveFrequency: 1 / 16, waveSpeed: 0},
        }),
      );
      for (const x of XS) {
        const glyph = sprites.createSprite();
        glyph.setSize(2, 2);
        glyph.setPosition(x, 0, 0);
      }
      const picture = await render(sprites, PPU);

      for (const x of XS) {
        const offset = 4 * Math.sin((2 * Math.PI * x) / 16);
        const rows = litRows(picture, TARGET_SIZE / 2 + x * PPU);
        // 2 units of 2 pixels, the middle `offset` units above the middle of the picture
        const top = TARGET_SIZE / 2 - (offset + 1) * PPU;
        expect(rows, `the glyph at x = ${x}`).to.deep.equal([top, top + 1, top + 2, top + 3]);
      }
    });

    it('moves with the time it shares with AnimatedFrames', async function () {
      const colorMap = keep(makeColorTexture([WHITE], 1, 1));
      const anims = new FrameBasedAnimations();
      anims.add('still', 1, [new TextureCoords(0, 0, 1, 1)]);
      const animsMap = keep(anims.bakeDataTexture());
      const sprites = keep(
        new FeatureSprites(AnimatedScrollerKind, {
          capacity: 1,
          textures: {colorMap, animsMap},
          uniforms: {waveAmplitude: 3},
        }),
      );
      sprites.createSprite().setSize(2, 2);

      sprites.setUniform('time', 0);
      const still = litRows(await render(sprites, 4), TARGET_SIZE / 2);
      // a quarter wave later the sine is −1
      sprites.setUniform('time', 0.25);
      const moved = litRows(await render(sprites, 4), TARGET_SIZE / 2);

      expect(still).to.have.lengthOf(8);
      expect(moved).to.have.lengthOf(8);
      expect(moved[0] - still[0], 'down by 3 units of 4 pixels').to.equal(12);
    });
  });
});

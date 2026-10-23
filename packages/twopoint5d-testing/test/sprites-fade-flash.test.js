import {expect} from '@esm-bundle/chai';
import {
  defineSprite,
  Display,
  Fade,
  FeatureSprites,
  FlatPlacement,
  Flash,
  InstancePosition,
  QuadBase,
  QuadSize,
  ShadowPass,
  TextureColor,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  diffPixels,
  disposeDisplay,
  disposeKept,
  isNearColor,
  keep,
  makeColorTexture,
  makeContainer,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;
const RED = [255, 0, 0, 255];

const FadingKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, TextureColor, Fade, Flash],
});

describe('sprites — Fade and Flash', function () {
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
    disposeKept();
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

  it('a faded sprite blends to half its color, a flashed one mixes towards the flash color and keeps its alpha', async function () {
    const colorMap = keep(makeColorTexture([RED]));
    const sprites = keep(new FeatureSprites(FadingKind, {capacity: 2, textures: {colorMap}, transparent: true}));
    sprites.frustumCulled = false;

    const faded = sprites.createSprite();
    faded.setSize(2, 2);
    faded.setPosition(-2, 0, 0);
    faded.fade = 0.5;

    const flashed = sprites.createSprite();
    flashed.setSize(2, 2);
    flashed.setPosition(2, 0, 0);
    flashed.setFlash(1, 1, 1, 0.5);

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const pixels = await renderToPixels(display.renderer, scene, makeCamera(), target);

    const fadedRgb = rgbAt(pixels, TARGET_SIZE, CENTER - 2 * PIXELS_PER_UNIT, CENTER);
    const flashedRgb = rgbAt(pixels, TARGET_SIZE, CENTER + 2 * PIXELS_PER_UNIT, CENTER);
    expect(isNearColor(fadedRgb, [128, 0, 0]), `the faded sprite: ${fadedRgb}`).to.be.true;
    expect(isNearColor(flashedRgb, [255, 128, 128]), `the flashed sprite: ${flashedRgb}`).to.be.true;
  });

  it('the shadow of a flashing sprite is the shadow of a plain one', async function () {
    const colorMap = keep(makeColorTexture([RED]));

    async function shadowOf(flashAmount) {
      const sprites = keep(
        new FeatureSprites(FadingKind, {
          capacity: 1,
          textures: {colorMap},
          uniforms: {shadowLight: [-0.5, 0, 1, 0], groundPlane: [0, 0, 1, 0], shadowColor: [0, 0, 1, 1]},
          passes: [ShadowPass],
        }),
      );
      sprites.frustumCulled = false;
      sprites.passes['shadow'].frustumCulled = false;
      // the sprite itself stays out of the picture: only its shadow is compared
      sprites.material.visible = false;
      const sprite = sprites.createSprite();
      sprite.setSize(2, 2);
      sprite.setPosition(0, 0, 1);
      sprite.setFlash(1, 1, 1, flashAmount);

      const scene = new Scene();
      scene.add(sprites);
      sprites.update();
      return renderToPixels(display.renderer, scene, makeCamera(), target);
    }

    const plain = await shadowOf(0);
    const flashing = await shadowOf(1);

    const {lit, differing} = diffPixels(plain, flashing);
    expect(lit, 'the shadow is drawn').to.be.above(0);
    expect(differing, 'pixels where the shadow of the flashing sprite differs').to.equal(0);
  });
});

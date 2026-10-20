import {expect} from '@esm-bundle/chai';
import {
  AnimatedSpriteKind,
  Display,
  FeatureSprites,
  FeatureSpritesGeometry,
  FeatureSpritesMaterial,
  FrameBasedAnimations,
  TextureCoords,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {disposeDisplay, isNearColor, makeColorTexture, makeContainer, renderToPixels, rgbAt} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;

// frame i of every animation here shows texel i of the color map
const COLORS = [
  [255, 0, 0, 255],
  [0, 255, 0, 255],
  [0, 0, 255, 255],
  [255, 255, 255, 255],
];

describe('sprites — AnimatedFrames plays once, ping-pong and per-frame durations', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(30000);

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

  /**
   * Draws one sprite of 4 × 4 units over the middle of the target, the animation named `draw` out of
   * `animations`, once for each of `times`, and answers the frame each render shows — the index of
   * the color of the middle pixel in {@link COLORS}, `-1` for none of them.
   *
   * @param {{
   *   animations: {name: string, timing: number | object, frames: number[]}[],
   *   draw: string,
   *   times: number[],
   *   animOffset?: number,
   * }} options
   */
  async function framesShown({animations, draw, times, animOffset = 0}) {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;

    const colorMap = makeColorTexture(COLORS);
    const sheet = new TextureCoords(0, 0, COLORS.length, 1);
    const anims = new FrameBasedAnimations();
    for (const {name, timing, frames} of animations) {
      anims.add(
        name,
        /** @type {any} */ (timing),
        frames.map((i) => new TextureCoords(sheet, i, 0, 1, 1)),
      );
    }
    const animsMap = anims.bakeDataTexture();

    const geometry = new FeatureSpritesGeometry(AnimatedSpriteKind, 1);
    const material = new FeatureSpritesMaterial(AnimatedSpriteKind, {textures: {colorMap, animsMap}});
    const sprites = new FeatureSprites(AnimatedSpriteKind, {geometry, material});
    sprites.frustumCulled = false;

    const sprite = geometry.instancedPool.createVO();
    sprite.setSize(4, 4);
    sprite.setPosition(0, 0, 0);
    sprite.animId = anims.animId(draw);
    sprite.animOffset = animOffset;

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const shown = [];
    for (const time of times) {
      material.setUniform('time', time);
      const rgb = rgbAt(await renderToPixels(display.renderer, scene, camera, target), TARGET_SIZE, CENTER, CENTER);
      shown.push(COLORS.findIndex((color) => isNearColor(rgb, color)));
    }

    sprites.dispose();
    geometry.dispose();
    material.dispose();
    colorMap.dispose();
    animsMap.dispose();

    return shown;
  }

  it("'once' shows the first frame before its start, plays through and holds its last frame", async function () {
    const shown = await framesShown({
      animations: [{name: 'kick', timing: {duration: 1, playback: 'once'}, frames: [0, 1, 2, 3]}],
      draw: 'kick',
      times: [-0.5, 0.1, 0.35, 0.6, 0.85, 1.1, 5],
    });

    expect(shown).to.deep.equal([0, 0, 1, 2, 3, 3, 3]);
  });

  it("'once' started at animOffset = -now shows its first frame at now", async function () {
    const shown = await framesShown({
      animations: [{name: 'kick', timing: {duration: 1, playback: 'once'}, frames: [0, 1, 2, 3]}],
      draw: 'kick',
      animOffset: -10,
      times: [9, 10.1, 10.6, 12],
    });

    expect(shown).to.deep.equal([0, 0, 2, 3]);
  });

  it("'pingpong' over 4 frames turns at both ends and shows each end frame once", async function () {
    // a quarter of a second per frame, a turn of six frames: 0 1 2 3 2 1, then 0 again
    const shown = await framesShown({
      animations: [{name: 'idle', timing: {duration: 1, playback: 'pingpong'}, frames: [0, 1, 2, 3]}],
      draw: 'idle',
      times: [0.125, 0.375, 0.625, 0.875, 1.125, 1.375, 1.625, 1.875, -0.125],
    });

    expect(shown).to.deep.equal([0, 1, 2, 3, 2, 1, 0, 1, 1]);
  });

  it('per-frame durations show each frame for its own time, on either side of every boundary', async function () {
    const shown = await framesShown({
      animations: [{name: 'attack', timing: {durations: [0.25, 0.25, 1, 0.5]}, frames: [0, 1, 2, 3]}],
      draw: 'attack',
      times: [0.05, 0.24, 0.26, 0.49, 0.51, 1.49, 1.51, 1.99, 2.05],
    });

    expect(shown).to.deep.equal([0, 0, 1, 1, 2, 2, 3, 3, 0]);
  });

  it("'once' with per-frame durations holds its last frame", async function () {
    const shown = await framesShown({
      animations: [{name: 'attack', timing: {durations: [0.25, 0.25, 1, 0.5], playback: 'once'}, frames: [0, 1, 2, 3]}],
      draw: 'attack',
      times: [-1, 0.3, 1.9, 10],
    });

    expect(shown).to.deep.equal([0, 1, 3, 3]);
  });

  it("'pingpong' with per-frame durations runs back through the middle frames at their own times", async function () {
    // 2.5 s there; back over frame 2 (0.75 s) and frame 1 (0.5 s): a turn of 3.75 s
    const shown = await framesShown({
      animations: [{name: 'breathe', timing: {durations: [0.25, 0.5, 0.75, 1], playback: 'pingpong'}, frames: [0, 1, 2, 3]}],
      draw: 'breathe',
      times: [0.1, 0.3, 0.8, 1.6, 2.4, 2.6, 3.2, 3.3, 3.7, 3.8],
    });

    expect(shown).to.deep.equal([0, 1, 2, 3, 3, 2, 2, 1, 1, 0]);
  });

  it('every animation of a bake keeps its own playback, behind one with durations', async function () {
    const animations = [
      {name: 'attack', timing: {durations: [0.25, 0.75]}, frames: [3, 2]},
      {name: 'kick', timing: {duration: 1, playback: 'once'}, frames: [0, 1]},
      {name: 'walk', timing: 1, frames: [1, 0]},
    ];

    const kick = await framesShown({animations, draw: 'kick', times: [0.25, 0.75, 1.25]});
    const walk = await framesShown({animations, draw: 'walk', times: [0.25, 0.75, 1.25]});

    expect(kick, 'the once animation').to.deep.equal([0, 1, 1]);
    expect(walk, 'the loop animation').to.deep.equal([1, 0, 1]);
  });
});

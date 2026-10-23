import {expect} from '@esm-bundle/chai';
import {
  createBloomOutputNodeBuilder,
  Display,
  FeatureSprites,
  OrthographicProjection,
  Stage2D,
  StageRenderer,
  TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {Color, RenderPipeline, RenderTarget} from 'three/webgpu';
import {disposeDisplay, disposeKept, isNearColor, keep, makeColorTexture, makeContainer, rgbAt} from './helpers/fixtures.js';

const TARGET_SIZE = 64;
const CENTER = TARGET_SIZE / 2;
// the sprite is 16 pixels square in the middle: its edge lies 8 pixels from the centre, the probe 6 beyond
const SPRITE_SIZE = 16;
const PROBE = CENTER + SPRITE_SIZE / 2 + 6;

describe('sprites — glow: a tint above white and the bloom of the stage', function () {
  let display;
  let host;

  beforeEach(async () => {
    host = makeContainer({width: TARGET_SIZE, height: TARGET_SIZE});
    display = new Display(host);
    await display.start();
  });

  afterEach(() => {
    disposeKept();
    disposeDisplay(display);
    display = undefined;
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  /**
   * Draws one sprite on a white color map, tinted by `tint`, through a stage whose output a bloom
   * builder of threshold 1 composes — or, with `bloom: false`, the stage alone — into a 64 × 64
   * target, and answers the pixel in its middle and the one 6 pixels beyond its right edge.
   */
  async function render(tint, {bloom = true} = {}) {
    const renderer = display.renderer;
    const target = keep(new RenderTarget(TARGET_SIZE, TARGET_SIZE));
    const colorMap = keep(makeColorTexture([[255, 255, 255, 255]]));
    const stage = new Stage2D(new OrthographicProjection('xy|bottom-left'));
    const sprites = keep(new FeatureSprites(TexturedSpriteKind, {capacity: 1, textures: {colorMap}}));
    const sprite = sprites.createSprite();
    sprite.setSize(SPRITE_SIZE, SPRITE_SIZE);
    sprite.setTexCoords(0, 0, 1, 1);
    sprite.setColorValues(tint[0], tint[1], tint[2], 1);
    sprites.update();
    stage.scene.add(sprites);

    const sr = new StageRenderer().setClearColor(new Color('#000'), 1).add(stage);
    const pipeline = new RenderPipeline(renderer);
    const glow = bloom ? createBloomOutputNodeBuilder({strength: 1, radius: 0, threshold: 1}) : undefined;
    // the renderer lets go first, then the builder, the stage and the pipeline
    keep(pipeline);
    keep(stage);
    if (glow) keep(glow);
    keep(sr);

    sr.pipeline = pipeline;
    /** @type {(passes: import('three/webgpu').Node[]) => import('three/webgpu').Node} */
    const passAlone = (passes) => passes[0];
    sr.buildOutputNode = glow ?? passAlone;
    sr.outputRenderTarget = target;
    sr.resize(TARGET_SIZE, TARGET_SIZE);
    sr.renderTo(renderer);
    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, TARGET_SIZE, TARGET_SIZE);
    return {center: rgbAt(pixels, TARGET_SIZE, CENTER, CENTER), probe: rgbAt(pixels, TARGET_SIZE, PROBE, CENTER)};
  }

  it('the stage alone draws nothing beside the sprite', async function () {
    const {center, probe} = await render([4, 3, 1], {bloom: false});

    expect(isNearColor(center, [255, 255, 255]), `the sprite, clamped to white: ${center}`).to.be.true;
    expect(isNearColor(probe, [0, 0, 0]), `beside it: ${probe}`).to.be.true;
  });

  it('a sprite tinted above white glows', async function () {
    const {center, probe} = await render([4, 3, 1]);

    expect(isNearColor(center, [255, 255, 255], 8), `the sprite: ${center}`).to.be.true;
    expect(probe[0], `a glow 6 px beyond its edge: ${probe}`).to.be.above(60);
  });

  it('a white sprite does not glow: its luminance is 1, the threshold', async function () {
    const {center, probe} = await render([1, 1, 1]);

    expect(isNearColor(center, [255, 255, 255]), `the sprite: ${center}`).to.be.true;
    expect(isNearColor(probe, [0, 0, 0]), `beside it: ${probe}`).to.be.true;
  });

  it('brightness is luminance: a blue tinted by 4 stays below the threshold, one tinted by 16 glows', async function () {
    const dim = await render([0, 0, 4]);
    const bright = await render([0, 0, 16]);

    // 0.0722 · 4 = 0.29, 0.0722 · 16 = 1.16
    expect(isNearColor(dim.probe, [0, 0, 0]), `beside the blue of 4: ${dim.probe}`).to.be.true;
    expect(bright.probe[2], `beside the blue of 16: ${bright.probe}`).to.be.above(60);
  });
});

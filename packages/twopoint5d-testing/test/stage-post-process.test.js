import {expect} from 'chai';
import {Display, RootRenderPipeline, StageDirector, StageRenderer, crossfade} from '@spearwolf/twopoint5d';
import {vec4} from 'three/tsl';
import {Color, RenderPipeline, RenderTarget} from 'three/webgpu';
import {
  countNodeBuilds,
  diffPixels,
  disposeDisplay,
  disposeKept,
  isNearColor,
  keep,
  makeContainer,
  makeFilledStage,
  pageScreenshot,
  rgbAt,
} from './helpers/fixtures.js';

/** @import {StagePostProcess} from '@spearwolf/twopoint5d' */
/** @import {Node, WebGPURenderer} from 'three/webgpu' */

// 64 pixels wide: rgbAt() reads the rows at that length
const SIZE = 64;

/** The 8-bit sRGB value of a linear channel, as the output transform of a pipeline writes it. */
const srgb = (linear) => Math.round(255 * (linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055));

// a color whose channels differ, and what the post-process below makes of it: an output transform
// that applies once gives the bytes back as they went in, one that applies twice or not at all
// gives others
const RUST = '#bc4000';
const RUST_BYTES = [0xbc, 0x40, 0x00];
const RUST_SWAPPED = [0x00, 0x40, 0xbc];
// the same two as linear bytes, as a plain draw writes them into a render target
const linearByte = (byte) => Math.round(255 * new Color().setRGB(byte / 255, 0, 0, 'srgb').r);
const RUST_LINEAR = RUST_BYTES.map(linearByte);
const RUST_SWAPPED_LINEAR = RUST_SWAPPED.map(linearByte);

/** @param {Node<'vec4'>} color */
const swapped = (color) => vec4(color.b, color.g, color.r, color.a);

/**
 * A post-process that swaps red and blue: easy to tell from the picture of the stage, and exact.
 * One object for every stage of this file — it is a description and keeps nothing of a build.
 *
 * @type {StagePostProcess}
 */
const swapRedAndBlue = {build: ({pass}) => swapped(pass)};

describe('Stage2D — a post-process on one stage', () => {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {WebGPURenderer} */
  let renderer;
  /** @type {RenderTarget} */
  let target;
  /** @type {{dispose(): void}[]} */
  let renderers;

  beforeEach(async () => {
    host = makeContainer({width: SIZE, height: SIZE});
    display = new Display(host);
    await display.start();
    renderer = display.renderer;
    target = keep(new RenderTarget(SIZE, SIZE));
    renderers = [];
  });

  afterEach(() => {
    // the renderers let go first, then the stages and what they used, the display last
    for (const sr of renderers) sr.dispose();
    disposeKept();
    disposeDisplay(display);
    display = undefined;
    host?.remove();
    host = undefined;
  });

  /** A director without a host that draws its stack into the target, over opaque black. */
  function makeDirector() {
    const director = new StageDirector().setClearColor(new Color('#000'), 1);
    director.outputRenderTarget = target;
    director.resize(SIZE, SIZE);
    renderers.push(director);
    return director;
  }

  /** A renderer without a host that draws into the target; with `compose`, through a `RootRenderPipeline`. */
  function makeRenderer({compose = false} = {}) {
    const sr = new StageRenderer();
    sr.outputRenderTarget = target;
    sr.resize(SIZE, SIZE);
    if (compose) {
      const pipeline = new RootRenderPipeline(renderer);
      sr.pipeline = pipeline;
      renderers.push(pipeline);
    }
    renderers.unshift(sr);
    return sr;
  }

  /** Draws `sr` and reads the target back. @param {StageRenderer} sr */
  async function draw(sr) {
    sr.updateFrame(0, 0, 0);
    sr.renderTo(renderer);
    return renderer.readRenderTargetPixelsAsync(target, 0, 0, SIZE, SIZE);
  }

  const middle = (pixels) => rgbAt(pixels, SIZE, 32, 32);

  const expectColor = (rgb, expected, what, tolerance = 2) => {
    expect(isNearColor(rgb, expected, tolerance), `${what}: [${rgb}], expected [${expected}]`).to.equal(true);
  };

  it('draws the same picture as a layer of a director, under a composing renderer and as a child with the equivalent pipeline', async () => {
    const processed = makeFilledStage('processed', RUST);
    processed.stage.postProcess = swapRedAndBlue;

    const director = makeDirector();
    director.setStack([processed.stage]);
    const asLayer = await draw(director);
    director.setStack([]);

    const root = makeRenderer({compose: true}).add(processed.stage);
    const composed = await draw(root);
    root.remove(processed.stage);

    // the way to an effect on one layer without a post-process on the stage: a child renderer
    // with a pipeline of its own under the composing root
    const plain = makeFilledStage('plain', RUST);
    const child = new StageRenderer().add(plain.stage);
    child.name = 'child';
    const childPipeline = new RenderPipeline(renderer);
    child.pipeline = childPipeline;
    child.buildOutputNode = ([pass]) => swapped(/** @type {Node<'vec4'>} */ (pass));
    renderers.unshift(child);
    renderers.push(childPipeline);
    root.add(child);
    const asChild = await draw(root);

    expectColor(middle(asLayer), RUST_SWAPPED, 'as a layer of a director');
    expect(diffPixels(asLayer, composed).differing, 'a layer of a director and a stage of a composing renderer').to.equal(0);
    expect(diffPixels(asLayer, asChild).differing, 'a layer of a director and a child with the equivalent pipeline').to.equal(0);
  });

  it('writes linear into a render target under a renderer without a pipeline, as the stage without a post-process does', async () => {
    const {stage} = makeFilledStage('alone', RUST);
    const sr = makeRenderer().add(stage);

    expectColor(middle(await draw(sr)), RUST_LINEAR, 'without a post-process');

    stage.postProcess = swapRedAndBlue;
    expectColor(middle(await draw(sr)), RUST_SWAPPED_LINEAR, 'with a post-process');
  });

  it('is transformed once on the canvas, alone under a renderer without a pipeline', async () => {
    const {stage} = makeFilledStage('alone', RUST);
    stage.postProcess = swapRedAndBlue;
    const sr = new StageRenderer(display).add(stage);
    renderers.push(sr);
    for (let i = 0; i < 5; i++) await display.nextFrame();

    const image = await pageScreenshot({x: 0, y: 0, width: SIZE, height: SIZE});
    const i = (32 * image.width + 32) * 4;
    // a screenshot goes through the color management of the browser and a PNG
    expectColor([image.data[i], image.data[i + 1], image.data[i + 2]], RUST_SWAPPED, 'on the canvas', 6);
  });

  it('shows the layer below where its scene draws nothing, and one post-process serves both layers', async () => {
    const below = makeFilledStage('below', RUST);
    const above = makeFilledStage('above', '#f00', {rect: {x: 0, y: 0, width: 32, height: 64}});
    below.stage.postProcess = swapRedAndBlue;
    above.stage.postProcess = swapRedAndBlue;
    const director = makeDirector();
    director.setStack([below.stage, above.stage]);

    const pixels = await draw(director);

    expectColor(rgbAt(pixels, SIZE, 16, 32), [0, 0, 255], 'the layer above, where it draws');
    expectColor(rgbAt(pixels, SIZE, 48, 32), RUST_SWAPPED, 'the layer below, where the one above is empty');
  });

  it('a transition mixes the processed picture', async () => {
    const red = makeFilledStage('red', '#f00');
    red.stage.postProcess = swapRedAndBlue;
    const green = makeFilledStage('green', '#0f0');
    const director = makeDirector();
    director.setStack([red.stage]);
    const transition = director.replace(red.stage, green.stage, {effect: crossfade(), manual: true});

    transition.progress = 0;
    expectColor(middle(await draw(director)), [0, 0, 255], 'progress 0');
    transition.progress = 0.5;
    const half = srgb(0.5);
    expectColor(middle(await draw(director)), [0, half, half], 'progress 0.5', 3);
    transition.complete();
    expectColor(middle(await draw(director)), [0, 255, 0], 'the end');
  });

  for (const [where, make] of /** @type {const} */ ([
    ['as a layer of a director', (stage) => makeDirector().setStack([stage])],
    ['under a composing renderer', (stage) => makeRenderer({compose: true}).add(stage)],
  ])) {
    it(`an assignment changes the picture ${where}, and undefined brings the plain one back`, async () => {
      const {stage} = makeFilledStage('room', RUST);
      const sr = make(stage);
      expectColor(middle(await draw(sr)), RUST_BYTES, 'without a post-process');

      stage.postProcess = swapRedAndBlue;
      expectColor(middle(await draw(sr)), RUST_SWAPPED, 'with a post-process');
      expectColor(middle(await draw(sr)), RUST_SWAPPED, 'the frame after');

      stage.postProcess = undefined;
      expectColor(middle(await draw(sr)), RUST_BYTES, 'without it again');
    });
  }

  it('a frozen layer of a director draws once more with a new post-process', async () => {
    const {stage} = makeFilledStage('room', RUST);
    const director = makeDirector();
    director.setStack([stage]);
    await draw(director);
    director.freeze(stage);

    stage.postProcess = swapRedAndBlue;
    expectColor(middle(await draw(director)), RUST_SWAPPED, 'with a post-process');

    stage.postProcess = undefined;
    expectColor(middle(await draw(director)), RUST_BYTES, 'without it again');
    expect(director.isFrozen(stage)).to.equal(true);
  });

  it('precompile() builds the post-process of a layer it is given, and its first frame in the stack builds nothing', async () => {
    const red = makeFilledStage('red', '#f00');
    const processed = makeFilledStage('processed', RUST);
    processed.stage.postProcess = swapRedAndBlue;
    const director = makeDirector();
    director.setStack([red.stage]);
    await draw(director);

    const effect = crossfade();
    await director.precompile(renderer, [[effect]], {layers: [processed.stage]});
    const builds = await countNodeBuilds(renderer);
    try {
      const transition = director.replace(red.stage, processed.stage, {effect, manual: true});
      transition.progress = 1;
      expectColor(middle(await draw(director)), RUST_SWAPPED, 'the new layer');
      expect(builds.count, 'node builds in the first frame of the new layer').to.equal(0);
    } finally {
      builds.stop();
    }
  });
});

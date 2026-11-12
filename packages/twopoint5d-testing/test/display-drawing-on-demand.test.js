import {expect} from 'chai';
import {Display, FramePacer, StageRenderer} from '@spearwolf/twopoint5d';
import {Color} from 'three/webgpu';
import {
  diffPixels,
  disposeDisplay,
  disposeKept,
  isNearColor,
  makeContainer,
  makeFilledStage,
  pageScreenshot,
} from './helpers/fixtures.js';

/** @import {MeshBasicMaterial} from 'three/webgpu' */

const WIDTH = 320;
const HEIGHT = 200;

// in the bytes of a screenshot: the clear color of the renderer and the colors of the square
const BACKDROP = [16, 32, 48];
const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];
const css = (/** @type {number[]} */ [r, g, b]) => `rgb(${r}, ${g}, ${b})`;

// a screenshot goes through the color management of the browser and a PNG
const TOLERANCE = 6;

/**
 * Drawing on demand rests on one behaviour of the platform: a canvas whose frame presents nothing
 * goes on showing the picture presented last. These tests hold it under every launcher, with
 * screenshots of the page — the picture the compositor shows, which no read of the canvas from
 * the page answers.
 */
describe('Drawing on demand — a canvas keeps its picture across frames that draw nothing', function () {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {FramePacer | undefined} */
  let frames;

  afterEach(() => {
    frames?.dispose();
    frames = undefined;
    disposeKept();
    disposeDisplay(display);
    display = undefined;
    host?.remove();
    host = undefined;
  });

  /**
   * A display that draws a red square of 64 units in the middle of a dark backdrop — through a
   * `StageRenderer` without a host, in a frame handler that asks a `FramePacer` whether to draw.
   * `continuous.on` draws every frame, as a display without a pacer does.
   */
  async function makePacedDisplay() {
    host = makeContainer({width: WIDTH, height: HEIGHT});
    display = new Display(host);
    const {stage, material} = makeFilledStage('square', css(RED));
    const sr = new StageRenderer().setClearColor(new Color(css(BACKDROP)), 1).add(stage);
    const pacer = new FramePacer(display);
    frames = pacer;
    const continuous = {on: false};

    display.onRenderFrame((frame) => {
      sr.resize(frame.width, frame.height, frame.pixelRatio);
      sr.updateFrame(frame.now, frame.deltaTime, frame.frameNo);
      if (pacer.shouldDraw(frame, continuous.on)) sr.renderTo(frame.renderer);
    });

    await display.start();
    // until the display has its size and the pacer has drawn for it: a resize that came in after
    // the test took its count of the draws would look like a frame nobody asked for
    let draws;
    do {
      draws = pacer.draws;
      await passFrames(10);
    } while (pacer.draws !== draws);
    return {pacer, material: /** @type {MeshBasicMaterial} */ (material), continuous};
  }

  /** Lets `count` frames of the display pass. */
  async function passFrames(count) {
    for (let i = 0; i < count; i++) await display.nextFrame();
  }

  /** What the page shows where the display is: the color in the middle of the square and beside it. */
  async function shown() {
    const {clientWidth: width, clientHeight: height} = host;
    const image = await pageScreenshot({x: 0, y: 0, width, height});
    expect([image.width, image.height], 'a screenshot of one pixel per CSS pixel').to.deep.equal([width, height]);
    const at = (/** @type {number} */ x, /** @type {number} */ y) => {
      const i = (y * image.width + x) * 4;
      return [image.data[i], image.data[i + 1], image.data[i + 2]];
    };
    return {image, square: at(width >> 1, height >> 1), backdrop: at(8, 8)};
  }

  const expectColor = (/** @type {number[]} */ rgb, /** @type {number[]} */ expected, /** @type {string} */ what) => {
    expect(isNearColor(rgb, expected, TOLERANCE), `${what}: ${css(rgb)}, expected ${css(expected)}`).to.equal(true);
  };

  it('shows the picture after frames that drew nothing', async () => {
    const {pacer} = await makePacedDisplay();
    const draws = pacer.draws;
    const framesBefore = pacer.frames;

    await passFrames(40);

    expect(pacer.frames - framesBefore, 'the frame loop ran on').to.be.at.least(40);
    expect(pacer.draws, 'and none of its frames drew').to.equal(draws);
    const {square, backdrop} = await shown();
    expectColor(square, RED, 'the square');
    expectColor(backdrop, BACKDROP, 'the backdrop');
  });

  // the control of the tests around it: a screenshot shows the picture on the canvas, not a
  // picture drawn for the screenshot, and a frame that is not drawn is not drawn
  it('does not show a change nobody reported', async () => {
    const {pacer, material} = await makePacedDisplay();
    const draws = pacer.draws;

    material.color.set(css(BLUE));
    await passFrames(20);

    expect(pacer.draws).to.equal(draws);
    expectColor((await shown()).square, RED, 'the square');
  });

  it('shows a change after invalidate() as a display that draws every frame shows it', async () => {
    const {pacer, material, continuous} = await makePacedDisplay();
    const draws = pacer.draws;

    material.color.set(css(GREEN));
    pacer.invalidate();
    await passFrames(40);

    expect(pacer.draws, 'the one frame the report asked for').to.equal(draws + 1);
    const onDemand = await shown();
    expectColor(onDemand.square, GREEN, 'the square');
    expectColor(onDemand.backdrop, BACKDROP, 'the backdrop');

    continuous.on = true;
    await passFrames(5);
    const everyFrame = await shown();

    expect(diffPixels(onDemand.image.data, everyFrame.image.data, TOLERANCE).differing).to.equal(0);
  });

  it('shows the picture again after a resize, which cleared the canvas', async () => {
    const {pacer} = await makePacedDisplay();
    const draws = pacer.draws;

    host.style.width = `${WIDTH + 80}px`;
    await passFrames(10);

    expect(display.width, 'the display took the new size').to.equal(WIDTH + 80);
    expect(pacer.draws, 'the pacer drew for the resize, without a report of the test').to.be.above(draws);

    const drawsAfterResize = pacer.draws;
    await passFrames(40);

    expect(pacer.draws).to.equal(drawsAfterResize);
    const {square, backdrop} = await shown();
    expectColor(square, RED, 'the square');
    expectColor(backdrop, BACKDROP, 'the backdrop');
  });
});

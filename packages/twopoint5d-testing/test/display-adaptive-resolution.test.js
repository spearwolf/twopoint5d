import {expect} from '@esm-bundle/chai';
import {Display} from '@spearwolf/twopoint5d';
import {Scene} from 'three/webgpu';
import {disposeDisplay, makeCamera, makeContainer} from './helpers/fixtures.js';

// the frames after a start, a restart and every resize that the controller lets pass unjudged
const SETTLE_FRAMES = 30;
// the measured frames of a window under gpu-time
const GPU_WINDOW = 12;

describe('Display — adaptiveResolution on a real renderer', function () {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;

  afterEach(() => {
    disposeDisplay(display);
    display = undefined;
    host?.remove();
    host = undefined;
  });

  /**
   * Draws a scene in every frame: only a render pass carries the timestamp query, a clear of the
   * canvas measures nothing under WebGPU. Answers the frames drawn so far.
   *
   * @param {Display} display
   */
  function drawScene(display) {
    const scene = new Scene();
    const camera = makeCamera();
    const drawn = {frames: 0};
    display.onRenderFrame(({renderer}) => {
      renderer.render(scene, camera);
      drawn.frames += 1;
    });
    return drawn;
  }

  it('picks in its first frame the method the backend measures with, and has a GPU time once a window is through or reads the frame pacing', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host, {adaptiveResolution: true});
    const adaptive = display.adaptiveResolution;
    expect(adaptive, 'the controller').to.exist;

    // every measurement the controller asks the renderer for
    const renderer = display.renderer;
    const resolveTimestampsAsync = renderer.resolveTimestampsAsync.bind(renderer);
    let measurements = 0;
    renderer.resolveTimestampsAsync = (type) => {
      measurements += 1;
      return resolveTimestampsAsync(type);
    };

    const drawn = drawScene(display);
    await display.start();
    await display.nextFrame();

    // told apart by the renderer, not by the fields of the backend the controller reads
    const expected = display.renderer.hasFeature('timestamp-query') ? 'gpu-time' : 'frame-pacing';
    expect(adaptive.method, 'the method of the first frame').to.equal(expected);

    expect(measurements, 'the first frame settles and measures nothing').to.equal(0);
    while (drawn.frames < SETTLE_FRAMES) {
      await display.nextFrame();
      if (drawn.frames <= SETTLE_FRAMES) {
        expect(measurements, `the frames that settle measure nothing, frame ${drawn.frames}`).to.equal(0);
      }
    }

    if (expected === 'gpu-time') {
      const limit = drawn.frames + 300;
      while (drawn.frames < limit && adaptive.gpuTime === undefined && adaptive.method === 'gpu-time') {
        await display.nextFrame();
      }

      if (adaptive.method === 'gpu-time') {
        expect(adaptive.gpuTime, 'the median of a window of GPU times, in ms').to.be.a('number').and.to.be.above(0);
        expect(Number.isFinite(adaptive.gpuTime), 'a finite GPU time').to.equal(true);
        expect(measurements, 'the measurements of a window').to.be.at.least(GPU_WINDOW);
      } else {
        // documented behavior: a renderer that answers no time for 60 frames leaves the pace
        expect(adaptive.method, 'the renderer measured nothing for 60 frames: frame-pacing').to.equal('frame-pacing');
        expect(adaptive.gpuTime, 'no GPU time after the fallback to frame-pacing').to.be.undefined;
      }
    } else {
      const limit = drawn.frames + 90;
      while (drawn.frames < limit) await display.nextFrame();

      expect(measurements, 'frame-pacing measures no GPU time').to.equal(0);
      expect(adaptive.gpuTime, 'gpuTime under frame-pacing').to.be.undefined;
    }

    expect(adaptive.scale, 'scale').to.be.within(adaptive.minScale, adaptive.maxScale);
    expect(display.resolutionScale, 'the scale of the display').to.equal(adaptive.scale);
  });

  it('draws the scale it sets into the drawing buffer, and gives the display its scale back when disabled', async () => {
    expect(window.devicePixelRatio, 'the pages of the browser tests run at a ratio of 1').to.equal(1);

    host = makeContainer({width: 320, height: 200});
    // one step: the controller sets 0.5 as it takes over, and stays there
    display = new Display(host, {adaptiveResolution: {minScale: 0.5, maxScale: 0.5}});
    const adaptive = display.adaptiveResolution;
    drawScene(display);
    await display.start();
    await display.nextFrame();

    expect(display.resolutionScale, 'the scale it set').to.equal(0.5);
    expect(display.canvas.width, '320 CSS pixels at a scale of 0.5').to.equal(160);

    adaptive.enabled = false;
    await display.nextFrame();

    expect(display.resolutionScale, 'the scale given back').to.equal(1);
    expect(display.canvas.width, '320 CSS pixels at a scale of 1').to.equal(320);
  });

  it('lets go of the display with it', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host, {adaptiveResolution: true});
    const adaptive = display.adaptiveResolution;
    drawScene(display);
    await display.start();
    await display.nextFrame();

    display.dispose();

    expect(display.adaptiveResolution, 'after dispose').to.be.undefined;
    expect(adaptive.isDisposed, 'the controller has let go').to.equal(true);
    adaptive.enabled = false;
    expect(adaptive.enabled, 'a controller that has let go stays as it is').to.equal(true);
  });
});

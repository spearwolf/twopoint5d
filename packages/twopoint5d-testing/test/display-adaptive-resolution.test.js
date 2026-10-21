import {expect} from '@esm-bundle/chai';
import {Display} from '@spearwolf/twopoint5d';
import {disposeDisplay, makeContainer} from './helpers/fixtures.js';

describe('Display — adaptiveResolution on a real renderer', function () {
  // a cold webgpu start — adapter plus device — happens inside the constructor, and it is slow
  this.timeout(20000);

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

  it('reads the cost of its frames in one of its two ways, and lets go of the display with it', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host, {adaptiveResolution: true});
    const adaptive = display.adaptiveResolution;
    expect(adaptive, 'the controller').to.exist;

    // the scene of every frame: a clear of the canvas, measured like any other draw
    display.onRenderFrame(({renderer}) => renderer.clear());
    await display.start();
    for (let i = 0; i < 40; i++) await display.nextFrame();

    // which one depends on the GPU and the backend the test runs on
    expect(['gpu-time', 'frame-pacing'], 'method').to.include(adaptive.method);
    expect(adaptive.scale, 'scale').to.be.within(adaptive.minScale, adaptive.maxScale);
    expect(display.resolutionScale, 'the scale of the display').to.equal(adaptive.scale);

    display.dispose();
    expect(display.adaptiveResolution, 'after dispose').to.be.undefined;
    adaptive.enabled = false;
    expect(adaptive.enabled, 'a controller that has let go stays as it is').to.equal(true);
  });
});

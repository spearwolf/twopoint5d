import {expect} from '@esm-bundle/chai';
import {Display} from '@spearwolf/twopoint5d';
import {WebGPURenderer} from 'three/webgpu';
import {disposeDisplay} from './helpers/fixtures.js';

describe('Display — the constructor that adopts a renderer', function () {
  // a cold webgpu start — adapter plus device — happens inside the constructor, and it is slow
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {WebGPURenderer | undefined} */
  let renderer;

  beforeEach(() => {
    renderer = new WebGPURenderer();
    document.body.appendChild(renderer.domElement);
  });

  // this block cleans up whatever got as far as existing — including the case where the
  // constructor threw and no display ever took the renderer over
  afterEach(() => {
    if (display) {
      // Display.dispose() releases the renderer it was handed
      disposeDisplay(display);
    } else if (renderer) {
      renderer.dispose();
    }
    display = undefined;
    if (renderer && renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
    renderer = undefined;
  });

  it('adopts the renderer and the canvas it brings', () => {
    display = new Display(renderer);

    expect(display.renderer, 'the renderer the display works with').to.equal(renderer);
    expect(display.canvas, 'the canvas the display works with').to.equal(renderer.domElement);
  });

  it('starts and renders a frame', async () => {
    display = new Display(renderer);

    await display.start();
    await display.nextFrame();

    expect(display.frameNo, 'frames rendered').to.be.greaterThan(0);
  });

  it('releases the renderer it was handed', async () => {
    display = new Display(renderer);

    // the constructor waits on renderer.init(); a dispose() dropped into that window would prove
    // something other than the name of this case
    await display.start();

    let disposeCalls = 0;
    /** @type {(value?: unknown) => void} */
    let markReleased;
    const released = new Promise((resolve) => {
      markReleased = resolve;
    });
    const realDispose = renderer.dispose.bind(renderer);
    renderer.dispose = () => {
      disposeCalls++;
      realDispose();
      markReleased();
    };

    display.dispose();
    // the display releases its renderer after dispose() has returned, once the GPU has run dry
    await released;

    expect(disposeCalls, 'calls to renderer.dispose()').to.equal(1);
  });
});

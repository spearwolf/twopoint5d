import {expect} from '@esm-bundle/chai';
import {Display} from '@spearwolf/twopoint5d';
import {WebGPURenderer} from 'three/webgpu';

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

  // the renderer belongs to this file, not to the display: it has to be released and its canvas
  // taken out of the document even when the constructor threw and no display ever existed
  afterEach(() => {
    if (display) {
      // Display.dispose() releases the renderer it was handed
      display.dispose();
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
});

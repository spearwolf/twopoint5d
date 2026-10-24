import {expect} from '@esm-bundle/chai';
import {Canvas2DStage, Display} from '@spearwolf/twopoint5d';
import {RenderTarget} from 'three/webgpu';
import {makeContainer, disposeDisplay, isNearColor, rgbAt} from './helpers/fixtures.js';

describe('Canvas2DStage — canvas on screen', () => {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {Canvas2DStage | undefined} */
  let canvasStage;
  /** @type {RenderTarget | undefined} */
  let target;

  afterEach(() => {
    // the stage lets go first, the target it drew into is the test's
    canvasStage?.dispose();
    canvasStage = undefined;
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  /** A stage on a 64 x 64 canvas painted red before the constructor sees it, drawing into a 64 x 64 target. */
  async function setup() {
    host = makeContainer({width: 64, height: 64});
    display = new Display(host);
    await display.start();

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    fill(canvas, '#ff0000');

    canvasStage = new Canvas2DStage(display.renderer, canvas);
    // 64 pixels wide: rgbAt() reads the rows at that length
    target = new RenderTarget(64, 64);
    canvasStage.stageRenderer.outputRenderTarget = target;
    canvasStage.setContainerSize(64, 64);

    return canvasStage;
  }

  /**
   * Paints the whole canvas in one color.
   *
   * @param {HTMLCanvasElement} canvas
   * @param {string} color a CSS color, as `fillStyle` takes it
   */
  function fill(canvas, color) {
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  async function centerPixel() {
    const pixels = await display.renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);
    return rgbAt(pixels, 64, 32, 32);
  }

  it('draws a canvas painted before the constructor on the first render()', async () => {
    const stage = await setup();

    stage.render();

    // pure primary colors, so the color transform does not shift the result
    expect(isNearColor(await centerPixel(), [255, 0, 0])).to.be.true;
  });

  it('uploads new content of the same size into the same texture', async () => {
    const stage = await setup();
    stage.render();
    const texture = stage.texture;

    fill(stage.canvas, '#00ff00');
    stage.needsUpdate = true;
    stage.render();

    expect(isNearColor(await centerPixel(), [0, 255, 0])).to.be.true;
    expect(stage.texture).to.equal(texture);
  });

  it('shows a canvas of another size through a new texture', async () => {
    const stage = await setup();
    stage.render();
    const texture = stage.texture;

    // the target stays 64 pixels wide
    stage.setCanvasSize(128, 128);
    fill(stage.canvas, '#0000ff');
    stage.needsUpdate = true;
    stage.render();

    expect(isNearColor(await centerPixel(), [0, 0, 255])).to.be.true;
    expect(stage.texture).to.not.equal(texture);
  });

  it('follows a canvas resized in place with sprite and view', async () => {
    const stage = await setup();
    stage.render();

    stage.canvas.width = 128;
    stage.canvas.height = 32;
    fill(stage.canvas, '#0000ff');
    stage.needsUpdate = true;
    stage.render();

    // 128 x 32 contained in the 64 x 64 container is a view of 128 x 128: the canvas lies across
    // the middle as a band 16 pixels high, and above and below it stays the red of the first
    // frame, since nothing clears the target
    const pixels = await display.renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);
    expect(isNearColor(rgbAt(pixels, 64, 32, 32), [0, 0, 255]), 'the middle of the band').to.be.true;
    expect(isNearColor(rgbAt(pixels, 64, 32, 2), [0, 0, 255]), 'a row near one edge').to.be.false;
    expect(isNearColor(rgbAt(pixels, 64, 32, 61), [0, 0, 255]), 'a row near the other edge').to.be.false;
  });
});

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
});

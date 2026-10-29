import {expect} from '@esm-bundle/chai';
import {
  Display,
  OrthographicProjection,
  Stage2D,
  StageDirector,
  StageRenderer,
  crossfade,
  fade,
  lumaMask,
  slide,
  wipe,
} from '@spearwolf/twopoint5d';
import {CanvasTexture, Color, Mesh, MeshBasicMaterial, PlaneGeometry, RenderPipeline, RenderTarget} from 'three/webgpu';
import {disposeDisplay, disposeKept, isNearColor, keep, makeContainer, readsTopDown, rgbAt} from './helpers/fixtures.js';

// 64 pixels wide: rgbAt() reads the rows at that length
const SIZE = 64;

/** The 8-bit sRGB value of a linear channel, as the output transform of the pipeline writes it. */
const srgb = (linear) => Math.round(255 * (linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055));

describe('StageDirector — transitions on the GPU', () => {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {RenderTarget} */
  let target;
  /** @type {StageDirector} */
  let director;

  /**
   * A layer that fills the whole picture with `color` at `opacity`, as a Stage2D of 64 × 64 units on
   * 64 × 64 pixels.
   */
  function layer(name, color, opacity = 1) {
    const stage = keep(new Stage2D(new OrthographicProjection('xy|bottom-left')));
    stage.name = name;
    const material = keep(new MeshBasicMaterial({color: new Color(color), transparent: opacity < 1, opacity}));
    stage.scene.add(new Mesh(keep(new PlaneGeometry(SIZE, SIZE)), material));
    return {stage, material};
  }

  async function draw() {
    director.updateFrame(0, 0, 0);
    director.renderTo(display.renderer);
    return display.renderer.readRenderTargetPixelsAsync(target, 0, 0, SIZE, SIZE);
  }

  beforeEach(async () => {
    host = makeContainer({width: SIZE, height: SIZE});
    display = new Display(host);
    await display.start();
    target = keep(new RenderTarget(SIZE, SIZE));
    // driven by hand, no host
    director = new StageDirector().setClearColor(new Color('#000'), 1);
    director.outputRenderTarget = target;
    director.resize(SIZE, SIZE);
  });

  afterEach(() => {
    director.dispose();
    disposeKept();
    disposeDisplay(display);
    display = undefined;
    host?.remove();
    host = undefined;
  });

  it('crossfade() shows from at progress 0, the mix at 0.5 and to at 1', async () => {
    const red = layer('red', '#f00');
    const green = layer('green', '#0f0');
    director.setStack([red.stage]);
    const t = director.replace(red.stage, green.stage, {effect: crossfade(), manual: true});

    t.progress = 0;
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [255, 0, 0]), 'progress 0').to.be.true;
    t.progress = 0.5;
    const half = srgb(0.5);
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [half, half, 0], 3), 'progress 0.5').to.be.true;
    t.progress = 1;
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [0, 255, 0]), 'progress 1').to.be.true;
    t.complete();
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [0, 255, 0]), 'the end').to.be.true;
  });

  it('wipe() "left" starts at the right side, "up" at the bottom', async () => {
    const topDown = await readsTopDown(display.renderer, target);
    const red = layer('red', '#f00');
    const green = layer('green', '#0f0');
    director.setStack([red.stage]);

    const left = director.replace(red.stage, green.stage, {effect: wipe({direction: 'left', softness: 0}), manual: true});
    left.progress = 0.5;
    let pixels = await draw();
    expect(isNearColor(rgbAt(pixels, SIZE, 8, 32), [255, 0, 0]), 'the left half still shows from').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, 56, 32), [0, 255, 0]), 'the right half shows to').to.be.true;
    left.cancel();

    const up = director.replace(red.stage, green.stage, {effect: wipe({direction: 'up', softness: 0}), manual: true});
    up.progress = 0.5;
    pixels = await draw();
    // the row of the picture at `fromTop` rows from its top edge
    const row = (fromTop) => (topDown ? fromTop : SIZE - 1 - fromTop);
    expect(isNearColor(rgbAt(pixels, SIZE, 32, row(8)), [255, 0, 0]), 'the upper half still shows from').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, 32, row(56)), [0, 255, 0]), 'the lower half shows to').to.be.true;
  });

  it('slide() "left" pushes from out to the left and to in from the right', async () => {
    const red = layer('red', '#f00');
    const green = layer('green', '#0f0');
    director.setStack([red.stage]);
    const t = director.replace(red.stage, green.stage, {effect: slide({direction: 'left'}), manual: true});
    t.progress = 0.25;
    const pixels = await draw();
    expect(isNearColor(rgbAt(pixels, SIZE, 8, 32), [255, 0, 0]), 'from on the left').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, 56, 32), [0, 255, 0]), 'to comes in on the right').to.be.true;
  });

  it('lumaMask() lies on the picture as a texture on a mesh: a mask dark on top switches the top first', async () => {
    const topDown = await readsTopDown(display.renderer, target);
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, 4, 4);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 4, 2);
    const mask = keep(new CanvasTexture(canvas));

    const red = layer('red', '#f00');
    const green = layer('green', '#0f0');
    director.setStack([red.stage]);
    const t = director.replace(red.stage, green.stage, {effect: lumaMask({mask, softness: 0}), manual: true});
    t.progress = 0.5;
    const pixels = await draw();
    const row = (fromTop) => (topDown ? fromTop : SIZE - 1 - fromTop);
    expect(isNearColor(rgbAt(pixels, SIZE, 32, row(8)), [0, 255, 0]), 'the dark top has switched').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, 32, row(56)), [255, 0, 0]), 'the bright bottom has not').to.be.true;
  });

  it('composes the slots over each other with premultiplied alpha', async () => {
    const blue = layer('blue', '#00f');
    const halfRed = layer('half red', '#f00', 0.5);
    const empty = keep(new Stage2D(new OrthographicProjection('xy|bottom-left')));
    empty.name = 'empty';
    director.setStack([blue.stage, empty, halfRed.stage]);
    const half = srgb(0.5);
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [half, 0, half], 3), 'half red over blue').to.be.true;

    director.hide(halfRed.stage);
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [0, 0, 255]), 'a layer that draws nothing shows the one below').to.be
      .true;
  });

  it('fade() from nothing shows the slot below alone at progress 0', async () => {
    const blue = layer('blue', '#00f');
    const red = layer('red', '#f00');
    director.setStack([blue.stage]);
    const t = director.show(red.stage, {effect: fade(), manual: true});
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [0, 0, 255]), 'progress 0').to.be.true;
    t.progress = 1;
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [255, 0, 0]), 'progress 1').to.be.true;
  });

  it('a frozen layer keeps its picture until it runs again', async () => {
    const red = layer('red', '#f00');
    director.setStack([red.stage]);
    await draw();
    director.freeze(red.stage);
    red.material.color.set('#0f0');
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [255, 0, 0]), 'frozen').to.be.true;
    director.run(red.stage);
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [0, 255, 0]), 'running').to.be.true;
  });

  it('a second transition of the same shape shows its own layers through the same pipeline', async () => {
    const red = layer('red', '#f00');
    const green = layer('green', '#0f0');
    const blue = layer('blue', '#00f');
    const effect = crossfade();
    director.setStack([red.stage]);

    const first = director.replace(red.stage, green.stage, {effect, manual: true});
    first.progress = 1;
    await draw();
    const pipeline = director.pipeline;
    first.complete();
    await draw();

    const second = director.replace(green.stage, blue.stage, {effect, manual: true});
    second.progress = 0;
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [0, 255, 0]), 'from is the new layer').to.be.true;
    second.progress = 1;
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [0, 0, 255]), 'to is the new layer').to.be.true;
    expect(director.pipeline, 'the shape keeps its pipeline').to.equal(pipeline);
  });

  it('a layer with a pipeline of its own keeps it, and the output transform applies once', async () => {
    const gray = layer('gray', '#000');
    // linear 0.5, written into the material as it is
    gray.material.color.setRGB(0.5, 0.5, 0.5);
    const own = keep(new StageRenderer().add(gray.stage));
    own.pipeline = keep(new RenderPipeline(display.renderer));
    director.setStack([own]);
    const half = srgb(0.5);
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [half, half, half], 3), 'encoded once').to.be.true;
  });
});

import {Display, StageArt, TexturePackerJson} from '@spearwolf/twopoint5d';
import {expect} from 'chai';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  countColor,
  disposeDisplay,
  disposeKept,
  isNearColor,
  keep,
  makeColorTexture,
  makeContainer,
  readsTopDown,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

// 16 units across 64 pixels: a unit of the art frame — an artwork pixel at pxPerUnit 1 — is 4 pixels
const TARGET_SIZE = 64;
const PPU = 4;

const BLACK = [0, 0, 0];
const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];

const CANVAS = {w: 16, h: 16};

/**
 * A trimmed atlas over a canvas of 16 × 16 artwork pixels, as a packer writes it: each frame is
 * `texels` of the sheet at `frame` and lies at `box` on the canvas.
 *
 * @param {Record<string, {frame: {x: number, y: number, w: number, h: number}, box: {x: number, y: number, w: number, h: number}}>} frames
 * @param {number} width
 * @param {number} height
 */
const trimmedAtlas = (frames, width, height) =>
  TexturePackerJson.parse({
    frames: Object.fromEntries(
      Object.entries(frames).map(([name, {frame, box}]) => [
        name,
        {frame, trimmed: true, spriteSourceSize: box, sourceSize: CANVAS},
      ]),
    ),
    meta: {image: 'sheet.png', size: {w: width, h: height}},
  })[0];

describe('stage art', function () {
  let display;
  let host;
  let target;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
  });

  afterEach(() => {
    disposeKept();
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  // draws the art on black and answers the color at the point (x, y) of the art frame, in units from
  // its origin, y up, and the pixels
  async function render(art) {
    const topDown = await readsTopDown(display.renderer, target);
    const half = TARGET_SIZE / PPU / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 50;
    const scene = new Scene();
    scene.add(art);
    art.update();
    const pixels = await renderToPixels(display.renderer, scene, camera, target);
    const colorAt = (x, y) => {
      const column = Math.floor(TARGET_SIZE / 2 + x * PPU);
      const fromTop = Math.floor(TARGET_SIZE / 2 - y * PPU);
      return rgbAt(pixels, TARGET_SIZE, column, topDown ? fromTop : TARGET_SIZE - 1 - fromTop);
    };
    return {colorAt, pixels};
  }

  const expectColor = (colorAt, x, y, rgb, what) =>
    expect(colorAt(x, y), `${what} at (${x}, ${y})`).to.satisfy((c) => isNearColor(c, rgb));

  it('turns a layer 90° clockwise about a pivot off its middle', async function () {
    // a bar of 4 × 2 artwork pixels at 8, 6 — red on its left half, green on its right — whose pivot is
    // its bottom left corner, the middle of the canvas: the origin of the art
    const texture = keep(
      makeColorTexture(
        [RED, RED, GREEN, GREEN, RED, RED, GREEN, GREEN].map((c) => [...c, 255]),
        4,
        2,
      ),
    );
    const atlas = trimmedAtlas({bar: {frame: {x: 0, y: 0, w: 4, h: 2}, box: {x: 8, y: 6, w: 4, h: 2}}}, 4, 2);
    const art = keep(new StageArt({atlas, texture}, {layers: {bar: {pivot: [8, 8]}}}));

    const atRest = await render(art);
    expectColor(atRest.colorAt, 1, 1, RED, 'the left half, at rest');
    expectColor(atRest.colorAt, 3, 1, GREEN, 'the right half, at rest');
    expectColor(atRest.colorAt, 1, -1, BLACK, 'below the bar, at rest');

    art.set('bar', {deg: 90});
    const turned = await render(art);
    // clockwise on the screen about the origin: (x, y) goes to (y, −x)
    expectColor(turned.colorAt, 1, -1, RED, 'the left half, turned down');
    expectColor(turned.colorAt, 1, -3, GREEN, 'the right half, turned down');
    expectColor(turned.colorAt, 1, 1, BLACK, 'where the bar stood');
    expectColor(turned.colorAt, 3, 1, BLACK, 'where the bar stood');
    expectColor(turned.colorAt, -1, -1, BLACK, 'left of the turned bar');
  });

  it('stacks two layers of one depth by their order, and a deeper layer under a nearer one', async function () {
    // red at 2, 4, 8 × 8, painted first, and blue at 6, 4, 8 × 8 above it: they overlap from 6 to 10
    const texture = keep(
      makeColorTexture(
        [
          [...RED, 255],
          [...BLUE, 255],
        ],
        2,
        1,
      ),
    );
    const atlas = trimmedAtlas(
      {
        red: {frame: {x: 0, y: 0, w: 1, h: 1}, box: {x: 2, y: 4, w: 8, h: 8}},
        blue: {frame: {x: 1, y: 0, w: 1, h: 1}, box: {x: 6, y: 4, w: 8, h: 8}},
      },
      2,
      1,
    );
    const art = keep(new StageArt({atlas, texture}));
    expect(art.names).to.deep.equal(['red', 'blue']);

    const painted = await render(art);
    expectColor(painted.colorAt, -4, 0, RED, 'red alone');
    expectColor(painted.colorAt, 4, 0, BLUE, 'blue alone');
    expectColor(painted.colorAt, 0, 0, BLUE, 'the overlap, as painted');

    art.set('red', {order: 1});
    const swapped = await render(art);
    expectColor(swapped.colorAt, 0, 0, RED, 'the overlap, red ordered above');
    expectColor(swapped.colorAt, 4, 0, BLUE, 'blue alone, red ordered above');

    const warnings = [];
    const warn = console.warn;
    console.warn = (message) => warnings.push(message);
    try {
      art.set('red', {order: 0});
      art.set('blue', {depth: 10});
      const deeper = await render(art);
      expectColor(deeper.colorAt, 0, 0, RED, 'the overlap, blue behind red');
      expectColor(deeper.colorAt, 4, 0, BLUE, 'blue alone, behind red');
    } finally {
      console.warn = warn;
    }
    expect(warnings).to.have.length(1);
    expect(warnings[0]).to.match(/^StageArt: the layer "blue", painted above "red", lies behind it/);
  });

  it('draws nothing of a layer whose picture is held back until it arrives', async function () {
    const texture = keep(makeColorTexture([[...RED, 255]], 1, 1));
    const atlas = trimmedAtlas({lamp: {frame: {x: 0, y: 0, w: 1, h: 1}, box: {x: 4, y: 4, w: 8, h: 8}}}, 1, 1);
    let arrive;
    const source = new Promise((resolve) => {
      arrive = resolve;
    });
    const art = keep(new StageArt(source, {only: ['lamp']}));
    art.set('lamp', {x: 9, deg: 10, opacity: 0.8});

    const before = await render(art);
    expect(countColor(before.pixels, BLACK), 'every pixel the clear color').to.equal(TARGET_SIZE * TARGET_SIZE);

    arrive({atlas, texture});
    await art.loaded;
    const after = await render(art);
    expect(countColor(after.pixels, BLACK), 'the lamp drawn').to.be.below(TARGET_SIZE * TARGET_SIZE);
    expect(art.layer('lamp').loaded).to.be.true;
  });
});

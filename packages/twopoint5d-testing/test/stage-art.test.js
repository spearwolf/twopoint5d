import {
  Display,
  OrthographicProjection,
  ParallaxProjection,
  SpritePicker,
  StageArt,
  TexturePackerJson,
} from '@spearwolf/twopoint5d';
import {expect} from 'chai';
import {OrthographicCamera, RenderTarget, Scene, Vector3} from 'three/webgpu';
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

/**
 * The box of the pixels of the color `rgb` in a read-back target, in pixels of the target as the
 * backend reads it back; `undefined` where no pixel has it.
 *
 * @param {Uint8Array} pixels
 * @param {number[]} rgb
 * @returns {{minX: number, maxX: number, minY: number, maxY: number} | undefined}
 */
function boxOfColor(pixels, rgb) {
  let box;
  for (let y = 0; y < TARGET_SIZE; y++) {
    for (let x = 0; x < TARGET_SIZE; x++) {
      if (!isNearColor(rgbAt(pixels, TARGET_SIZE, x, y), rgb)) continue;
      if (box === undefined) box = {minX: x, maxX: x, minY: y, maxY: y};
      box.minX = Math.min(box.minX, x);
      box.maxX = Math.max(box.maxX, x);
      box.minY = Math.min(box.minY, y);
      box.maxY = Math.max(box.maxY, y);
    }
  }
  return box;
}

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
  // its origin, y up on the screen, and the pixels. The camera looks at the 'xy|bottom-left' plane
  // unless one is handed in
  async function render(art, camera = undefined) {
    const topDown = await readsTopDown(display.renderer, target);
    if (camera === undefined) {
      const half = TARGET_SIZE / PPU / 2;
      camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
      camera.position.z = 50;
    }
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

  for (const plane of /** @type {const} */ (['xy|bottom-left', 'xy|top-left'])) {
    it(`turns a layer 90° clockwise about a pivot off its middle, on a stage of the plane ${plane}`, async function () {
      // a bar of 4 × 2 artwork pixels at 8, 6 — red on its left half, green on its right — whose pivot is
      // its bottom left corner, the middle of the canvas: the origin of the art. The art takes the plane
      // of the projection, whose camera looks at it: upright and unmirrored under either plane
      const projection = new OrthographicProjection(plane, {fit: 'contain', width: TARGET_SIZE / PPU, height: TARGET_SIZE / PPU});
      projection.updateViewRect(TARGET_SIZE, TARGET_SIZE);
      const camera = projection.createCamera();
      const texture = keep(
        makeColorTexture(
          [RED, RED, GREEN, GREEN, RED, RED, GREEN, GREEN].map((c) => [...c, 255]),
          4,
          2,
        ),
      );
      const atlas = trimmedAtlas({bar: {frame: {x: 0, y: 0, w: 4, h: 2}, box: {x: 8, y: 6, w: 4, h: 2}}}, 4, 2);
      const art = keep(new StageArt({atlas, texture}, {projection, layers: {bar: {pivot: [8, 8]}}}));

      const atRest = await render(art, camera);
      expectColor(atRest.colorAt, 1, 1, RED, 'the left half, at rest');
      expectColor(atRest.colorAt, 3, 1, GREEN, 'the right half, at rest');
      expectColor(atRest.colorAt, 1, -1, BLACK, 'below the bar, at rest');

      art.set('bar', {deg: 90});
      const turned = await render(art, camera);
      // clockwise on the screen about the origin: (x, y) goes to (y, −x)
      expectColor(turned.colorAt, 1, -1, RED, 'the left half, turned down');
      expectColor(turned.colorAt, 1, -3, GREEN, 'the right half, turned down');
      expectColor(turned.colorAt, 1, 1, BLACK, 'where the bar stood');
      expectColor(turned.colorAt, 3, 1, BLACK, 'where the bar stood');
      expectColor(turned.colorAt, -1, -1, BLACK, 'left of the turned bar');
    });
  }

  it('under a parallax camera at rest draws layers at three depths as painted, and parts them once the camera moves', async function () {
    // three squares of 4 × 4 artwork pixels side by side: red far behind the plane, green behind it,
    // blue in front of it. The camera stands 16 units — 16 artwork pixels — in front of the plane
    const texture = keep(
      makeColorTexture(
        [
          [...RED, 255],
          [...GREEN, 255],
          [...BLUE, 255],
        ],
        3,
        1,
      ),
    );
    const atlas = trimmedAtlas(
      {
        red: {frame: {x: 0, y: 0, w: 1, h: 1}, box: {x: 1, y: 6, w: 4, h: 4}},
        green: {frame: {x: 1, y: 0, w: 1, h: 1}, box: {x: 6, y: 6, w: 4, h: 4}},
        blue: {frame: {x: 2, y: 0, w: 1, h: 1}, box: {x: 11, y: 6, w: 4, h: 4}},
      },
      3,
      1,
    );
    const projection = new ParallaxProjection('xy|bottom-left', {
      fit: 'contain',
      width: TARGET_SIZE / PPU,
      height: TARGET_SIZE / PPU,
      distanceToProjectionPlane: 16,
    });
    projection.updateViewRect(TARGET_SIZE, TARGET_SIZE);
    const camera = projection.createCamera();

    const flat = keep(new StageArt({atlas, texture}, {projection}));
    const painted = await render(flat, camera);
    flat.removeFromParent();
    const deep = keep(
      new StageArt({atlas, texture}, {projection, layers: {red: {depth: 32}, green: {depth: 4}, blue: {depth: -8}}}),
    );
    const atRest = await render(deep, camera);

    const colors = {red: RED, green: GREEN, blue: BLUE};
    const rest = {};
    for (const [name, rgb] of Object.entries(colors)) {
      const want = boxOfColor(painted.pixels, rgb);
      const have = boxOfColor(atRest.pixels, rgb);
      expect(want, `${name} on the plane`).to.not.equal(undefined);
      expect(have, `${name} at its depth`).to.not.equal(undefined);
      // the square of 4 artwork pixels is 16 pixels of the target
      expect(want.maxX - want.minX + 1, `${name} on the plane, its width`).to.be.within(15, 17);
      for (const edge of ['minX', 'maxX', 'minY', 'maxY']) {
        expect(Math.abs(have[edge] - want[edge]), `${name} at its depth, ${edge}`).to.be.at.most(1);
      }
      rest[name] = have;
    }

    // the camera moved 1 unit right: the plane slides 4 pixels left, a layer behind it less — red 1⅓,
    // green 3.2 —, one in front of it more — blue 8. Each shift is counted twice, at both edges
    camera.position.x += 1;
    camera.updateMatrixWorld();
    const moved = await render(deep, camera);
    const shift = {};
    for (const [name, rgb] of Object.entries(colors)) {
      const box = boxOfColor(moved.pixels, rgb);
      expect(box, `${name} after the move`).to.not.equal(undefined);
      shift[name] = rest[name].minX + rest[name].maxX - (box.minX + box.maxX);
      expect(shift[name], `${name} slides left`).to.be.above(0);
    }
    expect(shift.red, 'the far layer moves less than the one behind the plane').to.be.below(shift.green);
    expect(shift.green, 'the layer behind the plane moves less than the near one').to.be.below(shift.blue);
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

  it('answers the layer behind through the transparent part of a front layer, and never a hidden one', async function () {
    // a wall of 12 × 12 artwork pixels, a carafe of 4 × 8 in front whose upper half is transparent, and a
    // ghost over the wall's right edge. The art frame is 16 × 16, its origin the middle
    const texture = keep(
      makeColorTexture(
        [
          [...RED, 255],
          [0, 0, 0, 0],
          [...GREEN, 255],
          [...RED, 255],
          [...BLUE, 255],
          [...GREEN, 255],
        ],
        3,
        2,
      ),
    );
    const atlas = trimmedAtlas(
      {
        wall: {frame: {x: 0, y: 0, w: 1, h: 1}, box: {x: 2, y: 2, w: 12, h: 12}},
        carafe: {frame: {x: 1, y: 0, w: 1, h: 2}, box: {x: 6, y: 4, w: 4, h: 8}},
        ghost: {frame: {x: 2, y: 0, w: 1, h: 1}, box: {x: 10, y: 6, w: 4, h: 4}},
      },
      3,
      2,
    );
    const art = keep(new StageArt({atlas, texture}));
    expect(art.names).to.deep.equal(['wall', 'carafe', 'ghost']);
    const camera = new OrthographicCamera(-8, 8, 8, -8, 0.1, 100);
    camera.position.z = 50;
    const scene = new Scene();
    scene.add(art);
    const picker = new SpritePicker(display.renderer);
    // the pointer at the point (x, y) of the art frame, in units from its origin, y up
    const pick = async (x, y) => {
      art.update();
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      const ndc = new Vector3(x, y, 0).project(camera);
      const hit = await picker.pick(camera, {x: ndc.x, y: ndc.y}, [art.mesh]);
      return {hit, name: hit && art.layerOf(hit.sprite)?.name};
    };

    try {
      expect((await pick(0, 2)).name, 'the transparent upper half of the carafe').to.equal('wall');
      const lower = await pick(0, -2);
      expect(lower.name, 'the opaque lower half of the carafe').to.equal('carafe');
      expect(lower.hit.sprites === art.mesh).to.be.true;
      expect(lower.hit.sprite === art.layer('carafe').sprite).to.be.true;
      expect((await pick(-6, 0)).name, 'the wall alone').to.equal('wall');
      expect((await pick(0, 7.5)).name, 'beyond the wall').to.equal(undefined);
      expect((await pick(4, 0)).name, 'the ghost over the wall').to.equal('ghost');

      art.set('ghost', {visible: false});
      expect((await pick(4, 0)).name, 'a hidden layer is never hit').to.equal('wall');
      art.set('ghost', {visible: true, opacity: 0});
      expect((await pick(4, 0)).name, 'a layer faded out is never hit').to.equal('wall');

      // a sort of the stack changes no handle
      art.set('wall', {order: 1});
      art.set('ghost', {opacity: 1});
      expect((await pick(4, 0)).name, 'the wall ordered above the ghost').to.equal('wall');
      expect((await pick(0, -2)).name, 'the carafe under the wall now').to.equal('wall');

      // of layers at different depths the nearer wins, whatever the order of the painting
      art.set('wall', {order: 0, depth: -10});
      expect((await pick(0, -2)).name, 'the wall in front of the carafe').to.equal('wall');
      art.set('wall', {depth: 10});
      expect((await pick(0, -2)).name, 'the wall behind the carafe').to.equal('carafe');
    } finally {
      picker.dispose();
    }
  });

  it('draws the layers of full-canvas PNG files where the files put them, and turns a layer about the dot of its pivot marker', async function () {
    // the PNGs of a paint tool, made here: a canvas of 16 × 16 artwork pixels each, transparent around
    // its picture — a red wall at 2, 2 of 12 × 12, a green lamp at 10, 10 of 4 × 4, and the marker of
    // the lamp's pivot, one black dot at its top left pixel
    /** @param {(context: OffscreenCanvasRenderingContext2D) => void} paint */
    const png = async (paint) => {
      const canvas = new OffscreenCanvas(16, 16);
      paint(/** @type {OffscreenCanvasRenderingContext2D} */ (canvas.getContext('2d')));
      return canvas.convertToBlob({type: 'image/png'});
    };
    /** @type {Record<string, string>} */
    const urls = {
      'wall.png': URL.createObjectURL(
        await png((context) => {
          context.fillStyle = 'rgb(255, 0, 0)';
          context.fillRect(2, 2, 12, 12);
        }),
      ),
      'lamp.png': URL.createObjectURL(
        await png((context) => {
          context.fillStyle = 'rgb(0, 255, 0)';
          context.fillRect(10, 10, 4, 4);
        }),
      ),
      'lamp.pivot.png': URL.createObjectURL(
        await png((context) => {
          context.fillStyle = 'rgb(0, 0, 0)';
          context.fillRect(10, 10, 1, 1);
        }),
      ),
    };
    // the art fetches each file by its name under baseUrl; the page answers it with the PNG made above,
    // and a name it has no PNG for with a 404
    const BASE = 'https://art.test/scene/';
    const realFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => {
      const url = String(input);
      const name = url.startsWith(BASE) ? decodeURIComponent(url.slice(BASE.length)) : '';
      return name in urls ? realFetch(urls[name], init) : Promise.resolve(new Response(null, {status: 404}));
    };

    try {
      const art = keep(new StageArt({files: ['wall.png', 'lamp.png', 'lamp.pivot.png', 'missing.png'], baseUrl: BASE}));
      expect(art.names).to.deep.equal(['wall', 'lamp', 'missing']);
      await art.loaded;
      expect(art.problems).to.deep.equal([
        {layer: 'missing', reason: 'the file "missing.png" did not load: the server answered 404', url: `${BASE}missing.png`},
      ]);
      expect(art.canvas).to.deep.equal({width: 16, height: 16});
      expect(art.layer('lamp').box).to.deep.equal({x: 10, y: 10, w: 4, h: 4});
      expect(art.layer('lamp').pivot).to.deep.equal([10.5, 10.5]);

      // the art frame has its origin at the middle of the canvas, 8, 8: a point of the canvas at px, py
      // lies at (px − 8, 8 − py)
      let {colorAt} = await render(art);
      expectColor(colorAt, -3.5, 3.5, RED, 'the wall, at 4.5, 4.5 of the canvas');
      expectColor(colorAt, 4, -4, GREEN, 'the lamp, at 12, 12');
      expectColor(colorAt, 0, -4, RED, 'the wall left of the lamp, at 8, 12');
      expectColor(colorAt, -7.5, 7.5, BLACK, 'outside the wall, at 0.5, 0.5');
      expectColor(colorAt, 2.5, -2.5, GREEN, 'the lamp over the dot of its marker, which is not drawn, at 10.5, 10.5');

      // 90° clockwise about the dot, 10.5, 10.5: the lamp now covers 7 … 11 across, 10 … 14 down
      art.set('lamp', {deg: 90});
      ({colorAt} = await render(art));
      expectColor(colorAt, 0, -4, GREEN, 'the lamp turned left of its dot, at 8, 12');
      expectColor(colorAt, 4, -4, RED, 'the wall where the lamp was, at 12, 12');
    } finally {
      globalThis.fetch = realFetch;
      for (const url of Object.values(urls)) URL.revokeObjectURL(url);
    }
  });
});

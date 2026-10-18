import {expect} from '@esm-bundle/chai';
import {AtlasFrameTable, Display, sampleAtlasFrame, TexturePackerJson} from '@spearwolf/twopoint5d';
import {float, fract, int, texture as sampleTexture, uv, vec2} from 'three/tsl';
import {
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  RenderTarget,
  Scene,
} from 'three/webgpu';
import {
  compareWithModel,
  disposeDisplay,
  makeColorTexture,
  makeContainer,
  makeSheetWithTurnedCopy,
  isNearColor,
  readsTopDown,
  renderToPixels,
} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;

// an image of 3 × 2 texels, six colors: not square, so a mix-up of width and height shows
const IMAGE_WIDTH = 3;
const IMAGE_HEIGHT = 2;
// biome-ignore format: the line breaks lay the numbers out row by row
const IMAGE = [
  [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255],
  [255, 255, 0, 255], [0, 255, 255, 255], [255, 0, 255, 255],
];
const BLACK = [0, 0, 0, 255];

/**
 * The model of a plane `columns × rows` units large with its middle at `(centerX, 0)`, that shows the
 * image once per `IMAGE_WIDTH × IMAGE_HEIGHT` units, its first row at the top; black around it.
 */
const imageOnPlane = (centerX, columns, rows) => (x, y) => {
  const left = x - (centerX - columns / 2);
  const fromTop = rows / 2 - y;
  if (left < 0 || left >= columns || fromTop < 0 || fromTop >= rows) return BLACK;
  return IMAGE[(Math.floor(fromTop) % IMAGE_HEIGHT) * IMAGE_WIDTH + (Math.floor(left) % IMAGE_WIDTH)];
};

/** The union of the models: the first that shows anything but black. */
const either =
  (...models) =>
  (x, y) =>
    models.map((model) => model(x, y)).find((color) => color !== BLACK) ?? BLACK;

describe('texture — sampleAtlasFrame() draws atlas frames on meshes of one’s own', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {RenderTarget | undefined} */
  let target;
  /** @type {(() => void)[]} */
  let disposals = [];

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
  });

  afterEach(() => {
    for (const dispose of disposals) dispose();
    disposals = [];
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  function makeCamera() {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;
    return camera;
  }

  /** A plane `width × height` units large at `(x, 0)` whose material takes `colorNode`. */
  function makePlane(scene, width, height, x, colorNode) {
    const geometry = new PlaneGeometry(width, height);
    const material = new MeshBasicNodeMaterial();
    material.colorNode = colorNode;
    const mesh = new Mesh(geometry, material);
    mesh.position.x = x;
    scene.add(mesh);
    disposals.push(() => {
      geometry.dispose();
      material.dispose();
    });
    return mesh;
  }

  async function render(scene) {
    const topDown = await readsTopDown(display.renderer, target);
    const pixels = await renderToPixels(display.renderer, scene, makeCamera(), target);
    return {pixels, topDown};
  }

  function expectModel({pixels, topDown}, colorAt) {
    const {checked, lit, differing} = compareWithModel(pixels, {
      size: TARGET_SIZE,
      pixelsPerUnit: PIXELS_PER_UNIT,
      topDown,
      black: BLACK,
      colorAt,
    });
    expect(lit, 'pixels the model lights').to.be.greaterThan(100);
    expect(differing, `${differing.length} of ${checked} pixels differ from the model`).to.deep.equal([]);
  }

  it('draws a turned frame upright, as the upright one, with three’s uv counted from the bottom left', async function () {
    const {texture, json} = makeSheetWithTurnedCopy(IMAGE, IMAGE_WIDTH, IMAGE_HEIGHT);
    disposals.push(() => texture.dispose());
    const [atlas] = TexturePackerJson.parse(json);
    const table = AtlasFrameTable.fromAtlas(atlas, ['upright', 'turned']);

    const scene = new Scene();
    makePlane(scene, 3, 2, -2, sampleAtlasFrame(texture, table, 0, uv(), {origin: 'bottom-left'}));
    makePlane(scene, 3, 2, 2, sampleAtlasFrame(texture, table, int(table.indexOf('turned')), uv(), {origin: 'bottom-left'}));

    expectModel(await render(scene), either(imageOnPlane(-2, 3, 2), imageOnPlane(2, 3, 2)));
  });

  it('takes a uv counted from the top left with the origin top-left', async function () {
    const {texture, json} = makeSheetWithTurnedCopy(IMAGE, IMAGE_WIDTH, IMAGE_HEIGHT);
    disposals.push(() => texture.dispose());
    const [atlas] = TexturePackerJson.parse(json);
    const table = AtlasFrameTable.fromAtlas(atlas);
    const fromTop = vec2(uv().x, float(1).sub(uv().y));

    const scene = new Scene();
    makePlane(scene, 3, 2, 0, sampleAtlasFrame(texture, table, table.indexOf('turned'), fromTop, {origin: 'top-left'}));

    expectModel(await render(scene), imageOnPlane(0, 3, 2));
  });

  it('repeats a frame inside its own area, without the frame beside it in the sheet bleeding in', async function () {
    const {texture, json} = makeSheetWithTurnedCopy(IMAGE, IMAGE_WIDTH, IMAGE_HEIGHT);
    disposals.push(() => texture.dispose());
    const [atlas] = TexturePackerJson.parse(json);
    const table = AtlasFrameTable.fromAtlas(atlas, ['upright', 'turned']);
    const twice = uv().mul(2);

    const scene = new Scene();
    // the upright frame lies at the left edge of the sheet, the turned copy right beside it
    makePlane(scene, 6, 4, -1, sampleAtlasFrame(texture, table, 0, twice, {origin: 'bottom-left', wrap: 'repeat', inset: 0.5}));

    expectModel(await render(scene), imageOnPlane(-1, 6, 4));
  });

  it('repeats a turned frame as the upright one', async function () {
    const {texture, json} = makeSheetWithTurnedCopy(IMAGE, IMAGE_WIDTH, IMAGE_HEIGHT);
    disposals.push(() => texture.dispose());
    const [atlas] = TexturePackerJson.parse(json);
    const table = AtlasFrameTable.fromAtlas(atlas, ['upright', 'turned']);
    const twice = uv().mul(2);

    const scene = new Scene();
    makePlane(scene, 6, 4, -1, sampleAtlasFrame(texture, table, 1, twice, {origin: 'bottom-left', wrap: 'repeat', inset: 0.5}));

    expectModel(await render(scene), imageOnPlane(-1, 6, 4));
  });

  it('wraps each axis on its own: repeated across, held at the top and bottom edges', async function () {
    const {texture, json} = makeSheetWithTurnedCopy(IMAGE, IMAGE_WIDTH, IMAGE_HEIGHT);
    disposals.push(() => texture.dispose());
    const [atlas] = TexturePackerJson.parse(json);
    const table = AtlasFrameTable.fromAtlas(atlas, ['upright']);
    // u runs over two frames; v from −0.5 at the bottom of the plane to 1.5 at its top, so half a
    // frame lies beyond each edge — a repeat in v would bring the other row there
    const across = vec2(uv().x.mul(2), uv().y.mul(2).sub(0.5));

    const scene = new Scene();
    makePlane(
      scene,
      6,
      4,
      0,
      sampleAtlasFrame(texture, table, 0, across, {origin: 'bottom-left', wrap: ['repeat', 'clamp'], inset: 0.5}),
    );

    // the first row of the image over the upper half of the plane, the second over the lower half
    expectModel(await render(scene), (x, y) =>
      x < -3 || x >= 3 || y < -2 || y >= 2 ? BLACK : IMAGE[(y >= 0 ? 0 : 1) * IMAGE_WIDTH + (Math.floor(x + 3) % IMAGE_WIDTH)],
    );
  });

  it('lays a trimmed frame where the untrimmed sprite has it, and draws nothing around it', async function () {
    // the image is the trimmed area of a sprite of 5 × 4, one texel in from its left and top edges
    const texture = makeColorTexture(IMAGE, IMAGE_WIDTH, IMAGE_HEIGHT);
    disposals.push(() => texture.dispose());
    const [atlas] = TexturePackerJson.parse({
      frames: {
        trimmed: {
          frame: {x: 0, y: 0, w: IMAGE_WIDTH, h: IMAGE_HEIGHT},
          trimmed: true,
          spriteSourceSize: {x: 1, y: 1, w: IMAGE_WIDTH, h: IMAGE_HEIGHT},
          sourceSize: {w: 5, h: 4},
        },
      },
      meta: {image: 'sheet.png', size: {w: IMAGE_WIDTH, h: IMAGE_HEIGHT}},
    });
    const table = AtlasFrameTable.fromAtlas(atlas);

    const scene = new Scene();
    // the plane stands for the untrimmed sprite: 5 × 4 units, from x = −2.5 and y = 2 at the top left
    makePlane(scene, 5, 4, 0, sampleAtlasFrame(texture, table, 0, uv(), {origin: 'bottom-left'}));

    // the trimmed area: from x = −1.5 to 1.5, from y = 1 down to −1
    expectModel(await render(scene), (x, y) => (y > 1 ? BLACK : imageOnPlane(0, 3, 2)(x, y)));
  });

  /**
   * A checkerboard of 4 × 4 red and green texels with mipmaps, magnified: every texel is drawn by
   * nearest, and only the smallest mip levels show the mix of the two colors.
   */
  function makeMipmappedChecker() {
    const red = [255, 0, 0, 255];
    const green = [0, 255, 0, 255];
    const texels = Array.from({length: 16}, (_, i) => (((i % 4) + Math.floor(i / 4)) % 2 ? green : red));
    const texture = makeColorTexture(texels, 4, 4);
    texture.generateMipmaps = true;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.magFilter = NearestFilter;
    disposals.push(() => texture.dispose());
    return texture;
  }

  /** How many lit pixels are neither red nor green: the seam of a mip level picked too small. */
  function countMixed(pixels) {
    let mixed = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      const rgb = [pixels[i], pixels[i + 1], pixels[i + 2]];
      if (isNearColor(rgb, [0, 0, 0])) continue;
      if (!isNearColor(rgb, [255, 0, 0], 8) && !isNearColor(rgb, [0, 255, 0], 8)) mixed++;
    }
    return mixed;
  }

  it('repeats a frame of a mipmapped atlas without a seam at its wraps, where a bare fract() shows one', async function () {
    const map = makeMipmappedChecker();
    const [atlas] = TexturePackerJson.parse({
      frames: {checker: {frame: {x: 0, y: 0, w: 4, h: 4}}},
      meta: {image: 'checker.png', size: {w: 4, h: 4}},
    });
    const table = AtlasFrameTable.fromAtlas(atlas);
    const thrice = uv().mul(3);

    // the gpu works the derivatives out over blocks of 2 × 2 pixels, and a seam shows only in a block a
    // wrap runs through: one pixel off the middle, the wraps of a plane 48 pixels wide repeated three
    // times lie on odd pixels and cut through blocks
    const ONE_PIXEL = 1 / PIXELS_PER_UNIT;

    const withFrame = new Scene();
    makePlane(
      withFrame,
      6,
      6,
      ONE_PIXEL,
      sampleAtlasFrame(map, table, 0, thrice, {origin: 'bottom-left', wrap: 'repeat'}),
    ).position.y = ONE_PIXEL;
    const {pixels} = await render(withFrame);

    // the same repeat, sampled the way the derivatives of the wrapped uv pick the mip level
    const bare = new Scene();
    makePlane(bare, 6, 6, ONE_PIXEL, sampleTexture(map, fract(thrice))).position.y = ONE_PIXEL;
    const {pixels: barePixels} = await render(bare);

    expect(countMixed(barePixels), 'mixed pixels of the bare fract(), the seam the test has to see').to.be.greaterThan(0);
    expect(countMixed(pixels), 'mixed pixels of sampleAtlasFrame()').to.equal(0);
  });
});

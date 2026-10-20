/** @import {InstancePositionApi, QuadSizeApi, SpriteKind} from '@spearwolf/twopoint5d' */
import {expect} from '@esm-bundle/chai';
import {
  AxisBillboardPlacement,
  axisBillboardPlacement,
  BillboardPlacement,
  defineSprite,
  Display,
  FeatureSprites,
  InstancePosition,
  QuadBase,
  QuadSize,
  ReflectionPass,
  ShadowPass,
  TextureColor,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  compareWithModel,
  coveredBox,
  diffPixels,
  disposeDisplay,
  makeCameraAboveGround,
  makeColorTexture,
  makeContainer,
  readsTopDown,
  renderToPixels,
} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];
const BLUE = [0, 0, 255, 255];
const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];

// an image of four quarters, row by row from the top: red and green above, blue and white below
const QUARTERS = [RED, GREEN, BLUE, WHITE];

// the sprite: 4 units square, standing on its foot at the origin
const SIZE = 4;

const AxisKind = defineSprite({base: QuadBase, features: [InstancePosition, AxisBillboardPlacement, QuadSize, TextureColor]});
const AxisZKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, axisBillboardPlacement({axis: 'z'}), QuadSize, TextureColor],
});
const SphericalKind = defineSprite({base: QuadBase, features: [InstancePosition, BillboardPlacement, QuadSize, TextureColor]});

/** The quarter of the image at the height `up` of the sprite and the offset `x` from its middle, or black beside it. */
function imageAt(x, up) {
  if (Math.abs(x) > SIZE / 2 || up < 0 || up > SIZE) return BLACK;
  const top = up > SIZE / 2;
  if (x < 0) return top ? RED : BLUE;
  return top ? GREEN : WHITE;
}

/**
 * The picture of an upright sprite seen through makeCameraAboveGround(): a point `up` units up the
 * sprite lands at `0.6 · up` of the view. With `mirrored`, its mirror image in the ground below it:
 * a point `up` units down lands at `−0.6 · up` and shows what the sprite shows `up` units up.
 */
const uprightAt = (mirrored) => (x, y) => (y >= 0 || mirrored ? imageAt(x, Math.abs(y) / 0.6) : BLACK);

describe('sprites — axis billboards', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  let display;
  let host;
  let target;
  let colorMap;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
    colorMap = makeColorTexture(QUARTERS, 2, 2);
  });

  afterEach(() => {
    colorMap?.dispose();
    colorMap = undefined;
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  /**
   * Renders one sprite of `kind` at `position`, with the options of the mesh, through `camera`.
   *
   * @param {SpriteKind<InstancePositionApi & QuadSizeApi>} kind
   */
  async function render(kind, {camera, position = [0, SIZE / 2, 0], options = {}, hideSprite = false}) {
    const sprites = new FeatureSprites(kind, {capacity: 1, textures: {colorMap}, ...options});
    sprites.frustumCulled = false;
    for (const pass of Object.values(sprites.passes)) pass.frustumCulled = false;
    if (hideSprite) sprites.material.visible = false;
    const sprite = sprites.createSprite();
    sprite.setSize(SIZE, SIZE);
    sprite.setPosition(position[0], position[1], position[2]);

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const pixels = await renderToPixels(display.renderer, scene, camera, target);
    sprites.dispose();
    return pixels;
  }

  function expectModel(pixels, topDown, colorAt) {
    const {checked, lit, differing} = compareWithModel(pixels, {
      size: TARGET_SIZE,
      pixelsPerUnit: PIXELS_PER_UNIT,
      topDown,
      black: BLACK,
      colorAt,
    });
    expect(lit, 'pixels the model lights').to.be.above(100);
    expect(checked, 'pixels checked').to.be.above(TARGET_SIZE * TARGET_SIZE * 0.8);
    expect(differing.slice(0, 5), `${differing.length} pixels differ`).to.deep.equal([]);
  }

  it('under a camera that looks down it stands upright, where a spherical billboard leans back', async function () {
    const topDown = await readsTopDown(display.renderer, target);
    const camera = makeCameraAboveGround(TARGET_SIZE, PIXELS_PER_UNIT);

    const axis = await render(AxisKind, {camera});
    const spherical = await render(SphericalKind, {camera});

    expectModel(axis, topDown, uprightAt(false));
    // the edge rows of a quad that faces the camera fall on either side of a pixel centre
    expect(coveredBox(spherical, TARGET_SIZE).height, 'the spherical billboard faces the camera at full height').to.be.within(
      SIZE * PIXELS_PER_UNIT - 1,
      SIZE * PIXELS_PER_UNIT,
    );
  });

  it('level with the camera it draws what a spherical billboard draws', async function () {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.set(3, 0, 9);
    camera.lookAt(0, 0, 0);

    const axis = await render(AxisKind, {camera, position: [0, 0, 0]});
    const spherical = await render(SphericalKind, {camera, position: [0, 0, 0]});

    const {lit, differing} = diffPixels(axis, spherical);
    expect(lit).to.be.above(100);
    expect(differing).to.equal(0);
  });

  it('about +Z it stands up along +Z in a mesh of the XY plane', async function () {
    const topDown = await readsTopDown(display.renderer, target);
    // the camera of makeCameraAboveGround() turned with the world by a quarter about +X: +Y goes to +Z
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.up.set(0, 0, 1);
    camera.position.set(0, -6, 8);
    camera.lookAt(0, 0, 0);

    const pixels = await render(AxisZKind, {camera, position: [0, 0, SIZE / 2]});

    expectModel(pixels, topDown, uprightAt(false));
  });

  it('ReflectionPass draws its mirror image in the ground, meeting it at its foot', async function () {
    const topDown = await readsTopDown(display.renderer, target);
    const camera = makeCameraAboveGround(TARGET_SIZE, PIXELS_PER_UNIT);

    const pixels = await render(AxisKind, {
      camera,
      options: {passes: [ReflectionPass], uniforms: {reflectionColor: [1, 1, 1, 1]}},
    });

    expectModel(pixels, topDown, uprightAt(true));
  });

  it('ShadowPass throws the shadow it throws for a spherical billboard', async function () {
    const camera = makeCameraAboveGround(TARGET_SIZE, PIXELS_PER_UNIT);
    const options = {passes: [ShadowPass], uniforms: {shadowColor: [0, 0, 1, 1]}};

    const axis = await render(AxisKind, {camera, options, hideSprite: true});
    const spherical = await render(SphericalKind, {camera, options, hideSprite: true});

    const {lit, differing} = diffPixels(axis, spherical);
    expect(lit, 'the shadow is drawn').to.be.above(50);
    expect(differing).to.equal(0);
  });
});

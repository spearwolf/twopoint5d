import {expect} from '@esm-bundle/chai';
import {
  defineSprite,
  Display,
  FeatureSprites,
  FeatureSpritesGeometry,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  ReflectionPass,
  TextureColor,
  Tint,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {disposeDisplay, isNearColor, makeColorTexture, makeContainer, renderToPixels, rgbAt} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;
const WHITE = [255, 255, 255, 255];

const TintedKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, TextureColor, Tint],
});

// five sprites in a row on y = 0 left of the mirror plane x = 0, each a colour of its own; on the
// middle row, so that the row order the backend reads the target back in does not matter
const SPRITES = [
  {x: -3.5, rgb: [255, 0, 0]},
  {x: -2.75, rgb: [0, 255, 0]},
  {x: -2, rgb: [0, 0, 255]},
  {x: -1.25, rgb: [255, 255, 0]},
  {x: -0.5, rgb: [255, 0, 255]},
];

/** The pixel at `x` world units right of the centre, on the middle row. */
const rgbAtX = (pixels, x) => rgbAt(pixels, TARGET_SIZE, Math.floor(CENTER + x * PIXELS_PER_UNIT), CENTER);

describe('sprites — another geometry under the mesh: growth and the geometry slot', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  let display;
  let host;
  let target;
  let info;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
    // the note of the first growth is expected; it stays out of the log of the run
    info = console.info;
    console.info = () => {};
  });

  afterEach(() => {
    console.info = info;
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  // A mesh of two sprites with grow and a reflection pass is drawn once, then grows twice to hold
  // five: the render objects built for the first geometry follow the mesh and its pass to the third.
  it('sprites created past the first capacity are drawn, and their pass draws them as well', async function () {
    const colorMap = makeColorTexture([WHITE]);
    const sprites = new FeatureSprites(TintedKind, {
      capacity: 2,
      grow: true,
      textures: {colorMap},
      uniforms: {mirrorPlane: [1, 0, 0, 0], reflectionColor: [1, 1, 1, 1]},
      passes: [ReflectionPass],
    });
    const create = ({x, rgb}) => {
      const sprite = sprites.createSprite();
      sprite.setSize(0.5, 0.5);
      sprite.setPosition(x, 0, 0);
      sprite.setColorValues(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1);
      return sprite;
    };

    const scene = new Scene();
    scene.add(sprites);
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;

    const first = SPRITES.slice(0, 2).map(create);
    const firstGeometry = sprites.geometry;
    sprites.update();
    const before = await renderToPixels(display.renderer, scene, camera, target);

    SPRITES.slice(2).map(create);
    sprites.update();
    const after = await renderToPixels(display.renderer, scene, camera, target);

    const capacity = sprites.spritePool.capacity;
    const geometryChanged = sprites.geometry !== firstGeometry;
    const passGeometry = sprites.passes['reflection'].geometry === sprites.geometry;
    const handlesKept = first.every((sprite, i) => sprites.spritePool.getVO(i) === sprite);
    sprites.dispose();
    colorMap.dispose();

    expect(capacity, 'two growths, from 2 to 8').to.equal(8);
    expect(geometryChanged, 'the mesh draws a new geometry').to.be.true;
    expect(passGeometry, 'the pass draws the geometry of the sprites').to.be.true;
    expect(handlesKept, 'the first two handles stayed in their slots').to.be.true;

    // before the growth: the two sprites and their mirror images, nothing where the others go
    for (const {x, rgb} of SPRITES.slice(0, 2)) {
      expect(isNearColor(rgbAtX(before, x), rgb), `before, at ${x}: ${rgbAtX(before, x)}`).to.be.true;
      expect(isNearColor(rgbAtX(before, -x), rgb), `before, mirrored at ${-x}: ${rgbAtX(before, -x)}`).to.be.true;
    }
    for (const {x} of SPRITES.slice(2)) {
      expect(isNearColor(rgbAtX(before, x), [0, 0, 0]), `before, nothing at ${x} yet: ${rgbAtX(before, x)}`).to.be.true;
    }

    // after it: all five and their mirror images
    for (const {x, rgb} of SPRITES) {
      expect(isNearColor(rgbAtX(after, x), rgb), `after, at ${x}: ${rgbAtX(after, x)}`).to.be.true;
      expect(isNearColor(rgbAtX(after, -x), rgb), `after, mirrored at ${-x}: ${rgbAtX(after, -x)}`).to.be.true;
    }
  });

  // The sprites of the geometry in the slot are the sprites of the mesh and of its pass: the render
  // objects built for the first geometry follow both to the one put there, and the first one is drawn by neither.
  it('a geometry put into the slot is drawn by the mesh and by its pass, and the geometry it took the place of by neither', async function () {
    const colorMap = makeColorTexture([WHITE]);
    const sprites = new FeatureSprites(TintedKind, {
      capacity: 2,
      textures: {colorMap},
      uniforms: {mirrorPlane: [1, 0, 0, 0], reflectionColor: [1, 1, 1, 1]},
      passes: [ReflectionPass],
    });
    const create = ({x, rgb}) => {
      const sprite = sprites.createSprite();
      sprite.setSize(0.5, 0.5);
      sprite.setPosition(x, 0, 0);
      sprite.setColorValues(rgb[0] / 255, rgb[1] / 255, rgb[2] / 255, 1);
      return sprite;
    };

    const scene = new Scene();
    scene.add(sprites);
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;

    SPRITES.slice(0, 2).map(create);
    sprites.update();
    const before = await renderToPixels(display.renderer, scene, camera, target);

    const other = new FeatureSpritesGeometry(TintedKind, 4);
    sprites.geometry = other;
    SPRITES.slice(2).map(create);
    sprites.update();
    const after = await renderToPixels(display.renderer, scene, camera, target);

    sprites.dispose();
    other.dispose();
    colorMap.dispose();

    for (const {x, rgb} of SPRITES.slice(0, 2)) {
      expect(isNearColor(rgbAtX(before, x), rgb), `before, at ${x}: ${rgbAtX(before, x)}`).to.be.true;
      expect(isNearColor(rgbAtX(before, -x), rgb), `before, mirrored at ${-x}: ${rgbAtX(before, -x)}`).to.be.true;
    }

    for (const {x, rgb} of SPRITES.slice(2)) {
      expect(isNearColor(rgbAtX(after, x), rgb), `after, at ${x}: ${rgbAtX(after, x)}`).to.be.true;
      expect(isNearColor(rgbAtX(after, -x), rgb), `after, mirrored at ${-x}: ${rgbAtX(after, -x)}`).to.be.true;
    }
    for (const {x} of SPRITES.slice(0, 2)) {
      expect(isNearColor(rgbAtX(after, x), [0, 0, 0]), `after, nothing of the first geometry at ${x}: ${rgbAtX(after, x)}`).to.be
        .true;
      expect(isNearColor(rgbAtX(after, -x), [0, 0, 0]), `after, nothing of it mirrored at ${-x}: ${rgbAtX(after, -x)}`).to.be
        .true;
    }
  });
});

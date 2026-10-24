import {expect} from '@esm-bundle/chai';
import {
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  ReflectionPass,
  TextureColor,
  Tint,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  disposeDisplay,
  disposeKept,
  isNearColor,
  keep,
  makeColorTexture,
  makeContainer,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;
const WHITE = [255, 255, 255, 255];

const TintedKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, TextureColor, Tint],
});

/** The pixel at `x` world units right of the centre, on the middle row: every sprite here is centred on y = 0. */
const rgbAtX = (pixels, x) => rgbAt(pixels, TARGET_SIZE, CENTER + x * PIXELS_PER_UNIT, CENTER);

describe('sprites — the draw order', function () {
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

  // Two half-transparent sprites 2 units square overlap between x = -2.5 and -1.5: red in front
  // (z = 1), blue behind (z = 0), on black. The sprites write their depth, as a transparent material
  // does by default; the reflection pass mirrors both at the plane x = 0 and writes none.
  it('back to front blends the front sprite over the back one, front to back drops the back one, and the pass follows', async function () {
    const colorMap = keep(makeColorTexture([WHITE]));
    const sprites = keep(
      new FeatureSprites(TintedKind, {
        capacity: 2,
        textures: {colorMap},
        transparent: true,
        uniforms: {mirrorPlane: [1, 0, 0, 0], reflectionColor: [1, 1, 1, 1]},
        passes: [ReflectionPass],
      }),
    );

    // created front first: the slot order is front to back
    const red = sprites.createSprite();
    red.setSize(2, 2);
    red.setPosition(-1.5, 0, 1);
    red.setColorValues(1, 0, 0, 0.5);
    const blue = sprites.createSprite();
    blue.setSize(2, 2);
    blue.setPosition(-2.5, 0, 0);
    blue.setColorValues(0, 0, 1, 0.5);

    const scene = new Scene();
    scene.add(sprites);
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;

    const backToFrontMoved = sprites.sortByViewDepth(camera);
    sprites.update();
    const backToFront = await renderToPixels(display.renderer, scene, camera, target);

    const frontToBackMoved = sprites.sortBy('z', {descending: true});
    sprites.update();
    const frontToBack = await renderToPixels(display.renderer, scene, camera, target);

    expect(backToFrontMoved, 'sortByViewDepth() put the back sprite first').to.be.true;
    expect(frontToBackMoved, 'sortBy() put the front sprite first').to.be.true;

    // where only one sprite lies, the order changes nothing
    for (const pixels of [backToFront, frontToBack]) {
      expect(isNearColor(rgbAtX(pixels, -1), [128, 0, 0]), `red alone: ${rgbAtX(pixels, -1)}`).to.be.true;
      expect(isNearColor(rgbAtX(pixels, -3), [0, 0, 128]), `blue alone: ${rgbAtX(pixels, -3)}`).to.be.true;
    }

    // the overlap of the sprites
    const spritesBackToFront = rgbAtX(backToFront, -2);
    const spritesFrontToBack = rgbAtX(frontToBack, -2);
    expect(isNearColor(spritesBackToFront, [128, 0, 64]), `back to front, red over blue: ${spritesBackToFront}`).to.be.true;
    expect(isNearColor(spritesFrontToBack, [128, 0, 0]), `front to back, blue behind the depth of red: ${spritesFrontToBack}`).to
      .be.true;

    // the overlap of their mirror images, drawn by the pass in the same order
    const passBackToFront = rgbAtX(backToFront, 2);
    const passFrontToBack = rgbAtX(frontToBack, 2);
    expect(isNearColor(passBackToFront, [128, 0, 64]), `the pass back to front, red over blue: ${passBackToFront}`).to.be.true;
    expect(isNearColor(passFrontToBack, [64, 0, 128]), `the pass front to back, blue over red: ${passFrontToBack}`).to.be.true;
  });
});

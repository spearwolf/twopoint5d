import {expect} from '@esm-bundle/chai';
import {Display, FeatureSprites, ReflectionPass, TexturedSpriteKind} from '@spearwolf/twopoint5d';
import {RenderTarget, Scene} from 'three/webgpu';
import {
  compareWithModel,
  countColor,
  disposeDisplay,
  makeCameraAboveGround,
  makeColorTexture,
  makeContainer,
  readsTopDown,
  renderToPixels,
} from './helpers/fixtures.js';

// 4 world units across 64 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 16;
const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];
const GREEN = [0, 255, 0, 255];

/**
 * The picture of a sprite 2 units square that stands on the XZ ground at the origin, facing the
 * camera of makeCameraAboveGround(), and of its mirror image below the ground: a point `h` units up
 * the sprite lies at `(x, 0.6 h)` of the view, its mirror image at `(x, -0.6 h)`.
 */
function reflectionAt(x, y) {
  if (Math.abs(x) > 1) return BLACK;
  const up = y / 0.6;
  if (up >= 0 && up <= 2) return WHITE;
  if (up < 0 && up >= -2) return GREEN;
  return BLACK;
}

describe('sprites — a reflection pass', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);
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
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  // mirroring a vertex in the shader turns the winding of every triangle; three culls by the side
  // of the material alone
  it('draws the mirror image of a sprite standing on the XZ ground below it, the camera in front and above', async function () {
    const topDown = await readsTopDown(display.renderer, target);
    const colorMap = makeColorTexture([WHITE, WHITE, WHITE, WHITE], 2, 2);
    // mirrorPlane keeps its start value, the ground y = 0
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1, textures: {colorMap}, passes: [ReflectionPass]});
    sprites.setUniform('reflectionColor', 0, 1, 0, 1);
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    sprite.setPosition(0, 1, 0);
    sprite.setTexCoords(0, 0, 1, 1);
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const pixels = await renderToPixels(display.renderer, scene, makeCameraAboveGround(TARGET_SIZE, PIXELS_PER_UNIT), target);

    sprites.dispose();
    colorMap.dispose();

    const {lit, differing} = compareWithModel(pixels, {
      size: TARGET_SIZE,
      pixelsPerUnit: PIXELS_PER_UNIT,
      topDown,
      black: BLACK,
      colorAt: reflectionAt,
    });
    // the sprite covers 2 × 1.2 units of the view, 614 pixels
    expect(countColor(pixels, WHITE), 'the pixels of the sprite').to.be.within(560, 670);
    // and so does its mirror image
    expect(countColor(pixels, GREEN), 'the pixels of the mirror image').to.be.within(560, 670);
    expect(lit, 'the lit pixels of the sprite and its mirror image the model checks').to.be.greaterThan(900);
    expect(differing.length, `the pixels against the model, first ones: ${differing.slice(0, 4).join('; ')}`).to.equal(0);
  });
});

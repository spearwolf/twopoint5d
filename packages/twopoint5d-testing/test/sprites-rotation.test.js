import {expect} from '@esm-bundle/chai';
import {Display, TexturedSprites} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {coveredBox, makeContainer, disposeDisplay, renderToPixels} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;

describe('sprites — rotation of a sprite that is not square', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {RenderTarget | undefined} */
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
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  /** Draws one sprite of 4 × 1 units, turned by `rotation`, and measures what it covers. */
  async function renderSprite({rotation, renderAsBillboards}) {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;

    const sprites = new TexturedSprites(1, {renderAsBillboards});
    sprites.frustumCulled = false;
    const sprite = sprites.createSprite();
    sprite.setSize(4, 1);
    sprite.setPosition(0, 0, 0);
    sprite.rotation = rotation;

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const pixels = await renderToPixels(display.renderer, scene, camera, target);

    sprites.dispose();

    return coveredBox(pixels, TARGET_SIZE);
  }

  it('an unturned sprite keeps its width and height', async function () {
    const box = await renderSprite({rotation: 0, renderAsBillboards: false});

    expect(box).to.deep.equal({width: 4 * PIXELS_PER_UNIT, height: 1 * PIXELS_PER_UNIT});
  });

  it('a sprite turned by a quarter swaps its width and height', async function () {
    const box = await renderSprite({rotation: Math.PI / 2, renderAsBillboards: false});

    expect(box, 'a rotated rectangle, not a rotated square stretched afterwards').to.deep.equal({
      width: 1 * PIXELS_PER_UNIT,
      height: 4 * PIXELS_PER_UNIT,
    });
  });

  it('a billboard turned by a quarter swaps its width and height', async function () {
    const box = await renderSprite({rotation: Math.PI / 2, renderAsBillboards: true});

    expect(box, 'a rotated rectangle, not a rotated square stretched afterwards').to.deep.equal({
      width: 1 * PIXELS_PER_UNIT,
      height: 4 * PIXELS_PER_UNIT,
    });
  });
});

import {expect} from '@esm-bundle/chai';
import {Display, TexturedSprites} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {stopAndDrain} from './support/stopAndDrain.js';

const FIXTURE_ID = 'sprites-rotation-fixture';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;

function makeContainer({width = 320, height = 200} = {}) {
  const el = document.createElement('div');
  el.id = `${FIXTURE_ID}-${Math.random().toString(36).slice(2, 8)}`;
  el.style.position = 'absolute';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  document.body.appendChild(el);
  return el;
}

/** Teardown must not mask the failure that got it here: no display, or a display that fails to go down. */
async function disposeDisplay(display) {
  if (!display) return;
  await stopAndDrain(display);
  try {
    display.dispose();
  } catch {
    // ignore — the fixture still has to leave the dom
  }
}

/** The width and height, in pixels, of the box around every pixel the sprite covered. */
function coveredBox(pixels, size) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // the sprite has no color map and draws in flat grey; the clear color is black
      if (pixels[(y * size + x) * 4] > 16) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (maxX < minX) return {width: 0, height: 0};
  return {width: maxX - minX + 1, height: maxY - minY + 1};
}

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

  afterEach(async () => {
    target?.dispose();
    target = undefined;
    await disposeDisplay(display);
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

    const {renderer} = display;
    renderer.setClearColor(0x000000, 1);
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);

    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, TARGET_SIZE, TARGET_SIZE);

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

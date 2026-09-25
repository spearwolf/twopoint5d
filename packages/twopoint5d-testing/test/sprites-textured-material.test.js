/** @import {Texture} from 'three/webgpu' */
import {expect} from '@esm-bundle/chai';
import {Display, TexturedSprites} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {disposeDisplay, isNearColor, makeColorTexture, makeContainer, renderToPixels, rgbAt} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;

const WHITE = [255, 255, 255, 255];
const GREEN = [0, 255, 0, 255];

describe('sprites — TexturedSpritesMaterial draws its color map', function () {
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

  /**
   * Draws one sprite of 4 × 4 units over the middle of the target, with the whole of `colorMap`
   * on it and, when given, `color` as its color, and answers the color of the middle pixel.
   *
   * @param {{colorMap: Texture, color?: [r: number, g: number, b: number, a: number]}} options
   */
  async function renderSprite({colorMap, color}) {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;

    const sprites = new TexturedSprites(1, colorMap);
    sprites.frustumCulled = false;
    const sprite = sprites.createSprite();
    sprite.setSize(4, 4);
    sprite.setPosition(0, 0, 0);
    sprite.setTexCoords(0, 0, 1, 1);
    if (color) sprite.setColorValues(...color);

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const pixels = await renderToPixels(display.renderer, scene, camera, target);

    // the mesh releases the material it built around the texture; the texture stays the caller's
    sprites.dispose();
    colorMap.dispose();

    return rgbAt(pixels, TARGET_SIZE, CENTER, CENTER);
  }

  it('draws the color of its color map', async function () {
    const rgb = await renderSprite({colorMap: makeColorTexture([GREEN, GREEN, GREEN, GREEN], 2, 2)});

    expect(rgb, 'the green of the color map').to.satisfy((c) => isNearColor(c, [0, 255, 0]));
  });

  it('tints the color map by the color of the sprite', async function () {
    const rgb = await renderSprite({colorMap: makeColorTexture([WHITE, WHITE, WHITE, WHITE], 2, 2), color: [1, 0, 0, 1]});

    expect(rgb, 'white tinted red').to.satisfy((c) => isNearColor(c, [255, 0, 0]));
  });

  it('does not draw a sprite whose color has an alpha of 0', async function () {
    const rgb = await renderSprite({colorMap: makeColorTexture([WHITE, WHITE, WHITE, WHITE], 2, 2), color: [1, 1, 1, 0]});

    expect(rgb, 'the clear color, the sprite fell through the alpha test').to.satisfy((c) => isNearColor(c, [0, 0, 0]));
  });
});

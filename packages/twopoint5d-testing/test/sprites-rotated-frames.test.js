import {expect} from '@esm-bundle/chai';
import {
  AnimatedSprites,
  AnimatedSpritesGeometry,
  AnimatedSpritesMaterial,
  Display,
  FrameBasedAnimations,
  TexturedSprites,
  TexturePackerJson,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {disposeDisplay, isNearColor, makeContainer, makeSheetWithTurnedCopy, renderToPixels, rgbAt} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;

// an image of 3 × 2 texels, six colors: not square, so a mix-up of width and height shows
const IMAGE_WIDTH = 3;
const IMAGE_HEIGHT = 2;
// prettier-ignore
const IMAGE = [
  [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 255, 255],
  [255, 255, 0, 255], [0, 255, 255, 255], [255, 0, 255, 255],
];

// the two sprites stand side by side, each drawn one unit per texel
const UPRIGHT_X = -2;
const TURNED_X = 2;

/**
 * The colors at the middles of the six cells of the sprite whose middle is at `spriteX`, each read
 * relative to that middle — so the two sprites are compared cell by cell, whichever way a backend
 * orders the rows it reads back.
 */
function cellColors(pixels, spriteX) {
  const colors = [];
  for (let row = 0; row < IMAGE_HEIGHT; row++) {
    for (let column = 0; column < IMAGE_WIDTH; column++) {
      const dx = column - (IMAGE_WIDTH - 1) / 2;
      const dy = row - (IMAGE_HEIGHT - 1) / 2;
      const x = Math.floor(CENTER + (spriteX + dx) * PIXELS_PER_UNIT);
      const y = Math.floor(CENTER + dy * PIXELS_PER_UNIT);
      colors.push(rgbAt(pixels, TARGET_SIZE, x, y));
    }
  }
  return colors;
}

/** Whether no two of the colors lie within the tolerance of {@link isNearColor} of each other. */
function allDifferent(colors) {
  return colors.every((a, i) => colors.every((b, j) => i === j || !isNearColor(a, b)));
}

describe('sprites — a rotated TexturePacker frame is drawn upright', function () {
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

  function makeCamera() {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;
    return camera;
  }

  /** Checks the six cells of the turned sprite against those of the upright one. */
  function expectSameCells(pixels) {
    const upright = cellColors(pixels, UPRIGHT_X);
    const turned = cellColors(pixels, TURNED_X);

    expect(upright, 'the six cells of the upright sprite, all different').to.satisfy(allDifferent);
    turned.forEach((rgb, i) => {
      expect(rgb, `cell ${i} of the turned sprite, against ${upright[i]} of the upright one`).to.satisfy((c) =>
        isNearColor(c, upright[i]),
      );
    });
  }

  it('TexturedSprites draws the turned frame as the upright one', async function () {
    const {texture, json} = makeSheetWithTurnedCopy(IMAGE, IMAGE_WIDTH, IMAGE_HEIGHT);
    const [atlas] = TexturePackerJson.parse(json);

    const sprites = new TexturedSprites(2, texture);
    sprites.frustumCulled = false;

    const upright = sprites.createSprite();
    upright.setSize(IMAGE_WIDTH, IMAGE_HEIGHT);
    upright.setPosition(UPRIGHT_X, 0, 0);
    upright.setFrame(atlas.frame('upright'));

    const turned = sprites.createSprite();
    turned.setSize(IMAGE_WIDTH, IMAGE_HEIGHT);
    turned.setPosition(TURNED_X, 0, 0);
    turned.setFrame(atlas.frame('turned'));

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const pixels = await renderToPixels(display.renderer, scene, makeCamera(), target);

    // the mesh releases the material it built around the texture; the texture stays the caller's
    sprites.dispose();
    texture.dispose();

    expectSameCells(pixels);
  });

  it('AnimatedSprites draws the turned frame of an animation as the upright one', async function () {
    const {texture, json} = makeSheetWithTurnedCopy(IMAGE, IMAGE_WIDTH, IMAGE_HEIGHT);
    const [atlas] = TexturePackerJson.parse(json);

    const anims = new FrameBasedAnimations();
    anims.add('upright', 1, [atlas.frame('upright').coords]);
    anims.add('turned', 1, [atlas.frame('turned').coords]);
    const animsMap = anims.bakeDataTexture();

    const geometry = new AnimatedSpritesGeometry(2);
    const material = new AnimatedSpritesMaterial({colorMap: texture, animsMap});
    const sprites = new AnimatedSprites(geometry, material);
    sprites.frustumCulled = false;

    const upright = geometry.instancedPool.createVO();
    upright.setSize(IMAGE_WIDTH, IMAGE_HEIGHT);
    upright.setPosition(UPRIGHT_X, 0, 0);
    upright.animId = anims.animId('upright');
    upright.animOffset = 0;

    const turned = geometry.instancedPool.createVO();
    turned.setSize(IMAGE_WIDTH, IMAGE_HEIGHT);
    turned.setPosition(TURNED_X, 0, 0);
    turned.animId = anims.animId('turned');
    turned.animOffset = 0;

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const pixels = await renderToPixels(display.renderer, scene, makeCamera(), target);

    // the mesh gives geometry and material up; both, like the two textures, are the caller's
    sprites.dispose();
    geometry.dispose();
    material.dispose();
    texture.dispose();
    animsMap.dispose();

    expectSameCells(pixels);
  });
});

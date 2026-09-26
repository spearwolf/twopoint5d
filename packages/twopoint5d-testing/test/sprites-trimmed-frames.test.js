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
import {disposeDisplay, isNearColor, makeColorTexture, makeContainer, renderToPixels, rgbAt} from './helpers/fixtures.js';

// 16 world units across 64 pixels: one unit is 4 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 4;
const CENTER = TARGET_SIZE / 2;

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];

// the untrimmed sprite is 5 × 4 texels, drawn one unit per texel
const SPRITE_WIDTH = 5;
const SPRITE_HEIGHT = 4;

// the reference and the candidate stand side by side
const REFERENCE_X = -4;
const CANDIDATE_X = 4;

/**
 * A sheet of 8 × 4 texels and its TexturePacker json. The frame `reference` is the untrimmed sprite,
 * 5 × 4 texels at `(0, 0)` with a red texel at `(1, 2)` and a green one at `(2, 2)` and nothing else.
 * The frame `trimmed` is the same sprite with its transparent border cut off: the red and the green
 * texel, 2 × 1 at `(5, 0)`. The frame `trimmed-turned` is `trimmed` laid into the sheet turned by 90°
 * clockwise, the way TexturePacker does it — 1 × 2 at `(7, 0)`, red above green.
 *
 * Both trimmed frames lie at `(1, 2)` in a sprite of 5 × 4, which makes their margins
 * `[0.2, 0.5, 0.4, 0.25]`: four different values, so that a mix-up of two sides shows.
 */
function makeTrimmedSheet() {
  const width = 8;
  const height = 4;
  const texels = Array.from({length: width * height}, () => [0, 0, 0, 0]);
  const put = (x, y, color) => {
    texels[y * width + x] = color;
  };

  put(1, 2, RED);
  put(2, 2, GREEN);

  put(5, 0, RED);
  put(6, 0, GREEN);

  put(7, 0, RED);
  put(7, 1, GREEN);

  const trim = {trimmed: true, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: SPRITE_WIDTH, h: SPRITE_HEIGHT}};

  return {
    texture: makeColorTexture(texels, width, height),
    json: {
      frames: {
        reference: {frame: {x: 0, y: 0, w: SPRITE_WIDTH, h: SPRITE_HEIGHT}},
        trimmed: {frame: {x: 5, y: 0, w: 2, h: 1}, ...trim},
        'trimmed-turned': {frame: {x: 7, y: 0, w: 2, h: 1}, rotated: true, ...trim},
      },
      meta: {image: 'sheet.png', size: {w: width, h: height}},
    },
  };
}

/**
 * The colors at the middles of the 20 cells of the sprite whose middle is at `spriteX`, each read
 * relative to that middle — so the two sprites are compared cell by cell, whichever way a backend
 * orders the rows it reads back.
 */
function cellColors(pixels, spriteX) {
  const colors = [];
  for (let row = 0; row < SPRITE_HEIGHT; row++) {
    for (let column = 0; column < SPRITE_WIDTH; column++) {
      const dx = column - (SPRITE_WIDTH - 1) / 2;
      const dy = row - (SPRITE_HEIGHT - 1) / 2;
      const x = Math.floor(CENTER + (spriteX + dx) * PIXELS_PER_UNIT);
      const y = Math.floor(CENTER + dy * PIXELS_PER_UNIT);
      colors.push(rgbAt(pixels, TARGET_SIZE, x, y));
    }
  }
  return colors;
}

describe('sprites — a trimmed TexturePacker frame is drawn where its untrimmed sprite has it', function () {
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

  /** Checks the 20 cells of the candidate against those of the reference. */
  function expectSameCells(pixels) {
    const reference = cellColors(pixels, REFERENCE_X);
    const candidate = cellColors(pixels, CANDIDATE_X);

    // a picture that is black all over would pass the comparison below
    const lit = reference.filter((rgb) => !isNearColor(rgb, [0, 0, 0]));
    expect(lit, 'the cells of the reference that are not black: its red and its green').to.have.lengthOf(2);
    expect(lit.some((rgb) => isNearColor(rgb, RED)) && lit.some((rgb) => isNearColor(rgb, GREEN))).to.equal(true);

    candidate.forEach((rgb, i) => {
      expect(rgb, `cell ${i} of the candidate, against ${reference[i]} of the reference`).to.satisfy((c) =>
        isNearColor(c, reference[i]),
      );
    });
  }

  async function renderTexturedSprites(candidateFrameName) {
    const {texture, json} = makeTrimmedSheet();
    const [atlas] = TexturePackerJson.parse(json);

    const sprites = new TexturedSprites(2, texture);
    sprites.frustumCulled = false;

    const reference = sprites.createSprite();
    reference.setSize(SPRITE_WIDTH, SPRITE_HEIGHT);
    reference.setPosition(REFERENCE_X, 0, 0);
    reference.setFrame(atlas.frame('reference'));

    const candidate = sprites.createSprite();
    candidate.setSize(SPRITE_WIDTH, SPRITE_HEIGHT);
    candidate.setPosition(CANDIDATE_X, 0, 0);
    candidate.setFrame(atlas.frame(candidateFrameName));

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const pixels = await renderToPixels(display.renderer, scene, makeCamera(), target);

    // the mesh releases the material it built around the texture; the texture stays the caller's
    sprites.dispose();
    texture.dispose();

    return pixels;
  }

  async function renderAnimatedSprites(candidateFrameQuery) {
    const {texture, json} = makeTrimmedSheet();
    const [atlas] = TexturePackerJson.parse(json);

    const anims = new FrameBasedAnimations();
    anims.add('reference', 1, atlas, '^reference$');
    anims.add('candidate', 1, atlas, candidateFrameQuery);
    const animsMap = anims.bakeDataTexture();

    const geometry = new AnimatedSpritesGeometry(2);
    const material = new AnimatedSpritesMaterial({colorMap: texture, animsMap, time: 0});
    const sprites = new AnimatedSprites(geometry, material);
    sprites.frustumCulled = false;

    const reference = geometry.instancedPool.createVO();
    reference.setSize(SPRITE_WIDTH, SPRITE_HEIGHT);
    reference.setPosition(REFERENCE_X, 0, 0);
    reference.animId = anims.animId('reference');
    reference.animOffset = 0;

    const candidate = geometry.instancedPool.createVO();
    candidate.setSize(SPRITE_WIDTH, SPRITE_HEIGHT);
    candidate.setPosition(CANDIDATE_X, 0, 0);
    candidate.animId = anims.animId('candidate');
    candidate.animOffset = 0;

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

    return pixels;
  }

  it('TexturedSprites draws a trimmed frame where its untrimmed sprite has it', async function () {
    expectSameCells(await renderTexturedSprites('trimmed'));
  });

  it('TexturedSprites draws a trimmed frame the packer turned where its untrimmed sprite has it', async function () {
    expectSameCells(await renderTexturedSprites('trimmed-turned'));
  });

  it('AnimatedSprites draws the frame of a trimmed animation where its untrimmed sprite has it', async function () {
    expectSameCells(await renderAnimatedSprites('^trimmed$'));
  });

  it('AnimatedSprites draws the frame of a trimmed animation the packer turned where its untrimmed sprite has it', async function () {
    // the bake then carries the diagonal flip and the margins of the frame
    expectSameCells(await renderAnimatedSprites('^trimmed-turned$'));
  });
});

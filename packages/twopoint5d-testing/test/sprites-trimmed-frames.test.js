import {expect} from '@esm-bundle/chai';
import {
  AnimatedSpriteKind,
  Display,
  FeatureSprites,
  FeatureSpritesGeometry,
  FeatureSpritesMaterial,
  FrameBasedAnimations,
  TexturedSpriteKind,
  TexturePackerJson,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  disposeDisplay,
  disposeKept,
  isNearColor,
  keep,
  makeContainer,
  makeTrimmedSheet,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

// 16 world units across 64 pixels: one unit is 4 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 4;
const CENTER = TARGET_SIZE / 2;

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];

// the untrimmed sprite of makeTrimmedSheet() is 5 × 4 texels, drawn one unit per texel
const SPRITE_WIDTH = 5;
const SPRITE_HEIGHT = 4;

// the reference and the candidate stand side by side
const REFERENCE_X = -4;
const CANDIDATE_X = 4;

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
    disposeKept();
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

  async function renderTexturedKind(candidateFrameName) {
    const {texture, json} = makeTrimmedSheet();
    keep(texture);
    const [atlas] = TexturePackerJson.parse(json);

    // the mesh releases the material it built around the texture; the texture stays the caller's
    const sprites = keep(new FeatureSprites(TexturedSpriteKind, {capacity: 2, textures: {colorMap: texture}}));
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

    return pixels;
  }

  async function renderAnimatedKind(candidateFrameQuery) {
    const {texture, json} = makeTrimmedSheet();
    keep(texture);
    const [atlas] = TexturePackerJson.parse(json);

    const anims = new FrameBasedAnimations();
    anims.add('reference', 1, atlas, '^reference$');
    anims.add('candidate', 1, atlas, candidateFrameQuery);
    const animsMap = keep(anims.bakeDataTexture());

    // the mesh gives geometry and material up; both, like the two textures, are the caller's
    const geometry = keep(new FeatureSpritesGeometry(AnimatedSpriteKind, 2));
    const material = keep(
      new FeatureSpritesMaterial(AnimatedSpriteKind, {
        textures: {colorMap: texture, animsMap},
        uniforms: {time: 0},
      }),
    );
    const sprites = keep(new FeatureSprites(AnimatedSpriteKind, {geometry, material}));
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

    return pixels;
  }

  it('TexturedSpriteKind draws a trimmed frame where its untrimmed sprite has it', async function () {
    expectSameCells(await renderTexturedKind('trimmed'));
  });

  it('TexturedSpriteKind draws a trimmed frame the packer turned where its untrimmed sprite has it', async function () {
    expectSameCells(await renderTexturedKind('trimmed-turned'));
  });

  it('AnimatedSpriteKind draws the frame of a trimmed animation where its untrimmed sprite has it', async function () {
    expectSameCells(await renderAnimatedKind('^trimmed$'));
  });

  it('AnimatedSpriteKind draws the frame of a trimmed animation the packer turned where its untrimmed sprite has it', async function () {
    // the bake then carries the diagonal flip and the margins of the frame
    expectSameCells(await renderAnimatedKind('^trimmed-turned$'));
  });
});

import {expect} from '@esm-bundle/chai';
import {
  AnimatedFrames,
  AtlasFrame,
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  Flip,
  FrameBasedAnimations,
  FrameTable,
  gridBase,
  InstancePosition,
  QuadBase,
  QuadSize,
  ReflectionPass,
  ShadowPass,
  TableFrame,
  TextureColor,
  TexturePackerJson,
} from '@spearwolf/twopoint5d';
import {FrontSide, OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  cellColors,
  diffPixels,
  disposeDisplay,
  disposeKept,
  expectSameCells,
  keep,
  makeCameraAboveGround,
  makeColorTexture,
  makeContainer,
  makeTrimmedSheet,
  mirroredX,
  mirroredY,
  readsTopDown,
  renderToPixels,
} from './helpers/fixtures.js';

const TARGET_SIZE = 64;

const BLACK = [0, 0, 0];
const RED = [255, 0, 0];
const GREEN = [0, 255, 0];

const flipKindOn = (base) =>
  defineSprite({base, features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Flip]});
const FlipKind = flipKindOn(QuadBase);
const TableFlipKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, TableFrame, TextureColor, Flip],
});
const AnimatedFlipKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AnimatedFrames, TextureColor, Flip],
});

// the sprite of makeTrimmedSheet(), 5 × 4: red at (1, 2), green at (2, 2), the rest clear
const REFERENCE = [
  [BLACK, BLACK, BLACK, BLACK, BLACK],
  [BLACK, BLACK, BLACK, BLACK, BLACK],
  [BLACK, RED, GREEN, BLACK, BLACK],
  [BLACK, BLACK, BLACK, BLACK, BLACK],
];

describe('sprites — Flip', function () {
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

  function makeCamera(pixelsPerUnit) {
    const half = TARGET_SIZE / pixelsPerUnit / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;
    return camera;
  }

  async function render(meshes, camera) {
    const scene = new Scene();
    for (const mesh of meshes) {
      scene.add(mesh);
      mesh.update();
    }
    return renderToPixels(display.renderer, scene, camera, target);
  }

  it('keeps a trimmed animated sprite on its foot under every playback, the mirror image of the untrimmed sprite', async function () {
    const PPU = 3;
    const {texture, json} = makeTrimmedSheet();
    keep(texture);
    const [atlas] = TexturePackerJson.parse(json);
    const anims = new FrameBasedAnimations();
    // every frame shows the same picture, trimmed or trimmed and turned
    anims.add('loop', {duration: 1}, atlas, ['trimmed', 'trimmed-turned']);
    anims.add('once', {duration: 1, playback: 'once'}, atlas, ['trimmed-turned', 'trimmed']);
    anims.add('pingpong', {duration: 1, playback: 'pingpong'}, atlas, ['trimmed', 'trimmed-turned', 'trimmed']);
    anims.add('durations', {durations: [0.2, 0.8], playback: 'loop'}, atlas, ['trimmed', 'trimmed-turned']);
    const animsMap = keep(anims.bakeDataTexture());
    const sprites = keep(new FeatureSprites(AnimatedFlipKind, {capacity: 4, textures: {colorMap: texture, animsMap}}));
    const places = {loop: [-5, 4], once: [5, 4], pingpong: [-5, -4], durations: [5, -4]};
    for (const [name, [x, y]] of Object.entries(places)) {
      const sprite = sprites.createSprite();
      sprite.setSize(5, 4);
      sprite.setPosition(x, y, 0);
      sprite.animId = anims.animId(name);
      sprite.flipX = 1;
    }

    expect(sprites.material.side, 'the side the material draws').to.equal(FrontSide);
    const topDown = await readsTopDown(display.renderer, target);
    const expected = mirroredX(REFERENCE);
    // two moments, so that each animation shows each of its frames once
    for (const time of [0.1, 0.6]) {
      sprites.setUniform('time', time);
      const pixels = await render([sprites], makeCamera(PPU));
      for (const [name, [x, y]] of Object.entries(places)) {
        expectSameCells(cellColors(pixels, TARGET_SIZE, PPU, topDown, x, y, 5, 4), expected, `"${name}" at ${time} s`);
      }
    }
  });

  it('mirrors a trimmed frame upside down and along both axes, a turned one as well', async function () {
    const PPU = 3;
    const {texture, json} = makeTrimmedSheet();
    keep(texture);
    const [atlas] = TexturePackerJson.parse(json);
    const sprites = keep(new FeatureSprites(FlipKind, {capacity: 4, textures: {colorMap: texture}}));
    const place = (name, x, y, flipX, flipY) => {
      const sprite = sprites.createSprite();
      sprite.setSize(5, 4);
      sprite.setPosition(x, y, 0);
      sprite.setFrame(atlas.frame(name));
      sprite.setFlip(flipX, flipY);
    };
    place('reference', -5, 4, 0, 0);
    place('trimmed', 5, 4, 0, 1);
    place('trimmed', -5, -4, 1, 1);
    place('trimmed-turned', 5, -4, 1, 1);

    const topDown = await readsTopDown(display.renderer, target);
    const pixels = await render([sprites], makeCamera(PPU));

    const reference = cellColors(pixels, TARGET_SIZE, PPU, topDown, -5, 4, 5, 4);
    expectSameCells(reference, REFERENCE, 'the untrimmed sprite');
    expectSameCells(cellColors(pixels, TARGET_SIZE, PPU, topDown, 5, 4, 5, 4), mirroredY(reference), 'flipped upside down');
    const both = mirroredY(mirroredX(reference));
    expectSameCells(cellColors(pixels, TARGET_SIZE, PPU, topDown, -5, -4, 5, 4), both, 'flipped along both');
    expectSameCells(cellColors(pixels, TARGET_SIZE, PPU, topDown, 5, -4, 5, 4), both, 'turned, flipped along both');
  });

  it('flips a sprite on gridBase({columns: 4, rows: 2}) as on the quad', async function () {
    const PPU = 3;
    const {texture, json} = makeTrimmedSheet();
    keep(texture);
    const [atlas] = TexturePackerJson.parse(json);
    const quads = keep(new FeatureSprites(FlipKind, {capacity: 1, textures: {colorMap: texture}}));
    const grids = keep(
      new FeatureSprites(flipKindOn(gridBase({columns: 4, rows: 2})), {capacity: 1, textures: {colorMap: texture}}),
    );
    for (const [sprites, x] of /** @type {const} */ ([
      [quads, -5],
      [grids, 5],
    ])) {
      const sprite = sprites.createSprite();
      sprite.setSize(5, 4);
      sprite.setPosition(x, 0, 0);
      sprite.setFrame(atlas.frame('trimmed-turned'));
      sprite.flipX = 1;
    }

    const topDown = await readsTopDown(display.renderer, target);
    const pixels = await render([quads, grids], makeCamera(PPU));

    expectSameCells(cellColors(pixels, TARGET_SIZE, PPU, topDown, -5, 0, 5, 4), mirroredX(REFERENCE), 'on the quad');
    expectSameCells(cellColors(pixels, TARGET_SIZE, PPU, topDown, 5, 0, 5, 4), mirroredX(REFERENCE), 'on the grid');
  });

  it('mirrors the frame tableFrame() picks, a trimmed and a turned trimmed one', async function () {
    const PPU = 3;
    const {texture, json} = makeTrimmedSheet();
    keep(texture);
    const [atlas] = TexturePackerJson.parse(json);
    const frameTable = keep(FrameTable.fromAtlas(atlas, ['reference', 'trimmed', 'trimmed-turned']).bakeDataTexture());
    const sprites = keep(new FeatureSprites(TableFlipKind, {capacity: 3, textures: {colorMap: texture, frameTable}}));
    const places = [-6, 0, 6];
    places.forEach((x, index) => {
      const sprite = sprites.createSprite();
      sprite.setSize(5, 4);
      sprite.setPosition(x, 0, 0);
      sprite.frameIndex = index;
      sprite.flipX = 1;
    });

    const topDown = await readsTopDown(display.renderer, target);
    const pixels = await render([sprites], makeCamera(PPU));

    for (const [index, x] of places.entries()) {
      expectSameCells(
        cellColors(pixels, TARGET_SIZE, PPU, topDown, x, 0, 5, 4),
        mirroredX(REFERENCE),
        `frame ${index} of the table`,
      );
    }
  });

  describe('in the passes', () => {
    const PPU = 8;
    // 3 × 2 texels, one of them clear, so that the outline of the shadow is not symmetric either
    // biome-ignore format: the line breaks lay the numbers out row by row
    const IMAGE = [
      [255, 0, 0, 255], [0, 255, 0, 255], [0, 0, 0, 0],
      [255, 255, 0, 255], [0, 255, 255, 255], [255, 0, 255, 255],
    ];
    const mirrored = (texels) => [texels.slice(0, 3).reverse(), texels.slice(3).reverse()].flat();

    /** Renders one sprite standing on the XZ ground with its shadow and its reflection, the sprites themselves left out. */
    async function renderPasses(texels, flipX) {
      const colorMap = keep(makeColorTexture(texels, 3, 2));
      const sprites = keep(
        new FeatureSprites(FlipKind, {capacity: 1, textures: {colorMap}, passes: [ShadowPass, ReflectionPass]}),
      );
      sprites.material.visible = false;
      sprites.setUniform('shadowColor', 0, 0, 1, 1);
      sprites.setUniform('shadowLight', -0.5, 1, 0.25, 0);
      sprites.setUniform('reflectionColor', 1, 1, 1, 1);
      const sprite = sprites.createSprite();
      sprite.setSize(3, 2);
      sprite.setPosition(0, 1, 0);
      sprite.setTexCoords(0, 0, 1, 1);
      sprite.flipX = flipX;
      const pixels = await render([sprites], makeCameraAboveGround(TARGET_SIZE, PPU));
      return pixels;
    }

    it('ShadowPass and ReflectionPass draw a flipped sprite as the sprite of the mirrored image', async function () {
      const flipped = await renderPasses(IMAGE, 1);
      const ofTheMirroredImage = await renderPasses(mirrored(IMAGE), 0);
      const plain = await renderPasses(IMAGE, 0);

      const {lit, differing} = diffPixels(flipped, ofTheMirroredImage);
      expect(lit, 'the pixels the passes light').to.be.above(300);
      expect(differing, 'the pixels that differ from the passes of the mirrored image').to.be.at.most(lit * 0.02);
      expect(diffPixels(flipped, plain).differing, 'the pixels that differ from the unflipped sprite').to.be.above(lit * 0.2);
    });
  });
});

import {expect} from '@esm-bundle/chai';
import {
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  ShadowPass,
  SpritePicker,
  TextureColor,
  Visible,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene, Vector3} from 'three/webgpu';
import {
  countColor,
  diffPixels,
  disposeDisplay,
  disposeKept,
  isNearColor,
  keep,
  makeColorTexture,
  makeContainer,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels, a sprite of 2 × 2 units 256 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;
const SPRITE_PIXELS = (2 * PIXELS_PER_UNIT) ** 2;
const RED = [255, 0, 0, 255];

const VisibleKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, TextureColor, Visible],
});

describe('sprites — Visible', function () {
  let display;
  let host;
  let target;

  beforeEach(async () => {
    host = makeContainer({width: TARGET_SIZE, height: TARGET_SIZE});
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

  function makeCamera() {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;
    return camera;
  }

  /** Red sprites of 2 × 2 units at the positions given, in a scene of their own. */
  function makeSprites(positions, options = {}) {
    const colorMap = keep(makeColorTexture([RED]));
    const sprites = keep(new FeatureSprites(VisibleKind, {capacity: positions.length, textures: {colorMap}, ...options}));
    sprites.frustumCulled = false;
    const all = positions.map(([x, y, z]) => {
      const sprite = sprites.createSprite();
      sprite.setSize(2, 2);
      sprite.setPosition(x, y, z);
      return sprite;
    });
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    return {sprites, all, scene};
  }

  const render = (scene) => renderToPixels(display.renderer, scene, makeCamera(), target);

  it('a hidden sprite clears its pixels, and shown again it is drawn as it was', async function () {
    const {sprites, all, scene} = makeSprites([
      [-2, 0, 0],
      [2, 0, 0],
    ]);
    const [left] = all;

    const before = await render(scene);
    expect(countColor(before, [255, 0, 0]), 'both sprites').to.equal(2 * SPRITE_PIXELS);

    left.visible = 0;
    sprites.spritePool.touchVO(left, 'visible');
    sprites.update();
    const hidden = await render(scene);
    const leftRgb = rgbAt(hidden, TARGET_SIZE, CENTER - 2 * PIXELS_PER_UNIT, CENTER);
    expect(isNearColor(leftRgb, [0, 0, 0]), `where the hidden sprite was: ${leftRgb}`).to.be.true;
    expect(countColor(hidden, [255, 0, 0]), 'the other sprite alone').to.equal(SPRITE_PIXELS);
    expect([left.width, left.height], 'the size of the hidden sprite').to.deep.equal([2, 2]);

    left.visible = 1;
    sprites.spritePool.touchVO(left, 'visible');
    sprites.update();
    const shown = await render(scene);
    expect(diffPixels(before, shown).differing, 'pixels that differ from before').to.equal(0);
  });

  it('a sprite created in the slot of a hidden one it took the place of is drawn', async function () {
    const {sprites, all, scene} = makeSprites([[0, 0, 0]]);
    const [first] = all;
    first.visible = 0;
    sprites.spritePool.touchVO(first, 'visible');
    sprites.update();
    expect(countColor(await render(scene), [255, 0, 0]), 'the hidden sprite').to.equal(0);

    sprites.freeSprite(first);
    const second = sprites.createSprite();
    second.setSize(2, 2);
    second.setPosition(0, 0, 0);
    sprites.update();

    expect(countColor(await render(scene), [255, 0, 0]), 'the sprite in its slot').to.equal(SPRITE_PIXELS);
  });

  it('a hidden sprite casts no shadow', async function () {
    async function shadowOf(visible) {
      const {sprites, all, scene} = makeSprites([[0, 0, 1]], {
        uniforms: {shadowLight: [-0.5, 0, 1, 0], groundPlane: [0, 0, 1, 0], shadowColor: [0, 0, 1, 1]},
        passes: [ShadowPass],
      });
      sprites.passes['shadow'].frustumCulled = false;
      // the sprite itself stays out of the picture: only its shadow is looked at
      sprites.material.visible = false;
      all[0].visible = visible;
      sprites.spritePool.touchVO(all[0], 'visible');
      sprites.update();
      return render(scene);
    }

    const shown = await shadowOf(1);
    const hidden = await shadowOf(0);

    expect(diffPixels(shown, shown).lit, 'the shadow of the shown sprite').to.be.above(0);
    expect(diffPixels(hidden, hidden).lit, 'the shadow of the hidden sprite').to.equal(0);
  });

  it('a hidden sprite is not picked, and the one behind it is', async function () {
    const picker = new SpritePicker(display.renderer);
    try {
      const camera = makeCamera();
      // the back sprite first, so that the slot order is not what decides
      const {sprites, all} = makeSprites([
        [-0.5, 0, 0],
        [0.5, 0, 1],
      ]);
      const [back, front] = all;
      camera.updateMatrixWorld();
      const ndc = new Vector3(0, 0, 0).project(camera);
      const overlap = {x: ndc.x, y: ndc.y};

      expect((await picker.pick(camera, overlap, [sprites]))?.sprite === front, 'the front sprite while it is shown').to.be.true;

      front.visible = 0;
      sprites.spritePool.touchVO(front, 'visible');
      sprites.update();
      expect((await picker.pick(camera, overlap, [sprites]))?.sprite === back, 'the back sprite once the front one is hidden').to
        .be.true;

      back.visible = 0;
      sprites.spritePool.touchVO(back, 'visible');
      sprites.update();
      expect(await picker.pick(camera, overlap, [sprites]), 'nothing once both are hidden').to.be.undefined;
    } finally {
      picker.dispose();
    }
  });
});

import {expect} from '@esm-bundle/chai';
import {
  AtlasFrame,
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  GroundPlacement,
  gridBase,
  InstancePosition,
  QuadBase,
  QuadSize,
  ShadowPass,
  TextureColor,
  TexturePackerJson,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  diffPixels,
  disposeDisplay,
  disposeKept,
  keep,
  makeCameraAboveGround,
  makeColorTexture,
  makeContainer,
  renderToPixels,
} from './helpers/fixtures.js';

// 10⅔ world units across 64 pixels: one unit is 6 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 6;

const R = [255, 0, 0, 255];
const G = [0, 255, 0, 255];
const B = [0, 0, 255, 255];
const Y = [255, 255, 0, 255];
const C = [0, 255, 255, 255];
const M = [255, 0, 255, 255];
const W = [255, 255, 255, 255];
const _ = [0, 0, 0, 0];

/**
 * A sheet of 8 × 3 texels and its TexturePacker json: the frame `upright`, 3 × 2 texels of six
 * colors at `(0, 0)`; the same image turned by 90° clockwise at `(3, 0)` as the frame `turned`, the
 * way TexturePacker lays it in; and the frame `trimmed`, 2 × 1 texels at `(5, 0)` cut out of a sprite
 * of 3 × 3 whose other texels are transparent — margins of 1, 2, 0 and 0 texels.
 */
function makeSheet() {
  // biome-ignore format: the line breaks lay the texels out row by row
  const texels = [
    R, G, B, C, R, W, Y, _,
    Y, C, M, M, G, _, _, _,
    _, _, _, B, Y, _, _, _,
  ];
  return {
    texture: makeColorTexture(texels, 8, 3),
    json: {
      frames: {
        upright: {frame: {x: 0, y: 0, w: 3, h: 2}},
        turned: {frame: {x: 3, y: 0, w: 3, h: 2}, rotated: true},
        trimmed: {
          frame: {x: 5, y: 0, w: 2, h: 1},
          trimmed: true,
          spriteSourceSize: {x: 1, y: 2, w: 2, h: 1},
          sourceSize: {w: 3, h: 3},
        },
      },
      meta: {image: 'sheet.png', size: {w: 8, h: 3}},
    },
  };
}

/** @param {import('@spearwolf/twopoint5d').SpriteBase} base */
const texturedKindOn = (base) =>
  defineSprite({base, features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor]});

const KINDS = {
  quad: texturedKindOn(QuadBase),
  'grid 1x1': texturedKindOn(gridBase({columns: 1, rows: 1})),
  'grid 4x2': texturedKindOn(gridBase({columns: 4, rows: 2})),
};

describe('sprites — gridBase() draws what QuadBase draws', function () {
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

  /**
   * Draws the upright, the turned and the trimmed frame side by side, one unit per texel, with sprites of `kind`.
   *
   * @param {typeof KINDS.quad} kind every kind of {@link KINDS} holds the same features
   */
  async function renderFrames(kind) {
    const {texture, json} = makeSheet();
    keep(texture);
    const [atlas] = TexturePackerJson.parse(json);
    const sprites = keep(new FeatureSprites(kind, {capacity: 3, textures: {colorMap: texture}}));
    const place = (name, x, width, height) => {
      const sprite = sprites.createSprite();
      sprite.setSize(width, height);
      sprite.setPosition(x, 0, 0);
      sprite.setFrame(atlas.frame(name));
    };
    place('upright', -3.5, 3, 2);
    place('turned', 0, 3, 2);
    place('trimmed', 3.5, 3, 3);
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    return renderToPixels(display.renderer, scene, makeCamera(), target);
  }

  it('an upright, a turned and a trimmed atlas frame on a 1 × 1 and a 4 × 2 grid, pixel for pixel', async function () {
    const quad = await renderFrames(KINDS.quad);

    for (const name of ['grid 1x1', 'grid 4x2']) {
      const grid = await renderFrames(KINDS[name]);
      const {lit, differing} = diffPixels(quad, grid);
      expect(lit, 'the pixels the frames light on the quad').to.be.above(400);
      expect(differing, `the pixels where the ${name} differs from the quad`).to.equal(0);
    }
  });

  it('the shadow of ShadowPass under a sprite on a grid is the shadow under the quad, but for its edges', async function () {
    const render = async (base) => {
      const colorMap = keep(makeColorTexture([W], 1, 1));
      const kind = defineSprite({base, features: [InstancePosition, GroundPlacement, QuadSize, TextureColor]});
      const sprites = keep(new FeatureSprites(kind, {capacity: 1, textures: {colorMap}, passes: [ShadowPass]}));
      sprites.setUniform('shadowColor', 0, 0, 1, 1);
      const sprite = sprites.createSprite();
      sprite.setSize(1.5, 1);
      sprite.setPosition(0, 0.5, 0);
      const scene = new Scene();
      scene.add(sprites);
      sprites.update();
      return renderToPixels(display.renderer, scene, makeCameraAboveGround(TARGET_SIZE, 16), target);
    };

    const quad = await render(QuadBase);
    const grid = await render(gridBase({columns: 4, rows: 2}));
    const {lit, differing} = diffPixels(quad, grid);

    expect(lit, 'the pixels of the sprite and its shadow').to.be.above(150);
    // seen at a slant, a vertex of the grid on an outer edge of the sprite is rounded apart from the
    // line between the corners, and a pixel whose middle lies on that edge may fall to either side
    expect(differing, 'the pixels on the edges where the grid differs from the quad').to.be.at.most(Math.ceil(lit / 50));
  });
});

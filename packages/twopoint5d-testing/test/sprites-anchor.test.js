import {expect} from '@esm-bundle/chai';
import {
  Anchor,
  AsepriteJson,
  AtlasFrame,
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  Flip,
  InstancePosition,
  QuadBase,
  QuadSize,
  Rotation,
  TextureColor,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  disposeDisplay,
  isNearColor,
  makeColorTexture,
  makeContainer,
  readsTopDown,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

const TARGET_SIZE = 64;
const PPU = 4;

const BLACK = [0, 0, 0];
const RED = [255, 0, 0];
const GREEN = [0, 255, 0];

const AnchoredKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Anchor, Rotation, AtlasFrame, TextureColor, Flip],
});

describe('sprites — Anchor', function () {
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

  async function render(sprites) {
    const topDown = await readsTopDown(display.renderer, target);
    const half = TARGET_SIZE / PPU / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const pixels = await renderToPixels(display.renderer, scene, camera, target);
    // the color at the point (x, y) of the view, in units from its middle, y up
    return (x, y) => {
      const column = Math.floor(TARGET_SIZE / 2 + x * PPU);
      const fromTop = Math.floor(TARGET_SIZE / 2 - y * PPU);
      return rgbAt(pixels, TARGET_SIZE, column, topDown ? fromTop : TARGET_SIZE - 1 - fromTop);
    };
  }

  const expectColor = (colorAt, x, y, rgb, what) =>
    expect(colorAt(x, y), `${what} at (${x}, ${y})`).to.satisfy((c) => isNearColor(c, rgb));

  async function renderStanding(rotation) {
    // red above green, the foot green
    const colorMap = makeColorTexture(
      [
        [255, 0, 0, 255],
        [0, 255, 0, 255],
      ],
      1,
      2,
    );
    const sprites = new FeatureSprites(AnchoredKind, {capacity: 1, textures: {colorMap}});
    const sprite = sprites.createSprite();
    sprite.setSize(4, 8);
    sprite.setTexCoords(0, 0, 1, 1);
    sprite.setAnchor(0.5, 1);
    sprite.rotation = rotation;
    const colorAt = await render(sprites);
    sprites.dispose();
    colorMap.dispose();
    return colorAt;
  }

  it('stands a sprite anchored at its foot on its position', async function () {
    const colorAt = await renderStanding(0);

    expectColor(colorAt, 0, 0.5, GREEN, 'the foot');
    expectColor(colorAt, 1.5, 3.5, GREEN, 'the foot');
    expectColor(colorAt, 0, 7.5, RED, 'the head');
    expectColor(colorAt, 0, -0.5, BLACK, 'below the foot');
    expectColor(colorAt, 2.5, 4, BLACK, 'beside the sprite');
  });

  it('turns a sprite anchored at its foot about the foot', async function () {
    const colorAt = await renderStanding(Math.PI);

    expectColor(colorAt, 0, -0.5, GREEN, 'the foot');
    expectColor(colorAt, 0, -7.5, RED, 'the head, hanging');
    expectColor(colorAt, 0, 0.5, BLACK, 'above the foot');
  });

  it('keeps a trimmed figure on the pivot of its Aseprite slice when it flips', async function () {
    // a canvas of 8 × 4 whose figure is two pixels on the bottom row — the foot, green, at x = 2, red
    // beside it — trimmed to them; the pivot marks the foot
    const json = {
      frames: {
        'figure 0.aseprite': {
          frame: {x: 0, y: 0, w: 2, h: 1},
          rotated: false,
          trimmed: true,
          spriteSourceSize: {x: 2, y: 3, w: 2, h: 1},
          sourceSize: {w: 8, h: 4},
          duration: 100,
        },
      },
      meta: {
        app: 'https://www.aseprite.org/',
        image: 'figure.png',
        size: {w: 2, h: 1},
        slices: [{name: 'pivot', keys: [{frame: 0, bounds: {x: 0, y: 0, w: 8, h: 4}, pivot: {x: 2, y: 3}}]}],
      },
    };
    const [atlas] = AsepriteJson.parse(json);
    const colorMap = makeColorTexture(
      [
        [0, 255, 0, 255],
        [255, 0, 0, 255],
      ],
      2,
      1,
    );
    const renderFigure = async (flipX) => {
      const sprites = new FeatureSprites(AnchoredKind, {capacity: 1, textures: {colorMap}});
      const sprite = sprites.createSprite();
      const frame = atlas.frame('figure 0.aseprite');
      sprite.setSize(8, 4);
      sprite.setFrame(frame);
      sprite.setAnchorFromPivot(frame);
      sprite.flipX = flipX;
      expect([sprite.anchorX, sprite.anchorY]).to.deep.equal([0.25, 1]);
      const colorAt = await render(sprites);
      sprites.dispose();
      return colorAt;
    };

    const facingRight = await renderFigure(0);
    const facingLeft = await renderFigure(1);
    colorMap.dispose();

    expectColor(facingRight, 0.5, 0.5, GREEN, 'the foot, facing right');
    expectColor(facingRight, 1.5, 0.5, RED, 'beside the foot, facing right');
    expectColor(facingRight, -0.5, 0.5, BLACK, 'behind the foot, facing right');
    expectColor(facingLeft, -0.5, 0.5, GREEN, 'the foot, facing left');
    expectColor(facingLeft, -1.5, 0.5, RED, 'beside the foot, facing left');
    expectColor(facingLeft, 0.5, 0.5, BLACK, 'behind the foot, facing left');
  });
});

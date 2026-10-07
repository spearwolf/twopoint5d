import {expect} from '@esm-bundle/chai';
import {
  AtlasFrame,
  BillboardPlacement,
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  Rotation,
  Shear,
  TextureColor,
  TexturePackerJson,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {diffPixels, disposeDisplay, makeColorTexture, makeContainer, renderToPixels} from './helpers/fixtures.js';

// 16 world units across 64 pixels: one unit is 4 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 4;

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];

const ShearedSprite = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Shear, Rotation, AtlasFrame, TextureColor],
});

/** The sheet of sprites-trimmed-frames.test.js: an untrimmed 5 × 4 frame and the same frame trimmed to 2 × 1. */
function makeTrimmedSheet() {
  const width = 8;
  const height = 4;
  const texels = Array.from({length: width * height}, () => [0, 0, 0, 0]);
  texels[2 * width + 1] = RED;
  texels[2 * width + 2] = GREEN;
  texels[5] = RED;
  texels[6] = GREEN;
  const trim = {trimmed: true, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}};
  return {
    texture: makeColorTexture(texels, width, height),
    json: {
      frames: {reference: {frame: {x: 0, y: 0, w: 5, h: 4}}, trimmed: {frame: {x: 5, y: 0, w: 2, h: 1}, ...trim}},
      meta: {image: 'sheet.png', size: {w: width, h: height}},
    },
  };
}

describe('sprites — a sprite composed of size, shear and rotation on a trimmed frame', function () {
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
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  function makeCamera() {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;
    return camera;
  }

  /** Renders one sprite of 5 × 4 units, sheared and turned, showing `frameName`, once per placement. */
  async function render(frameName) {
    const {texture, json} = makeTrimmedSheet();
    const [atlas] = TexturePackerJson.parse(json);
    const sprites = new FeatureSprites(ShearedSprite, {capacity: 1, textures: {colorMap: texture}});
    const sprite = sprites.createSprite();
    sprite.setSize(5, 4);
    sprite.setShear(0.25, 0);
    sprite.rotation = Math.PI / 6;
    sprite.setPosition(0, 0, 0);
    sprite.setFrame(atlas.frame(frameName));
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const flat = await renderToPixels(display.renderer, scene, makeCamera(), target);
    // one live material: the swap rebuilds the position graph, the sprite data stays as it is
    sprites.placement = BillboardPlacement;
    const billboard = await renderToPixels(display.renderer, scene, makeCamera(), target);

    // the mesh releases the material it built around the texture; the texture stays the caller's
    sprites.dispose();
    texture.dispose();
    return {flat, billboard};
  }

  it('draws the trimmed frame where the untrimmed one has its texels, flat and as a billboard', async function () {
    const reference = await render('reference');
    const trimmed = await render('trimmed');

    const flat = diffPixels(reference.flat, trimmed.flat);
    const billboard = diffPixels(reference.flat, trimmed.billboard);
    const placementSwap = diffPixels(reference.flat, reference.billboard);

    // the red and the green texel cover two cells of 4 × 4 pixels, sheared and turned
    expect(flat.lit, 'the reference draws its two texels').to.be.greaterThan(20);
    // an edge rasterised from a trimmed corner may fall on the other side of a pixel centre
    expect(flat.differing, 'the trimmed frame against the untrimmed one').to.be.at.most(Math.ceil(flat.lit * 0.1));
    expect(billboard.differing, 'the trimmed frame as a billboard against the untrimmed flat one').to.be.at.most(
      Math.ceil(flat.lit * 0.1),
    );
    // a camera looking straight down -z sees a billboard exactly as the flat sprite
    expect(placementSwap.differing, 'the same sprite flat and as a billboard').to.be.at.most(Math.ceil(flat.lit * 0.1));
  });
});

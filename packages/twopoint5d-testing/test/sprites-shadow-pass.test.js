import {expect} from '@esm-bundle/chai';
import {
  AnimatedSpriteKind,
  BillboardPlacement,
  Display,
  FeatureSprites,
  FrameBasedAnimations,
  ShadowPass,
  TextureCoords,
  TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {disposeDisplay, isNearColor, makeColorTexture, makeContainer, renderToPixels} from './helpers/fixtures.js';

const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;
const RED = [255, 0, 0, 255];
const CLEAR = [0, 0, 0, 0];
const BLUE = [0, 0, 255];

/** The columns, left to right, in which some pixel has the color `rgb`. */
function columnsOf(pixels, rgb) {
  const columns = new Set();
  for (let y = 0; y < TARGET_SIZE; y++) {
    for (let x = 0; x < TARGET_SIZE; x++) {
      const i = (y * TARGET_SIZE + x) * 4;
      if (isNearColor([pixels[i], pixels[i + 1], pixels[i + 2]], rgb)) columns.add(x);
    }
  }
  return columns.size === 0 ? {from: -1, to: -1} : {from: Math.min(...columns), to: Math.max(...columns)};
}

describe('sprites — a shadow pass', function () {
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

  function makeCamera() {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.set(-1, 0, 10);
    return camera;
  }

  function aimTheShadow(sprites) {
    sprites.setUniform('lightDirection', 0.5, 0, -1);
    sprites.setUniform('groundPlane', 0, 0, 1, 0);
    sprites.setUniform('shadowColor', 0, 0, 1, 1);
  }

  it('draws the shadow of a sprite where the light projects it, in the shadow color, flat and as a billboard', async function () {
    const colorMap = makeColorTexture([RED, RED, RED, RED], 2, 2);
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1, textures: {colorMap}, passes: [ShadowPass]});
    aimTheShadow(sprites);
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    sprite.setPosition(-1, 0, 4);
    sprite.setTexCoords(0, 0, 1, 1);
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const flat = await renderToPixels(display.renderer, scene, makeCamera(), target);
    sprites.placement = BillboardPlacement;
    const billboard = await renderToPixels(display.renderer, scene, makeCamera(), target);

    sprites.dispose();
    colorMap.dispose();

    for (const pixels of [flat, billboard]) {
      expect(columnsOf(pixels, [255, 0, 0]), 'the sprite at x ∈ [-2, 0]').to.deep.equal({from: CENTER - 8, to: CENTER + 7});
      expect(columnsOf(pixels, BLUE), 'its shadow at x ∈ [0, 2]').to.deep.equal({from: CENTER + 8, to: CENTER + 23});
    }
  });

  it('shows the shadow of the frame the animated sprite shows at the same time', async function () {
    // frame 0 is opaque red, frame 1 transparent: the shadow is there at the start and gone three quarters in
    const texels = [RED, CLEAR];
    const colorMap = makeColorTexture(texels);
    const frames = new TextureCoords(0, 0, texels.length, 1);
    const anims = new FrameBasedAnimations();
    anims.add(
      'blink',
      1,
      [0, 1].map((i) => new TextureCoords(frames, i, 0, 1, 1)),
    );
    const animsMap = anims.bakeDataTexture();

    const sprites = new FeatureSprites(AnimatedSpriteKind, {capacity: 1, textures: {colorMap, animsMap}, passes: [ShadowPass]});
    aimTheShadow(sprites);
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    sprite.setPosition(-1, 0, 4);
    sprite.animId = anims.animId('blink');
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    sprites.setUniform('time', 0);
    const atStart = await renderToPixels(display.renderer, scene, makeCamera(), target);
    sprites.setUniform('time', 0.75);
    const later = await renderToPixels(display.renderer, scene, makeCamera(), target);

    sprites.dispose();
    colorMap.dispose();
    animsMap.dispose();

    expect(columnsOf(atStart, BLUE).from, 'a shadow of the opaque frame').to.equal(CENTER + 8);
    expect(columnsOf(later, BLUE).from, 'no shadow of the transparent frame').to.equal(-1);
  });
});

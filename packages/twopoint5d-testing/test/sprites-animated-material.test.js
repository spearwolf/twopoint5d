import {expect} from '@esm-bundle/chai';
import {
  AnimatedSprites,
  AnimatedSpritesGeometry,
  AnimatedSpritesMaterial,
  Display,
  FrameBasedAnimations,
  TextureCoords,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {disposeDisplay, isNearColor, makeColorTexture, makeContainer, renderToPixels, rgbAt} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];
const BLUE = [0, 0, 255, 255];

describe('sprites — AnimatedSpritesMaterial draws the frame the time points at', function () {
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
   * One animation over one second, a frame for each texel of a color map one texel high — the
   * first frame on the left texel. Draws one sprite of 4 × 4 units over the middle of the target
   * at `time` and answers the color of the middle pixel. `bakeOptions` go to `bakeDataTexture()`.
   */
  async function renderAt(time, texels = [RED, GREEN], bakeOptions = undefined) {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;

    const colorMap = makeColorTexture(texels);
    const frames = new TextureCoords(0, 0, texels.length, 1);
    const anims = new FrameBasedAnimations();
    anims.add(
      'blink',
      1,
      texels.map((_, i) => new TextureCoords(frames, i, 0, 1, 1)),
    );
    const animsMap = anims.bakeDataTexture(bakeOptions);

    const geometry = new AnimatedSpritesGeometry(1);
    const material = new AnimatedSpritesMaterial({colorMap, animsMap, time});
    const sprites = new AnimatedSprites(geometry, material);
    sprites.frustumCulled = false;

    const sprite = geometry.instancedPool.createVO();
    sprite.setSize(4, 4);
    sprite.setPosition(0, 0, 0);
    sprite.animId = anims.animId('blink');
    sprite.animOffset = 0;

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const pixels = await renderToPixels(display.renderer, scene, camera, target);

    // the mesh gives geometry and material up; both, like the two textures, are the caller's
    sprites.dispose();
    geometry.dispose();
    material.dispose();
    colorMap.dispose();
    animsMap.dispose();

    return rgbAt(pixels, TARGET_SIZE, CENTER, CENTER);
  }

  it('shows the first frame at the start of the animation', async function () {
    const rgb = await renderAt(0);

    expect(rgb, 'the red of the first frame').to.satisfy((c) => isNearColor(c, [255, 0, 0]));
  });

  it('shows the second frame three quarters into the animation', async function () {
    const rgb = await renderAt(0.75);

    expect(rgb, 'the green of the second frame').to.satisfy((c) => isNearColor(c, [0, 255, 0]));
  });

  // three frames, not two: read one texel too early, the second frame hits the size texel
  // [1, 1, 0, 0] of the first, whose corner (1, 1) lies on the last texel of the color map — blue
  // here, and with two frames the very green that is expected
  it('shows the second frame of an animsMap baked with includeTextureSize in the middle of that frame', async function () {
    const rgb = await renderAt(0.5, [RED, GREEN, BLUE], {includeTextureSize: true});

    expect(rgb, 'the green of the second frame').to.satisfy((c) => isNearColor(c, [0, 255, 0]));
  });
});

import {expect} from '@esm-bundle/chai';
import {AnimatedSpriteKind, Display, FeatureSprites, TextureStore} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {disposeDisplay, isNearColor, makeContainer, renderToPixels, rgbAt} from './helpers/fixtures.js';

// the dev server of web-test-runner serves the repo root
const SHEET_URL = '/packages/twopoint5d/fixtures/aseprite/fighter-hash.json';

const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;

const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];
const WHITE = [255, 255, 255];

/**
 * The sheet of the fixture painted as a data url: 16 cells of 16 × 16, four to a row, the three
 * frames of the tag `kick` (8, 9, 10) red, green and blue, every other frame white.
 */
function paintSheet() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
  for (let frame = 0; frame < 16; frame++) {
    const rgb = frame === 8 ? RED : frame === 9 ? GREEN : frame === 10 ? BLUE : WHITE;
    ctx.fillStyle = `rgb(${rgb.join(',')})`;
    ctx.fillRect((frame % 4) * 16, Math.floor(frame / 4) * 16, 16, 16);
  }
  return canvas.toDataURL('image/png');
}

describe('texture — an Aseprite sheet through the TextureStore', function () {
  this.timeout(30000);

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

  it('publishes the tags of the sheet, and the one-shot kick plays its frames at their durations and holds the last', async function () {
    const store = new TextureStore(display.renderer);
    store.parse({items: {fighter: {atlasUrl: SHEET_URL, overrideImageUrl: paintSheet()}}});

    const [colorMap, animations] = await store.getAsync('fighter', ['texture', 'frameBasedAnimations']);
    const animsMap = animations.bakeDataTexture();

    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;

    const sprites = new FeatureSprites(AnimatedSpriteKind, {capacity: 1, textures: {colorMap, animsMap}});
    sprites.frustumCulled = false;
    const sprite = sprites.createSprite();
    sprite.setSize(4, 4);
    sprite.setPosition(0, 0, 0);
    sprite.animId = animations.animId('kick');
    // the kick starts at 10 s
    sprite.animOffset = -10;

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    // 80 ms, 80 ms and 240 ms: red until 10.08, green until 10.16, then blue, held
    const shown = [];
    for (const time of [9.5, 10.04, 10.12, 10.2, 12]) {
      sprites.setUniform('time', time);
      shown.push(rgbAt(await renderToPixels(display.renderer, scene, camera, target), TARGET_SIZE, CENTER, CENTER));
    }

    const tagNames = ['idle', 'walk', 'kick', 'block', 'spin'].filter((tag) => animations.hasAnimation(tag));
    const {playback, cycleDuration} = animations.animation('kick');

    sprites.dispose();
    animsMap.dispose();
    store.dispose();

    expect(tagNames, 'the tags of the sheet').to.deep.equal(['idle', 'walk', 'kick', 'block', 'spin']);
    expect([playback, Math.round(cycleDuration * 1000)], 'the kick is a one-shot of 400 ms').to.deep.equal(['once', 400]);
    const expected = [RED, RED, GREEN, BLUE, BLUE];
    shown.forEach((rgb, i) => {
      expect(rgb, `the frame at render ${i}`).to.satisfy((c) => isNearColor(c, expected[i]));
    });
  });
});

import {expect} from '@esm-bundle/chai';
import {Display, FeatureSprites, TexturedSpriteKind, TexturePackerJson} from '@spearwolf/twopoint5d';
import {NearestFilter, OrthographicCamera, RenderTarget, Scene, TextureLoader} from 'three/webgpu';
import {disposeDisplay, isNearColor, makeContainer, readsTopDown, renderToPixels, rgbAt} from './helpers/fixtures.js';

// a real export of free-tex-packer-core, see its README; the test runner serves the repo root
const FIXTURES = '/packages/twopoint5d/src/texture/fixtures/free-tex-packer';

// 16 world units across 64 pixels: one unit — one texel of the sheet — is 4 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 4;
const CENTER = TARGET_SIZE / 2;

// the six cells of 2 × 2 texels the source images hold, row by row from the top
const CELLS = [
  [255, 0, 0],
  [0, 255, 0],
  [0, 0, 255],
  [255, 255, 0],
  [0, 255, 255],
  [255, 0, 255],
];

describe('sprites — the frames of a free-tex-packer sheet', function () {
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

  it('draws a rotated and a rotated trimmed frame upright, every cell where the source image has it', async function () {
    const topDown = await readsTopDown(display.renderer, target);

    const json = await (await fetch(`${FIXTURES}/sheet-hash.json`)).json();
    const [atlas] = TexturePackerJson.parse(json);
    const sheet = await new TextureLoader().loadAsync(`${FIXTURES}/sheet.png`);
    sheet.flipY = false;
    sheet.magFilter = NearestFilter;
    sheet.minFilter = NearestFilter;
    sheet.generateMipmaps = false;

    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 2, textures: {colorMap: sheet}});
    sprites.frustumCulled = false;
    // each sprite one unit per texel of its untrimmed source, its middle at x
    const placed = {gem: -4, hero: 3.5};
    for (const [name, x] of Object.entries(placed)) {
      const frame = atlas.frame(`${name}.png`);
      const {sourceSize} = frame.data;
      const sprite = sprites.createSprite();
      sprite.setSize(sourceSize.w, sourceSize.h);
      sprite.setPosition(x, 0, 0);
      sprite.setFrame(frame);
    }

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;
    const pixels = await renderToPixels(display.renderer, scene, camera, target);
    sprites.dispose();
    sheet.dispose();

    /** The color at the texel `(sx, sy)` of the source image — from its top left — of the sprite `name`. */
    const colorAt = (name, sx, sy) => {
      const {w, h} = atlas.frame(`${name}.png`).data.sourceSize;
      const x = placed[name] + sx - w / 2;
      const y = h / 2 - sy;
      const column = Math.floor(CENTER + x * PIXELS_PER_UNIT);
      const fromTop = Math.floor(CENTER - y * PIXELS_PER_UNIT);
      return rgbAt(pixels, TARGET_SIZE, column, topDown ? fromTop : TARGET_SIZE - 1 - fromTop);
    };

    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 2; column++) {
        const cell = row * 2 + column;
        // gem holds the cells in reverse order and fills its image; hero lies 2 texels right and 1 down in its 9 × 9
        const gem = colorAt('gem', 2 * column + 1, 2 * row + 1);
        const hero = colorAt('hero', 2 + 2 * column + 1, 1 + 2 * row + 1);
        expect(isNearColor(gem, CELLS[5 - cell]), `gem cell ${cell}: ${gem}`).to.be.true;
        expect(isNearColor(hero, CELLS[cell]), `hero cell ${cell}: ${hero}`).to.be.true;
      }
    }
    // the trimmed margin of hero is empty: its top left texel of the source shows the clear color
    expect(isNearColor(colorAt('hero', 0.5, 0.5), [0, 0, 0]), 'a texel in the trimmed margin').to.be.true;
  });
});

import {expect} from '@esm-bundle/chai';
import {BitmapFont, Display, FeatureSprites, layoutText, TexturedSpriteKind, writeText} from '@spearwolf/twopoint5d';
import {NearestFilter, OrthographicCamera, RenderTarget, Scene, TextureLoader} from 'three/webgpu';
import {disposeDisplay, makeContainer, readsTopDown, renderToPixels} from './helpers/fixtures.js';

// the lookbook's pixel-8 font; the test runner serves the repo root
const FIXTURES = '/packages/twopoint5d/src/text/fixtures';

// 32 world units across 64 pixels: one unit — one pixel of the font at scale 1 — is 2 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 2;
const CENTER = TARGET_SIZE / 2;

/** The alpha of every pixel of the font's page, read from the png. */
async function pageAlpha(url) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const {data} = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return (x, y) => data[(y * bitmap.width + x) * 4 + 3];
}

describe('text — writeText() with a BMFont', function () {
  let display;
  let host;
  let target;
  let sprites;
  let page;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
  });

  afterEach(() => {
    sprites?.dispose();
    sprites = undefined;
    page?.dispose();
    page = undefined;
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  /**
   * Writes `text` with `options`, renders it and compares every texel of every glyph box — at the place
   * layoutText() computes for it — with the page image: lit where the page has a pixel, dark where not.
   * Answers the number of texels that differ and the lit pixels counted inside and outside the boxes.
   */
  async function drawAndCompare(text, options) {
    const topDown = await readsTopDown(display.renderer, target);

    const [font] = BitmapFont.parse(await (await fetch(`${FIXTURES}/pixel-8.fnt`)).text());
    page = await new TextureLoader().loadAsync(`${FIXTURES}/${font.page}`);
    page.flipY = false;
    page.magFilter = NearestFilter;
    page.minFilter = NearestFilter;
    page.generateMipmaps = false;
    const alphaAt = await pageAlpha(`${FIXTURES}/${font.page}`);

    sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 32, textures: {colorMap: page}});
    sprites.frustumCulled = false;
    const glyphs = writeText(sprites, font, text, options);
    const layout = layoutText(font, text, options);
    expect(glyphs.length).to.equal(layout.glyphs.length);

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;
    const pixels = await renderToPixels(display.renderer, scene, camera, target);

    const litAt = (column, fromTop) => {
      const row = topDown ? fromTop : TARGET_SIZE - 1 - fromTop;
      return pixels[(row * TARGET_SIZE + column) * 4] > 128;
    };

    const differing = [];
    let litTexels = 0;
    for (const {glyph, x, y} of layout.glyphs) {
      for (let ty = 0; ty < glyph.height; ty++) {
        for (let tx = 0; tx < glyph.width; tx++) {
          const expected = alphaAt(glyph.x + tx, glyph.y + ty) > 127;
          if (expected) litTexels++;
          // the middle of the texel, in world units, y up
          const column = Math.floor(CENTER + (x + tx + 0.5) * PIXELS_PER_UNIT);
          const fromTop = Math.floor(CENTER - (y - ty - 0.5) * PIXELS_PER_UNIT);
          if (litAt(column, fromTop) !== expected) differing.push(`${glyph.char} (${tx}, ${ty})`);
        }
      }
    }
    let litPixels = 0;
    for (let i = 0; i < pixels.length; i += 4) if (pixels[i] > 128) litPixels++;

    return {differing, litTexels, litPixels, layout, glyphs};
  }

  it('draws every texel of every glyph where the layout puts it, two lines from the top left', async () => {
    const {differing, litTexels, litPixels, layout} = await drawAndCompare('AB\n-g', {x: -15, y: 15});
    expect(layout.lineCount).to.equal(2);
    expect(litTexels).to.be.greaterThan(40);
    expect(differing, differing.join(', ')).to.deep.equal([]);
    // nothing lit outside the glyphs: every lit texel is a square of 2 × 2 pixels
    expect(litPixels).to.equal(litTexels * PIXELS_PER_UNIT * PIXELS_PER_UNIT);
  });

  it('a glyph with a yoffset lands lower by it, and align right puts the end of each line at x', async () => {
    const {differing, litTexels, litPixels, layout} = await drawAndCompare('A-\nHI', {x: 15, y: 10, align: 'right'});
    expect(differing, differing.join(', ')).to.deep.equal([]);
    expect(litPixels).to.equal(litTexels * PIXELS_PER_UNIT * PIXELS_PER_UNIT);

    const dash = layout.glyphs.find(({glyph}) => glyph.char === '-');
    expect(dash.glyph.yoffset).to.be.greaterThan(0);
    expect(dash.y).to.equal(10 - dash.glyph.yoffset);
    // both lines are two advances of 8 wide, ending at x = 15
    expect(layout.glyphs[0].x).to.equal(15 - 16 + layout.glyphs[0].glyph.xoffset);
  });
});

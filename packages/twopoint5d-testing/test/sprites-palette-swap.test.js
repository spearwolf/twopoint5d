import {expect} from '@esm-bundle/chai';
import {
  AtlasFrame,
  BitmapFont,
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  PaletteSwap,
  QuadBase,
  QuadSize,
  TextureColor,
  TextureCoords,
} from '@spearwolf/twopoint5d';
import {NearestFilter, OrthographicCamera, RenderTarget, Scene, SRGBColorSpace, TextureLoader} from 'three/webgpu';
import {
  disposeDisplay,
  isNearColor,
  makeColorTexture,
  makeContainer,
  readsTopDown,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

// the lookbook's assets; the test runner serves the repo root
const ASSETS = '/apps/lookbook/public/assets';

const Swapped = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, TextureColor, PaletteSwap]});
const SwappedFrames = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, PaletteSwap],
});

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];
const BLUE = [0, 0, 255, 255];
const GREY = [128, 128, 128, 255];
const YELLOW = [255, 255, 0, 255];
const CYAN = [0, 255, 255, 255];
const MAGENTA = [255, 0, 255, 255];
const WHITE = [255, 255, 255, 255];
const ORANGE = [255, 128, 0, 255];
const PURPLE = [128, 0, 255, 255];

/** The rgba of every texel of an image file, row by row from the top. */
async function texelsOf(url) {
  const bitmap = await createImageBitmap(await (await fetch(url)).blob(), {
    premultiplyAlpha: 'none',
    colorSpaceConversion: 'none',
  });
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0);
  const {data} = ctx.getImageData(0, 0, bitmap.width, bitmap.height);
  return {
    width: bitmap.width,
    height: bitmap.height,
    at: (x, y) => Array.from(data.subarray((y * bitmap.width + x) * 4, (y * bitmap.width + x) * 4 + 4)),
  };
}

/** A texture of an image file, read texel for texel and upright. */
async function loadNearest(url) {
  const texture = await new TextureLoader().loadAsync(url);
  texture.flipY = false;
  texture.magFilter = NearestFilter;
  texture.minFilter = NearestFilter;
  texture.generateMipmaps = false;
  return texture;
}

/** The colour `palette` draws `source` with in `row`, cycling `[first, first + count)` by `shift`, worked out on the CPU. */
function swapOnCpu(palette, source, row, {first = 0, count = 0, shift = 0} = {}) {
  let index = -1;
  for (let i = 0; i < palette.width; i++) {
    const entry = palette.at(i, 0);
    if (entry[0] === source[0] && entry[1] === source[1] && entry[2] === source[2]) {
      index = i;
      break;
    }
  }
  if (index < 0) return source;
  const length = count > 0 ? count : palette.width - first;
  const offset = index - first;
  const entry = offset >= 0 && offset < length ? first + ((((offset + Math.floor(shift)) % length) + length) % length) : index;
  return [...palette.at(entry, row).slice(0, 3), source[3]];
}

describe('sprites — PaletteSwap', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(30000);

  let display;
  let host;
  const disposables = [];

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
  });

  afterEach(() => {
    for (const item of disposables.splice(0)) item.dispose();
    disposeDisplay(display);
    display = undefined;
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  const keep = (item) => {
    disposables.push(item);
    return item;
  };

  /**
   * Renders `sprites` seen straight on, `size` pixels square at one pixel a unit, and answers the colour
   * at a point of the view, y up.
   */
  const render = async (sprites, size, topDown) => {
    const target = keep(new RenderTarget(size, size));
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const camera = new OrthographicCamera(-size / 2, size / 2, size / 2, -size / 2, 0.1, 100);
    camera.position.z = 10;
    const pixels = await renderToPixels(display.renderer, scene, camera, target);
    scene.remove(sprites);
    return (x, y) => {
      const column = Math.floor(size / 2 + x);
      const fromTop = Math.floor(size / 2 - y);
      return rgbAt(pixels, size, column, topDown ? fromTop : size - 1 - fromTop);
    };
  };

  it('draws a row of a palette, leaves an unmatched colour, and cycles by paletteShift over a range', async () => {
    const topDown = await readsTopDown(display.renderer, keep(new RenderTarget(64, 64)));
    // four texels: the three source colours and one the palette does not hold
    const colorMap = keep(makeColorTexture([RED, GREEN, BLUE, GREY], 4, 1));
    // three entries, three rows: the source, and two replacement sets
    const palette = keep(makeColorTexture([RED, GREEN, BLUE, YELLOW, CYAN, MAGENTA, WHITE, ORANGE, PURPLE], 3, 3));
    const sprites = keep(new FeatureSprites(Swapped, {capacity: 1, textures: {colorMap, palette}}));
    const sprite = sprites.createSprite();
    // 4 units a texel, at 1 pixel a unit: each texel a cell of 4 × 4 pixels
    sprite.setSize(16, 4);

    const cells = async () => {
      sprites.spritePool.touchVO(sprite, 'paletteRow');
      const colorAt = await render(sprites, 64, topDown);
      return [-6, -2, 2, 6].map((x) => colorAt(x, 0));
    };
    const expectCells = (rgbs, expected, what) => {
      rgbs.forEach((rgb, i) => expect(isNearColor(rgb, expected[i]), `${what}, texel ${i}: ${rgb}`).to.be.true);
    };

    expectCells(await cells(), [RED, GREEN, BLUE, GREY], 'row 0');
    sprite.paletteRow = 1;
    expectCells(await cells(), [YELLOW, CYAN, MAGENTA, GREY], 'row 1');
    sprite.paletteRow = 2;
    expectCells(await cells(), [WHITE, ORANGE, PURPLE, GREY], 'row 2');
    sprite.paletteRow = 9;
    expectCells(await cells(), [WHITE, ORANGE, PURPLE, GREY], 'a row past the last');

    sprite.paletteRow = 1;
    sprites.setUniform('paletteShift', 1.7);
    expectCells(await cells(), [CYAN, MAGENTA, YELLOW, GREY], 'the whole palette shifted by 1');
    sprites.setUniform('paletteShift', -1);
    expectCells(await cells(), [MAGENTA, YELLOW, CYAN, GREY], 'shifted by −1');
    sprites.setUniform('paletteCycle', 1, 2);
    sprites.setUniform('paletteShift', 1);
    expectCells(await cells(), [YELLOW, MAGENTA, CYAN, GREY], 'entries 1 and 2 cycled');
  });

  it('compares sRGB textures in their 8-bit values: black and a dark grey keep their colour beside close palette entries', async () => {
    const topDown = await readsTopDown(display.renderer, keep(new RenderTarget(64, 64)));
    const srgb = (texture) => {
      texture.colorSpace = SRGBColorSpace;
      texture.magFilter = NearestFilter;
      texture.minFilter = NearestFilter;
      return texture;
    };
    // black and 25 match no entry; decoded to linear values, black lies within 1/512 of the entry 5 and
    // 25 within 1/512 of the entry 28
    const colorMap = keep(
      srgb(
        makeColorTexture(
          [
            [0, 0, 0, 255],
            [5, 5, 5, 255],
            [25, 25, 25, 255],
            [28, 28, 28, 255],
          ],
          4,
          1,
        ),
      ),
    );
    const palette = keep(srgb(makeColorTexture([[5, 5, 5, 255], [28, 28, 28, 255], RED, GREEN], 2, 2)));
    const sprites = keep(new FeatureSprites(Swapped, {capacity: 1, textures: {colorMap, palette}}));
    const sprite = sprites.createSprite();
    // 4 units a texel, at 1 pixel a unit: each texel a cell of 4 × 4 pixels
    sprite.setSize(16, 4);
    sprite.paletteRow = 1;

    const colorAt = await render(sprites, 64, topDown);
    const [black, five, darkGrey, twentyEight] = [-6, -2, 2, 6].map((x) => colorAt(x, 0));

    expect(isNearColor(five, RED), `the texel 5: ${five}`).to.be.true;
    expect(isNearColor(twentyEight, GREEN), `the texel 28: ${twentyEight}`).to.be.true;
    // the target holds linear values, so the greys read darker than their texels; what counts is that
    // they stay grey and dark
    expect(isNearColor(black, [0, 0, 0]), `black: ${black}`).to.be.true;
    const grey = darkGrey[0] === darkGrey[1] && darkGrey[1] === darkGrey[2] && darkGrey[0] <= 28;
    expect(grey, `the texel 25: ${darkGrey}`).to.be.true;
  });

  it('draws the lookbook goblin in its red and its blue variant, texel for texel', async () => {
    const goblinUrl = `${ASSETS}/platformer/goblin.png`;
    const paletteUrl = `${ASSETS}/platformer/goblin-palette.png`;
    const topDown = await readsTopDown(display.renderer, keep(new RenderTarget(64, 64)));
    const [colorMap, palette] = [keep(await loadNearest(goblinUrl)), keep(await loadNearest(paletteUrl))];
    const image = await texelsOf(goblinUrl);
    const colours = await texelsOf(paletteUrl);

    const sprites = keep(new FeatureSprites(Swapped, {capacity: 1, textures: {colorMap, palette}}));
    const sprite = sprites.createSprite();
    sprite.setSize(image.width, image.height);

    for (const row of [1, 2]) {
      sprite.paletteRow = row;
      sprites.spritePool.touchVO(sprite, 'paletteRow');
      const colorAt = await render(sprites, 128, topDown);
      let checked = 0;
      const differing = [];
      for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
          const source = image.at(x, y);
          if (source[3] < 255) continue;
          checked++;
          const expected = swapOnCpu(colours, source, row);
          const rgb = colorAt(x - image.width / 2 + 0.5, image.height / 2 - y - 0.5);
          if (!isNearColor(rgb, expected)) differing.push(`(${x}, ${y}) ${rgb} for ${expected.slice(0, 3)}`);
        }
      }
      expect(checked, `row ${row}`).to.be.greaterThan(500);
      expect(differing.slice(0, 5), `row ${row}: ${differing.length} texels differ`).to.deep.equal([]);
    }
  });

  it('cycles the chrome font over its entries 1 to 15, texel for texel', async () => {
    const dir = `${ASSETS}/sine-scroller`;
    const topDown = await readsTopDown(display.renderer, keep(new RenderTarget(64, 64)));
    const [font] = BitmapFont.parse(await (await fetch(`${dir}/chrome-32.fnt`)).text());
    const [colorMap, palette] = [
      keep(await loadNearest(`${dir}/chrome-32.png`)),
      keep(await loadNearest(`${dir}/chrome-32-palette.png`)),
    ];
    const page = await texelsOf(`${dir}/chrome-32.png`);
    const colours = await texelsOf(`${dir}/chrome-32-palette.png`);
    const glyph = font.glyph('A');

    const sprites = keep(new FeatureSprites(SwappedFrames, {capacity: 1, textures: {colorMap, palette}}));
    const sprite = sprites.createSprite();
    sprite.setSize(glyph.width, glyph.height);
    sprite.setFrame({
      coords: new TextureCoords(new TextureCoords(0, 0, page.width, page.height), glyph.x, glyph.y, glyph.width, glyph.height),
    });
    sprite.paletteRow = 1;
    sprites.setUniform('paletteCycle', 1, 15);

    for (const shift of [0, 3]) {
      sprites.setUniform('paletteShift', shift);
      const colorAt = await render(sprites, 64, topDown);
      let checked = 0;
      const differing = [];
      for (let y = 0; y < glyph.height; y++) {
        for (let x = 0; x < glyph.width; x++) {
          const source = page.at(glyph.x + x, glyph.y + y);
          if (source[3] < 255) continue;
          checked++;
          const expected = swapOnCpu(colours, source, 1, {first: 1, count: 15, shift});
          const rgb = colorAt(x - glyph.width / 2 + 0.5, glyph.height / 2 - y - 0.5);
          if (!isNearColor(rgb, expected)) differing.push(`(${x}, ${y}) ${rgb} for ${expected.slice(0, 3)}`);
        }
      }
      expect(checked, `shift ${shift}`).to.be.greaterThan(100);
      expect(differing.slice(0, 5), `shift ${shift}: ${differing.length} texels differ`).to.deep.equal([]);
    }
  });
});

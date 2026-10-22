import {expect} from '@esm-bundle/chai';
import {Display, DynamicAtlas, FeatureSprites, TexturedSpriteKind} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {disposeDisplay, isNearColor, makeContainer, readsTopDown, renderToPixels, rgbAt} from './helpers/fixtures.js';

// 16 world units across 64 pixels: one unit is 4 pixels; every sprite is 4 × 4 units, one unit a texel
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 4;
const CENTER = TARGET_SIZE / 2;

const RED = [255, 0, 0];
const GREEN = [0, 255, 0];
const BLUE = [0, 0, 255];
const YELLOW = [255, 255, 0];
const WHITE = [255, 255, 255];
const MAGENTA = [255, 0, 255];
const BLACK = [0, 0, 0];

/** Fills `ctx` with two halves of 4 × 4: `first` on top (or left), `second` below (or right). */
function halves(ctx, first, second, split = 'horizontal') {
  ctx.fillStyle = `rgb(${first.join(',')})`;
  if (split === 'horizontal') ctx.fillRect(0, 0, 4, 2);
  else ctx.fillRect(0, 0, 2, 4);
  ctx.fillStyle = `rgb(${second.join(',')})`;
  if (split === 'horizontal') ctx.fillRect(0, 2, 4, 2);
  else ctx.fillRect(2, 0, 2, 4);
}

describe('texture — DynamicAtlas', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  let display;
  let host;
  let target;
  let atlas;
  let sprites;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
  });

  afterEach(() => {
    sprites?.dispose();
    sprites = undefined;
    atlas?.dispose();
    atlas = undefined;
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  const camera = () => {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const cam = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    cam.position.z = 10;
    return cam;
  };

  /** Renders the sprites and answers the color at the point `(x, y)` of the view, in units, y up. */
  const render = async (topDown) => {
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const pixels = await renderToPixels(display.renderer, scene, camera(), target);
    return (x, y) => {
      const column = Math.floor(CENTER + x * PIXELS_PER_UNIT);
      const fromTop = Math.floor(CENTER - y * PIXELS_PER_UNIT);
      return rgbAt(pixels, TARGET_SIZE, column, topDown ? fromTop : TARGET_SIZE - 1 - fromTop);
    };
  };

  const showFrame = (frame, x, y = 0) => {
    const sprite = sprites.createSprite();
    sprite.setSize(4, 4);
    sprite.setPosition(x, y, 0);
    sprite.setFrame(frame);
    return sprite;
  };

  it('draws the frames of a callback, an ImageBitmap and a canvas upright, each texel where it was drawn', async () => {
    const topDown = await readsTopDown(display.renderer, target);

    atlas = new DynamicAtlas({width: 64, height: 32, filter: 'nearest'});
    const drawn = atlas.add('drawn', (ctx) => halves(ctx, RED, BLUE), {width: 4, height: 4});

    const pixels = new Uint8ClampedArray(4 * 4 * 4);
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 4; x++) {
        const [r, g, b] = x < 2 ? GREEN : YELLOW;
        pixels.set([r, g, b, 255], (y * 4 + x) * 4);
      }
    }
    const bitmap = await createImageBitmap(new ImageData(pixels, 4, 4));
    const fromBitmap = atlas.add('bitmap', bitmap);

    const source = document.createElement('canvas');
    source.width = 4;
    source.height = 4;
    halves(source.getContext('2d'), WHITE, MAGENTA);
    const fromCanvas = atlas.add('canvas', source);

    sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 3, textures: {colorMap: atlas.texture}});
    sprites.frustumCulled = false;
    showFrame(drawn, -5);
    showFrame(fromBitmap, 0);
    showFrame(fromCanvas, 5);

    const colorAt = await render(topDown);

    // the callback: red on top, blue below — upright, flipY false
    expect(isNearColor(colorAt(-5, 1), RED), `drawn, top: ${colorAt(-5, 1)}`).to.be.true;
    expect(isNearColor(colorAt(-5, -1), BLUE), `drawn, bottom: ${colorAt(-5, -1)}`).to.be.true;
    // the bitmap: green left, yellow right
    expect(isNearColor(colorAt(-1, 0.5), GREEN), `bitmap, left: ${colorAt(-1, 0.5)}`).to.be.true;
    expect(isNearColor(colorAt(1, 0.5), YELLOW), `bitmap, right: ${colorAt(1, 0.5)}`).to.be.true;
    // the canvas: white on top, magenta below
    expect(isNearColor(colorAt(5, 1), WHITE), `canvas, top: ${colorAt(5, 1)}`).to.be.true;
    expect(isNearColor(colorAt(5, -1), MAGENTA), `canvas, bottom: ${colorAt(5, -1)}`).to.be.true;
    // between the sprites nothing
    expect(isNearColor(colorAt(-2.5, 0), BLACK), `between: ${colorAt(-2.5, 0)}`).to.be.true;
  });

  it('shows a frame added after the first render, and a redraw, in the next render', async () => {
    const topDown = await readsTopDown(display.renderer, target);

    atlas = new DynamicAtlas({width: 32, height: 32, filter: 'nearest'});
    const first = atlas.add(
      'first',
      (ctx, w, h) => {
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(0, 0, w, h);
      },
      {width: 4, height: 4},
    );

    sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 2, textures: {colorMap: atlas.texture}});
    sprites.frustumCulled = false;
    showFrame(first, -3);

    let colorAt = await render(topDown);
    expect(isNearColor(colorAt(-3, 0), RED), `first: ${colorAt(-3, 0)}`).to.be.true;

    const second = atlas.add(
      'second',
      (ctx, w, h) => {
        ctx.fillStyle = 'rgb(0,255,0)';
        ctx.fillRect(0, 0, w, h);
      },
      {width: 4, height: 4},
    );
    showFrame(second, 3);
    // the first sprite is not written to: its frame is drawn anew in place
    atlas.redraw('first', (ctx, w, h) => {
      ctx.fillStyle = 'rgb(0,0,255)';
      ctx.fillRect(0, 0, w, h);
    });

    colorAt = await render(topDown);
    expect(isNearColor(colorAt(3, 0), GREEN), `second: ${colorAt(3, 0)}`).to.be.true;
    expect(isNearColor(colorAt(-3, 0), BLUE), `first, redrawn: ${colorAt(-3, 0)}`).to.be.true;
  });

  it('after upload(), a redraw, a remove and an add into the freed cell reach the next render through copies of their cells', async () => {
    const topDown = await readsTopDown(display.renderer, target);
    const fill = (color) => (ctx, w, h) => {
      ctx.fillStyle = `rgb(${color.join(',')})`;
      ctx.fillRect(0, 0, w, h);
    };

    atlas = new DynamicAtlas({width: 32, height: 32, filter: 'nearest'});
    const left = atlas.add('left', fill(RED), {width: 4, height: 4});
    const right = atlas.add('right', fill(GREEN), {width: 4, height: 4});

    sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 2, textures: {colorMap: atlas.texture}});
    sprites.frustumCulled = false;
    showFrame(left, -3);
    showFrame(right, 3);

    // the first call copies nothing: the first render uploads the whole canvas
    atlas.upload(display.renderer);
    let colorAt = await render(topDown);
    expect(isNearColor(colorAt(-3, 0), RED), `left: ${colorAt(-3, 0)}`).to.be.true;
    expect(isNearColor(colorAt(3, 0), GREEN), `right: ${colorAt(3, 0)}`).to.be.true;

    const version = atlas.texture.version;
    atlas.redraw('left', fill(BLUE));
    atlas.upload(display.renderer);
    expect(atlas.texture.version).to.equal(version);
    colorAt = await render(topDown);
    expect(isNearColor(colorAt(-3, 0), BLUE), `left, redrawn: ${colorAt(-3, 0)}`).to.be.true;
    expect(isNearColor(colorAt(3, 0), GREEN), `right, beside it: ${colorAt(3, 0)}`).to.be.true;

    atlas.remove('right');
    const again = atlas.add('again', fill(YELLOW), {width: 4, height: 4});
    expect(again.data.frame).to.deep.equal(right.data.frame);
    atlas.upload(display.renderer);
    expect(atlas.texture.version).to.equal(version);
    // the sprite on the right still shows the coords of `right`: the cell `again` was packed into
    colorAt = await render(topDown);
    expect(isNearColor(colorAt(3, 0), YELLOW), `right, packed anew: ${colorAt(3, 0)}`).to.be.true;
    expect(isNearColor(colorAt(-3, 0), BLUE), `left: ${colorAt(-3, 0)}`).to.be.true;
  });

  it('keeps straight alpha: a half transparent red blends to half red over black', async () => {
    const topDown = await readsTopDown(display.renderer, target);

    atlas = new DynamicAtlas({width: 16, height: 16, filter: 'nearest'});
    const half = atlas.add(
      'half',
      (ctx, w, h) => {
        ctx.fillStyle = 'rgba(255,0,0,0.5)';
        ctx.fillRect(0, 0, w, h);
      },
      {width: 4, height: 4},
    );

    sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1, textures: {colorMap: atlas.texture}, transparent: true});
    sprites.frustumCulled = false;
    showFrame(half, 0);

    const colorAt = await render(topDown);
    // premultiplied twice it would come out near 64 in linear space, or near 27 decoded from sRGB
    const [r, g, b] = colorAt(0, 0);
    expect(Math.abs(r - 128), `red ${r}`).to.be.at.most(8);
    expect(g).to.be.at.most(2);
    expect(b).to.be.at.most(2);
  });

  it('extrudes the edges of a frame into its cell and keeps the padding clear', () => {
    atlas = new DynamicAtlas({width: 16, height: 16, padding: 1, extrude: 2});
    const frame = atlas.add(
      'a',
      (ctx, w, h) => {
        ctx.fillStyle = 'rgb(255,0,0)';
        ctx.fillRect(0, 0, w, h);
      },
      {width: 2, height: 2},
    );
    expect(frame.data.frame).to.deep.equal({x: 3, y: 3, w: 2, h: 2});

    const {data} = atlas.context.getImageData(0, 0, 16, 16);
    const alphaAt = (x, y) => data[(y * 16 + x) * 4 + 3];
    const redAt = (x, y) => data[(y * 16 + x) * 4];

    // the cell runs from 1 to 6 on both axes: the frame at 3 … 4, its extruded edges around it
    for (const [x, y] of [
      [1, 1],
      [3, 1],
      [6, 1],
      [1, 3],
      [6, 4],
      [3, 6],
      [6, 6],
      [3, 3],
    ]) {
      expect([redAt(x, y), alphaAt(x, y)], `(${x}, ${y})`).to.deep.equal([255, 255]);
    }
    // the padding around it stays clear
    for (const [x, y] of [
      [0, 0],
      [0, 3],
      [3, 0],
      [7, 3],
      [3, 7],
      [7, 7],
    ]) {
      expect(alphaAt(x, y), `(${x}, ${y})`).to.equal(0);
    }
  });

  it('draws an SVG image without a width and a height at the size add() gives it, and redraws it at the size of the frame', async () => {
    const svgImage = async (color) => {
      const img = new Image();
      img.src = `data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 4"><rect width="4" height="4" fill="${color}"/></svg>`,
      )}`;
      await img.decode();
      return img;
    };
    const red = await svgImage('rgb(255,0,0)');
    const blue = await svgImage('rgb(0,0,255)');

    atlas = new DynamicAtlas({width: 16, height: 16});
    const frame = atlas.add('icon', red, {width: 4, height: 4});
    expect(frame.data.frame).to.deep.equal({x: 1, y: 1, w: 4, h: 4});

    const pixelsOf = (color) => {
      const {data} = atlas.context.getImageData(1, 1, 4, 4);
      for (let i = 0; i < 16; i++) {
        expect([data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]], `pixel ${i}`).to.deep.equal([...color, 255]);
      }
    };
    pixelsOf(RED);

    atlas.redraw('icon', blue);
    pixelsOf(BLUE);
  });

  it('refuses an image element that failed to load — without a size for want of a natural size, with one in drawImage() — and takes no cell for it', async () => {
    const broken = new Image();
    broken.src = 'data:image/png;base64,AAAA';
    await broken.decode().catch(() => {});

    atlas = new DynamicAtlas({width: 16, height: 16});
    let refused;
    try {
      atlas.add('broken', broken);
    } catch (caught) {
      refused = caught;
    }
    expect(refused, 'add() of a broken image without a size throws').to.be.an.instanceOf(Error);
    expect(refused.name).to.equal('Error');
    expect(refused.message).to.contain('has no natural size');
    expect(atlas.atlas.size).to.equal(0);

    let error;
    try {
      atlas.add('broken', broken, {width: 4, height: 4});
    } catch (caught) {
      error = caught;
    }
    expect(error, 'add() of a broken image throws').to.be.an.instanceOf(Error);
    expect(error.name).to.equal('InvalidStateError');
    expect(atlas.atlas.size).to.equal(0);

    const next = atlas.add('next', () => {}, {width: 4, height: 4});
    expect(next.data.frame).to.deep.equal({x: 1, y: 1, w: 4, h: 4});
  });
});

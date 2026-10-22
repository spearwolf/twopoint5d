import {createSandbox} from 'sinon';
import {Box2, CanvasTexture, LinearFilter, NearestFilter, SRGBColorSpace, Vector2, type WebGPURenderer} from 'three/webgpu';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import {prepareSpriteFrame} from '../sprites/features/AtlasFrame.js';
import {asCanvas, FakeCanvas} from '../testing/fakeCanvas.js';
import {AtlasFrameTable} from './AtlasFrameTable.js';
import {DynamicAtlas, type DynamicAtlasImage} from './DynamicAtlas.js';
import {frameTable} from './FrameTable.js';

const atlasOn = (
  width: number,
  height: number,
  options: {padding?: number; extrude?: number; filter?: 'linear' | 'nearest'} = {},
) => {
  const canvas = new FakeCanvas(width, height);
  const atlas = new DynamicAtlas({canvas: asCanvas(canvas), ...options});
  return {canvas, context: canvas.context, atlas};
};

const image = (width: number, height: number) => ({width, height}) as unknown as DynamicAtlasImage;

const noop = () => {};

const NO_LONGER_BE_A_COINCIDENCE = 23;

// an image element that has loaded without a natural size: an SVG without width and height
const svg = {width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, complete: true} as unknown as DynamicAtlasImage;

const NOT_LOADED = (call: string) =>
  `DynamicAtlas: the image of "avatar" has not loaded yet — await image.decode() before ${call}`;
const ZERO_BY_ZERO =
  'DynamicAtlas: the image of "avatar" is 0 × 0 — a closed ImageBitmap or a canvas of no size has nothing to draw';

const rectOf = (atlas: DynamicAtlas, name: string) => atlas.atlas.frame(name)?.data?.frame;

// a renderer that records the copies upload() hands it
const fakeRenderer = () => {
  const copyTextureToTexture = vi.fn();
  return {renderer: {copyTextureToTexture} as unknown as WebGPURenderer, copyTextureToTexture};
};

describe('DynamicAtlas', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
    vi.unstubAllGlobals();
  });

  describe('the constructor', () => {
    test('takes the size of a canvas handed in, with padding 1, extrude 0 and linear filtering by default', () => {
      const {atlas} = atlasOn(64, 32);
      expect(atlas.width).toBe(64);
      expect(atlas.height).toBe(32);
      expect(atlas.padding).toBe(1);
      expect(atlas.extrude).toBe(0);
      expect(atlas.texture.magFilter).toBe(LinearFilter);
      expect(atlas.texture.minFilter).toBe(LinearFilter);
      expect(atlas.atlas.size).toBe(0);
    });

    test('refuses a width or a height beside a canvas', () => {
      const canvas = asCanvas(new FakeCanvas(8, 8));
      expect(() => new DynamicAtlas({canvas, width: 8})).toThrow(
        'DynamicAtlas: the size comes from the canvas handed in — leave out width and height',
      );
      expect(() => new DynamicAtlas({canvas, height: 8})).toThrow(TypeError);
    });

    test('refuses a canvas without a 2D context', () => {
      const fake = new FakeCanvas(8, 8);
      fake.context2d = null;
      expect(() => new DynamicAtlas({canvas: asCanvas(fake)})).toThrow(
        'DynamicAtlas: the canvas handed in gives no 2D context — it holds a context of another kind; hand in a fresh canvas',
      );
    });

    test('refuses a canvas of no size', () => {
      expect(() => new DynamicAtlas({canvas: asCanvas(new FakeCanvas(0, 8))})).toThrow(
        'DynamicAtlas: the width of the canvas must be a whole number of 1 or more, got 0',
      );
    });

    test('asks for the size without a canvas', () => {
      expect(() => new DynamicAtlas({})).toThrow(
        'DynamicAtlas: give the size of the atlas — new DynamicAtlas({width: 1024, height: 1024})',
      );
      expect(() => new DynamicAtlas({width: 16})).toThrow(TypeError);
    });

    test.each([
      [{width: 0, height: 8}, 'DynamicAtlas: the width must be a whole number of 1 or more, got 0'],
      [{width: 8, height: 2.5}, 'DynamicAtlas: the height must be a whole number of 1 or more, got 2.5'],
      [{width: 8, height: 8, padding: -1}, 'DynamicAtlas: the padding must be a whole number of 0 or more, got -1'],
      [{width: 8, height: 8, extrude: 0.5}, 'DynamicAtlas: the extrude must be a whole number of 0 or more, got 0.5'],
      [{width: 8, height: 8, padding: '2'}, 'DynamicAtlas: the padding must be a whole number of 0 or more, got "2"'],
    ])('refuses %o', (options, message) => {
      expect(() => new DynamicAtlas(options as never)).toThrow(RangeError);
      expect(() => new DynamicAtlas(options as never)).toThrow(message);
    });

    test('refuses a filter it does not know', () => {
      expect(() => new DynamicAtlas({width: 8, height: 8, filter: 'cubic' as never})).toThrow(
        "DynamicAtlas: the filter \"cubic\" is neither 'linear' nor 'nearest'",
      );
    });

    test('says how to hand in a canvas where there is neither an OffscreenCanvas nor a document', () => {
      vi.stubGlobal('OffscreenCanvas', undefined);
      vi.stubGlobal('document', undefined);
      expect(() => new DynamicAtlas({width: 8, height: 8})).toThrow(
        'DynamicAtlas: there is no OffscreenCanvas and no document to build a canvas — hand one in: new DynamicAtlas({canvas})',
      );
    });

    test('builds an OffscreenCanvas of the size where the global exists', () => {
      vi.stubGlobal('OffscreenCanvas', FakeCanvas);
      const atlas = new DynamicAtlas({width: 32, height: 16});
      expect(atlas.canvas).toBeInstanceOf(FakeCanvas);
      expect(atlas.canvas.width).toBe(32);
      expect(atlas.canvas.height).toBe(16);
    });

    test('builds a canvas element of the document otherwise', () => {
      vi.stubGlobal('OffscreenCanvas', undefined);
      const createElement = vi.fn(() => new FakeCanvas(300, 150));
      vi.stubGlobal('document', {createElement});
      const atlas = new DynamicAtlas({width: 32, height: 16});
      expect(createElement).toHaveBeenCalledWith('canvas');
      expect(atlas.canvas.width).toBe(32);
      expect(atlas.canvas.height).toBe(16);
    });
  });

  describe('the texture', () => {
    test('is a canvas texture read upright, in sRGB, with straight alpha and no mipmaps', () => {
      const {atlas, canvas} = atlasOn(16, 16);
      const {texture} = atlas;
      expect(texture.isCanvasTexture).toBe(true);
      expect(texture.image).toBe(canvas);
      expect(texture.flipY).toBe(false);
      expect(texture.colorSpace).toBe(SRGBColorSpace);
      expect(texture.premultiplyAlpha).toBe(false);
      expect(texture.generateMipmaps).toBe(false);
      expect(texture.name).toBe('twopoint5d.DynamicAtlas');
    });

    test('filters nearest with filter: nearest', () => {
      const {atlas} = atlasOn(16, 16, {filter: 'nearest'});
      expect(atlas.texture.magFilter).toBe(NearestFilter);
      expect(atlas.texture.minFilter).toBe(NearestFilter);
    });

    test('is marked for upload by every add(), redraw(), remove() and clear()', () => {
      const {atlas} = atlasOn(32, 32);
      const {texture} = atlas;
      const versions = [texture.version];
      atlas.add('a', noop, {width: 4, height: 4});
      versions.push(texture.version);
      atlas.redraw('a', noop);
      versions.push(texture.version);
      atlas.remove('a');
      versions.push(texture.version);
      atlas.clear();
      versions.push(texture.version);
      for (let i = 1; i < versions.length; i++) expect(versions[i]).toBeGreaterThan(versions[i - 1]!);
    });

    test('stays the same object through clear()', () => {
      const {atlas} = atlasOn(16, 16);
      const {texture} = atlas;
      atlas.clear();
      expect(atlas.texture).toBe(texture);
    });
  });

  describe('packing on shelves', () => {
    test('lays frames out left to right, padding apart and padding from the edges', () => {
      const {atlas} = atlasOn(64, 32);
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.add('b', noop, {width: 10, height: 8});
      expect(rectOf(atlas, 'a')).toEqual({x: 1, y: 1, w: 10, h: 8});
      expect(rectOf(atlas, 'b')).toEqual({x: 12, y: 1, w: 10, h: 8});
    });

    test('a taller frame opens a shelf below, and a lower one goes onto the lowest shelf it fits', () => {
      const {atlas} = atlasOn(64, 32);
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.add('tall', noop, {width: 20, height: 12});
      atlas.add('low', noop, {width: 10, height: 6});
      expect(rectOf(atlas, 'tall')).toEqual({x: 1, y: 10, w: 20, h: 12});
      expect(rectOf(atlas, 'low')).toEqual({x: 12, y: 1, w: 10, h: 6});
    });

    test('a frame that does not fit beside the others on a shelf goes onto the next shelf that fits', () => {
      const {atlas} = atlasOn(32, 32);
      atlas.add('a', noop, {width: 20, height: 8});
      atlas.add('b', noop, {width: 20, height: 8});
      expect(rectOf(atlas, 'b')).toEqual({x: 1, y: 10, w: 20, h: 8});
      atlas.add('c', noop, {width: 9, height: 8});
      expect(rectOf(atlas, 'c')).toEqual({x: 22, y: 1, w: 9, h: 8});
    });

    test('a frame fills the atlas exactly up to the padding at its edges', () => {
      const {atlas} = atlasOn(16, 16);
      atlas.add('full', noop, {width: 14, height: 14});
      expect(rectOf(atlas, 'full')).toEqual({x: 1, y: 1, w: 14, h: 14});
    });

    test('extrusion widens every cell by the extruded edges; the frame covers the middle alone', () => {
      const {atlas} = atlasOn(32, 32, {padding: 1, extrude: 2});
      atlas.add('a', noop, {width: 4, height: 4});
      atlas.add('b', noop, {width: 4, height: 4});
      expect(rectOf(atlas, 'a')).toEqual({x: 3, y: 3, w: 4, h: 4});
      expect(rectOf(atlas, 'b')).toEqual({x: 12, y: 3, w: 4, h: 4});
    });

    test('padding 0 packs the cells edge to edge', () => {
      const {atlas} = atlasOn(16, 16, {padding: 0});
      atlas.add('a', noop, {width: 4, height: 4});
      atlas.add('b', noop, {width: 4, height: 4});
      expect(rectOf(atlas, 'a')).toEqual({x: 0, y: 0, w: 4, h: 4});
      expect(rectOf(atlas, 'b')).toEqual({x: 4, y: 0, w: 4, h: 4});
    });

    test('a frame larger than the atlas can hold is refused naming its size and the atlas', () => {
      const {atlas} = atlasOn(16, 16);
      expect(() => atlas.add('big', noop, {width: 15, height: 4})).toThrow(RangeError);
      expect(() => atlas.add('big', noop, {width: 4, height: 15})).toThrow(
        'DynamicAtlas: the frame "big" of 4 × 15 does not fit into an atlas of 16 × 16 with padding 1 and extrude 0 — build a larger atlas',
      );
    });

    test('a full atlas refuses the next frame naming its size and the fix, and changes nothing', () => {
      const {atlas, context} = atlasOn(16, 16);
      atlas.add('full', noop, {width: 14, height: 14});
      const calls = context.calls.length;
      expect(() => atlas.add('more', noop, {width: 1, height: 1})).toThrow(
        'DynamicAtlas: the atlas of 16 × 16 is full — the frame "more" of 1 × 1 does not fit beside the 1 frame packed into it; build a larger one — new DynamicAtlas({width: 32, height: 32}) — or clear() it',
      );
      expect(atlas.atlas.size).toBe(1);
      expect(atlas.atlas.frame('more')).toBeUndefined();
      expect(context.calls.length).toBe(calls);
    });
    test('a removed cell is taken by the next frame that fits into it', () => {
      const {atlas} = atlasOn(64, 32);
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.add('b', noop, {width: 10, height: 8});
      atlas.remove('a');
      atlas.add('c', noop, {width: 10, height: 8});
      expect(rectOf(atlas, 'c')).toEqual({x: 1, y: 1, w: 10, h: 8});
    });

    test('a narrower frame takes the left part of a freed cell, and the rest stays free for another', () => {
      const {atlas} = atlasOn(64, 32);
      atlas.add('a', noop, {width: 20, height: 8});
      atlas.add('b', noop, {width: 10, height: 8});
      atlas.remove('a');
      atlas.add('c', noop, {width: 8, height: 8});
      atlas.add('d', noop, {width: 8, height: 8});
      expect(rectOf(atlas, 'c')).toEqual({x: 1, y: 1, w: 8, h: 8});
      expect(rectOf(atlas, 'd')).toEqual({x: 10, y: 1, w: 8, h: 8});
    });

    test('freed neighbours merge, and a frame as wide as both together takes their place', () => {
      const {atlas} = atlasOn(64, 32);
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.add('b', noop, {width: 10, height: 8});
      atlas.add('c', noop, {width: 10, height: 8});
      atlas.remove('a');
      atlas.remove('b');
      atlas.add('wide', noop, {width: 21, height: 8});
      expect(rectOf(atlas, 'wide')).toEqual({x: 1, y: 1, w: 21, h: 8});
    });

    test('a cell freed at the end of a shelf gives its room back to the shelf', () => {
      const {atlas} = atlasOn(32, 32);
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.add('b', noop, {width: 10, height: 8});
      atlas.remove('b');
      // 19 + padding fits behind `a` only once the shelf ends at 12 again
      atlas.add('c', noop, {width: 19, height: 8});
      expect(rectOf(atlas, 'c')).toEqual({x: 12, y: 1, w: 19, h: 8});
    });

    test('a last shelf left empty leaves the shelves, and a taller frame opens one in its place', () => {
      const {atlas} = atlasOn(32, 32);
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.add('tall', noop, {width: 10, height: 12});
      expect(rectOf(atlas, 'tall')).toEqual({x: 1, y: 10, w: 10, h: 12});
      atlas.remove('tall');
      // below an empty shelf of 12 there would be no room for it
      atlas.add('taller', noop, {width: 10, height: 20});
      expect(rectOf(atlas, 'taller')).toEqual({x: 1, y: 10, w: 10, h: 20});
    });

    test('frames whose width changes through remove() and add() do not fill the atlas', () => {
      const {atlas} = atlasOn(64, 32);
      const names = ['hp', 'mp', 'gold', 'time'];
      for (const name of names) atlas.add(name, noop, {width: 8, height: 6});
      for (let round = 0; round < 1000; round++) {
        for (const name of names) {
          atlas.remove(name);
          atlas.add(name, noop, {width: 8 + (round % 7), height: 6});
        }
      }
      expect(atlas.atlas.frameNames().length).toBe(4);
    });

    test('a callback that throws gives a freed cell back as it was', () => {
      const {atlas} = atlasOn(64, 32);
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.add('b', noop, {width: 10, height: 8});
      atlas.remove('a');
      expect(() =>
        atlas.add(
          'x',
          () => {
            throw new Error('nope');
          },
          {width: 10, height: 8},
        ),
      ).toThrow('nope');
      atlas.add('y', noop, {width: 10, height: 8});
      expect(rectOf(atlas, 'y')).toEqual({x: 1, y: 1, w: 10, h: 8});
    });
  });

  describe('add()', () => {
    test('answers the frame of the atlas, untrimmed, with its rectangle as TexturePacker data', () => {
      const {atlas} = atlasOn(64, 32);
      const frame = atlas.add('a', noop, {width: 10, height: 8});
      expect(frame).toBe(atlas.atlas.frame('a'));
      expect(frame.data).toEqual({frame: {x: 1, y: 1, w: 10, h: 8}});
      expect(frame.coords.getTexCoords()).toEqual([1 / 64, 1 / 32, 10 / 64, 8 / 32]);
      expect(frame.coords.flip).toBe(0);
    });

    test('runs a draw callback clipped to the frame and moved to its top left, the cell cleared first', () => {
      const {atlas, context} = atlasOn(64, 32, {extrude: 1});
      const draw = vi.fn((ctx: unknown, width: number, height: number) => {
        (ctx as {fillRect(...args: number[]): void}).fillRect(0, 0, width, height);
      });
      atlas.add('a', draw, {width: 10, height: 8});

      expect(draw).toHaveBeenCalledOnce();
      expect(draw.mock.calls[0]![0]).toBe(context);
      expect(draw.mock.calls[0]!.slice(1)).toEqual([10, 8]);
      // the frame lies at (2, 2): padding 1, extrude 1
      expect(context.drawCalls.slice(0, 2).map(({op, args, translation}) => [op, ...args, translation])).toEqual([
        ['clearRect', 1, 1, 12, 10, [0, 0]],
        ['fillRect', '#000', 0, 0, 10, 8, [2, 2]],
      ]);
      expect(context.callsOf('rect')).toMatchObject([{args: [2, 2, 10, 8], translation: [0, 0]}]);
      expect(context.callsOf('save').length).toBe(context.callsOf('restore').length);
    });

    test('draws and clears in canvas pixels whatever transform, alpha and compositing the caller left on the context', () => {
      const {atlas, canvas, context} = atlasOn(64, 32, {extrude: 1});
      context.translate(5, 5);
      context.globalAlpha = 0.5;
      context.globalCompositeOperation = 'destination-out';
      context.font = '16px serif';
      const source = image(4, 4);
      atlas.add('img', source);
      atlas.add('drawn', noop, {width: 4, height: 4});
      atlas.redraw('img', source);
      atlas.remove('drawn');
      atlas.clear();

      const neutral = {globalAlpha: 1, globalCompositeOperation: 'source-over'};
      for (const call of context.drawCalls) {
        const expected = call.op === 'drawImage' && call.args[0] === source ? [2, 2] : [0, 0];
        expect(call, `${call.op} ${call.args.slice(1).join(',')}`).toMatchObject({...neutral, translation: expected});
      }
      expect(context.drawCalls.at(-1)).toMatchObject({op: 'clearRect', args: [0, 0, 64, 32]});
      // three frames drawn, each extruded by four strips
      expect(context.callsOf('drawImage').filter(({args}) => args[0] === canvas)).toHaveLength(12);
      // the caller's state comes back, and measureText() goes on with the font it set
      expect([context.globalAlpha, context.globalCompositeOperation, context.font]).toEqual([
        0.5,
        'destination-out',
        '16px serif',
      ]);
      expect(context.calls.at(-1)?.translation).toEqual([5, 5]);
    });

    test('restores the context whatever the callback left in it', () => {
      const {atlas, context} = atlasOn(32, 32);
      atlas.add(
        'a',
        (ctx) => {
          ctx.imageSmoothingEnabled = false;
          ctx.fillStyle = '#f00';
        },
        {width: 4, height: 4},
      );
      expect(context.imageSmoothingEnabled).toBe(true);
      expect(context.fillStyle).toBe('#000');
    });

    test('rounds a size up to whole texels', () => {
      const {atlas} = atlasOn(64, 32);
      const draw = vi.fn();
      atlas.add('a', draw, {width: 37.4, height: 7.01});
      expect(draw.mock.calls[0]!.slice(1)).toEqual([38, 8]);
      expect(rectOf(atlas, 'a')).toEqual({x: 1, y: 1, w: 38, h: 8});
    });

    test('draws an image at its own size', () => {
      const {atlas, context} = atlasOn(64, 32);
      const source = image(12, 6);
      atlas.add('img', source);
      expect(rectOf(atlas, 'img')).toEqual({x: 1, y: 1, w: 12, h: 6});
      expect(context.callsOf('drawImage').map(({args}) => args)).toEqual([[source, 0, 0, 12, 6]]);
    });

    test('reads the natural size of an image element', () => {
      const {atlas} = atlasOn(64, 32);
      atlas.add('img', {width: 1, height: 1, naturalWidth: 9, naturalHeight: 5} as unknown as DynamicAtlasImage);
      expect(rectOf(atlas, 'img')).toEqual({x: 1, y: 1, w: 9, h: 5});
    });

    test('scales an image to the size given', () => {
      const {atlas, context} = atlasOn(64, 32);
      const source = image(12, 6);
      atlas.add('img', source, {width: 24, height: 12});
      expect(context.callsOf('drawImage').map(({args}) => args)).toEqual([[source, 0, 0, 24, 12]]);
    });

    test('refuses an image element that has loaded without a natural size when no size is given, asking for one', () => {
      const {atlas} = atlasOn(64, 32);
      expect(() => atlas.add('avatar', svg)).toThrow(
        'DynamicAtlas: the image of "avatar" has no natural size — an SVG without width and height needs the size: add(name, image, {width, height}); an image that failed to load cannot be drawn at all',
      );
    });

    test('draws an image element that has loaded without a natural size at the size given', () => {
      const {atlas, context} = atlasOn(64, 32);
      atlas.add('icon', svg, {width: 16, height: 8});
      expect(rectOf(atlas, 'icon')).toEqual({x: 1, y: 1, w: 16, h: 8});
      expect(context.callsOf('drawImage').map(({args}) => args)).toEqual([[svg, 0, 0, 16, 8]]);
    });

    test('refuses a closed ImageBitmap or a canvas of no size, with or without a size, and takes no cell', () => {
      const {atlas, context} = atlasOn(64, 32);
      const source = image(0, 0);
      expect(() => atlas.add('avatar', source)).toThrow(ZERO_BY_ZERO);
      expect(() => atlas.add('avatar', source, {width: 8, height: 8})).toThrow(ZERO_BY_ZERO);
      expect(atlas.atlas.size).toBe(0);
      expect(context.callsOf('drawImage')).toHaveLength(0);
      expect(atlas.add('next', noop, {width: 8, height: 8}).data?.frame).toMatchObject({x: 1, y: 1});
    });

    test('refuses an image element that has not loaded when a size is given', () => {
      const {atlas, context} = atlasOn(64, 32);
      const unloaded = {width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, complete: false} as unknown as DynamicAtlasImage;
      expect(() => atlas.add('avatar', unloaded, {width: 8, height: 8})).toThrow(
        'DynamicAtlas: the image of "avatar" has not loaded yet — await image.decode() before add()',
      );
      expect(atlas.atlas.size).toBe(0);
      expect(context.callsOf('drawImage')).toHaveLength(0);
      // no cell was taken: the next frame goes where the refused one would have gone
      expect(atlas.add('next', noop, {width: 8, height: 8}).data?.frame).toMatchObject({x: 1, y: 1});
    });

    test('refuses an image element that is still loading although its natural size is known', () => {
      const {atlas} = atlasOn(64, 32);
      // the browser knows the size once the image is "partially available", before it has loaded
      const loading = {width: 9, height: 5, naturalWidth: 9, naturalHeight: 5, complete: false} as unknown as DynamicAtlasImage;
      expect(() => atlas.add('avatar', loading)).toThrow(
        'DynamicAtlas: the image of "avatar" has not loaded yet — await image.decode() before add()',
      );
    });

    test('refuses a draw callback without a size', () => {
      const {atlas} = atlasOn(64, 32);
      expect(() => atlas.add('a', noop as never)).toThrow(
        'DynamicAtlas: add("a") with a draw callback needs the size — add(name, draw, {width, height})',
      );
    });

    test.each([
      [{width: 0, height: 4}, 'DynamicAtlas: the width of the frame "a" must be a finite number above 0, got 0'],
      [{width: 4, height: Number.NaN}, 'DynamicAtlas: the height of the frame "a" must be a finite number above 0, got NaN'],
      [{width: Infinity, height: 4}, 'DynamicAtlas: the width of the frame "a" must be a finite number above 0, got Infinity'],
    ])('refuses the size %o', (size, message) => {
      const {atlas} = atlasOn(64, 32);
      expect(() => atlas.add('a', noop, size)).toThrow(RangeError);
      expect(() => atlas.add('a', noop, size)).toThrow(message);
    });

    test('refuses a name that is taken before it packs anything', () => {
      const {atlas, context} = atlasOn(64, 32);
      atlas.add('hp', noop, {width: 4, height: 4});
      const calls = context.calls.length;
      expect(() => atlas.add('hp', noop, {width: 4, height: 4})).toThrow(
        'DynamicAtlas: the frame name "hp" is already taken — redraw() draws it anew, remove() lets go of it',
      );
      expect(context.calls.length).toBe(calls);
      expect(atlas.add('next', noop, {width: 4, height: 4}).data?.frame).toEqual({x: 6, y: 1, w: 4, h: 4});
    });

    test('takes a symbol as a name', () => {
      const {atlas} = atlasOn(64, 32);
      const name = Symbol('label');
      const frame = atlas.add(name, noop, {width: 4, height: 4});
      expect(atlas.atlas.frame(name)).toBe(frame);
      expect(() => atlas.add(name, noop, {width: 4, height: 4})).toThrow('the frame name "Symbol(label)" is already taken');
    });

    test('a draw callback that throws leaves the atlas as it was, its cell cleared again and given back', () => {
      const {atlas, context} = atlasOn(64, 32);
      const failure = new Error('no font');
      expect(() =>
        atlas.add(
          'a',
          () => {
            throw failure;
          },
          {width: 10, height: 8},
        ),
      ).toThrow(failure);
      expect(atlas.atlas.size).toBe(0);
      expect(atlas.atlas.frame('a')).toBeUndefined();
      const clears = context.callsOf('clearRect').map(({args}) => args);
      expect(clears).toEqual([
        [1, 1, 10, 8],
        [1, 1, 10, 8],
      ]);
      expect(context.callsOf('save').length).toBe(context.callsOf('restore').length);
      // the cell is given back: the next frame takes its place, under the same name
      expect(atlas.add('a', noop, {width: 10, height: 8}).data?.frame).toEqual({x: 1, y: 1, w: 10, h: 8});
    });

    test('a throwing callback on a shelf in use gives its place on the shelf back', () => {
      const {atlas} = atlasOn(64, 32);
      atlas.add('a', noop, {width: 10, height: 8});
      expect(() =>
        atlas.add(
          'b',
          () => {
            throw new Error('nope');
          },
          {width: 10, height: 8},
        ),
      ).toThrow('nope');
      expect(atlas.add('c', noop, {width: 10, height: 8}).data?.frame).toEqual({x: 12, y: 1, w: 10, h: 8});
    });

    test('a full atlas counts the frames packed into it', () => {
      const {atlas} = atlasOn(16, 16);
      atlas.add('a', noop, {width: 6, height: 14});
      atlas.add('b', noop, {width: 6, height: 14});
      expect(() => atlas.add('c', noop, {width: 6, height: 6})).toThrow('beside the 2 frames packed into it');
    });

    test('a throwing callback that opened a shelf gives the shelf back', () => {
      const {atlas} = atlasOn(64, 32);
      atlas.add('a', noop, {width: 10, height: 4});
      expect(() =>
        atlas.add(
          'tall',
          () => {
            throw new Error('nope');
          },
          {width: 10, height: 8},
        ),
      ).toThrow('nope');
      // a shelf of 8 left behind would take both of these; without it each opens a shelf of its own
      atlas.add('x', noop, {width: 10, height: 5});
      atlas.add('y', noop, {width: 10, height: 7});
      expect(rectOf(atlas, 'x')).toEqual({x: 1, y: 6, w: 10, h: 5});
      expect(rectOf(atlas, 'y')).toEqual({x: 1, y: 12, w: 10, h: 7});
    });

    test('extrudes the edges of the frame outwards by copying the canvas onto itself without smoothing', () => {
      const {atlas, canvas, context} = atlasOn(32, 32, {extrude: 2});
      atlas.add('a', noop, {width: 4, height: 6});
      // the frame lies at (3, 3); left, right, then top and bottom across the extruded corners
      const copies = context.callsOf('drawImage');
      expect(copies.map(({args}) => args)).toEqual([
        [canvas, 3, 3, 1, 6, 1, 3, 2, 6],
        [canvas, 6, 3, 1, 6, 7, 3, 2, 6],
        [canvas, 1, 3, 8, 1, 1, 1, 8, 2],
        [canvas, 1, 8, 8, 1, 1, 9, 8, 2],
      ]);
      expect(copies.every((call) => !call.imageSmoothingEnabled)).toBe(true);
      expect(context.imageSmoothingEnabled).toBe(true);
    });

    test('extrudes nothing with extrude 0', () => {
      const {atlas, context} = atlasOn(32, 32);
      atlas.add('a', noop, {width: 4, height: 6});
      expect(context.callsOf('drawImage')).toEqual([]);
    });
  });

  describe('redraw()', () => {
    test('draws anew into the cell of the frame, which keeps its object, id and coords', () => {
      const {atlas, context} = atlasOn(64, 32, {extrude: 1});
      const frame = atlas.add('score', noop, {width: 10, height: 8});
      const coords = frame.coords;
      const draw = vi.fn();
      context.calls.length = 0;

      expect(atlas.redraw('score', draw)).toBe(frame);

      expect(frame.coords).toBe(coords);
      expect(atlas.atlas.frameId('score')).toBe(0);
      expect(draw.mock.calls[0]!.slice(1)).toEqual([10, 8]);
      expect(context.drawCalls[0]).toMatchObject({op: 'clearRect', args: [1, 1, 12, 10]});
      expect(context.callsOf('translate').map(({args}) => args)).toEqual([[2, 2]]);
      // extruded again
      expect(context.callsOf('drawImage')).toHaveLength(4);
    });

    test('scales an image to the size of the frame', () => {
      const {atlas, context} = atlasOn(64, 32);
      atlas.add('portrait', noop, {width: 10, height: 8});
      const source = image(96, 96);
      atlas.redraw('portrait', source);
      expect(context.callsOf('drawImage').map(({args}) => args)).toEqual([[source, 0, 0, 10, 8]]);
    });

    test('refuses a name the atlas does not hold', () => {
      const {atlas} = atlasOn(64, 32);
      expect(() => atlas.redraw('hp', noop)).toThrow('DynamicAtlas: there is no frame "hp" to redraw — add() it first');
    });

    test('refuses an image element that has not loaded, before it clears the frame', () => {
      const {atlas, context} = atlasOn(64, 32);
      atlas.add('avatar', noop, {width: 10, height: 8});
      const calls = context.calls.length;
      const unloaded = {width: 0, height: 0, naturalWidth: 0, naturalHeight: 0, complete: false} as unknown as DynamicAtlasImage;
      expect(() => atlas.redraw('avatar', unloaded)).toThrow(NOT_LOADED('redraw()'));
      expect(context.calls.length).toBe(calls);
    });

    test('draws an image element that has loaded without a natural size at the size of the frame', () => {
      const {atlas, context} = atlasOn(64, 32);
      atlas.add('portrait', noop, {width: 10, height: 8});
      atlas.redraw('portrait', svg);
      expect(context.callsOf('drawImage').map(({args}) => args)).toEqual([[svg, 0, 0, 10, 8]]);
    });

    test('refuses a closed ImageBitmap or a canvas of no size, before it clears the frame', () => {
      const {atlas, context} = atlasOn(64, 32);
      atlas.add('avatar', noop, {width: 10, height: 8});
      const calls = context.calls.length;
      expect(() => atlas.redraw('avatar', image(0, 0))).toThrow(ZERO_BY_ZERO);
      expect(context.calls.length).toBe(calls);
    });

    test('refuses an image element that is still loading, before it clears the frame', () => {
      const {atlas, context} = atlasOn(64, 32);
      atlas.add('avatar', noop, {width: 10, height: 8});
      const clears = context.callsOf('clearRect').length;
      const loading = {width: 9, height: 5, naturalWidth: 9, naturalHeight: 5, complete: false} as unknown as DynamicAtlasImage;
      expect(() => atlas.redraw('avatar', loading)).toThrow(
        'DynamicAtlas: the image of "avatar" has not loaded yet — await image.decode() before redraw()',
      );
      expect(context.callsOf('clearRect')).toHaveLength(clears);
    });

    test('a draw that throws leaves the frame cleared, and marked for upload', () => {
      const {atlas, context} = atlasOn(64, 32);
      const frame = atlas.add('hp', noop, {width: 10, height: 8});
      const version = atlas.texture.version;
      const failure = new Error('no font');
      context.calls.length = 0;
      expect(() =>
        atlas.redraw('hp', () => {
          throw failure;
        }),
      ).toThrow(failure);
      expect(context.drawCalls).toMatchObject([{op: 'clearRect', args: [1, 1, 10, 8]}]);
      expect(atlas.texture.version).toBeGreaterThan(version);
      expect(atlas.atlas.frame('hp')).toBe(frame);
      expect(context.callsOf('save').length).toBe(context.callsOf('restore').length);
    });

    test('keeps the cell of a frame whose data the caller changed', () => {
      const {atlas, context} = atlasOn(64, 32);
      const frame = atlas.add('hp', noop, {width: 10, height: 8});
      frame.data!.frame.x = 40;
      (frame as {data?: unknown}).data = undefined;
      context.calls.length = 0;
      atlas.redraw('hp', noop);
      atlas.remove('hp');
      expect(context.callsOf('clearRect').map(({args}) => args)).toEqual([
        [1, 1, 10, 8],
        [1, 1, 10, 8],
      ]);
    });
  });

  describe('remove()', () => {
    test('clears the cell, lets go of the name and gives the cell to the next frame that fits', () => {
      const {atlas, context} = atlasOn(64, 32, {extrude: 1});
      const frame = atlas.add('a', noop, {width: 10, height: 8});
      context.calls.length = 0;

      expect(atlas.remove('a')).toBe(true);

      expect(context.drawCalls).toEqual([expect.objectContaining({op: 'clearRect', args: [1, 1, 12, 10]})]);
      expect(atlas.atlas.frame('a')).toBeUndefined();
      expect(atlas.atlas.frameId('a')).toBeUndefined();
      expect(atlas.atlas.get(0)).toBe(frame);
      expect(atlas.atlas.size).toBe(1);
      // the name is free, and so is the cell: the shelf it emptied is gone, and a new one opens in its place
      expect(atlas.add('a', noop, {width: 10, height: 8}).data?.frame).toEqual({x: 2, y: 2, w: 10, h: 8});
    });

    test('answers false for a name it does not hold', () => {
      const {atlas} = atlasOn(64, 32);
      expect(atlas.remove('nope')).toBe(false);
    });

    test('a removed frame leaves the random draws and a table of every frame', () => {
      const {atlas} = atlasOn(64, 32);
      atlas.add('a', noop, {width: 10, height: 8});
      const kept = atlas.add('b', noop, {width: 10, height: 8});

      atlas.remove('a');

      for (let i = 0; i < NO_LONGER_BE_A_COINCIDENCE; i++) expect(atlas.atlas.randomFrame()).toBe(kept);
      expect(frameTable(atlas.atlas).size).toBe(1);
      expect(frameTable(atlas.atlas).indexOf('b')).toBe(0);
    });

    test('the message of a full atlas counts the frames it holds', () => {
      const {atlas} = atlasOn(16, 16);
      atlas.add('a', noop, {width: 6, height: 14});
      atlas.add('b', noop, {width: 6, height: 14});
      atlas.remove('a');

      // wider than the cell `a` gave back
      expect(() => atlas.add('more', noop, {width: 7, height: 14})).toThrow(
        'DynamicAtlas: the atlas of 16 × 16 is full — the frame "more" of 7 × 14 does not fit beside the 1 frame packed into it; build a larger one — new DynamicAtlas({width: 32, height: 32}) — or clear() it',
      );
    });

    test('a frame let go of shows what is packed into its cell later', () => {
      const {atlas} = atlasOn(64, 32);
      const old = atlas.add('a', noop, {width: 10, height: 8});
      const id = atlas.atlas.frameId('a')!;
      atlas.remove('a');
      const next = atlas.add('b', noop, {width: 10, height: 8});
      expect(atlas.atlas.get(id)).toBe(old);
      expect(old.data?.frame).toEqual(next.data?.frame);
      expect(old.coords.getTexCoords()).toEqual(next.coords.getTexCoords());
    });
  });

  describe('clear()', () => {
    test('clears the canvas and starts a new atlas whose frames are packed from the start again', () => {
      const {atlas, context} = atlasOn(64, 32);
      const before = atlas.atlas;
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.add('tall', noop, {width: 10, height: 12});

      atlas.clear();

      expect(context.drawCalls.at(-1)).toMatchObject({op: 'clearRect', args: [0, 0, 64, 32]});
      expect(atlas.atlas).not.toBe(before);
      expect(atlas.atlas.size).toBe(0);
      expect(before.size).toBe(2);
      const frame = atlas.add('a', noop, {width: 10, height: 12});
      expect(atlas.atlas.frameId('a')).toBe(0);
      expect(frame.data?.frame).toEqual({x: 1, y: 1, w: 10, h: 12});
    });
  });

  describe('upload()', () => {
    beforeEach(() => {
      // the staging canvas
      vi.stubGlobal('OffscreenCanvas', FakeCanvas);
    });

    test('the texture is marked from its construction on, so the first render uploads the canvas at its size', () => {
      const {atlas} = atlasOn(16, 16);
      expect(atlas.texture.version).toBeGreaterThan(0);
    });

    test('the first call copies nothing, and from then on add(), redraw() and remove() leave the texture unmarked', () => {
      const {atlas} = atlasOn(64, 32);
      const {renderer, copyTextureToTexture} = fakeRenderer();
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.upload(renderer);
      expect(copyTextureToTexture).not.toHaveBeenCalled();
      const version = atlas.texture.version;
      atlas.redraw('a', noop);
      atlas.add('b', noop, {width: 10, height: 8});
      atlas.remove('a');
      expect(atlas.texture.version).toBe(version);
    });

    test('copies each changed cell, its extruded edges included, from a staging texture to its place', () => {
      const {atlas, canvas} = atlasOn(64, 32, {extrude: 1});
      const {renderer, copyTextureToTexture} = fakeRenderer();
      atlas.upload(renderer);
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.upload(renderer);

      expect(copyTextureToTexture).toHaveBeenCalledOnce();
      const [staging, texture, region, position] = copyTextureToTexture.mock.calls[0]!;
      expect(texture).toBe(atlas.texture);
      expect(region).toEqual(new Box2(new Vector2(0, 0), new Vector2(12, 10)));
      expect(position).toEqual(new Vector2(1, 1));
      expect(staging).toBeInstanceOf(CanvasTexture);
      expect(staging).toMatchObject({
        flipY: false,
        colorSpace: SRGBColorSpace,
        premultiplyAlpha: false,
        generateMipmaps: false,
        name: 'twopoint5d.DynamicAtlas.staging',
      });
      const stagingContext = (staging.image as FakeCanvas).context;
      expect(stagingContext.callsOf('drawImage')).toMatchObject([
        {
          args: [canvas, 1, 1, 12, 10, 0, 0, 12, 10],
          globalCompositeOperation: 'copy',
          imageSmoothingEnabled: false,
          translation: [0, 0],
          globalAlpha: 1,
        },
      ]);
    });

    test('copies a cell changed twice once, and nothing at the next call without a change', () => {
      const {atlas} = atlasOn(64, 32);
      const {renderer, copyTextureToTexture} = fakeRenderer();
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.upload(renderer);
      atlas.redraw('a', noop);
      atlas.redraw('a', noop);
      atlas.upload(renderer);
      expect(copyTextureToTexture).toHaveBeenCalledOnce();
      atlas.upload(renderer);
      expect(copyTextureToTexture).toHaveBeenCalledOnce();
    });

    test('copies the cell a remove() cleared', () => {
      const {atlas} = atlasOn(64, 32);
      const {renderer, copyTextureToTexture} = fakeRenderer();
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.add('b', noop, {width: 10, height: 8});
      atlas.upload(renderer);
      atlas.remove('a');
      atlas.upload(renderer);
      expect(copyTextureToTexture).toHaveBeenCalledOnce();
      const [, , region, position] = copyTextureToTexture.mock.calls[0]!;
      expect(region).toEqual(new Box2(new Vector2(0, 0), new Vector2(10, 8)));
      expect(position).toEqual(new Vector2(1, 1));
    });

    test('marks the whole texture instead where the copies would cover half the atlas or more, and copies nothing', () => {
      const {atlas} = atlasOn(16, 16);
      const {renderer, copyTextureToTexture} = fakeRenderer();
      atlas.upload(renderer);
      // four cells of 6 × 6: 144 texels to copy, at least half of 256
      for (const name of ['a', 'b', 'c', 'd']) atlas.add(name, noop, {width: 6, height: 6});
      const version = atlas.texture.version;
      atlas.upload(renderer);
      expect(atlas.texture.version).toBeGreaterThan(version);
      expect(copyTextureToTexture).not.toHaveBeenCalled();
    });

    test('marks the whole texture at clear(), and drops the cells changed before', () => {
      const {atlas} = atlasOn(64, 32);
      const {renderer, copyTextureToTexture} = fakeRenderer();
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.upload(renderer);
      const version = atlas.texture.version;
      atlas.redraw('a', noop);
      atlas.clear();
      expect(atlas.texture.version).toBeGreaterThan(version);
      atlas.upload(renderer);
      expect(copyTextureToTexture).not.toHaveBeenCalled();
    });

    test('grows the staging canvas to the largest changed cell and builds its texture anew', () => {
      const {atlas} = atlasOn(64, 32);
      const {renderer, copyTextureToTexture} = fakeRenderer();
      atlas.upload(renderer);
      atlas.add('small', noop, {width: 4, height: 4});
      atlas.upload(renderer);
      const first = copyTextureToTexture.mock.calls[0]![0] as CanvasTexture<FakeCanvas>;
      const firstCanvas = first.image;
      const disposeFirst = sandbox.spy(first, 'dispose');

      atlas.add('large', noop, {width: 10, height: 8});
      atlas.upload(renderer);

      expect(disposeFirst.calledOnce).toBe(true);
      expect([firstCanvas.width, firstCanvas.height]).toEqual([0, 0]);
      expect(copyTextureToTexture).toHaveBeenCalledTimes(2);
      const second = copyTextureToTexture.mock.calls[1]![0] as CanvasTexture<FakeCanvas>;
      expect(second).not.toBe(first);
      expect(second.image.width).toBeGreaterThanOrEqual(10);
      expect(second.image.height).toBeGreaterThanOrEqual(8);
    });

    test('an upload that throws marks the whole texture, so no change is lost, and the error goes on', () => {
      const {atlas} = atlasOn(64, 32);
      const {renderer, copyTextureToTexture} = fakeRenderer();
      const failure = new Error('device lost');
      copyTextureToTexture.mockImplementation(() => {
        throw failure;
      });
      atlas.upload(renderer);
      atlas.add('a', noop, {width: 10, height: 8});
      const version = atlas.texture.version;

      expect(() => atlas.upload(renderer)).toThrow(failure);

      expect(atlas.texture.version).toBeGreaterThan(version);
      atlas.upload(renderer);
      expect(copyTextureToTexture).toHaveBeenCalledOnce();
    });

    test('an upload whose staging canvas cannot be built marks the whole texture, so no change is lost, and the error goes on', () => {
      const {atlas} = atlasOn(64, 32);
      const {renderer, copyTextureToTexture} = fakeRenderer();
      atlas.upload(renderer);
      atlas.add('a', noop, {width: 10, height: 8});
      // a staging canvas whose 2D context is taken: getContext('2d') answers null
      vi.stubGlobal(
        'OffscreenCanvas',
        class extends FakeCanvas {
          constructor(width: number, height: number) {
            super(width, height);
            this.context2d = null;
          }
        },
      );
      const version = atlas.texture.version;

      expect(() => atlas.upload(renderer)).toThrow('expected the 2D context of a canvas of its own to be defined');

      expect(atlas.texture.version).toBeGreaterThan(version);
      vi.stubGlobal('OffscreenCanvas', FakeCanvas);
      atlas.upload(renderer);
      expect(copyTextureToTexture).not.toHaveBeenCalled();
    });
  });

  describe('the frames are those of an ordinary atlas', () => {
    test('an AtlasFrameTable and prepareSpriteFrame() read them', () => {
      const {atlas} = atlasOn(64, 32);
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.add('b', noop, {width: 4, height: 4});

      const table = AtlasFrameTable.fromAtlas(atlas.atlas);
      expect(table.size).toBe(2);
      expect(table.indexOf('b')).toBe(1);

      const prepared = prepareSpriteFrame(atlas.atlas.frame('b')!);
      expect(prepared.texCoords).toEqual([12 / 64, 1 / 32, 4 / 64, 4 / 32]);
      expect(prepared.texTrim).toEqual([0, 0, 0, 0]);
      expect(prepared.texFlipDiagonal).toBe(0);
    });
  });

  describe('dispose()', () => {
    test('disposes the texture it built itself', () => {
      const {atlas} = atlasOn(16, 16);
      const textureDispose = sandbox.spy(atlas.texture, 'dispose');
      atlas.dispose();
      expect(textureDispose.calledOnce).toBe(true);
    });

    test('does NOT resize or release a canvas that was handed in', () => {
      const {atlas, canvas} = atlasOn(16, 8);
      atlas.dispose();
      expect(canvas.width).toBe(16);
      expect(canvas.height).toBe(8);
    });

    test('shrinks a canvas of its own to 0 × 0', () => {
      vi.stubGlobal('OffscreenCanvas', FakeCanvas);
      const atlas = new DynamicAtlas({width: 32, height: 16});
      const canvas = atlas.canvas;
      atlas.dispose();
      expect(canvas.width).toBe(0);
      expect(canvas.height).toBe(0);
    });

    test('releases the staging texture and shrinks the staging canvas, and upload() does nothing afterwards', () => {
      vi.stubGlobal('OffscreenCanvas', FakeCanvas);
      const {atlas} = atlasOn(64, 32);
      const {renderer, copyTextureToTexture} = fakeRenderer();
      atlas.upload(renderer);
      atlas.add('a', noop, {width: 10, height: 8});
      atlas.upload(renderer);
      const staging = copyTextureToTexture.mock.calls[0]![0] as CanvasTexture<FakeCanvas>;
      const disposeStaging = sandbox.spy(staging, 'dispose');

      atlas.dispose();

      expect(disposeStaging.calledOnce).toBe(true);
      expect([staging.image.width, staging.image.height]).toEqual([0, 0]);
      expect(() => atlas.upload(renderer)).not.toThrow();
      expect(copyTextureToTexture).toHaveBeenCalledOnce();
    });

    test('behaves as documented after dispose()', () => {
      const {atlas} = atlasOn(64, 32);
      const {renderer} = fakeRenderer();
      atlas.add('a', noop, {width: 4, height: 4});
      const frames = atlas.atlas;
      atlas.dispose();

      expect(atlas.isDisposed).toBe(true);
      expect(() => atlas.texture).toThrow('DynamicAtlas#texture is not available: this atlas has been disposed');
      expect(() => atlas.canvas).toThrow('DynamicAtlas#canvas is not available: this atlas has been disposed');
      expect(() => atlas.context).toThrow('DynamicAtlas#context is not available: this atlas has been disposed');
      expect(() => atlas.add('b', noop, {width: 4, height: 4})).toThrow(
        'DynamicAtlas#add() is not available: this atlas has been disposed',
      );
      expect(() => atlas.redraw('a', noop)).toThrow('DynamicAtlas#redraw() is not available: this atlas has been disposed');
      expect(atlas.remove('a')).toBe(false);
      expect(() => atlas.clear()).not.toThrow();
      expect(() => atlas.upload(renderer)).not.toThrow();
      expect(atlas.atlas).toBe(frames);
      expect(atlas.atlas.frame('a')).toBeDefined();
      expect([atlas.width, atlas.height, atlas.padding, atlas.extrude]).toEqual([64, 32, 1, 0]);
    });

    test('is safe to call twice', () => {
      const {atlas} = atlasOn(16, 16);
      const textureDispose = sandbox.spy(atlas.texture, 'dispose');
      expect(() => {
        atlas.dispose();
        atlas.dispose();
      }).not.toThrow();
      expect(textureDispose.calledOnce).toBe(true);
    });
  });

  test('the context of the canvas is there to measure text before add()', () => {
    const {atlas, context} = atlasOn(64, 32);
    expect(atlas.context).toBe(context);
    expect(atlas.canvas).toBeInstanceOf(FakeCanvas);
  });
});

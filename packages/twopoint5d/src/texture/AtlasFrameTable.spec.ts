import {describe, expect, test} from 'vitest';

import {AtlasFrameTable, atlasFrameTable} from './AtlasFrameTable.js';
import {forgetFrameName} from './internals.js';
import {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';
import {TexturePackerJson} from './TexturePackerJson.js';

// a sheet of 8 × 4 pixels: a plain frame, a frame the packer turned, a trimmed frame
const [sheet] = TexturePackerJson.parse({
  frames: {
    plain: {frame: {x: 0, y: 0, w: 2, h: 4}},
    turned: {frame: {x: 2, y: 0, w: 4, h: 2}, rotated: true},
    trimmed: {
      frame: {x: 4, y: 0, w: 2, h: 1},
      trimmed: true,
      spriteSourceSize: {x: 1, y: 2, w: 2, h: 1},
      sourceSize: {w: 5, h: 4},
    },
  },
  meta: {image: 'sheet.png', size: {w: 8, h: 4}},
});

/** The values of the table, three `vec4` per frame. */
const valuesOf = (table: AtlasFrameTable): number[][] =>
  table.node.array.map((value) => (value as {toArray(): number[]}).toArray());

/** The three `vec4` the table holds for the frame at `index`. */
const frameValuesOf = (table: AtlasFrameTable, index: number): number[][] => valuesOf(table).slice(index * 3, index * 3 + 3);

describe('AtlasFrameTable', () => {
  test('holds three vec4 for every frame: the tex coords, the measures with the diagonal flip, the trim margins', () => {
    const table = atlasFrameTable(sheet);
    const plain = sheet.frame('plain')!.coords;

    expect(table.size).toBe(3);
    expect(valuesOf(table)).toHaveLength(9);
    expect(frameValuesOf(table, 0)).toEqual([plain.getTexCoords(), [2, 4, 0, 0], [0, 0, 0, 0]]);
  });

  test('carries the diagonal flip of a turned frame and its tex coords as TextureCoords answers them', () => {
    const table = atlasFrameTable(sheet);
    const turned = sheet.frame('turned')!.coords;

    expect(turned.flipD).toBe(true);
    // the area in the sheet is 2 wide and 4 high: the frame lies turned there
    expect(frameValuesOf(table, 1)).toEqual([turned.getTexCoords(), [2, 4, 1, 0], [0, 0, 0, 0]]);
  });

  test('carries the trim margins of a trimmed frame', () => {
    const table = atlasFrameTable(sheet);

    expect(frameValuesOf(table, 2)[2]).toEqual([1 / 5, 2 / 4, 2 / 5, 1 / 4]);
  });

  test('without a selection the index of a frame is its frame id, and every name is found', () => {
    const table = atlasFrameTable(sheet);

    expect(table.indexOf('plain')).toBe(sheet.frameId('plain'));
    expect(table.indexOf('turned')).toBe(sheet.frameId('turned'));
    expect(table.indexOf('trimmed')).toBe(sheet.frameId('trimmed'));
    expect(table.indexOf('missing')).toBe(-1);
  });

  test('a table of every frame leaves out a frame the atlas let go of, and indexOf() finds the others by name', () => {
    const atlas = new TextureAtlas();
    ['a', 'b', 'c'].forEach((name, i) => atlas.add(name, new TextureCoords(i * 2, 0, 2, 2)));
    atlas[forgetFrameName]('b');

    const table = AtlasFrameTable.fromAtlas(atlas);

    expect(table.size).toBe(2);
    expect([table.indexOf('a'), table.indexOf('c'), table.indexOf('b')]).toEqual([0, 1, -1]);
  });

  test('with a list of names the index is the position in that list', () => {
    const table = atlasFrameTable(sheet, ['trimmed', 'plain']);

    expect(table.size).toBe(2);
    expect(table.indexOf('trimmed')).toBe(0);
    expect(table.indexOf('plain')).toBe(1);
    expect(table.indexOf('turned')).toBe(-1);
    expect(frameValuesOf(table, 1)[0]).toEqual(sheet.frame('plain')!.coords.getTexCoords());
  });

  test('with a RegExp it takes the names the atlas matches, in the order of frameNames()', () => {
    const table = atlasFrameTable(sheet, /^t/);

    expect(table.size).toBe(2);
    expect(table.indexOf('turned')).toBe(0);
    expect(table.indexOf('trimmed')).toBe(1);
  });

  test('atlasFrameTable() is the short form of AtlasFrameTable.fromAtlas()', () => {
    expect(valuesOf(atlasFrameTable(sheet, ['turned']))).toEqual(valuesOf(AtlasFrameTable.fromAtlas(sheet, ['turned'])));
  });

  test('refuses a name the atlas does not hold, and an empty selection', () => {
    expect(() => atlasFrameTable(sheet, ['plain', 'missing'])).toThrow(/"missing"/);
    expect(() => atlasFrameTable(sheet, [])).toThrow(/no frames/);
    expect(() => atlasFrameTable(sheet, /^nothing/)).toThrow(/no frames/);
    expect(() => atlasFrameTable(new TextureAtlas())).toThrow(/no frames/);
  });

  test('takes a list of frames and TextureCoords; a bare TextureCoords is untrimmed, and no name is found', () => {
    const coords = new TextureCoords(new TextureCoords(0, 0, 8, 4), 6, 0, 2, 2);
    const table = new AtlasFrameTable([sheet.frame('trimmed')!, coords]);

    expect(table.size).toBe(2);
    expect(frameValuesOf(table, 0)[2]).toEqual([1 / 5, 2 / 4, 2 / 5, 1 / 4]);
    expect(frameValuesOf(table, 1)).toEqual([coords.getTexCoords(), [2, 2, 0, 0], [0, 0, 0, 0]]);
    expect(table.indexOf('trimmed')).toBe(-1);
  });

  test(`holds up to ${AtlasFrameTable.MaxFrames} frames and refuses one more with a RangeError that names the limit`, () => {
    const coords = new TextureCoords(0, 0, 1, 1);

    expect(AtlasFrameTable.MaxFrames).toBe(341);
    expect(new AtlasFrameTable(Array.from({length: AtlasFrameTable.MaxFrames}, () => coords)).size).toBe(341);
    expect(() => new AtlasFrameTable(Array.from({length: AtlasFrameTable.MaxFrames + 1}, () => coords))).toThrow(RangeError);
    expect(() => new AtlasFrameTable(Array.from({length: AtlasFrameTable.MaxFrames + 1}, () => coords))).toThrow(/341/);
  });

  test('update() reads the frames again into the values it holds', () => {
    const coords = new TextureCoords(new TextureCoords(0, 0, 8, 4), 2, 0, 4, 2);
    const table = new AtlasFrameTable([coords]);
    const before = table.node.array.slice();

    coords.flipDiagonal().flipHorizontal();
    table.update();

    expect(frameValuesOf(table, 0)).toEqual([coords.getTexCoords(), [4, 2, 1, 0], [0, 0, 0, 0]]);
    // the same objects: three uploads the array it was built with
    expect(table.node.array).toHaveLength(3);
    table.node.array.forEach((value, i) => expect(value).toBe(before[i]));
  });

  test('the node is an array of vec4', () => {
    const table = atlasFrameTable(sheet);

    expect(table.node.elementType).toBe('vec4');
  });
});

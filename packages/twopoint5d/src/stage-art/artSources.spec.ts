import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';

import {AsepriteJson, type AsepriteJsonArrayFrameData, type AsepriteJsonData} from '../texture/AsepriteJson.js';
import type {TextureAtlas} from '../texture/TextureAtlas.js';
import {TexturePackerJson, type TexturePackerJsonData} from '../texture/TexturePackerJson.js';
import type {LayerBox} from './artLayout.js';
import {
  type ArtLayerSpec,
  checkArtSourceOptions,
  checkLayerDefs,
  prepareLayerFrame,
  readAtlasSource,
  readLooseLayers,
} from './artSources.js';

const SUBJECT = 'StageArt "kitchen"';

// a fresh copy of a fixture per call: a test that changes it leaves the others as they were
const asepriteJson = (): AsepriteJsonData =>
  JSON.parse(readFileSync(new URL('./fixtures/kitchen-aseprite.json', import.meta.url), 'utf8'));
const ftpJson = (): TexturePackerJsonData =>
  JSON.parse(readFileSync(new URL('./fixtures/kitchen-ftp.json', import.meta.url), 'utf8'));

const asepriteAtlas = (data: AsepriteJsonData = asepriteJson()): TextureAtlas<unknown> => AsepriteJson.parse(data)[0];
const ftpAtlas = (data: TexturePackerJsonData = ftpJson()): TextureAtlas<unknown> => TexturePackerJson.parse(data)[0];

const arrayFrames = (data: AsepriteJsonData) => data.frames as AsepriteJsonArrayFrameData[];

const layerOf = (layers: readonly ArtLayerSpec[], name: string): ArtLayerSpec => {
  const layer = layers.find((spec) => spec.name === name);
  if (layer === undefined) throw new Error(`no layer ${name}`);
  return layer;
};

const boxesOf = (layer: ArtLayerSpec) => layer.frames.map((frame) => frame?.box);

describe('readAtlasSource() of an Aseprite split-layer sheet', () => {
  test('takes the names and the order of meta.layers, bottom first, and the plain names of layers in a group; a group is no layer', () => {
    const {layers, problems} = readAtlasSource(SUBJECT, asepriteAtlas(), {});

    expect(layers.map(({name}) => name)).toEqual(['wall', 'window', 'table', 'carafe5', 'ladle', 'steam']);
    expect(problems).toEqual([]);
  });

  test('takes the canvas from the sourceSize of the frames', () => {
    expect(readAtlasSource(SUBJECT, asepriteAtlas(), {}).canvas).toEqual({width: 320, height: 180});
  });

  test('a box is the spriteSourceSize of each frame, a layer box the union of its frames', () => {
    const atlas = asepriteAtlas();
    const {layers} = readAtlasSource(SUBJECT, atlas, {});

    expect(layerOf(layers, 'wall').box).toEqual({x: 0, y: 0, w: 320, h: 180});
    expect(layerOf(layers, 'window').box).toEqual({x: 196, y: 22, w: 84, h: 64});

    const steam = layerOf(layers, 'steam');
    expect(boxesOf(steam)).toEqual([
      {x: 100, y: 40, w: 14, h: 26},
      {x: 98, y: 34, w: 18, h: 32},
      {x: 96, y: 28, w: 22, h: 38},
      {x: 97, y: 31, w: 20, h: 35},
    ]);
    expect(steam.box).toEqual({x: 96, y: 28, w: 22, h: 38});
    expect(steam.frames.map((frame) => frame?.frame)).toEqual([0, 1, 2, 3].map((n) => atlas.frame(`steam#${n}`)));
  });

  test('an empty cel — the 1 × 1 entry of --trim — is undefined and joins no box', () => {
    const ladle = layerOf(readAtlasSource(SUBJECT, asepriteAtlas(), {}).layers, 'ladle');

    expect(ladle.frames).toHaveLength(4);
    expect(ladle.frames[3]).toBeUndefined();
    expect(ladle.box).toEqual({x: 150, y: 84, w: 18, h: 40});
  });

  test('an empty cel left out of the sheet — --ignore-empty — is undefined as well', () => {
    const data = asepriteJson();
    data.frames = arrayFrames(data).filter(({filename}) => filename !== 'ladle#3');
    const {layers, problems} = readAtlasSource(SUBJECT, asepriteAtlas(data), {});

    const ladle = layerOf(layers, 'ladle');
    expect(ladle.frames).toHaveLength(4);
    expect(ladle.frames[3]).toBeUndefined();
    expect(ladle.box).toEqual({x: 150, y: 84, w: 18, h: 40});
    expect(problems).toEqual([]);
  });

  test('a single pixel at the top left corner that Aseprite did not trim from an empty cel is a frame', () => {
    const data = asepriteJson();
    const entry = arrayFrames(data).find(({filename}) => filename === 'ladle#3')!;
    entry.trimmed = false;
    const ladle = layerOf(readAtlasSource(SUBJECT, asepriteAtlas(data), {}).layers, 'ladle');

    expect(ladle.frames[3]?.box).toEqual({x: 0, y: 0, w: 1, h: 1});
  });

  test('the pivot of the slice named like the layer is the bottom left corner of its pixel; without one the middle of the box', () => {
    const {layers} = readAtlasSource(SUBJECT, asepriteAtlas(), {});

    const carafe5 = layerOf(layers, 'carafe5');
    expect([carafe5.pivotX, carafe5.pivotY]).toEqual([92 + 17, 70 + 51 + 1]);
    const table = layerOf(layers, 'table');
    expect([table.pivotX, table.pivotY]).toEqual([40 + 240 / 2, 118 + 62 / 2]);
    const steam = layerOf(layers, 'steam');
    expect([steam.pivotX, steam.pivotY]).toEqual([96 + 22 / 2, 28 + 38 / 2]);
  });

  test('a slice with a pivot that names no layer is a problem of the source', () => {
    const data = asepriteJson();
    data.meta.slices![0]!.name = 'carafe6';
    const {layers, problems} = readAtlasSource(SUBJECT, asepriteAtlas(data), {});

    expect(problems).toEqual([{layer: undefined, reason: expect.stringContaining('the slice "carafe6" has a pivot')}]);
    const carafe5 = layerOf(layers, 'carafe5');
    expect([carafe5.pivotX, carafe5.pivotY]).toEqual([92 + 17, 70 + 52 / 2]);
  });

  test('the depth comes from depth=… in the user data, a layer without one takes that of its group, one with neither 0', () => {
    const {layers} = readAtlasSource(SUBJECT, asepriteAtlas(), {});

    expect(layers.map(({name, depth}) => [name, depth])).toEqual([
      ['wall', 600],
      ['window', 600],
      ['table', 0],
      ['carafe5', 0],
      ['ladle', 0],
      ['steam', 0],
    ]);
  });

  test('the depth of a layer beats that of its group, and the rest of the user data is left alone', () => {
    const data = asepriteJson();
    data.meta.layers![0]!.data = 'far away depth=800 hazy';
    data.meta.layers![2]!.data = 'depth=-120.5';
    const {layers} = readAtlasSource(SUBJECT, asepriteAtlas(data), {});

    expect(layerOf(layers, 'wall').depth).toBe(800);
    expect(layerOf(layers, 'window').depth).toBe(-120.5);
  });

  test('a depth in the file that is no number is a problem of its layer, which stands on the plane', () => {
    const data = asepriteJson();
    data.meta.layers![2]!.data = 'depth=far';
    const {layers, problems} = readAtlasSource(SUBJECT, asepriteAtlas(data), {});

    expect(layerOf(layers, 'window').depth).toBe(0);
    expect(problems).toEqual([{layer: 'window', reason: expect.stringMatching(/depth of "far", which is no number/)}]);
  });

  test('a depth of a group that is no number is a problem of each layer that takes it', () => {
    const data = asepriteJson();
    data.meta.layers![0]!.data = 'depth=0x10';
    const {layers, problems} = readAtlasSource(SUBJECT, asepriteAtlas(data), {});

    expect(layerOf(layers, 'wall').depth).toBe(0);
    expect(layerOf(layers, 'window').depth).toBe(600);
    expect(problems).toEqual([{layer: 'wall', reason: expect.stringContaining('its group "backdrop"')}]);
  });

  test('a depth override beats a depth in the file that is no number, without a problem', () => {
    const data = asepriteJson();
    data.meta.layers![2]!.data = 'depth=far';
    const {layers, problems} = readAtlasSource(SUBJECT, asepriteAtlas(data), {layers: {window: {depth: 300}}});

    expect(layerOf(layers, 'window').depth).toBe(300);
    expect(problems).toEqual([]);
  });

  test('every layer has the tags of the sheet, with their direction and the durations of their frames in seconds', () => {
    const {layers} = readAtlasSource(SUBJECT, asepriteAtlas(), {});

    for (const layer of layers) {
      expect([...layer.tags.keys()]).toEqual(['puff']);
      expect(layer.tags.get('puff')).toEqual({
        frames: [1, 2, 3],
        frameCount: 3,
        duration: 0.1 + 0.1 + 0.15,
        durations: [0.1, 0.1, 0.15],
        playback: 'pingpong',
      });
    }
  });

  test('a tag unrolls its direction and repeat; one duration where the frames agree', () => {
    const data = asepriteJson();
    data.meta.frameTags = [{name: 'blink', from: 1, to: 2, direction: 'reverse', repeat: '2'}];
    const steam = layerOf(readAtlasSource(SUBJECT, asepriteAtlas(data), {}).layers, 'steam');

    expect(steam.tags.get('blink')).toEqual({
      frames: [2, 1, 2, 1],
      frameCount: 4,
      duration: 0.1 + 0.1 + 0.1 + 0.1,
      durations: undefined,
      playback: 'once',
    });
  });

  test('a tag that runs past the frames of the sprite is a problem of the source and left out', () => {
    const data = asepriteJson();
    data.meta.frameTags!.push({name: 'late', from: 2, to: 9, direction: 'forward'});
    const {layers, problems} = readAtlasSource(SUBJECT, asepriteAtlas(data), {});

    expect([...layerOf(layers, 'steam').tags.keys()]).toEqual(['puff']);
    expect(problems).toEqual([{layer: undefined, reason: expect.stringContaining('the tag "late" runs past the 4 frames')}]);
  });

  test('a name used twice is a problem of the source; the art takes the first', () => {
    const data = asepriteJson();
    data.meta.layers!.push({name: 'table', opacity: 255, blendMode: 'normal'});
    const {layers, problems} = readAtlasSource(SUBJECT, asepriteAtlas(data), {});

    expect(layers.map(({name}) => name)).toEqual(['wall', 'window', 'table', 'carafe5', 'ladle', 'steam']);
    expect(problems).toEqual([{layer: 'table', reason: expect.stringContaining('two layers of the source are named "table"')}]);
  });

  test('a layer of meta.layers without a picture in the sheet is a problem of that layer', () => {
    const data = asepriteJson();
    data.frames = arrayFrames(data).filter(({filename}) => !filename.startsWith('ladle#'));
    const {layers, problems} = readAtlasSource(SUBJECT, asepriteAtlas(data), {});

    const ladle = layerOf(layers, 'ladle');
    expect(ladle.frames).toEqual([undefined, undefined, undefined, undefined]);
    expect(problems).toEqual([{layer: 'ladle', reason: expect.stringContaining('no picture of the layer "ladle"')}]);
  });

  test('a sheet with the default frame names of Aseprite is one problem of the source naming the filename format, not an art of empty layers', () => {
    const data = asepriteJson();
    for (const entry of arrayFrames(data)) {
      const [layer, n] = entry.filename.split('#');
      entry.filename = `kitchen (${layer}) ${n}.aseprite`;
    }
    const {layers, problems} = readAtlasSource(SUBJECT, asepriteAtlas(data), {layers: {window: {depth: 600}}});

    expect(layers).toEqual([]);
    expect(problems).toHaveLength(1);
    expect(problems[0]!.layer).toBeUndefined();
    expect(problems[0]!.reason).toContain("--filename-format '{layer}#{frame}'");
  });

  test('without meta.layers the names come from the frames, in the order of the sheet', () => {
    const data = asepriteJson();
    delete data.meta.layers;
    const {layers, problems} = readAtlasSource(SUBJECT, asepriteAtlas(data), {});

    expect(layers.map(({name}) => name)).toEqual(['wall', 'window', 'table', 'carafe5', 'ladle', 'steam']);
    expect(layerOf(layers, 'wall').depth).toBe(0);
    expect(problems).toEqual([]);
  });
});

describe('readAtlasSource() of a trimmed atlas', () => {
  test('without only the order is that of the frames in the json', () => {
    const {layers, problems} = readAtlasSource(SUBJECT, ftpAtlas(), {});

    expect(layers.map(({name}) => name)).toEqual(['wall', 'table', 'window', 'carafe5', 'steam', 'ladle']);
    expect(problems).toEqual([]);
  });

  test('only names the layers and their order', () => {
    const only = ['wall', 'window', 'table', 'carafe5', 'ladle', 'steam'];
    const {layers} = readAtlasSource(SUBJECT, ftpAtlas(), {only});

    expect(layers.map(({name}) => name)).toEqual(only);
  });

  test('takes the canvas and the boxes from sourceSize and spriteSourceSize, as in Aseprite', () => {
    const {canvas, layers} = readAtlasSource(SUBJECT, ftpAtlas(), {});

    expect(canvas).toEqual({width: 320, height: 180});
    expect(layerOf(layers, 'table').box).toEqual({x: 40, y: 118, w: 240, h: 62});
    expect(layerOf(layers, 'steam').box).toEqual({x: 96, y: 28, w: 22, h: 38});
  });

  test('-suffix frames follow the frame of their layer, #n frames go by their number', () => {
    const atlas = ftpAtlas();
    const {layers} = readAtlasSource(SUBJECT, atlas, {});

    expect(layerOf(layers, 'carafe5').frames.map((frame) => frame?.frame)).toEqual([
      atlas.frame('carafe5'),
      atlas.frame('carafe5-empty'),
    ]);
    expect(layerOf(layers, 'steam').frames.map((frame) => frame?.frame)).toEqual(
      [0, 1, 2, 3].map((n) => atlas.frame(`steam#${n}`)),
    );
    expect(layerOf(layers, 'ladle').frames.map((frame) => frame?.frame)).toEqual([atlas.frame('ladle')]);
  });

  test('a .pivot marker is not drawn: the middle of its box is the pivot of its layer', () => {
    const {layers} = readAtlasSource(SUBJECT, ftpAtlas(), {});

    const carafe5 = layerOf(layers, 'carafe5');
    expect([carafe5.pivotX, carafe5.pivotY]).toEqual([109.5, 121.5]);
    expect(layers.some(({name}) => name.includes('pivot'))).toBe(false);
    expect(carafe5.frames).toHaveLength(2);
  });

  test('a pivot marker that names no layer is a problem of the source', () => {
    const data = ftpJson();
    const frames = data.frames as Record<string, unknown>;
    frames['jug.pivot'] = frames['carafe5.pivot'];
    const {problems} = readAtlasSource(SUBJECT, ftpAtlas(data), {});

    expect(problems).toEqual([
      {layer: undefined, reason: expect.stringContaining('the pivot marker "jug.pivot" names no layer')},
    ]);
  });

  test('@depth in a frame name is the depth of its layer and no part of its name', () => {
    const {layers} = readAtlasSource(SUBJECT, ftpAtlas(), {});

    expect(layers.map(({name, depth}) => [name, depth])).toEqual([
      ['wall', 600],
      ['table', 0],
      ['window', 600],
      ['carafe5', 0],
      ['steam', 0],
      ['ladle', 0],
    ]);
  });

  test('@depth takes a negative depth and stands before a frame suffix as well', () => {
    const data = ftpJson();
    const frames = data.frames as Record<string, unknown>;
    frames['ladle@-120'] = frames['ladle'];
    delete frames['ladle'];
    frames['steam@40#0'] = frames['steam#0'];
    delete frames['steam#0'];
    const {layers, problems} = readAtlasSource(SUBJECT, ftpAtlas(data), {});

    expect(layerOf(layers, 'ladle').depth).toBe(-120);
    expect(layerOf(layers, 'steam').depth).toBe(40);
    expect(layerOf(layers, 'steam').frames).toHaveLength(4);
    expect(problems).toEqual([]);
  });

  test('a hyphen in a name without a layer before it is part of the name', () => {
    const data = ftpJson();
    const frames = data.frames as Record<string, unknown>;
    frames['back-wall'] = frames['wall@600'];
    delete frames['wall@600'];
    const {layers} = readAtlasSource(SUBJECT, ftpAtlas(data), {});

    expect(layers.map(({name}) => name)).toContain('back-wall');
  });

  test('a name used twice is a problem of the source; the art takes the first', () => {
    const data = ftpJson();
    const frames = data.frames as Record<string, unknown>;
    frames['table@300'] = frames['table'];
    const {layers, problems} = readAtlasSource(SUBJECT, ftpAtlas(data), {});

    expect(layers.filter(({name}) => name === 'table')).toHaveLength(1);
    expect(problems).toContainEqual({layer: 'table', reason: expect.stringContaining('"table"')});
  });

  test('a trimmed atlas has no tags', () => {
    const {layers} = readAtlasSource(SUBJECT, ftpAtlas(), {});

    for (const layer of layers) expect(layer.tags.size).toBe(0);
  });
});

describe('readAtlasSource() with overrides', () => {
  test('the overrides beat the file: pivot, depth, order, rest, frames', () => {
    const atlas = ftpAtlas();
    const rest = {deg: 10, opacity: 0.5};
    const {layers, problems} = readAtlasSource(SUBJECT, atlas, {
      layers: {
        window: {depth: 100},
        carafe5: {pivot: [90, 400]},
        steam: {order: 9, frames: /^steam#/, rest},
      },
    });

    expect(layerOf(layers, 'window').depth).toBe(100);
    const carafe5 = layerOf(layers, 'carafe5');
    expect([carafe5.pivotX, carafe5.pivotY]).toEqual([90, 400]);
    const steam = layerOf(layers, 'steam');
    expect(steam.order).toBe(9);
    expect(steam.rest).toEqual(rest);
    expect(steam.rest).not.toBe(rest);
    expect(steam.frames.map((frame) => frame?.frame)).toEqual([0, 1, 2, 3].map((n) => atlas.frame(`steam#${n}`)));
    expect(layerOf(layers, 'table')).toMatchObject({order: 0, rest: undefined});
    expect(problems).toEqual([]);
  });

  test('frames named by a list, in its order', () => {
    const atlas = ftpAtlas();
    const {layers} = readAtlasSource(SUBJECT, atlas, {layers: {carafe5: {frames: ['carafe5-empty', 'carafe5']}}});

    expect(layerOf(layers, 'carafe5').frames.map((frame) => frame?.frame)).toEqual([
      atlas.frame('carafe5-empty'),
      atlas.frame('carafe5'),
    ]);
  });

  test('frames for an atlas that does not follow the names make a layer of their own', () => {
    const atlas = ftpAtlas();
    const {layers, problems} = readAtlasSource(SUBJECT, atlas, {layers: {puff: {frames: /^steam#/}}});

    expect(layers.map(({name}) => name)).toEqual(['wall', 'table', 'window', 'carafe5', 'puff', 'ladle']);
    expect(layerOf(layers, 'puff').frames).toHaveLength(4);
    expect(problems).toEqual([]);
  });

  test('a frame of a frames list the atlas lacks is a problem of the layer', () => {
    const {layers, problems} = readAtlasSource(SUBJECT, ftpAtlas(), {
      layers: {carafe5: {frames: ['carafe5', 'carafe5-cracked']}},
    });

    expect(layerOf(layers, 'carafe5').frames).toHaveLength(1);
    expect(problems).toEqual([{layer: 'carafe5', reason: expect.stringContaining('"carafe5-cracked"')}]);
  });

  test('in an Aseprite sheet a frames override keeps the tags its #n frames cover', () => {
    const atlas = asepriteAtlas();
    const {layers} = readAtlasSource(SUBJECT, atlas, {layers: {steam: {frames: /^steam#/}}});

    const steam = layerOf(layers, 'steam');
    expect(steam.frames.map((frame) => frame?.frame)).toEqual([0, 1, 2, 3].map((n) => atlas.frame(`steam#${n}`)));
    expect(steam.tags.get('puff')?.frames).toEqual([1, 2, 3]);
  });

  test('an override for a layer the source lacks is a problem of that layer', () => {
    const {layers, problems} = readAtlasSource(SUBJECT, asepriteAtlas(), {layers: {ghost: {depth: 10}}});

    expect(layers.map(({name}) => name)).not.toContain('ghost');
    expect(problems).toEqual([{layer: 'ghost', reason: expect.stringContaining('no layer "ghost"')}]);
  });

  test('only naming a layer the source lacks is a problem of that layer, which stays in its place without a picture, its box of no size at its pivot', () => {
    const {layers, problems} = readAtlasSource(SUBJECT, ftpAtlas(), {
      only: ['wall', 'ghost', 'table'],
      layers: {ghost: {depth: 10, pivot: [5, 6]}},
    });

    expect(layers.map(({name}) => name)).toEqual(['wall', 'ghost', 'table']);
    const ghost = layerOf(layers, 'ghost');
    expect(ghost).toMatchObject({frames: [], depth: 10, pivotX: 5, pivotY: 6, box: {x: 5, y: 6, w: 0, h: 0}});
    expect(problems).toEqual([{layer: 'ghost', reason: expect.stringContaining('no layer "ghost"')}]);
  });

  test('an override for a layer the source has and only leaves out is no problem', () => {
    const {layers, problems} = readAtlasSource(SUBJECT, ftpAtlas(), {only: ['wall'], layers: {table: {depth: 5}}});

    expect(layers.map(({name}) => name)).toEqual(['wall']);
    expect(problems).toEqual([]);
  });

  test('an override passes neither at nor pxPerUnit on: they are loose options', () => {
    const {layers} = readAtlasSource(SUBJECT, ftpAtlas(), {layers: {table: {depth: 5}}});

    expect(layerOf(layers, 'table').at).toBeUndefined();
    expect(layerOf(layers, 'table').pxPerUnit).toBeUndefined();
  });
});

describe('checkArtSourceOptions()', () => {
  test('refuses only naming a layer twice', () => {
    expect(() => checkArtSourceOptions(SUBJECT, {only: ['wall', 'table', 'wall']})).toThrow(
      'StageArt "kitchen": only names the layer "wall" twice',
    );
    expect(() => readAtlasSource(SUBJECT, ftpAtlas(), {only: ['wall', 'wall']})).toThrow(/only names the layer "wall" twice/);
  });

  test('refuses only that is no list of names', () => {
    for (const bad of ['wall', [1], {}, null]) {
      expect(() => checkArtSourceOptions(SUBJECT, {only: bad})).toThrow(
        /^StageArt "kitchen": only must be a list of layer names, got /,
      );
    }
  });

  test('refuses layers that is no object', () => {
    for (const bad of [[], null, 5, 'window']) {
      expect(() => checkArtSourceOptions(SUBJECT, {layers: bad})).toThrow(
        /^StageArt "kitchen": layers must be an object of layer options by name, got /,
      );
    }
  });

  test('refuses the options of a layer that are no object, or that have a key no option has', () => {
    expect(() => checkArtSourceOptions(SUBJECT, {layers: {window: 600}})).toThrow(
      'StageArt "kitchen": the options of the layer "window" must be an object, got 600',
    );
    expect(() => checkArtSourceOptions(SUBJECT, {layers: {window: {dept: 600}}})).toThrow(
      /^StageArt "kitchen": the options of the layer "window" have no key "dept"; their keys are "pivot", /,
    );
  });

  test('refuses a depth override that is no finite number', () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, '600', null]) {
      expect(() => checkArtSourceOptions(SUBJECT, {layers: {window: {depth: bad}}})).toThrow(
        /^StageArt "kitchen": the depth of the layer "window" must be a finite number, got /,
      );
    }
  });

  test('refuses at and pxPerUnit in the overrides of an atlas source, naming the layer, the key and the way out', () => {
    expect(() => checkArtSourceOptions(SUBJECT, {layers: {table: {at: [1, 2]}}})).toThrow(
      'StageArt "kitchen": the options of the layer "table" have at, which only a loose layer takes — give a loose layer its at and pxPerUnit in the layers list of the source',
    );
    expect(() => checkArtSourceOptions(SUBJECT, {layers: {table: {pxPerUnit: 2}}})).toThrow(
      /^StageArt "kitchen": the options of the layer "table" have pxPerUnit, which only a loose layer takes/,
    );
    expect(() => readAtlasSource(SUBJECT, ftpAtlas(), {layers: {table: {at: [1, 2]}}})).toThrow(
      /have at, which only a loose layer takes/,
    );
    expect(() => checkArtSourceOptions(SUBJECT, {layers: {table: {at: undefined, pxPerUnit: undefined}}})).not.toThrow();
    expect(() => checkLayerDefs(SUBJECT, [{name: 'table', at: [1, 2], pxPerUnit: 2}])).not.toThrow();
  });

  test('refuses an order, a pivot and frames the options cannot take', () => {
    const refused = (options: unknown, message: RegExp) =>
      expect(() => checkArtSourceOptions(SUBJECT, {layers: {steam: options}})).toThrow(message);

    refused({order: 1.5}, /the order of the layer "steam" must be a whole number from -1024 to 1023, got 1.5/);
    refused({order: 1024}, /the order of the layer "steam" must be a whole number from -1024 to 1023/);
    refused({pivot: [1]}, /the pivot of the layer "steam" must be a pair of finite numbers, got \[1\]/);
    refused({frames: 'steam#0'}, /the frames of the layer "steam" must be a list of frame names or a RegExp, got "steam#0"/);
    refused({frames: [1]}, /the frames of the layer "steam" must be a list of frame names or a RegExp/);
  });

  test('refuses a rest pose as set() refuses it', () => {
    const refused = (rest: unknown, message: RegExp) =>
      expect(() => checkArtSourceOptions(SUBJECT, {layers: {steam: {rest}}})).toThrow(message);

    refused(
      {opacity: 2},
      /^StageArt "kitchen": the opacity of the rest of the layer "steam" must be a number from 0 to 1, got 2/,
    );
    refused({frame: -1}, /the frame of the rest of the layer "steam" must be a whole number of 0 or more, got -1/);
    refused({deg: Number.NaN}, /the deg of the rest of the layer "steam" must be a finite number, got NaN/);
    refused({visible: 1}, /the visible of the rest of the layer "steam" must be a boolean, got 1/);
    refused({rotation: 90}, /^StageArt "kitchen": the rest of the layer "steam" has no field "rotation"; its fields are "x", /);
    refused(5, /^StageArt "kitchen": the rest of the layer "steam" must be an object, got 5/);
  });

  test('takes no options at all, and undefined fields', () => {
    expect(() => checkArtSourceOptions(SUBJECT, {})).not.toThrow();
    expect(() => checkArtSourceOptions(SUBJECT, {only: undefined, layers: {steam: {depth: undefined}}})).not.toThrow();
  });
});

// a small atlas of loose props: three upright frames side by side, and one trimmed out of a sprite of 40 × 60
const propsAtlas = (): TextureAtlas<unknown> =>
  TexturePackerJson.parse({
    frames: {
      jug: {frame: {x: 0, y: 0, w: 40, h: 60}},
      'jug-empty': {frame: {x: 40, y: 0, w: 40, h: 60}},
      lamp: {frame: {x: 80, y: 0, w: 20, h: 30}},
      spark: {
        frame: {x: 100, y: 0, w: 10, h: 20},
        trimmed: true,
        spriteSourceSize: {x: 5, y: 30, w: 10, h: 20},
        sourceSize: {w: 40, h: 60},
      },
    },
    meta: {image: 'props.png', size: {w: 128, h: 64}},
  })[0];

describe('readLooseLayers()', () => {
  test('a layer stands with the pivot of its frame at its at; the box is the size of its frame', () => {
    const atlas = propsAtlas();
    const {layers, problems} = readLooseLayers(SUBJECT, atlas, [
      {name: 'jug', frames: ['jug', 'jug-empty'], pivot: [10, 50], at: [100, 200], depth: 40},
    ]);

    expect(problems).toEqual([]);
    expect(layers).toHaveLength(1);
    const [jug] = layers as [ArtLayerSpec];
    expect(jug).toMatchObject({
      name: 'jug',
      box: {x: 90, y: 150, w: 40, h: 60},
      pivotX: 100,
      pivotY: 200,
      depth: 40,
      at: [100, 200],
    });
    expect(jug.frames.map((frame) => frame?.frame)).toEqual([atlas.frame('jug'), atlas.frame('jug-empty')]);
    expect(boxesOf(jug)).toEqual([
      {x: 90, y: 150, w: 40, h: 60},
      {x: 90, y: 150, w: 40, h: 60},
    ]);
    expect(jug.tags.size).toBe(0);
  });

  test('a trimmed frame lies in its untrimmed sprite, and the pivot is in pixels of that sprite', () => {
    const {layers} = readLooseLayers(SUBJECT, propsAtlas(), [{name: 'spark', frames: ['spark'], pivot: [20, 60], at: [0, 0]}]);

    const [spark] = layers as [ArtLayerSpec];
    expect(spark.frames[0]?.box).toEqual({x: -15, y: -30, w: 10, h: 20});
    expect(spark.box).toEqual({x: -15, y: -30, w: 10, h: 20});
    expect([spark.pivotX, spark.pivotY]).toEqual([0, 0]);
  });

  test('without a pivot the middle of the frame stands at at; without at at [0, 0]; without frames the frame of its name', () => {
    const {layers} = readLooseLayers(SUBJECT, propsAtlas(), [{name: 'lamp'}]);

    const [lamp] = layers as [ArtLayerSpec];
    expect(lamp).toMatchObject({box: {x: -10, y: -15, w: 20, h: 30}, pivotX: 0, pivotY: 0, depth: 0, order: 0, at: [0, 0]});
  });

  test('a RegExp takes the frames it matches, in the natural order of their names', () => {
    const atlas = propsAtlas();
    const {layers} = readLooseLayers(SUBJECT, atlas, [{name: 'jug', frames: /^jug/}]);

    expect(layers[0]!.frames.map((frame) => frame?.frame)).toEqual([atlas.frame('jug'), atlas.frame('jug-empty')]);
  });

  test('a frame the atlas lacks is a problem of its layer', () => {
    const {layers, problems} = readLooseLayers(SUBJECT, propsAtlas(), [{name: 'cup', at: [5, 6]}]);

    expect(layers[0]).toMatchObject({name: 'cup', frames: [], box: {x: 5, y: 6, w: 0, h: 0}, pivotX: 5, pivotY: 6});
    expect(problems).toEqual([
      {layer: 'cup', reason: expect.stringContaining('the frame "cup" of the layer "cup" is not in the atlas')},
    ]);
  });

  test('refuses defs that are no list, a def without a name, a name twice, and the options as an override', () => {
    expect(() => checkLayerDefs(SUBJECT, {})).toThrow(/^StageArt "kitchen": layers must be a list of layer definitions, got /);
    expect(() => checkLayerDefs(SUBJECT, [{}])).toThrow(
      /^StageArt "kitchen": the layer 0 must be named by a string, got undefined/,
    );
    expect(() => checkLayerDefs(SUBJECT, [5])).toThrow(/^StageArt "kitchen": the layer 0 must be an object, got 5/);
    expect(() => checkLayerDefs(SUBJECT, [{name: 'jug'}, {name: 'jug'}])).toThrow(
      'StageArt "kitchen": two layers are named "jug"',
    );
    expect(() => checkLayerDefs(SUBJECT, [{name: 'jug', depth: '4'}])).toThrow(
      /the depth of the layer "jug" must be a finite number, got "4"/,
    );
    expect(() => checkLayerDefs(SUBJECT, [{name: 'jug', at: [1, Number.NaN]}])).toThrow(
      /the at of the layer "jug" must be a pair of finite numbers/,
    );
    expect(() => checkLayerDefs(SUBJECT, [{name: 'jug', pxPerUnit: 0}])).toThrow(
      /the pxPerUnit of the layer "jug" must be a finite number above 0, got 0/,
    );
    expect(() => readLooseLayers(SUBJECT, propsAtlas(), [{name: 'jug'}, {name: 'jug'}])).toThrow(/two layers are named "jug"/);
  });
});

describe('prepareLayerFrame()', () => {
  test('the tex coords and the flip of the frame, the margins of its box in the layer box as fractions', () => {
    const atlas = asepriteAtlas();
    const steam = layerOf(readAtlasSource(SUBJECT, atlas, {}).layers, 'steam');
    const prepared = prepareLayerFrame(steam.frames[0]!, steam.box);

    expect(prepared.texCoords).toEqual(atlas.frame('steam#0')!.coords.getTexCoords());
    expect(prepared.texFlipDiagonal).toBe(0);
    expect(prepared.texTrim).toEqual([4 / 22, 12 / 38, 4 / 22, 0]);
  });

  test('a frame the size of its layer box has no margins, whatever the canvas', () => {
    const atlas = asepriteAtlas();
    const window = layerOf(readAtlasSource(SUBJECT, atlas, {}).layers, 'window');

    expect(prepareLayerFrame(window.frames[0]!, window.box).texTrim).toEqual([0, 0, 0, 0]);
  });

  test('a frame drawn turned answers its diagonal flip', () => {
    const [atlas] = TexturePackerJson.parse({
      frames: {turned: {frame: {x: 0, y: 0, w: 10, h: 20}, rotated: true}},
      meta: {image: 'x.png', size: {w: 32, h: 32}},
    });
    const frame = atlas.frame('turned')!;
    const box: LayerBox = {x: 0, y: 0, w: 10, h: 20};

    expect(prepareLayerFrame({frame, box}, box)).toEqual({
      texCoords: frame.coords.getTexCoords(),
      texFlipDiagonal: 1,
      texTrim: [0, 0, 0, 0],
    });
  });
});

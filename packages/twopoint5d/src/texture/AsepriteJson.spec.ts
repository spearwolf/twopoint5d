import {readFileSync} from 'node:fs';
import {describe, expect, expectTypeOf, test} from 'vitest';

import {type AsepriteFrameData, AsepriteJson, type AsepriteJsonData} from './AsepriteJson.js';
import {asepriteAtlasAdapter} from './atlasAdapters.js';
import {TextureAtlas} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';

const fixture = (name: string): AsepriteJsonData =>
  JSON.parse(readFileSync(new URL(`./fixtures/aseprite/${name}`, import.meta.url), 'utf8')) as AsepriteJsonData;

const frameName = (index: number) => `fighter ${index}.aseprite`;

// a sheet of `count` frames of 4 × 4 in a row, every frame `ms` long unless `durations` says otherwise
const sheet = (
  count: number,
  meta: Partial<AsepriteJsonData['meta']> = {},
  durations: number[] = Array.from({length: count}, () => 100),
): AsepriteJsonData => ({
  frames: Object.fromEntries(
    Array.from({length: count}, (_, i) => [
      `f${i}`,
      {
        frame: {x: i * 4, y: 0, w: 4, h: 4},
        rotated: false,
        trimmed: false,
        spriteSourceSize: {x: 0, y: 0, w: 4, h: 4},
        sourceSize: {w: 4, h: 4},
        duration: durations[i]!,
      },
    ]),
  ),
  meta: {app: 'https://www.aseprite.org/', version: '1.3.10-x64', image: 's.png', size: {w: count * 4, h: 4}, ...meta},
});

// the frame names an animation runs through, read back out of its bake
const framesOf = (data: AsepriteJsonData, tag: string, options?: Parameters<typeof AsepriteJson.parse>[1]): string[] => {
  const [atlas, , animations] = AsepriteJson.parse(data, options);
  const info = animations.animation(tag);
  const buffer = animations.bakeDataTexture().image.data as Float32Array;
  const header = buffer.subarray(info.id * 4, info.id * 4 + 4);
  const names = atlas.frameNames() as string[];
  return Array.from({length: info.frameCount}, (_, i) => {
    const texel = (header[2]! + i * header[3]!) * 4;
    const [s, t] = [buffer[texel]!, buffer[texel + 1]!];
    return names.find((name) => {
      const coords = atlas.frame(name)!.coords.getTexCoords();
      return Math.fround(coords[0]!) === s && Math.fround(coords[1]!) === t;
    })!;
  });
};

describe('AsepriteJson', () => {
  describe('the fixtures', () => {
    test.each(['fighter-hash.json', 'fighter-array.json'])('%s: every frame by its name, in the order of the sheet', (name) => {
      const [atlas, meta] = AsepriteJson.parse(fixture(name));

      expect(atlas.size).toBe(16);
      expect(atlas.frameNames()).toEqual(Array.from({length: 16}, (_, i) => frameName(i)));
      expect(atlas.frame(frameName(5))!.coords.x).toBe(16);
      expect(atlas.frame(frameName(5))!.coords.y).toBe(16);
      expect(meta.app).toBe('https://www.aseprite.org/');
    });

    test('the frames of the trimmed array carry their margins in their data, untouched', () => {
      const [atlas] = AsepriteJson.parse(fixture('fighter-array.json'));

      const data = atlas.frame(frameName(0))!.data!;
      expect([data.trimmed, data.spriteSourceSize, data.sourceSize]).toEqual([true, {x: 2, y: 2, w: 12, h: 14}, {w: 16, h: 16}]);
    });

    test('one animation per tag, in the order of the tags', () => {
      const [, , animations] = AsepriteJson.parse(fixture('fighter-hash.json'));

      expect(['idle', 'walk', 'kick', 'block', 'spin'].map((tag) => animations.animId(tag))).toEqual([0, 1, 2, 3, 4]);
    });

    test('the tags of the fixture: playback, frames and durations', () => {
      const [, , animations] = AsepriteJson.parse(fixture('fighter-hash.json'));
      const summary = (tag: string) => {
        const {playback, frameCount, duration, durations} = animations.animation(tag);
        return {
          playback,
          frameCount,
          duration: Math.round(duration * 1000),
          durations: durations?.map((d) => Math.round(d * 1000)),
        };
      };

      expect(summary('idle')).toEqual({playback: 'pingpong', frameCount: 4, duration: 400, durations: undefined});
      expect(summary('walk')).toEqual({playback: 'loop', frameCount: 4, duration: 400, durations: undefined});
      expect(summary('kick')).toEqual({playback: 'once', frameCount: 3, duration: 400, durations: [80, 80, 240]});
      expect(summary('block')).toEqual({playback: 'loop', frameCount: 2, duration: 240, durations: undefined});
      expect(summary('spin')).toEqual({playback: 'pingpong', frameCount: 3, duration: 240, durations: [120, 60, 60]});
    });

    test('a reversed tag runs its frames backwards', () => {
      expect(framesOf(fixture('fighter-hash.json'), 'block')).toEqual([frameName(12), frameName(11)]);
      expect(framesOf(fixture('fighter-hash.json'), 'spin')).toEqual([frameName(15), frameName(14), frameName(13)]);
    });

    test('the frames of the trimmed array bring their margins into the animsMap', () => {
      const [, , animations] = AsepriteJson.parse(fixture('fighter-array.json'));

      const buffer = animations.bakeDataTexture().image.data as Float32Array;

      expect(buffer[3], 'three texels per frame').toBe(3);
      expect(Array.from(buffer.subarray(5 * 4 + 8, 5 * 4 + 12)).map((v) => Math.round(v * 16))).toEqual([2, 2, 2, 0]);
    });

    test('every frame carries its index and the slices in force at it', () => {
      const [atlas] = AsepriteJson.parse(fixture('fighter-hash.json'));

      expect(atlas.frame(frameName(3))!.data!.index).toBe(3);
      expect(atlas.frame(frameName(7))!.data!.slices).toEqual({
        hitbox: {bounds: {x: 4, y: 2, w: 8, h: 14}, pivot: {x: 4, y: 14}},
        panel: {bounds: {x: 0, y: 0, w: 16, h: 16}, center: {x: 4, y: 4, w: 8, h: 8}},
      });
      expect(atlas.frame(frameName(8))!.data!.slices['hitbox']).toEqual({
        bounds: {x: 2, y: 2, w: 13, h: 14},
        pivot: {x: 6, y: 14},
      });
      expect(atlas.frame(frameName(15))!.data!.slices['hitbox']!.pivot).toEqual({x: 6, y: 14});
    });

    test('the json handed in is left as it was', () => {
      const data = fixture('fighter-hash.json');
      const before = JSON.stringify(data);

      AsepriteJson.parse(data);

      expect(JSON.stringify(data)).toBe(before);
    });
  });

  describe('frame tags', () => {
    test('a pingpong tag of uneven durations keeps them per frame', () => {
      const data = sheet(3, {frameTags: [{name: 'a', from: 0, to: 2, direction: 'pingpong'}]}, [50, 100, 150]);

      const [, , animations] = AsepriteJson.parse(data);

      expect(animations.animation('a').durations).toEqual([0.05, 0.1, 0.15]);
      expect(animations.animation('a').playback).toBe('pingpong');
    });

    test('a forward tag with a repeat of 3 is a one-shot over its frames three times', () => {
      const data = sheet(2, {frameTags: [{name: 'a', from: 0, to: 1, direction: 'forward', repeat: '3'}]});

      expect(framesOf(data, 'a')).toEqual(['f0', 'f1', 'f0', 'f1', 'f0', 'f1']);
      expect(AsepriteJson.parse(data)[2].animation('a').playback).toBe('once');
    });

    test('a reverse tag with a repeat of 2 runs backwards twice', () => {
      const data = sheet(3, {frameTags: [{name: 'a', from: 0, to: 2, direction: 'reverse', repeat: 2}]});

      expect(framesOf(data, 'a')).toEqual(['f2', 'f1', 'f0', 'f2', 'f1', 'f0']);
    });

    test('a pingpong tag with a repeat counts each direction as one pass and shows a turning frame once', () => {
      const data = sheet(4, {frameTags: [{name: 'a', from: 0, to: 3, direction: 'pingpong', repeat: '3'}]});

      expect(framesOf(data, 'a')).toEqual(['f0', 'f1', 'f2', 'f3', 'f2', 'f1', 'f0', 'f1', 'f2', 'f3']);
    });

    test('a pingpong_reverse tag with a repeat of 2 goes down and up again', () => {
      const data = sheet(3, {frameTags: [{name: 'a', from: 0, to: 2, direction: 'pingpong_reverse', repeat: '2'}]});

      expect(framesOf(data, 'a')).toEqual(['f2', 'f1', 'f0', 'f1', 'f2']);
    });

    test('a repeat of 0 plays forever', () => {
      const data = sheet(2, {frameTags: [{name: 'a', from: 0, to: 1, direction: 'forward', repeat: '0'}]});

      expect(AsepriteJson.parse(data)[2].animation('a').playback).toBe('loop');
    });

    test('the durations of a repeated tag repeat with its frames', () => {
      const data = sheet(2, {frameTags: [{name: 'a', from: 0, to: 1, direction: 'forward', repeat: '2'}]}, [100, 300]);

      expect(AsepriteJson.parse(data)[2].animation('a').durations).toEqual([0.1, 0.3, 0.1, 0.3]);
    });

    test('options.playback names the playback of a tag outright: the frames follow the direction, repeat is left out', () => {
      const data = sheet(3, {
        frameTags: [
          {name: 'kick', from: 0, to: 2, direction: 'reverse', repeat: '2'},
          {name: 'walk', from: 0, to: 2, direction: 'forward'},
        ],
      });

      const [, , animations] = AsepriteJson.parse(data, {playback: {kick: 'once', walk: 'pingpong'}});

      expect([animations.animation('kick').playback, animations.animation('walk').playback]).toEqual(['once', 'pingpong']);
      expect(framesOf(data, 'kick', {playback: {kick: 'once'}})).toEqual(['f2', 'f1', 'f0']);
    });

    test('a tag named constructor takes the playback of its direction when options.playback names other tags', () => {
      const data = sheet(2, {frameTags: [{name: 'constructor', from: 0, to: 1, direction: 'forward'}]});

      const [, , animations] = AsepriteJson.parse(data, {playback: {}});

      expect(animations.animation('constructor').playback).toBe('loop');
    });

    test('a sheet without tags answers an empty set of animations', () => {
      const [, , animations] = AsepriteJson.parse(sheet(2));

      expect(animations.hasAnimation('anim_0')).toBe(false);
      expect(() => animations.animation(0)).toThrow();
    });

    test('answers an atlas of AsepriteFrameData', () => {
      expectTypeOf(AsepriteJson.parse(sheet(1))[0]).toEqualTypeOf<TextureAtlas<AsepriteFrameData>>();
    });

    test('takes the parent coords and the target atlas it is handed', () => {
      const target = new TextureAtlas<never>();
      const parent = new TextureCoords(0, 0, 64, 64);

      const [atlas] = AsepriteJson.parse(sheet(1), {parentCoords: parent, target: target as never});

      expect(atlas).toBe(target);
      expect(atlas.frame('f0')!.coords.parent).toBe(parent);
    });
  });

  describe('refusals', () => {
    test.each([
      [
        {name: 'a', from: 0, to: 5, direction: 'forward'},
        'the tag "a" runs from frame 0 to frame 5, outside the 2 frames of the sheet',
      ],
      [
        {name: 'a', from: -1, to: 1, direction: 'forward'},
        'the tag "a" runs from frame -1 to frame 1, outside the 2 frames of the sheet',
      ],
      [
        {name: 'a', from: 0.5, to: 1, direction: 'forward'},
        'the tag "a" runs from frame 0.5 to frame 1, outside the 2 frames of the sheet',
      ],
      [
        {name: 'a', from: 1, to: 0, direction: 'forward'},
        'the tag "a" runs from frame 1 back to frame 0 — export the sheet again from Aseprite',
      ],
      [
        {name: 'a', from: 0, to: 1, direction: 'sideways'},
        'the tag "a" has the direction "sideways" — Aseprite\'s directions are forward, reverse, pingpong and pingpong_reverse',
      ],
      [
        {name: 'a', from: 0, to: 1, direction: 'forward', repeat: '-1'},
        'the tag "a" has a repeat of "-1" — a repeat is a whole number of 0 or more',
      ],
      [
        {name: 'a', from: 0, to: 1, direction: 'forward', repeat: 'x'},
        'the tag "a" has a repeat of "x" — a repeat is a whole number of 0 or more',
      ],
    ])('refuses the tag %j', (tag, message) => {
      expect(() => AsepriteJson.parse(sheet(2, {frameTags: [tag as never]}))).toThrow(`AsepriteJson: ${message}`);
    });

    test('refuses a tag whose direction is a BigInt, showing it with its n', () => {
      const tag = {name: 'a', from: 0, to: 1, direction: 1n};

      expect(() => AsepriteJson.parse(sheet(2, {frameTags: [tag as never]}))).toThrow(
        'AsepriteJson: the tag "a" has the direction 1n — Aseprite\'s directions are forward, reverse, pingpong and pingpong_reverse',
      );
    });

    test('refuses two tags of one name', () => {
      const tags = [
        {name: 'a', from: 0, to: 0, direction: 'forward' as const},
        {name: 'a', from: 1, to: 1, direction: 'forward' as const},
      ];

      expect(() => AsepriteJson.parse(sheet(2, {frameTags: tags}))).toThrow(
        'AsepriteJson: two tags are named "a" — rename one of them in Aseprite',
      );
    });

    test('refuses a frame of a tag without a duration above 0', () => {
      const data = sheet(2, {frameTags: [{name: 'a', from: 0, to: 1, direction: 'forward'}]}, [100, 0]);

      expect(() => AsepriteJson.parse(data)).toThrow(
        new RangeError('AsepriteJson: the duration of the frame "f1" must be a finite number above 0, got 0'),
      );
    });

    test('refuses a frame outside every tag without a duration above 0, with a RangeError naming it, before the first frame reaches options.target', () => {
      const target = new TextureAtlas<never>();
      const data = sheet(3, {frameTags: [{name: 'a', from: 0, to: 0, direction: 'forward'}]}, [100, 100, NaN]);

      expect(() => AsepriteJson.parse(data, {target: target as never})).toThrow(
        new RangeError('AsepriteJson: the duration of the frame "f2" must be a finite number above 0, got NaN'),
      );
      expect(target.size).toBe(0);
    });

    test('refuses a sheet with a frame without its area and leaves options.target as it was', () => {
      const target = new TextureAtlas<never>();
      const data = sheet(2);
      delete (data.frames as Record<string, {frame?: unknown}>)['f1']!.frame;

      expect(() => AsepriteJson.parse(data, {target: target as never})).toThrow(
        new TypeError(
          'TexturePackerJson: the frame "f1" has a frame of undefined — its area in the image is an object {x, y, w, h}',
        ),
      );
      expect(target.size).toBe(0);
    });

    test('refuses a frame that is no object, by its name or by its index', () => {
      const hash = sheet(2);
      (hash.frames as Record<string, unknown>)['f1'] = null;
      const array = {...sheet(1), frames: [7]};

      expect(() => AsepriteJson.parse(hash)).toThrow(
        new TypeError('AsepriteJson: the frame "f1" is null — a frame of the json is an object'),
      );
      expect(() => AsepriteJson.parse(array as never)).toThrow(
        new TypeError('AsepriteJson: the frame 0 of the "Array" frames is 7 — a frame of the json is an object'),
      );
    });

    test('refuses meta.frameTags that is no list, and a frame tag that is no object', () => {
      expect(() => AsepriteJson.parse(sheet(2, {frameTags: {name: 'a'} as never}))).toThrow(
        new TypeError('AsepriteJson: meta.frameTags is {name: "a"} — Aseprite writes the frame tags as a list'),
      );
      expect(() => AsepriteJson.parse(sheet(2, {frameTags: [null as never]}))).toThrow(
        new TypeError('AsepriteJson: the frame tag 0 is null — a frame tag is an object'),
      );
    });

    test('asepriteAtlasAdapter refuses a json whose frames carry no duration', () => {
      const json = {
        frames: {a: {frame: {x: 0, y: 0, w: 4, h: 4}}},
        meta: {app: 'https://www.aseprite.org/', image: 's.png', size: {w: 4, h: 4}},
      };

      expect(() => asepriteAtlasAdapter(json, new TextureCoords(0, 0, 4, 4))).toThrow(
        new RangeError('AsepriteJson: the duration of the frame "a" must be a finite number above 0, got undefined'),
      );
    });

    test('refuses a playback for a tag the sheet does not carry, naming its tags', () => {
      const data = sheet(2, {frameTags: [{name: 'idle', from: 0, to: 1, direction: 'forward'}]});

      expect(() => AsepriteJson.parse(data, {playback: {kick: 'once'}})).toThrow(
        'AsepriteJson: parse() got a playback for the tag "kick", which the sheet does not carry — its tags are: idle',
      );
    });

    test.each([
      ['bounce', '"bounce"'],
      [null, 'null'],
      [1, '1'],
    ])('refuses a playback of %s, naming the tag, and leaves the target atlas as it was', (value, shown) => {
      const target = new TextureAtlas<never>();
      const data = sheet(2, {frameTags: [{name: 'walk', from: 0, to: 1, direction: 'forward'}]});

      expect(() => AsepriteJson.parse(data, {target: target as never, playback: {walk: value as never}})).toThrow(
        `AsepriteJson: parse() got a playback of ${shown} for the tag "walk" — a playback is 'loop', 'once' or 'pingpong'`,
      );
      expect(target.size).toBe(0);
    });

    test('refuses a frame name twice in the layout "Array", naming the fix', () => {
      const data = sheet(2);
      const entries = Object.values(data.frames as Record<string, object>).map((entry) => ({
        ...entry,
        filename: 'fighter.aseprite',
      }));

      expect(() => AsepriteJson.parse({...data, frames: entries} as never)).toThrow(
        'AsepriteJson: the frame name "fighter.aseprite" appears twice — export with a filename format that contains {frame}',
      );
    });

    test('refuses a tag whose repeat plays more frames with their own durations than an animation holds', () => {
      const data = sheet(3, {frameTags: [{name: 'a', from: 0, to: 2, direction: 'forward', repeat: '3000'}]}, [50, 100, 150]);

      expect(() => AsepriteJson.parse(data)).toThrow(
        'AsepriteJson: the tag "a" plays 9000 frames with their own durations — an animation with per-frame durations holds at most 8191 frames; lower its repeat',
      );
    });

    test('a tag refused for its repeat leaves the target atlas as it was', () => {
      const target = new TextureAtlas<never>();
      const data = sheet(3, {frameTags: [{name: 'a', from: 0, to: 2, direction: 'forward', repeat: '3000'}]}, [50, 100, 150]);

      expect(() => AsepriteJson.parse(data, {target: target as never})).toThrow();
      expect(target.size).toBe(0);
    });

    test('a repeat of even durations holds as many frames as a data texture takes', () => {
      const data = sheet(3, {frameTags: [{name: 'a', from: 0, to: 2, direction: 'forward', repeat: '3000'}]});

      expect(AsepriteJson.parse(data)[2].animation('a').frameCount).toBe(9000);
    });

    test('a refused sheet leaves the target atlas as it was', () => {
      const target = new TextureAtlas<never>();

      expect(() =>
        AsepriteJson.parse(sheet(2, {frameTags: [{name: 'a', from: 0, to: 9, direction: 'forward'}]}), {target: target as never}),
      ).toThrow();
      expect(target.size).toBe(0);
    });
  });
});

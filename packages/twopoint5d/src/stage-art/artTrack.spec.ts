import {describe, expect, test} from 'vitest';

import type {ArtPose} from './artPose.js';
import {type ArtKey, artTrack, rampAt} from './artTrack.js';

const at = (track: ReturnType<typeof artTrack>, seconds: number, target: ArtPose = {}): ArtPose => track.sample(seconds, target);

describe('artTrack()', () => {
  test('shows the first key before it, the last after it, and blends in between', () => {
    const track = artTrack([
      {at: 1, x: 10, deg: 0},
      {at: 3, x: 30, deg: 90},
    ]);
    expect(track.duration).toBe(3);
    expect(at(track, -5)).toEqual({x: 10, deg: 0});
    expect(at(track, 0)).toEqual({x: 10, deg: 0});
    expect(at(track, 1)).toEqual({x: 10, deg: 0});
    expect(at(track, 2)).toEqual({x: 20, deg: 45});
    expect(at(track, 3)).toEqual({x: 30, deg: 90});
    expect(at(track, 100)).toEqual({x: 30, deg: 90});
  });

  test('answers the target it is given', () => {
    const track = artTrack([{at: 0, x: 1}]);
    const target: ArtPose = {};
    expect(track.sample(0, target)).toBe(target);
  });

  test('equal times make a cut: the later key shows from its time on', () => {
    const track = artTrack([
      {at: 0, x: 0},
      {at: 1, x: 10},
      {at: 1, x: 50},
      {at: 2, x: 60},
    ]);
    expect(at(track, 0.5).x).toBe(5);
    expect(at(track, 0.999).x).toBeCloseTo(9.99, 5);
    expect(at(track, 1).x).toBe(50);
    expect(at(track, 1.5).x).toBe(55);
  });

  test('a key holds what it leaves out, and a field the first key leaves out is not part of the track', () => {
    const track = artTrack([
      {at: 0, x: 0, y: 7},
      {at: 1, deg: 35},
      {at: 2, x: 20},
    ]);
    // the deg of the second key is no field of the track: the first key leaves it out
    expect(at(track, 0.5)).toEqual({x: 0, y: 7});
    expect(at(track, 1)).toEqual({x: 0, y: 7});
    expect(at(track, 1.5)).toEqual({x: 10, y: 7});
    expect(at(track, 2)).toEqual({x: 20, y: 7});
  });

  test('leaves the fields it has not on the target alone', () => {
    const track = artTrack([
      {at: 0, opacity: 1},
      {at: 1, opacity: 0},
    ]);
    const target: ArtPose = {x: 99, deg: 12, opacity: 0.3};
    track.sample(0.5, target);
    expect(target).toEqual({x: 99, deg: 12, opacity: 0.5});
  });

  test('two tracks that write different fields run on one pose', () => {
    const move = artTrack([
      {at: 0, x: 0},
      {at: 1, x: 100},
    ]);
    const fade = artTrack([
      {at: 0, opacity: 1},
      {at: 1, opacity: 0},
    ]);
    const pose: ArtPose = {};
    move.sample(0.25, pose);
    fade.sample(0.5, pose);
    expect(pose).toEqual({x: 25, opacity: 0.5});
  });

  test('blends every continuous field', () => {
    const track = artTrack([
      {at: 0, x: 0, y: 0, depth: 0, deg: 0, scaleX: 1, scaleY: 1, opacity: 0},
      {at: 2, x: 2, y: 4, depth: 100, deg: 350, scaleX: 3, scaleY: 5, opacity: 1},
    ]);
    expect(at(track, 1)).toEqual({x: 1, y: 2, depth: 50, deg: 175, scaleX: 2, scaleY: 3, opacity: 0.5});
  });

  test('blends deg as written: 0 to 350 turns 350 degrees', () => {
    const track = artTrack([
      {at: 0, deg: 0},
      {at: 1, deg: 350},
    ]);
    expect(at(track, 0.5).deg).toBe(175);
  });

  test('discrete fields change at the key that sets them', () => {
    const track = artTrack([
      {at: 0, frame: 0, visible: false, order: 1},
      {at: 1, frame: 2, visible: true, order: 5},
      {at: 2, frame: 3},
    ]);
    expect(at(track, 0.99)).toEqual({frame: 0, visible: false, order: 1});
    expect(at(track, 1)).toEqual({frame: 2, visible: true, order: 5});
    expect(at(track, 1.99)).toEqual({frame: 2, visible: true, order: 5});
    expect(at(track, 2)).toEqual({frame: 3, visible: true, order: 5});
  });

  test('eases the stretch that arrives at a key by the ease of that key', () => {
    const track = artTrack([
      {at: 0, x: 0},
      {at: 1, x: 100, ease: 'ease-in'},
      {at: 2, x: 200, ease: 'ease-out'},
    ]);
    expect(at(track, 0.5).x).toBeCloseTo(100 * 0.125, 9);
    expect(at(track, 1.5).x).toBeCloseTo(100 + 100 * (1 - 0.125), 9);
  });

  test('the ease of the track is the default of every key without one', () => {
    const track = artTrack(
      [
        {at: 0, x: 0},
        {at: 1, x: 100},
        {at: 2, x: 200, ease: 'linear'},
      ],
      {ease: 'ease-in'},
    );
    expect(at(track, 0.5).x).toBeCloseTo(12.5, 9);
    expect(at(track, 1.5).x).toBe(150);
  });

  test('an ease is a function from the share to the eased share, clamped', () => {
    const track = artTrack([
      {at: 0, x: 0},
      {at: 1, x: 10, ease: (t) => t * 3},
    ]);
    expect(at(track, 0.2).x).toBeCloseTo(6, 9);
    expect(at(track, 0.5).x).toBe(10);
  });

  test("'loop' wraps over the duration, backwards as well", () => {
    const track = artTrack(
      [
        {at: 0, x: 0},
        {at: 2, x: 20},
      ],
      {playback: 'loop'},
    );
    expect(at(track, 1).x).toBe(10);
    expect(at(track, 3).x).toBe(10);
    expect(at(track, 5).x).toBe(10);
    expect(at(track, 2.5).x).toBe(5);
    expect(at(track, -0.5).x).toBe(15);
  });

  test("'pingpong' runs forth and back", () => {
    const track = artTrack(
      [
        {at: 0, x: 0},
        {at: 2, x: 20},
      ],
      {playback: 'pingpong'},
    );
    expect(at(track, 1).x).toBe(10);
    expect(at(track, 2).x).toBe(20);
    expect(at(track, 3).x).toBe(10);
    expect(at(track, 4).x).toBe(0);
    expect(at(track, 5).x).toBe(10);
    expect(at(track, -1).x).toBe(10);
  });

  test("'once' is the default playback", () => {
    const track = artTrack([
      {at: 0, x: 0},
      {at: 2, x: 20},
    ]);
    expect(at(track, 3).x).toBe(20);
    expect(at(track, -3).x).toBe(0);
  });

  test('a track of one key, or of a duration of 0, holds that key and loops without a fault', () => {
    for (const playback of ['once', 'loop', 'pingpong'] as const) {
      const track = artTrack([{at: 0, x: 4, frame: 2}], {playback});
      expect(track.duration).toBe(0);
      expect(at(track, 0)).toEqual({x: 4, frame: 2});
      expect(at(track, 9)).toEqual({x: 4, frame: 2});
      expect(at(track, -9)).toEqual({x: 4, frame: 2});
      expect(track.isMoving(0)).toBe(false);
    }
  });

  test('is pure: the same time gives the same pose, in any order', () => {
    const track = artTrack([
      {at: 0, x: 0},
      {at: 1, x: 10},
      {at: 2, x: 0},
    ]);
    const first = at(track, 0.7).x;
    at(track, 1.9);
    at(track, 0.1);
    expect(at(track, 0.7).x).toBe(first);
  });

  test('copies its keys: a key changed afterwards changes nothing', () => {
    const keys: ArtKey[] = [
      {at: 0, x: 0},
      {at: 1, x: 10},
    ];
    const track = artTrack(keys);
    keys[1]!.x = 999;
    keys[1]!.at = 50;
    expect(at(track, 1).x).toBe(10);
    expect(track.duration).toBe(1);
  });

  test('isMoving() is true within its keys, and always for a loop and a pingpong', () => {
    const keys: ArtKey[] = [
      {at: 1, x: 0},
      {at: 3, x: 20},
    ];
    const once = artTrack(keys);
    expect(once.isMoving(0)).toBe(false);
    expect(once.isMoving(0.999)).toBe(false);
    expect(once.isMoving(1)).toBe(true);
    expect(once.isMoving(2.999)).toBe(true);
    expect(once.isMoving(3)).toBe(false);
    expect(once.isMoving(100)).toBe(false);
    expect(artTrack(keys, {playback: 'loop'}).isMoving(0)).toBe(true);
    expect(artTrack(keys, {playback: 'loop'}).isMoving(1000)).toBe(true);
    expect(artTrack(keys, {playback: 'pingpong'}).isMoving(-4)).toBe(true);
  });

  describe('refuses', () => {
    test('keys that are no list or empty', () => {
      expect(() => artTrack([])).toThrow(/^artTrack: keys must be a non-empty array of ArtKey, got \[\]$/);
      expect(() => artTrack(undefined as never)).toThrow(TypeError);
      expect(() => artTrack('keys' as never)).toThrow(/artTrack: keys must be a non-empty array of ArtKey, got "keys"/);
    });

    test('a key that is no object', () => {
      expect(() => artTrack([{at: 0}, 4 as never])).toThrow(/^artTrack: keys\[1\] must be an object with at, got 4$/);
      expect(() => artTrack([null as never])).toThrow(TypeError);
    });

    test('an at that is no finite number of 0 or more', () => {
      expect(() => artTrack([{at: -1}])).toThrow(/^artTrack: keys\[0\]\.at must be a finite number of 0 or more, got -1$/);
      expect(() => artTrack([{at: Number.NaN}])).toThrow(RangeError);
      expect(() => artTrack([{at: Number.POSITIVE_INFINITY}])).toThrow(RangeError);
      expect(() => artTrack([{} as ArtKey])).toThrow(/keys\[0\]\.at must be a finite number of 0 or more, got undefined/);
      expect(() => artTrack([{at: '1' as never}])).toThrow(RangeError);
    });

    test('an at smaller than the one before', () => {
      expect(() => artTrack([{at: 0}, {at: 2}, {at: 1}])).toThrow(
        /^artTrack: keys\[2\]\.at must be 2 or more, the at of keys\[1\], got 1$/,
      );
    });

    test('an unknown field, rotation for deg', () => {
      expect(() => artTrack([{at: 0, rotation: 5} as ArtKey])).toThrow(
        /^artTrack: keys\[0\] has no field "rotation"; its fields are "at", "ease", "x", "y", "depth", "deg", "scaleX", "scaleY", "opacity", "frame", "visible", "order"$/,
      );
      expect(() => artTrack([{at: 0}, {at: 1, rotation: 5} as ArtKey])).toThrow(TypeError);
    });

    test('a field as set() refuses it', () => {
      expect(() => artTrack([{at: 0, opacity: 1.5}])).toThrow(
        /^artTrack: keys\[0\]\.opacity must be a number from 0 to 1, got 1\.5$/,
      );
      expect(() => artTrack([{at: 0}, {at: 1, frame: 0.5}])).toThrow(
        /^artTrack: keys\[1\]\.frame must be a whole number of 0 or more, got 0\.5$/,
      );
      expect(() => artTrack([{at: 0, frame: -1}])).toThrow(RangeError);
      expect(() => artTrack([{at: 0, order: 1024}])).toThrow(
        /^artTrack: keys\[0\]\.order must be a whole number from -1024 to 1023, got 1024$/,
      );
      expect(() => artTrack([{at: 0, order: -1025}])).toThrow(RangeError);
      expect(() => artTrack([{at: 0, x: Number.NaN}])).toThrow(/keys\[0\]\.x must be a finite number, got NaN/);
      expect(() => artTrack([{at: 0, depth: Number.POSITIVE_INFINITY}])).toThrow(RangeError);
      expect(() => artTrack([{at: 0, visible: 1 as never}])).toThrow(/keys\[0\]\.visible must be a boolean, got 1/);
      expect(() => artTrack([{at: 0, deg: '5' as never}])).toThrow(RangeError);
    });

    test('takes the whole range of order and a depth in front of the plane', () => {
      expect(() =>
        artTrack([
          {at: 0, order: -1024},
          {at: 1, order: 1023},
          {at: 2, depth: -4000},
        ]),
      ).not.toThrow();
    });

    test('an ease easingOf() refuses', () => {
      expect(() => artTrack([{at: 0}, {at: 1, ease: 'bounce' as never}])).toThrow(
        /^artTrack: keys\[1\]\.ease must be 'linear', 'ease-in', 'ease-out', 'ease-in-out' or a function, got "bounce"$/,
      );
      expect(() => artTrack([{at: 0}], {ease: 'bounce' as never})).toThrow(/artTrack: options\.ease must be 'linear'/);
    });

    test('a playback that is none of the three', () => {
      expect(() => artTrack([{at: 0}], {playback: 'bounce' as never})).toThrow(
        /^artTrack: options\.playback must be 'once', 'loop' or 'pingpong', got "bounce"$/,
      );
    });

    test('options that are no object', () => {
      expect(() => artTrack([{at: 0}], 5 as never)).toThrow(/^artTrack: options must be an object, got 5$/);
    });

    test('builds nothing on a refusal: the keys before the fault are no track', () => {
      const keys: ArtKey[] = [
        {at: 0, x: 1},
        {at: 1, opacity: 2},
      ];
      expect(() => artTrack(keys)).toThrow(RangeError);
    });

    test('sample() and isMoving() of a time that is no finite number', () => {
      const track = artTrack([{at: 0, x: 1}]);
      expect(() => track.sample(Number.NaN, {})).toThrow(/^ArtTrack#sample\(\): seconds must be a finite number, got NaN$/);
      expect(() => track.sample(Number.POSITIVE_INFINITY, {})).toThrow(RangeError);
      expect(() => track.isMoving('1' as never)).toThrow(/^ArtTrack#isMoving\(\): seconds must be a finite number, got "1"$/);
    });
  });
});

describe('rampAt()', () => {
  test('is 0 before the start, 1 after the end and the share in between', () => {
    expect(rampAt(1, 2, 4)).toBe(0);
    expect(rampAt(2, 2, 4)).toBe(0);
    expect(rampAt(4, 2, 4)).toBe(0.5);
    expect(rampAt(6, 2, 4)).toBe(1);
    expect(rampAt(60, 2, 4)).toBe(1);
  });

  test('eases the share', () => {
    expect(rampAt(0.5, 0, 1, 'ease-in')).toBeCloseTo(0.125, 9);
    expect(rampAt(0.5, 0, 1, 'ease-out')).toBeCloseTo(0.875, 9);
    expect(rampAt(0.5, 0, 1, 'ease-in-out')).toBeCloseTo(0.5, 9);
    expect(rampAt(0.25, 0, 1, (t) => t * 2)).toBe(0.5);
    expect(rampAt(0.9, 0, 1, (t) => t * 2)).toBe(1);
  });

  test('refuses a duration that is no finite number above 0', () => {
    expect(() => rampAt(0, 0, 0)).toThrow(/^rampAt: duration must be a finite number above 0, got 0$/);
    expect(() => rampAt(0, 0, -1)).toThrow(RangeError);
    expect(() => rampAt(0, 0, Number.NaN)).toThrow(RangeError);
    expect(() => rampAt(0, 0, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  test('refuses a time and a start that are no finite numbers', () => {
    expect(() => rampAt(Number.NaN, 0, 1)).toThrow(/^rampAt: seconds must be a finite number, got NaN$/);
    expect(() => rampAt(0, Number.POSITIVE_INFINITY, 1)).toThrow(/^rampAt: start must be a finite number, got Infinity$/);
  });

  test('refuses an ease easingOf() refuses', () => {
    expect(() => rampAt(0, 0, 1, 'bounce' as never)).toThrow(/^rampAt: ease must be 'linear'/);
  });
});

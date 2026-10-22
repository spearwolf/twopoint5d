import {describe, expect, test} from 'vitest';

import {cmpAnimationsData} from './cmpAnimationsData.js';
import type {FrameBasedAnimationsDataMap} from './types.js';

// a catalog in JSON names a frameNameQuery as a string; FrameBasedAnimations#add() takes a RegExp as well
const query = (pattern: string, flags?: string) => new RegExp(pattern, flags) as unknown as string;

const animations = (): FrameBasedAnimationsDataMap => ({
  walk: {duration: 1, tileIds: [1, 2, 3]},
  idle: {frameRate: 4, firstTileId: 5, tileCount: 2},
  blink: {duration: 0.5, frameNameQuery: 'blink.*'},
});

describe('cmpAnimationsData()', () => {
  test('a deep copy equals the original', () => {
    const data = animations();

    expect(cmpAnimationsData(data, structuredClone(data))).toBe(true);
    expect(cmpAnimationsData(data, data)).toBe(true);
    expect(cmpAnimationsData(undefined, undefined)).toBe(true);
  });

  test('the same entries in another order are different', () => {
    const walk = {duration: 1, tileIds: [1, 2, 3]};
    const idle = {frameRate: 4, firstTileId: 5, tileCount: 2};
    const blink = {duration: 0.5, frameNameQuery: 'blink.*'};

    expect(cmpAnimationsData({walk, idle, blink}, {idle, walk, blink})).toBe(false);
    expect(cmpAnimationsData({walk: {duration: 1, tileIds: [1]}}, {walk: {tileIds: [1], duration: 1}})).toBe(false);
  });

  test('undefined is different from an empty map', () => {
    expect(cmpAnimationsData(undefined, {})).toBe(false);
    expect(cmpAnimationsData({}, undefined)).toBe(false);
  });

  test('a field that is undefined is different from one that is missing', () => {
    expect(
      cmpAnimationsData({walk: {duration: 1, tileIds: [1], frameRate: undefined}}, {walk: {duration: 1, tileIds: [1]}}),
    ).toBe(false);
  });

  test('a RegExp equals one of the same source and flags, and nothing else', () => {
    const blink = (frameNameQuery: string) => ({blink: {duration: 1, frameNameQuery}});

    expect(cmpAnimationsData(blink(query('^blink', 'i')), blink(query('^blink', 'i')))).toBe(true);
    expect(cmpAnimationsData(blink(query('^blink', 'i')), blink(query('^blink', 'iu')))).toBe(false);
    expect(cmpAnimationsData(blink(query('^blink', 'i')), blink(query('^blinks', 'i')))).toBe(false);
    expect(cmpAnimationsData(blink('^blink'), blink(query('^blink')))).toBe(false);
    expect(cmpAnimationsData(blink(query('^blink')), blink('^blink'))).toBe(false);
  });

  test('arrays are compared by length and element for element', () => {
    const walk = (tileIds: number[]) => ({walk: {duration: 1, tileIds}});

    expect(cmpAnimationsData(walk([1, 2]), walk([1, 2]))).toBe(true);
    expect(cmpAnimationsData(walk([1, 2]), walk([1, 2, 3]))).toBe(false);
    expect(cmpAnimationsData(walk([1, 2]), walk([1, 3]))).toBe(false);
    expect(cmpAnimationsData(walk([1, 2]), {walk: {duration: 1, tileIds: {0: 1, 1: 2} as unknown as number[]}})).toBe(false);
  });

  test('NaN equals NaN', () => {
    expect(cmpAnimationsData({walk: {duration: Number.NaN, tileIds: [1]}}, {walk: {duration: Number.NaN, tileIds: [1]}})).toBe(
      true,
    );
  });

  test('a number changed deep inside is different', () => {
    const changed = animations();
    (changed['walk'] as {tileIds: number[]}).tileIds[2] = 4;

    expect(cmpAnimationsData(animations(), changed)).toBe(false);
  });

  test('an object made by a class is different from a plain one with the same fields', () => {
    class Timing {
      duration = 1;
      tileIds = [1];
    }

    expect(cmpAnimationsData({walk: new Timing()}, {walk: {duration: 1, tileIds: [1]}})).toBe(false);
  });

  test('a cycle in both graphs ends the comparison', () => {
    const cyclic = () => {
      const entry: Record<string, unknown> = {duration: 1, tileIds: [1]};
      entry['self'] = entry;
      return {walk: entry} as unknown as FrameBasedAnimationsDataMap;
    };

    expect(cmpAnimationsData(cyclic(), cyclic())).toBe(true);

    const other = cyclic();
    (other['walk'] as {duration: number}).duration = 2;
    expect(cmpAnimationsData(cyclic(), other)).toBe(false);
  });

  test('cycles of different periods end the comparison', () => {
    const once = () => {
      const entry: Record<string, unknown> = {duration: 1, tileIds: [1]};
      entry['self'] = entry;
      return {walk: entry} as unknown as FrameBasedAnimationsDataMap;
    };
    const twice = (secondDuration: number) => {
      const first: Record<string, unknown> = {duration: 1, tileIds: [1]};
      const second: Record<string, unknown> = {duration: secondDuration, tileIds: [1]};
      first['self'] = second;
      second['self'] = first;
      return {walk: first} as unknown as FrameBasedAnimationsDataMap;
    };

    expect(cmpAnimationsData(once(), twice(1))).toBe(true);
    expect(cmpAnimationsData(twice(1), once())).toBe(true);
    expect(cmpAnimationsData(once(), twice(2))).toBe(false);
  });
});

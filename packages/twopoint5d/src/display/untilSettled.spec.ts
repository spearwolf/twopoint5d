import {describe, expect, test} from 'vitest';

import {untilSettled} from './untilSettled.js';

describe('untilSettled()', () => {
  test('answers true while the motion runs', () => {
    const settled = untilSettled();

    expect(settled(true)).toBe(true);
    expect(settled(true)).toBe(true);
  });

  test('answers true once more in the frame the motion comes to rest', () => {
    const settled = untilSettled();
    settled(true);

    expect(settled(false), 'the frame of the end pose').toBe(true);
    expect(settled(false), 'the frame after it').toBe(false);
    expect(settled(false)).toBe(false);
  });

  test('answers false before the first motion', () => {
    const settled = untilSettled();

    expect(settled(false)).toBe(false);
    expect(settled(false)).toBe(false);
  });

  test('a second motion starts over', () => {
    const settled = untilSettled();
    settled(true);
    settled(false);
    settled(false);

    expect(settled(true)).toBe(true);
    expect(settled(false)).toBe(true);
    expect(settled(false)).toBe(false);
  });

  test('two functions share no memory', () => {
    const camera = untilSettled();
    const door = untilSettled();
    camera(true);

    expect(door(false), 'the door never moved').toBe(false);
    expect(camera(false), 'the camera comes to rest').toBe(true);
  });
});

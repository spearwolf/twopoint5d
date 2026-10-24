import {describe, expect, test} from 'vitest';
import {writeFrameTexels, writeTableEntryTexels} from './frameTexels.js';
import type {FrameTrimMargins} from './frameTrimMargins.js';
import {TextureCoords} from './TextureCoords.js';

const UNTOUCHED = -7;

const turnedFrame = (): TextureCoords => {
  const root = new TextureCoords(0, 0, 64, 32);
  const coords = new TextureCoords(root, 16, 8, 16, 8);
  coords.flip = TextureCoords.FLIP_DIAGONAL;
  return coords;
};

const margins: FrameTrimMargins = [0.125, 0.25, 0.375, 0.5];

describe('writeFrameTexels()', () => {
  test.each([
    [1, 4],
    [2, 8],
    [3, 12],
  ] as const)('with %i texels it writes %i values from the offset and leaves the rest of the target alone', (texels, written) => {
    const coords = turnedFrame();
    const target = new Float32Array(20).fill(UNTOUCHED);

    writeFrameTexels(target, 4, coords, texels, margins, 1.5);

    const expected = [...coords.getTexCoords(), coords.width, coords.height, 1, 1.5, ...margins].slice(0, written);
    expect(Array.from(target.subarray(4, 4 + written))).toEqual(Array.from(new Float32Array(expected)));
    expect(Array.from(target.subarray(0, 4))).toEqual([UNTOUCHED, UNTOUCHED, UNTOUCHED, UNTOUCHED]);
    expect(Array.from(target.subarray(4 + written)).every((value) => value === UNTOUCHED)).toBe(true);
  });

  test('a frame without FLIP_DIAGONAL writes 0 as its flipDiagonal', () => {
    const target = new Float64Array(8);

    writeFrameTexels(target, 0, new TextureCoords(0, 0, 8, 4), 2, margins, 0);

    expect(Array.from(target.subarray(4))).toEqual([8, 4, 0, 0]);
  });
});

describe('writeTableEntryTexels()', () => {
  test('bare TextureCoords are written with four zeros as their margins and an end time of 0', () => {
    const coords = turnedFrame();
    const target = new Float64Array(16).fill(UNTOUCHED);

    writeTableEntryTexels(target, 4, coords);

    expect(Array.from(target.subarray(4, 16))).toEqual([...coords.getTexCoords(), 16, 8, 1, 0, 0, 0, 0, 0]);
    expect(Array.from(target.subarray(0, 4))).toEqual([UNTOUCHED, UNTOUCHED, UNTOUCHED, UNTOUCHED]);
  });

  test('a frame of an atlas is written with the trim margins of its data', () => {
    const coords = new TextureCoords(0, 0, 8, 8);
    const target = new Float64Array(12);

    writeTableEntryTexels(target, 0, {
      coords,
      data: {spriteSourceSize: {x: 1, y: 2, w: 4, h: 4}, sourceSize: {w: 8, h: 8}},
    });

    expect(Array.from(target.subarray(8))).toEqual([1 / 8, 2 / 8, 3 / 8, 2 / 8]);
  });
});

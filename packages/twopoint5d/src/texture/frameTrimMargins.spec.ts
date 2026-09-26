import {describe, expect, test} from 'vitest';

import {frameTrimMargins, type FrameTrimMargins} from './frameTrimMargins.js';
import type {TextureAtlasFrameData} from './TextureAtlas.js';

describe('frameTrimMargins()', () => {
  test('answers the margins of a sprite of 5 × 4 trimmed to 2 × 1 at (1, 2) as fractions of its width and height', () => {
    const margins = frameTrimMargins({trimmed: true, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}});

    expect(margins).toEqual([0.2, 0.5, 0.4, 0.25]);
  });

  test('answers four zeros for an untrimmed TexturePacker frame, whose first rectangle fills the second', () => {
    const margins = frameTrimMargins({trimmed: false, spriteSourceSize: {x: 0, y: 0, w: 5, h: 4}, sourceSize: {w: 5, h: 4}});

    expect(margins).toEqual([0, 0, 0, 0]);
  });

  test.each<[string, TextureAtlasFrameData | undefined]>([
    ['no data', undefined],
    ['no spriteSourceSize', {sourceSize: {w: 5, h: 4}}],
    ['no sourceSize', {spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}}],
    ['a sourceSize of width 0', {spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 0, h: 4}}],
    ['a NaN among the numbers', {spriteSourceSize: {x: NaN, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}}],
    ['a string for a number', {spriteSourceSize: {x: 1, y: '2', w: 2, h: 1}, sourceSize: {w: 5, h: 4}}],
  ])('answers four zeros for %s', (_, data) => {
    expect(frameTrimMargins(data)).toEqual([0, 0, 0, 0]);
  });

  test('reads the margins off the two rectangles, not off the trimmed flag', () => {
    const margins = frameTrimMargins({trimmed: false, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}});

    expect(margins).toEqual([0.2, 0.5, 0.4, 0.25]);
  });

  test('writes into the target it is given and answers that very array', () => {
    const target: FrameTrimMargins = [9, 9, 9, 9];

    const margins = frameTrimMargins({spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}}, target);

    expect(margins).toBe(target);
    expect(target).toEqual([0.2, 0.5, 0.4, 0.25]);

    // four zeros overwrite what an earlier call left in it
    frameTrimMargins(undefined, target);
    expect(target).toEqual([0, 0, 0, 0]);
  });
});

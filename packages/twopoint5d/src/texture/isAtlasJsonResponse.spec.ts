import {describe, expect, test} from 'vitest';
import {isAtlasJsonResponse} from './isAtlasJsonResponse.js';

const frames = {a: {frame: {x: 0, y: 0, w: 8, h: 8}}};
const size = {w: 16, h: 16};

describe('isAtlasJsonResponse', () => {
  test('a json with frames and a meta that names an image and a size passes', () => {
    expect(isAtlasJsonResponse({frames, meta: {image: 'a.png', size}})).toBe(true);
  });

  test('a json whose meta names no image passes', () => {
    expect(isAtlasJsonResponse({frames, meta: {size}})).toBe(true);
  });

  test('a JSON Array whose entries carry a filename passes', () => {
    expect(isAtlasJsonResponse({frames: [{filename: 'a.png', frame: {x: 0, y: 0, w: 8, h: 8}}], meta: {size}})).toBe(true);
  });

  test('a frame with rotated true passes', () => {
    expect(isAtlasJsonResponse({frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}, rotated: true}}, meta: {size}})).toBe(true);
  });

  test.each([
    ['null', null],
    ['a JSON Array entry without a filename', {frames: [{frame: {x: 0, y: 0, w: 8, h: 8}}], meta: {size}}],
    ['a JSON Array entry whose filename is a number', {frames: [{filename: 5, frame: {x: 0, y: 0, w: 8, h: 8}}], meta: {size}}],
    ['a frame whose rotated is a string', {frames: {a: {frame: {x: 0, y: 0, w: 8, h: 8}, rotated: 'true'}}, meta: {size}}],
    ['a string', 'atlas'],
    ['a json without frames', {meta: {size}}],
    ['frames that are null', {frames: null, meta: {size}}],
    ['a frame entry that is a number', {frames: {a: 5}, meta: {size}}],
    ['a frame entry without a frame', {frames: {a: {}}, meta: {size}}],
    ['a frame with an x that is a string', {frames: {a: {frame: {x: '0', y: 0, w: 8, h: 8}}}, meta: {size}}],
    ['a frame without an h', {frames: {a: {frame: {x: 0, y: 0, w: 8}}}, meta: {size}}],
    ['a json without a meta', {frames}],
    ['a meta without a size', {frames, meta: {}}],
    ['a size without an h', {frames, meta: {size: {w: 16}}}],
    ['a size with a w that is a string', {frames, meta: {size: {w: '16', h: 16}}}],
  ])('%s is refused', (_name, value) => {
    expect(isAtlasJsonResponse(value)).toBe(false);
  });
});

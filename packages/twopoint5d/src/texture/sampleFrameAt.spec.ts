import {float, texture, uniform, vec2, vec4} from 'three/tsl';
import {type Node, Texture, type TextureNode, Vector2} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {evaluateNode, nodesOf, operatorOf} from '../testing/spriteGraph.js';
import {type FrameToSample, sampleFrameAt} from './sampleFrameAt.js';

const vec4Of = (...values: [number, number, number, number]) => vec4(...values) as unknown as Node<'vec4'>;

// a frame of 8 × 4 texels at (2, 0) of a texture 16 × 4 large: s, t, u, v
const frame = (flip: 0 | 1 = 0): FrameToSample => ({
  texCoords: vec4Of(2 / 16, 0, 8 / 16, 1),
  flipDiagonal: float(flip) as unknown as Node<'float'>,
  margins: vec4Of(0.25, 0, 0.25, 0),
  drawnTexels: vec2(8, 4) as unknown as Node<'vec2'>,
});

/** A lookup that records what it is handed and answers a sample of a fresh texture. */
const recording = () => {
  const calls: {st: Node<'vec2'>; gradX: Node<'vec2'>; gradY: Node<'vec2'>}[] = [];
  const lookup = (st: Node<'vec2'>, gradX: Node<'vec2'>, gradY: Node<'vec2'>) => {
    calls.push({st, gradX, gradY});
    return texture(new Texture(), st) as unknown as Node<'vec4'>;
  };
  return {calls, lookup};
};

// the position as a uniform, so that evaluateNode() can work out the st the lookup is handed
const at = (x: number, y: number) => uniform(new Vector2(x, y)) as unknown as Node<'vec2'>;

describe('sampleFrameAt()', () => {
  test('hands the lookup the tex coords of the position, once, and answers its sample for trim stretch', () => {
    const {calls, lookup} = recording();

    const color = sampleFrameAt(lookup, frame(), at(0.5, 0.25), {wrap: ['clamp', 'clamp'], trim: 'stretch', inset: 0});

    expect(calls).toHaveLength(1);
    expect(evaluateNode(calls[0]!.st)).toEqual([2 / 16 + 0.5 * (8 / 16), 0.25]);
    expect((color as unknown as TextureNode).isTextureNode).toBe(true);
  });

  test('repeats along an axis that wraps by repeat and holds the other at its edge', () => {
    const {calls, lookup} = recording();

    sampleFrameAt(lookup, frame(), at(2.25, 1.5), {wrap: ['repeat', 'clamp'], trim: 'stretch', inset: 0});

    // fract() is no node evaluateNode() knows: the graph holds it, and the clamp holds v at 1
    const st = calls[0]!.st;
    expect([...nodesOf(st)].some((node) => (node as unknown as {method?: string}).method === 'fract')).toBe(true);
  });

  test('swaps the two components of the lookup and of the gradients for a frame with the diagonal flip', () => {
    const {calls, lookup} = recording();

    sampleFrameAt(lookup, frame(1), at(0.5, 0.25), {wrap: ['clamp', 'clamp'], trim: 'stretch', inset: 0});

    expect(evaluateNode(calls[0]!.st)).toEqual([0.25, 2 / 16 + 0.5 * (8 / 16)]);
    expect(calls[0]!.gradX).not.toBe(calls[0]!.gradY);
  });

  test('keeps the lookup inset texels of the frame as drawn away from its edges', () => {
    const {calls, lookup} = recording();

    sampleFrameAt(lookup, frame(), at(0, 1), {wrap: ['clamp', 'clamp'], trim: 'stretch', inset: 0.5});

    // half a texel of 8 across and of 4 down
    const [s, t] = evaluateNode(calls[0]!.st) as number[];
    expect(s).toBeCloseTo(2 / 16 + (0.5 / 8) * (8 / 16), 6);
    expect(t).toBeCloseTo(1 - 0.5 / 4, 6);
  });

  test('multiplies the sample by the covered part of the trimmed area for trim mask', () => {
    const {lookup} = recording();

    const color = sampleFrameAt(lookup, frame(), at(0.5, 0.5), {wrap: ['clamp', 'clamp'], trim: 'mask', inset: 0});

    expect(operatorOf(color).op).toBe('*');
  });

  test('maps the position into the trimmed area for trim mask', () => {
    const {calls, lookup} = recording();

    sampleFrameAt(lookup, frame(), at(0.5, 0.5), {wrap: ['clamp', 'clamp'], trim: 'mask', inset: 0});

    // the margins are a quarter left and right: the middle of the sprite is the middle of the frame
    expect(evaluateNode(calls[0]!.st)).toEqual([2 / 16 + 0.5 * (8 / 16), 0.5]);
  });
});

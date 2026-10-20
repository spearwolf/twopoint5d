import {add, attribute, float, sub, vec2} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {graphSignature} from './spriteGraph.js';

const graph = (op: typeof add, name = 'uv', constant = 1) =>
  op(attribute(name), vec2(float(constant), float(2))) as unknown as Node;

describe('graphSignature()', () => {
  test('is the same for two graphs built alike from other objects', () => {
    expect(graphSignature(graph(add))).toBe(graphSignature(graph(add)));
  });

  test('tells an operator, an attribute name and a constant apart', () => {
    const base = graphSignature(graph(add));

    expect(graphSignature(graph(sub))).not.toBe(base);
    expect(graphSignature(graph(add, 'position'))).not.toBe(base);
    expect(graphSignature(graph(add, 'uv', 3))).not.toBe(base);
  });

  test('numbers a node read twice once, so that sharing shows', () => {
    const uv = attribute('uv');
    const shared = add(uv, uv) as unknown as Node;
    const separate = add(attribute('uv'), attribute('uv')) as unknown as Node;

    expect(graphSignature(shared)).not.toBe(graphSignature(separate));
  });
});

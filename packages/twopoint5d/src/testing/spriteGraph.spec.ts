import {add, attribute, float, round, sub, uniform, vec2} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {evaluateNode, graphSignature} from './spriteGraph.js';

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
    const uv = attribute<'vec2'>('uv') as unknown as Node<'vec2'>;
    const shared = add(uv, uv) as unknown as Node;
    const separate = add(
      attribute<'vec2'>('uv') as unknown as Node<'vec2'>,
      attribute<'vec2'>('uv') as unknown as Node<'vec2'>,
    ) as unknown as Node;

    expect(graphSignature(shared)).not.toBe(graphSignature(separate));
  });
});

describe('evaluateNode()', () => {
  test('works out a node read twice once', () => {
    const leaf = uniform(1);
    let reads = 0;
    // on the node itself: a count behind a proxy would miss the reads that go around it
    Object.defineProperty(leaf, 'value', {
      configurable: true,
      get: () => {
        reads++;
        return 1;
      },
    });

    let chain = leaf as unknown as Node<'float'>;
    for (let i = 0; i < 16; i++) chain = add(chain, chain) as unknown as Node<'float'>;

    expect(evaluateNode(chain as unknown as Node)).toBe(2 ** 16);
    expect(reads).toBe(1);
  });

  test("rounds halves to the even neighbour, as WGSL's round does", () => {
    const cases: [number, number][] = [
      [2.5, 2],
      [-2.5, -2],
      [3.5, 4],
      [-3.5, -4],
      [0.5, 0],
      [1.4, 1],
      [1.6, 2],
    ];
    for (const [input, expected] of cases) {
      expect(evaluateNode(round(float(input)) as unknown as Node)).toBe(expected);
    }
    expect(evaluateNode(round(vec2(0.5, 1.5)) as unknown as Node)).toEqual([0, 2]);
  });
});

import {add, attribute, float, floor, mod, round, sub, texture, uniform, vec2} from 'three/tsl';
import {type Node, Texture} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {attributeNameOf, evaluateNode, graphSignature, operatorOf, textureBasesOf, unwrap} from './spriteGraph.js';

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

  test("'%' floors as WGSL's tsl_mod_float does: mod(-1, 4) is 3", () => {
    expect(evaluateNode(mod(float(-1), float(4)) as unknown as Node)).toBe(3);
    expect(evaluateNode(mod(float(5.5), float(4)) as unknown as Node)).toBe(1.5);
    // x − y · floor(x / y): x / y underflows to −0, and the remainder stays the tiny negative x
    expect(evaluateNode(mod(uniform(-Number.MIN_VALUE), float(4)) as unknown as Node)).toBe(-Number.MIN_VALUE);
  });

  test('floor takes a value down to the whole number below it', () => {
    expect(evaluateNode(floor(float(-1.5)) as unknown as Node)).toBe(-2);
    expect(evaluateNode(floor(vec2(2.7, -0.2)) as unknown as Node)).toEqual([2, -1]);
  });

  test('toUint() takes a negative value to 0, as WGSL u32() does', () => {
    expect(evaluateNode(uniform(-1.5).toUint() as unknown as Node)).toBe(0);
  });

  test('toInt() cuts towards zero as WGSL i32() does, and toFloat() hands the value on', () => {
    expect(evaluateNode(uniform(-1.5).toInt() as unknown as Node)).toBe(-1);
    expect(evaluateNode(uniform(2.7).toInt() as unknown as Node)).toBe(2);
    expect(evaluateNode(uniform(2.7).toUint() as unknown as Node)).toBe(2);
    expect(evaluateNode(uniform(2.7).toFloat() as unknown as Node)).toBe(2.7);
  });
});

describe('unwrap() and operatorOf()', () => {
  test('give the node a VarNode holds, and any other node itself', () => {
    const sum = add(float(1), float(2)) as unknown as Node;
    const held = add(float(1), float(2)).toVar() as unknown as Node;

    expect(unwrap(sum)).toBe(sum);
    expect(unwrap(held)).not.toBe(held);
    expect(unwrap(held).type).toBe('OperatorNode');
    expect(operatorOf(held).op).toBe('+');
    expect(operatorOf(sum)).toBe(sum);
  });
});

describe('attributeNameOf()', () => {
  test('answers the name of an attribute node without a builder', () => {
    expect(attributeNameOf(attribute('uv') as unknown as Node)).toBe('uv');
  });
});

describe('textureBasesOf()', () => {
  test('answers the base of every texture node once, a sample of one counted as its base', () => {
    const base = texture(new Texture());
    const other = texture(new Texture());
    const graph = add(add(base.sample(vec2(0.5, 0.5)), base), other) as unknown as Node;
    const bases = textureBasesOf(graph);

    expect([bases.size, bases.has(base), bases.has(other)]).toEqual([2, true, true]);
    expect(textureBasesOf(float(1) as unknown as Node).size).toBe(0);
  });
});

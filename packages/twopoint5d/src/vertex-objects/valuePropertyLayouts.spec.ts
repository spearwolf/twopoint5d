import {describe, expect, test} from 'vitest';

import type {VertexObjectDescription} from './types.js';
import {valuePropertyLayouts} from './valuePropertyLayouts.js';
import {VertexObjectPool} from './VertexObjectPool.js';

// every value property of the description reads, through its getter, what its layout names
function expectLayoutsMatchGetters(description: VertexObjectDescription, expectedNames: string[]): void {
  const pool = new VertexObjectPool<Record<string, number>>(description, 3);
  pool.createVO();
  const vo = pool.createVO()!;
  pool.createVO();

  const layouts = valuePropertyLayouts(pool.buffer);
  expect([...layouts.keys()].sort()).toEqual([...expectedNames].sort());

  // distinct values everywhere, so that a layout one element off reads another value
  for (const record of pool.buffer.bufferList) {
    record.typedArray!.forEach((_, i, array) => {
      array[i] = (i % 120) + 1;
    });
  }
  for (const [name, {bufferIndex, stride, offset}] of layouts) {
    const array = pool.buffer.bufferList[bufferIndex]!.typedArray!;
    expect(array[1 * stride + offset], name).toBe(vo[name]);
  }
  pool.dispose();
}

describe('valuePropertyLayouts()', () => {
  test('the components and the attribute of one value on a single vertex', () => {
    expectLayoutsMatchGetters(
      {
        attributes: {
          position: {components: ['x', 'y', 'z'], usage: 'dynamic'},
          color: {components: ['r', 'g', 'b', 'a']},
          rotation: {size: 1, usage: 'dynamic'},
          uv: {size: 2},
        },
      },
      ['x', 'y', 'z', 'r', 'g', 'b', 'a', 'rotation'],
    );
  });

  test('the components of each vertex on several vertices, and no attribute of one value', () => {
    expectLayoutsMatchGetters({vertexCount: 2, attributes: {position: {components: ['x', 'y']}, weight: {size: 1}}}, [
      'x0',
      'x1',
      'y0',
      'y1',
    ]);
  });

  test('interleaved and padded buffers of narrow types', () => {
    expectLayoutsMatchGetters(
      {
        attributes: {
          tint: {components: ['r', 'g', 'b'], type: 'uint8', normalized: true, bufferName: 'packed'},
          level: {components: ['level', 'layer'], type: 'uint8', normalized: true, bufferName: 'packed'},
          offset: {components: ['dx', 'dy', 'dz'], type: 'int16'},
          half: {components: ['h0', 'h1'], type: 'float16'},
        },
      },
      ['r', 'g', 'b', 'level', 'layer', 'dx', 'dy', 'dz', 'h0', 'h1'],
    );
  });

  test('a single component named as its attribute is the attribute itself', () => {
    expectLayoutsMatchGetters({attributes: {depth: {components: ['depth']}}}, ['depth']);
  });

  test('the methods and the base prototype have no value property', () => {
    const description: VertexObjectDescription = {
      attributes: {position: {components: ['x', 'y']}},
      methods: {length() {}},
      basePrototype: {
        get size() {
          return 1;
        },
      },
    };
    const pool = new VertexObjectPool(description, 1);
    expect([...valuePropertyLayouts(pool.buffer).keys()]).toEqual(['x', 'y']);
    pool.dispose();
  });
});

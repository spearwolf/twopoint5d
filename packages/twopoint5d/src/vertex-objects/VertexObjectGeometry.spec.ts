import {describe, expect, test} from 'vitest';

import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';
import {VertexObjectPool} from './VertexObjectPool.js';
import type {VO} from './types.js';

describe('VertexObjectGeometry', () => {
  const descriptor = new VertexObjectDescriptor({
    vertexCount: 4,
    indices: [0, 1, 2, 0, 2, 3],

    attributes: {
      position: {
        components: ['x', 'y', 'z'],
        type: 'float32',
        usage: 'dynamic',
      },
      color: {
        components: ['r', 'g', 'b'],
        type: 'float32',
        usage: 'dynamic',
      },
      strength: {
        size: 1,
        type: 'float32',
        usage: 'static',
      },
      impact: {
        size: 1,
        type: 'uint32',
        usage: 'dynamic',
      },
    },
  });

  test('construct with descriptor', () => {
    const geometry = new VertexObjectGeometry(descriptor, 10);

    expect(geometry).toBeDefined();
    expect(geometry.buffers).toBeDefined();

    expect(geometry.buffers.get('dynamic_float32')!.array).toBe(geometry.pool.buffer.buffers.get('dynamic_float32')!.typedArray);
    expect(geometry.buffers.get('static_float32')!.array).toBe(geometry.pool.buffer.buffers.get('static_float32')!.typedArray);
    expect(geometry.buffers.get('dynamic_uint32')!.array).toBe(geometry.pool.buffer.buffers.get('dynamic_uint32')!.typedArray);
  });

  test('index array buffer is created', () => {
    const capacity = 10;
    const geometry = new VertexObjectGeometry(descriptor, capacity);

    expect(geometry.index).toBeDefined();
    expect(geometry.index!.array.length).toBe(descriptor.indices.length * capacity);

    // prettier-ignore
    expect(Array.from(geometry.index!.array).slice(0, descriptor.indices.length * 3)).toEqual([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
    ]);
  });

  test('a description whose indices leave a vertex unused draws every object from its own vertices', () => {
    const geometry = new VertexObjectGeometry(
      {vertexCount: 4, indices: [0, 1, 2], attributes: {position: {components: ['x', 'y', 'z']}}},
      2,
    );

    expect(Array.from(geometry.index!.array)).toEqual([0, 1, 2, 4, 5, 6]);
  });

  test('touch() marks the buffers behind every argument for the next update(), each argument on its own', () => {
    const geometry = new VertexObjectGeometry(descriptor, 10);
    geometry.pool.createVO();
    geometry.update();

    // `strength` is the one static attribute here, and the only buffer that uploads on nothing but a touch
    const staticBuffer = geometry.buffers.get('static_float32')!;
    const settled = staticBuffer.version;

    geometry.update();
    expect(staticBuffer.version, 'nothing touched').toBe(settled);

    geometry.touch('strength');
    expect(staticBuffer.version, 'not before update()').toBe(settled);
    geometry.update();
    expect(staticBuffer.version, 'by attribute name').toBeGreaterThan(settled);

    const byName = staticBuffer.version;
    geometry.touch({static: true}, {static: false});
    geometry.update();
    expect(staticBuffer.version, 'a later {static: false} leaves an earlier {static: true} standing').toBeGreaterThan(byName);

    const byUsage = staticBuffer.version;
    geometry.touch('position', {dynamic: true});
    geometry.update();
    expect(staticBuffer.version, 'names and usage types that do not reach it').toBe(byUsage);
  });

  describe('a pool that has been disposed', () => {
    test('the constructor refuses it', () => {
      const pool = new VertexObjectPool<VO>(descriptor, 10);
      pool.dispose();

      const build = () => new VertexObjectGeometry(pool, 10);
      expect(build, 'the message names the class').toThrow(/VOBufferGeometry/);
      expect(build, 'the message names the state').toThrow(/disposed/);
    });
  });
});

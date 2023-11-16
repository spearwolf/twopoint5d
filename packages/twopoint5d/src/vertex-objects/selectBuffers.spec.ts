import {describe, expect, test} from 'vitest';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';
import {selectBuffers} from './selectBuffers.js';

describe('selectBuffers', () => {
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

  test('works as axpected', () => {
    const geometry = new VertexObjectGeometry(descriptor, 1);

    geometry.update();

    expect(selectBuffers(geometry.buffers, {dynamic: true})).toEqual(
      expect.arrayContaining([geometry.buffers.get('dynamic_float32'), geometry.buffers.get('dynamic_uint32')]),
    );
    expect(selectBuffers(geometry.buffers, {dynamic: true})).not.toEqual(
      expect.arrayContaining([geometry.buffers.get('static_float32')]),
    );

    expect(selectBuffers(geometry.buffers, {static: true})).toMatchObject([geometry.buffers.get('static_float32')]);

    expect(selectBuffers(geometry.buffers, {stream: true})).toEqual([]);
    expect(selectBuffers(geometry.buffers, {})).toEqual([]);
    expect(selectBuffers(geometry.buffers, {dynamic: false})).toEqual([]);

    expect(
      selectBuffers(geometry.buffers, {
        dynamic: true,
        static: true,
        stream: true,
      }),
    ).toEqual(
      expect.arrayContaining([
        geometry.buffers.get('dynamic_float32'),
        geometry.buffers.get('dynamic_uint32'),
        geometry.buffers.get('static_float32'),
      ]),
    );
  });
});

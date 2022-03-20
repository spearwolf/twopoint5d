import {VertexObjectDescriptor} from './VertexObjectDescriptor';
import {VertexObjectGeometry} from './VertexObjectGeometry';
import {selectAttributes} from './selectAttributes';

describe('selectAttributes', () => {
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

    expect(selectAttributes(geometry.pool, geometry.buffers, ['position', 'color'])).toMatchObject([
      geometry.buffers.get('dynamic_float32'),
    ]);

    expect(selectAttributes(geometry.pool, geometry.buffers, ['strength'])).toMatchObject([
      geometry.buffers.get('static_float32'),
    ]);

    expect(selectAttributes(geometry.pool, geometry.buffers, ['impact'])).toMatchObject([geometry.buffers.get('dynamic_uint32')]);

    expect(selectAttributes(geometry.pool, geometry.buffers, [])).toEqual([]);

    expect(selectAttributes(geometry.pool, geometry.buffers, ['position', 'impact'])).toEqual(
      expect.arrayContaining([geometry.buffers.get('dynamic_float32'), geometry.buffers.get('dynamic_uint32')]),
    );
    expect(selectAttributes(geometry.pool, geometry.buffers, ['position', 'impact'])).not.toEqual(
      expect.arrayContaining([geometry.buffers.get('static_float32')]),
    );
  });
});

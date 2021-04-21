import {VertexObjectBuffer} from './VertexObjectBuffer';
import {VertexObjectDescriptor} from './VertexObjectDescriptor';

describe('VertexObjectBuffer', () => {
  test('construct works', () => {
    const descriptor = new VertexObjectDescriptor({
      vertexCount: 4,
      indices: [0, 1, 2, 0, 2, 3],

      attributes: {
        foo: {
          components: ['x', 'y'],
          type: 'float32',
          usage: 'dynamic',
        },
        bar: {
          size: 1,
          type: 'float32',
          usage: 'static',
        },
        plah: {
          components: ['a', 'b', 'c'],
          type: 'float32',
          usage: 'static',
        },
        zack: {
          components: ['zick'],
          type: 'float32',
          usage: 'static',
        },
      },
    });
    const vob = new VertexObjectBuffer(descriptor);

    expect(vob).toBeDefined();
    expect(vob.descriptor).toBe(descriptor);
    expect(vob.attributeNames).toEqual(['bar', 'foo', 'plah', 'zack']);
    expect(vob.buffers.get('static_float32')).toEqual({
      bufferName: 'static_float32',
      itemSize: 5,
      dataType: 'float32',
      usageType: 'static',
    });
    expect(vob.buffers.get('dynamic_float32')).toEqual({
      bufferName: 'dynamic_float32',
      itemSize: 2,
      dataType: 'float32',
      usageType: 'dynamic',
    });
    expect(vob.bufferAttributes.get('foo')).toEqual({
      attributeName: 'foo',
      bufferName: 'dynamic_float32',
      offset: 0,
    });
    expect(vob.bufferAttributes.get('bar')).toEqual({
      attributeName: 'bar',
      bufferName: 'static_float32',
      offset: 0,
    });
    expect(vob.bufferAttributes.get('plah')).toEqual({
      attributeName: 'plah',
      bufferName: 'static_float32',
      offset: 1,
    });
    expect(vob.bufferAttributes.get('zack')).toEqual({
      attributeName: 'zack',
      bufferName: 'static_float32',
      offset: 4,
    });
  });
});

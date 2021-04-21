import {VertexAttributeDescriptor} from './VertexAttributeDescriptor';

describe('VertexAttributeDescriptor', () => {
  test('construct with components', () => {
    const descriptor = new VertexAttributeDescriptor('foo', {
      components: ['x', 'y', 'z'],
      type: 'float32',
      usage: 'dynamic',
    });
    expect(descriptor).toBeDefined();
    expect(descriptor.name).toBe('foo');
    expect(descriptor.size).toBe(3);
    expect(descriptor.hasComponents).toBeTruthy();
    expect(descriptor.components).toEqual(['x', 'y', 'z']);
    expect(descriptor.dataType).toBe('float32');
    expect(descriptor.usageType).toBe('dynamic');
    expect(descriptor.bufferName).toBe('dynamic_float32');
  });

  test('construct with size', () => {
    const descriptor = new VertexAttributeDescriptor('bar', {
      size: 2,
      type: 'float64',
      usage: 'static',
    });
    expect(descriptor).toBeDefined();
    expect(descriptor.name).toBe('bar');
    expect(descriptor.size).toBe(2);
    expect(descriptor.hasComponents).toBeFalsy();
    expect(descriptor.components).toEqual([]);
    expect(descriptor.dataType).toBe('float64');
    expect(descriptor.usageType).toBe('static');
    expect(descriptor.bufferName).toBe('static_float64');
  });
});

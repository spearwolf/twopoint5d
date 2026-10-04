import {describe, expect, test} from 'vitest';
import {VertexAttributeDescriptor} from './VertexAttributeDescriptor.js';

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
    expect(descriptor.normalizedData).toBe(false);
    expect(descriptor.usageType).toBe('dynamic');
    expect(descriptor.bufferName).toBe('dynamic_float32');
    expect(descriptor.getterName).toBe('getFoo');
    expect(descriptor.setterName).toBe('setFoo');
  });

  test('construct with getter and setter', () => {
    const descriptor = new VertexAttributeDescriptor('foo', {
      size: 3,
      getter: 'getCoords',
      setter: 'setCoords',
    });
    expect(descriptor).toBeDefined();
    expect(descriptor.name).toBe('foo');
    expect(descriptor.getterName).toBe('getCoords');
    expect(descriptor.setterName).toBe('setCoords');
  });

  test('construct without getter and setter', () => {
    const descriptor = new VertexAttributeDescriptor('foo', {
      components: ['x', 'y', 'z'],
      getter: undefined,
      setter: false,
    });
    expect(descriptor).toBeDefined();
    expect(descriptor.name).toBe('foo');
    expect(descriptor.getterName).toBe(undefined);
    expect(descriptor.setterName).toBe(undefined);
  });

  test('construct with size', () => {
    const descriptor = new VertexAttributeDescriptor('bar', {
      size: 2,
      type: 'uint16',
      normalized: true,
      usage: 'static',
    });
    expect(descriptor).toBeDefined();
    expect(descriptor.name).toBe('bar');
    expect(descriptor.size).toBe(2);
    expect(descriptor.hasComponents).toBeFalsy();
    expect(descriptor.components).toEqual([]);
    expect(descriptor.dataType).toBe('uint16');
    expect(descriptor.normalizedData).toBe(true);
    expect(descriptor.usageType).toBe('static');
    expect(descriptor.bufferName).toBe('static_uint16N');
  });

  test('default dataType is float32', () => {
    const descriptor = new VertexAttributeDescriptor('bar', {
      size: 1,
    });
    expect(descriptor.dataType).toBe('float32');
  });

  test('an 8- or 16-bit integer of one value without normalized is laid out as a 32-bit integer', () => {
    const layoutOf = (type: 'int8' | 'int16' | 'uint8' | 'uint16') =>
      new VertexAttributeDescriptor('a', {size: 1, type}).dataType;

    expect(layoutOf('int8')).toBe('int32');
    expect(layoutOf('int16')).toBe('int32');
    expect(layoutOf('uint8')).toBe('uint32');
    expect(layoutOf('uint16')).toBe('uint32');
    expect(new VertexAttributeDescriptor('a', {components: ['x'], type: 'int16'}).dataType).toBe('int32');
    expect(new VertexAttributeDescriptor('a', {size: 1, type: 'uint16'}).bufferName).toBe('static_uint32');
  });

  test('an 8- or 16-bit integer of two values or more, or with normalized, keeps its type', () => {
    expect(new VertexAttributeDescriptor('a', {size: 2, type: 'int16'}).dataType).toBe('int16');
    expect(new VertexAttributeDescriptor('a', {size: 4, type: 'uint8'}).dataType).toBe('uint8');
    expect(new VertexAttributeDescriptor('a', {size: 2, type: 'uint8', normalized: true}).dataType).toBe('uint8');
  });

  test('default usageType is static', () => {
    const descriptor = new VertexAttributeDescriptor('foo', {
      size: 1,
    });
    expect(descriptor.usageType).toBe('static');
  });

  test('autoTouch', () => {
    expect(
      new VertexAttributeDescriptor('foo', {
        size: 1,
        usage: 'static',
      }).autoTouch,
    ).toBe(false);
    expect(
      new VertexAttributeDescriptor('foo', {
        size: 1,
        usage: 'dynamic',
      }).autoTouch,
    ).toBe(true);
    expect(
      new VertexAttributeDescriptor('foo', {
        size: 1,
        usage: 'stream',
      }).autoTouch,
    ).toBe(true);
    expect(
      new VertexAttributeDescriptor('foo', {
        size: 1,
        usage: 'static',
        autoTouch: true,
      }).autoTouch,
    ).toBe(true);
    expect(
      new VertexAttributeDescriptor('foo', {
        size: 1,
        usage: 'dynamic',
        autoTouch: false,
      }).autoTouch,
    ).toBe(false);
    expect(
      new VertexAttributeDescriptor('foo', {
        size: 1,
        usage: 'stream',
        autoTouch: false,
      }).autoTouch,
    ).toBe(false);
  });
});

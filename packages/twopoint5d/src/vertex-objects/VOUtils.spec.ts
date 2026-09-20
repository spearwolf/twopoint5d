import {describe, expect, test} from 'vitest';
import {VOUtils} from './VOUtils.js';
import {VertexObjectBuffer} from './VertexObjectBuffer.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import type {VO} from './types.js';

describe('VOUtils', () => {
  const descriptor = new VertexObjectDescriptor({
    vertexCount: 1,
    attributes: {
      position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'},
    },
  });

  // a vertex object is nothing but an object that carries the two symbol properties
  const newVO = () => ({}) as VO;

  const newBuffer = () => new VertexObjectBuffer(descriptor, 4);

  test('set() writes buffer and index and answers the very object it was given', () => {
    const vo = newVO();
    const buffer = newBuffer();

    const result = VOUtils.set(vo, buffer, 3);

    expect(result).toBe(vo);
    expect(VOUtils.getBuffer(vo)).toBe(buffer);
    expect(VOUtils.getIndex(vo)).toBe(3);
  });

  test('getIndex() and getBuffer() answer what set() wrote', () => {
    const vo = newVO();
    const buffer = newBuffer();
    VOUtils.set(vo, buffer, 5);

    expect(VOUtils.getIndex(vo)).toBe(5);
    expect(VOUtils.getBuffer(vo)).toBe(buffer);
  });

  test('setIndex() moves the index and leaves the buffer where it is', () => {
    const vo = newVO();
    const buffer = newBuffer();
    VOUtils.set(vo, buffer, 3);

    const result = VOUtils.setIndex(vo, 7);

    expect(result).toBe(vo);
    expect(VOUtils.getIndex(vo)).toBe(7);
    expect(VOUtils.getBuffer(vo)).toBe(buffer);
  });

  test('isBuffer() is true for the buffer the vertex object points at and false for another one', () => {
    const vo = newVO();
    const buffer = newBuffer();
    const other = newBuffer();
    VOUtils.set(vo, buffer, 0);

    expect(VOUtils.isBuffer(vo, buffer)).toBe(true);
    expect(VOUtils.isBuffer(vo, other)).toBe(false);
  });

  test('isBuffer() compares rather than checks for presence: undefined matches a vertex object without a buffer', () => {
    const bare = newVO();
    const linked = VOUtils.set(newVO(), newBuffer(), 0);

    expect(VOUtils.isBuffer(bare, undefined)).toBe(true);
    expect(VOUtils.isBuffer(linked, undefined)).toBe(false);
  });

  test('hasBuffer() is true with a buffer, false after clearBuffer() and false for an object that never had one', () => {
    const vo = VOUtils.set(newVO(), newBuffer(), 0);

    expect(VOUtils.hasBuffer(vo)).toBe(true);

    VOUtils.clearBuffer(vo);

    expect(VOUtils.hasBuffer(vo)).toBe(false);
    expect(VOUtils.hasBuffer(newVO())).toBe(false);
  });

  test('setBuffer(vo, undefined) and clearBuffer() end in the same state and answer the object', () => {
    const viaSet = VOUtils.set(newVO(), newBuffer(), 2);
    const viaClear = VOUtils.set(newVO(), newBuffer(), 2);

    expect(VOUtils.setBuffer(viaSet, undefined)).toBe(viaSet);
    expect(VOUtils.clearBuffer(viaClear)).toBe(viaClear);

    for (const vo of [viaSet, viaClear]) {
      expect(VOUtils.hasBuffer(vo)).toBe(false);
      expect(VOUtils.getBuffer(vo)).toBeUndefined();
      expect(VOUtils.getIndex(vo), 'the index is not touched').toBe(2);
    }
  });

  test('setBuffer() links a vertex object to a buffer without touching its index', () => {
    const vo = VOUtils.set(newVO(), newBuffer(), 4);
    const other = newBuffer();

    expect(VOUtils.setBuffer(vo, other)).toBe(vo);
    expect(VOUtils.getBuffer(vo)).toBe(other);
    expect(VOUtils.getIndex(vo)).toBe(4);
  });

  test('getBuffer() answers undefined for a vertex object that never got one', () => {
    expect(VOUtils.getBuffer(newVO())).toBeUndefined();
  });
});

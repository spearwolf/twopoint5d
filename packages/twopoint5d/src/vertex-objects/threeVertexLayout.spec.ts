// The rules of three the vertex layout of this module rests on, checked against the three in the
// catalog of `pnpm-workspace.yaml`. A test that fails after a bump names a comment to check again,
// and the comment names this test.

import WebGPUAttributeUtils from 'three/src/renderers/webgpu/utils/WebGPUAttributeUtils.js';
import type {TypedArray} from 'three/webgpu';
import {
  BufferAttribute,
  BufferGeometry,
  InstancedBufferGeometry,
  InterleavedBuffer,
  InterleavedBufferAttribute,
} from 'three/webgpu';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

describe('the vertex layout three asks for', () => {
  // the part of a WebGPU backend that `WebGPUAttributeUtils` reaches while it builds a gpu buffer
  const backendData = new WeakMap<object, Record<string, unknown>>();
  const backend = {
    get(object: object): Record<string, unknown> {
      let data = backendData.get(object);
      if (data === undefined) {
        data = {};
        backendData.set(object, data);
      }
      return data;
    },
    device: {createBuffer: ({size}: {size: number}) => ({getMappedRange: () => new ArrayBuffer(size), unmap() {}})},
  };

  const utils = new WebGPUAttributeUtils(backend);

  beforeEach(() => {
    vi.stubGlobal('GPUBufferUsage', {INDEX: 0x10, VERTEX: 0x20});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test('three has a vertex format of one value for the 32-bit types alone', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    for (const ArrayType of [Int8Array, Uint8Array, Int16Array, Uint16Array]) {
      expect(utils._getVertexFormat(new BufferAttribute(new ArrayType(4), 1)), ArrayType.name).toBeUndefined();
    }
    expect(consoleError, 'three says it has no format').toHaveBeenCalledTimes(4);

    expect(utils._getVertexFormat(new BufferAttribute(new Int32Array(4), 1))).toBe('sint32');
    expect(utils._getVertexFormat(new BufferAttribute(new Uint32Array(4), 1))).toBe('uint32');
    expect(utils._getVertexFormat(new BufferAttribute(new Float32Array(4), 1))).toBe('float32');
  });

  test('three rounds the vertex format of more than one value up to whole 4 bytes', () => {
    expect(utils._getVertexFormat(new BufferAttribute(new Uint8Array(6), 3, true))).toBe('unorm8x4');
    expect(utils._getVertexFormat(new BufferAttribute(new Uint16Array(6), 3, true))).toBe('unorm16x4');
  });

  test('three widens an 8- or 16-bit integer BufferAttribute without normalized to 32 bits, and leaves an InterleavedBuffer as it is', () => {
    const uint8 = new BufferAttribute(new Uint8Array(4), 1);
    utils.createAttribute(uint8, 0x20);
    expect(uint8.array).toBeInstanceOf(Uint32Array);

    const int16 = new BufferAttribute(new Int16Array(4), 2);
    utils.createAttribute(int16, 0x20);
    expect(int16.array).toBeInstanceOf(Int32Array);

    const interleaved = new InterleavedBufferAttribute(new InterleavedBuffer(new Uint8Array(8), 4), 4, 0);
    utils.createAttribute(interleaved, 0x20);
    expect(interleaved.data.array).toBeInstanceOf(Uint8Array);
  });

  test('three pads a BufferAttribute whose stride is no multiple of 4 bytes, and never an InterleavedBuffer', () => {
    const tint = new BufferAttribute(new Uint8Array(6), 3, true);
    utils.createAttribute(tint, 0x20);
    expect(backend.get(tint)['_paddedItemSize']).toBe(4);

    const buffer = new InterleavedBuffer(new Uint8Array(8), 4);
    utils.createAttribute(new InterleavedBufferAttribute(buffer, 4, 0), 0x20);
    expect(backend.get(buffer)['_paddedItemSize']).toBeUndefined();
  });

  test('InstancedBufferGeometry#copy() of a plain BufferGeometry leaves instanceCount undefined', () => {
    const geometry = new InstancedBufferGeometry().copy(new BufferGeometry() as InstancedBufferGeometry);

    expect(geometry.instanceCount).toBeUndefined();
  });

  test("three's TypedArray has no Float16Array", () => {
    // @ts-expect-error three's TypedArray has no Float16Array (asThreeTypedArray.ts)
    const float16: TypedArray = new Float16Array(1);

    expect(float16.length).toBe(1);
  });
});

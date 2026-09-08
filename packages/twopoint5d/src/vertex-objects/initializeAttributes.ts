import type {BufferGeometry, TypedArray as ThreeTypedArray} from 'three/webgpu';
import {
  BufferAttribute,
  InstancedBufferAttribute,
  InstancedInterleavedBuffer,
  InterleavedBuffer,
  InterleavedBufferAttribute,
} from 'three/webgpu';
import type {AttributeRoute, GeometryAttributeSlots} from './GeometryAttributeSlots.js';
import type {VOBufferPool} from './VOBufferPool.js';
import {asThreeTypedArray} from './asThreeTypedArray.js';
import {createIndicesArray} from './createIndicesArray.js';
import {expectDefined} from '../utils/expectDefined.js';
import {toDrawUsage} from './toDrawUsage.js';

/**
 * What separates a plain attribute route from an instanced one: the two three.js
 * constructors, and whether the route also carries the index of the geometry.
 */
interface AttributeBuilders {
  interleavedBuffer(array: ThreeTypedArray, itemSize: number): InterleavedBuffer;
  bufferAttribute(array: ThreeTypedArray, itemSize: number, normalized: boolean): BufferAttribute;
  ownsIndex: boolean;
}

function initializeRoute(
  geometry: BufferGeometry,
  pool: VOBufferPool,
  buffers: AttributeRoute,
  bufferSerials: Map<string, number>,
  slots: GeometryAttributeSlots,
  builders: AttributeBuilders,
): void {
  const {descriptor, capacity} = pool;
  if (builders.ownsIndex && descriptor.hasIndices) {
    const {indices} = descriptor;
    const bufAttr = new BufferAttribute(createIndicesArray(indices, capacity), 1);
    geometry.setIndex(bufAttr);
  }
  // a buffer reached through a live pool holds its typed array
  for (const buffer of pool.buffer.buffers.values()) {
    // both maps are filled from the same list of attribute names in VertexObjectBuffer, so a
    // buffer name that has a buffer has its attributes, and an attribute name has its descriptor
    const attributes = expectDefined(
      pool.buffer.bufferNameAttributes.get(buffer.bufferName),
      `the attributes of buffer "${buffer.bufferName}"`,
    );
    if (attributes.length > 1) {
      const interleavedBuffer = builders.interleavedBuffer(asThreeTypedArray(buffer.typedArray!), buffer.itemSize);
      interleavedBuffer.setUsage(toDrawUsage(buffer.usageType));
      buffers.set(buffer.bufferName, interleavedBuffer);
      bufferSerials.set(buffer.bufferName, buffer.serial);
      for (const bufAttr of attributes) {
        const attrDesc = expectDefined(
          descriptor.attributes.get(bufAttr.attributeName),
          `the descriptor of attribute "${bufAttr.attributeName}"`,
        );
        const attr = new InterleavedBufferAttribute(interleavedBuffer, attrDesc.size, bufAttr.offset, attrDesc.normalizedData);
        attr.name = bufAttr.attributeName;
        geometry.setAttribute(attrDesc.name, attr);
        slots.claim(attrDesc.name, buffers, pool, attr);
      }
    } else {
      const bufAttr = expectDefined(attributes[0], `the sole attribute of buffer "${buffer.bufferName}"`);
      const attrDesc = expectDefined(
        descriptor.attributes.get(bufAttr.attributeName),
        `the descriptor of attribute "${bufAttr.attributeName}"`,
      );
      const attr = builders.bufferAttribute(asThreeTypedArray(buffer.typedArray!), buffer.itemSize, attrDesc.normalizedData);
      attr.setUsage(toDrawUsage(buffer.usageType));
      attr.name = bufAttr.attributeName;
      buffers.set(buffer.bufferName, attr);
      bufferSerials.set(buffer.bufferName, buffer.serial);
      geometry.setAttribute(attrDesc.name, attr);
      slots.claim(attrDesc.name, buffers, pool, attr);
    }
  }
}

export function initializeAttributes(
  geometry: BufferGeometry,
  pool: VOBufferPool,
  buffers: AttributeRoute,
  bufferSerials: Map<string, number>,
  slots: GeometryAttributeSlots,
): void {
  initializeRoute(geometry, pool, buffers, bufferSerials, slots, {
    interleavedBuffer: (array, itemSize) => new InterleavedBuffer(array, itemSize),
    bufferAttribute: (array, itemSize, normalized) => new BufferAttribute(array, itemSize, normalized),
    ownsIndex: true,
  });
}

export function initializeInstancedAttributes(
  geometry: BufferGeometry,
  pool: VOBufferPool,
  buffers: AttributeRoute,
  bufferSerials: Map<string, number>,
  slots: GeometryAttributeSlots,
): void {
  // every instanced attribute advances once per mesh of the descriptor
  const meshPerAttribute = pool.descriptor.meshCount;
  initializeRoute(geometry, pool, buffers, bufferSerials, slots, {
    interleavedBuffer: (array, itemSize) => new InstancedInterleavedBuffer(array, itemSize, meshPerAttribute),
    bufferAttribute: (array, itemSize, normalized) => new InstancedBufferAttribute(array, itemSize, normalized, meshPerAttribute),
    // the index of an instanced geometry comes from its base route, never from this one
    ownsIndex: false,
  });
}

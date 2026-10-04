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
import type {VertexAttributeDataType} from './types.js';
import {asThreeTypedArray} from './asThreeTypedArray.js';
import {createIndicesArray} from './createIndicesArray.js';
import {expectDefined} from '../utils/expectDefined.js';
import {toDrawUsage} from './toDrawUsage.js';

// three 0.186.1 widens the array of an 8- or 16-bit integer BufferAttribute without `normalized`
// to 32 bits as it builds its gpu buffer, and from then on uploads from that copy
// (`WebGPUAttributeUtils.js:82–107`). It leaves an InterleavedBuffer as it is and gives it the
// format of its own type (`sint16x2`, `uint8x4`, …), so a buffer of these types reaches three as one
const typesThreeWidens: ReadonlySet<VertexAttributeDataType> = new Set(['int8', 'int16', 'uint8', 'uint16']);

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
    const bufAttr = new BufferAttribute(createIndicesArray(indices, capacity, descriptor.vertexCount), 1);
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
    // a buffer of one attribute with padding behind it goes the interleaved way as well: a
    // BufferAttribute of the padded itemSize would show the shader the padding as a component, one
    // of the attribute's size would read the array at the wrong stride. An InterleavedBuffer carries
    // the stride, and three never pads one — it has no itemSize (`WebGPUAttributeUtils.js:119`), and
    // its arrayStride is `stride × BYTES_PER_ELEMENT` (`:304`)
    const first = descriptor.attributes.get(attributes[0]!.attributeName);
    const padded = attributes.length === 1 && first?.size !== buffer.itemSize;
    // every attribute of a buffer agrees on type and `normalized` (`VertexObjectDescriptor`)
    const threeWouldWiden = typesThreeWidens.has(buffer.dataType) && first?.normalizedData === false;
    if (attributes.length > 1 || padded || threeWouldWiden) {
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
        slots.claim(attrDesc.name, buffers, attr);
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
      slots.claim(attrDesc.name, buffers, attr);
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
  initializeRoute(geometry, pool, buffers, bufferSerials, slots, {
    interleavedBuffer: (array, itemSize) => new InstancedInterleavedBuffer(array, itemSize),
    bufferAttribute: (array, itemSize, normalized) => new InstancedBufferAttribute(array, itemSize, normalized),
    // the index of an instanced geometry comes from its base route, never from this one
    ownsIndex: false,
  });
}

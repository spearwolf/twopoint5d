import type { BufferGeometry} from 'three/webgpu';
import {BufferAttribute, InterleavedBuffer, InterleavedBufferAttribute} from 'three/webgpu';
import type {AttributeRoute, GeometryAttributeSlots} from './GeometryAttributeSlots.js';
import type {VOBufferPool} from './VOBufferPool.js';
import {asThreeTypedArray} from './asThreeTypedArray.js';
import {createIndicesArray} from './createIndicesArray.js';
import {toDrawUsage} from './toDrawUsage.js';

export function initializeAttributes(
  geometry: BufferGeometry,
  pool: VOBufferPool,
  buffers: AttributeRoute,
  bufferSerials: Map<string, number>,
  slots: GeometryAttributeSlots,
): void {
  const {descriptor, capacity} = pool;
  if (descriptor.hasIndices) {
    const {indices} = descriptor;
    const bufAttr = new BufferAttribute(createIndicesArray(indices, capacity), 1);
    geometry.setIndex(bufAttr);
  }
  for (const buffer of pool.buffer.buffers.values()) {
    // both maps are filled from the same list of attribute names in VertexObjectBuffer, so a
    // buffer name that has a buffer has its attributes, and an attribute name has its descriptor
    const attributes = pool.buffer.bufferNameAttributes.get(buffer.bufferName);
    if (attributes.length > 1) {
      const interleavedBuffer = new InterleavedBuffer(asThreeTypedArray(buffer.typedArray), buffer.itemSize);
      interleavedBuffer.setUsage(toDrawUsage(buffer.usageType));
      buffers.set(buffer.bufferName, interleavedBuffer);
      bufferSerials.set(buffer.bufferName, buffer.serial);
      for (const bufAttr of attributes) {
        const attrDesc = descriptor.attributes.get(bufAttr.attributeName);
        const attr = new InterleavedBufferAttribute(interleavedBuffer, attrDesc.size, bufAttr.offset, attrDesc.normalizedData);
        attr.name = bufAttr.attributeName;
        geometry.setAttribute(attrDesc.name, attr);
        slots.claim(attrDesc.name, buffers, pool, attr);
      }
    } else {
      const bufAttr = attributes[0];
      const attrDesc = descriptor.attributes.get(bufAttr.attributeName);
      const attr = new BufferAttribute(asThreeTypedArray(buffer.typedArray), buffer.itemSize, attrDesc.normalizedData);
      attr.setUsage(toDrawUsage(buffer.usageType));
      attr.name = bufAttr.attributeName;
      buffers.set(buffer.bufferName, attr);
      bufferSerials.set(buffer.bufferName, buffer.serial);
      geometry.setAttribute(attrDesc.name, attr);
      slots.claim(attrDesc.name, buffers, pool, attr);
    }
  }
}

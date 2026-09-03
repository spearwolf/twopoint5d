import type {BufferGeometry} from 'three/webgpu';
import { InstancedBufferAttribute, InstancedInterleavedBuffer, InterleavedBufferAttribute} from 'three/webgpu';
import type {AttributeRoute, GeometryAttributeSlots} from './GeometryAttributeSlots.js';
import type {VOBufferPool} from './VOBufferPool.js';
import {toDrawUsage} from './toDrawUsage.js';

export function initializeInstancedAttributes(
  geometry: BufferGeometry,
  pool: VOBufferPool,
  buffers: AttributeRoute,
  bufferSerials: Map<string, number>,
  slots: GeometryAttributeSlots,
): void {
  const {descriptor} = pool;
  const meshPerAttribute = descriptor.meshCount;
  for (const buffer of pool.buffer.buffers.values()) {
    const attributes = pool.buffer.bufferNameAttributes.get(buffer.bufferName);
    if (attributes.length > 1) {
      const interleavedBuffer = new InstancedInterleavedBuffer(buffer.typedArray, buffer.itemSize, meshPerAttribute);
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
      const attr = new InstancedBufferAttribute(buffer.typedArray, buffer.itemSize, attrDesc.normalizedData, meshPerAttribute);
      attr.setUsage(toDrawUsage(buffer.usageType));
      attr.name = bufAttr.attributeName;
      buffers.set(buffer.bufferName, attr);
      bufferSerials.set(buffer.bufferName, buffer.serial);
      geometry.setAttribute(attrDesc.name, attr);
      slots.claim(attrDesc.name, buffers, pool, attr);
    }
  }
}

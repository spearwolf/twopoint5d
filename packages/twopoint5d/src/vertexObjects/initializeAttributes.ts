import {BufferAttribute, BufferGeometry, InterleavedBuffer, InterleavedBufferAttribute} from 'three';

import {VertexObjectPool} from './VertexObjectPool';
import {createIndicesArray} from './createIndicesArray';
import {toDrawUsage} from './toDrawUsage';
import {BufferLike} from './types';

export function initializeAttributes(geometry: BufferGeometry, pool: VertexObjectPool, buffers: Map<string, BufferLike>): void {
  const {descriptor, capacity} = pool;
  if (descriptor.hasIndices) {
    const {indices} = descriptor;
    const bufAttr = new BufferAttribute(createIndicesArray(indices, capacity), 3);
    bufAttr.count = capacity * indices.length;
    geometry.setIndex(bufAttr);
  }
  for (const buffer of pool.buffer.buffers.values()) {
    const attributes = pool.buffer.bufferNameAttributes.get(buffer.bufferName);
    if (attributes.length > 1) {
      const interleavedBuffer = new InterleavedBuffer(buffer.typedArray, buffer.itemSize);
      interleavedBuffer.setUsage(toDrawUsage(buffer.usageType));
      buffers.set(buffer.bufferName, interleavedBuffer);
      for (const bufAttr of attributes) {
        const attrDesc = descriptor.attributes.get(bufAttr.attributeName);
        const attr = new InterleavedBufferAttribute(interleavedBuffer, attrDesc.size, bufAttr.offset, attrDesc.normalizedData);
        attr.name = bufAttr.attributeName;
        geometry.setAttribute(attrDesc.name, attr);
      }
    } else {
      const bufAttr = attributes[0];
      const attrDesc = descriptor.attributes.get(bufAttr.attributeName);
      const attr = new BufferAttribute(buffer.typedArray, buffer.itemSize, attrDesc.normalizedData);
      attr.setUsage(toDrawUsage(buffer.usageType));
      attr.name = bufAttr.attributeName;
      buffers.set(buffer.bufferName, attr);
      geometry.setAttribute(attrDesc.name, attr);
    }
  }
}

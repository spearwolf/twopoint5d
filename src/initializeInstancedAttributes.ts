import {
  BufferGeometry,
  InstancedBufferAttribute,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
} from 'three';

import {VertexObjectPool} from './VertexObjectPool';
import {toDrawUsage} from './toDrawUsage';
import {BufferLike} from './types';

export function initializeInstancedAttributes(
  geometry: BufferGeometry,
  pool: VertexObjectPool,
  buffers: Map<string, BufferLike>,
): void {
  const {descriptor} = pool;
  const meshPerAttribute = descriptor.meshCount;
  for (const buffer of pool.buffer.buffers.values()) {
    const attributes = pool.buffer.bufferNameAttributes.get(buffer.bufferName);
    if (attributes.length > 1) {
      const interleavedBuffer = new InstancedInterleavedBuffer(
        buffer.typedArray,
        buffer.itemSize,
        meshPerAttribute,
      );
      interleavedBuffer.setUsage(toDrawUsage(buffer.usageType));
      buffers.set(buffer.bufferName, interleavedBuffer);
      for (const bufAttr of attributes) {
        const attrDesc = descriptor.attributes.get(bufAttr.attributeName);
        const attr = new InterleavedBufferAttribute(
          interleavedBuffer,
          attrDesc.size,
          bufAttr.offset,
          attrDesc.normalizedData,
        );
        attr.name = bufAttr.attributeName;
        geometry.setAttribute(attrDesc.name, attr);
      }
    } else {
      const bufAttr = attributes[0];
      const attrDesc = descriptor.attributes.get(bufAttr.attributeName);
      const attr = new InstancedBufferAttribute(
        buffer.typedArray,
        buffer.itemSize,
        attrDesc.normalizedData,
        meshPerAttribute,
      );
      attr.setUsage(toDrawUsage(buffer.usageType));
      attr.name = bufAttr.attributeName;
      buffers.set(buffer.bufferName, attr);
      geometry.setAttribute(attrDesc.name, attr);
    }
  }
}

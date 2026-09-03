import {toDrawUsage} from './toDrawUsage.js';
import type {BufferLike, VertexAttributeUsageType} from './types.js';

export function selectBuffers(
  buffers: Map<string, BufferLike>,
  bufferTypes: {
    [Type in VertexAttributeUsageType]?: boolean;
  },
): BufferLike[] {
  const results: BufferLike[] = [];
  for (const usageType in bufferTypes) {
    if (bufferTypes[usageType as VertexAttributeUsageType] !== true) continue;
    const drawUsage = toDrawUsage(usageType as VertexAttributeUsageType);
    for (const buffer of buffers.values()) {
      if (buffer.usage === drawUsage) {
        results.push(buffer);
      }
    }
  }
  return results;
}

import {toDrawUsage} from './toDrawUsage';
import {BufferLike, VertexAttributeUsageType} from './types';

export function selectBuffers(
  buffers: Map<string, BufferLike>,
  bufferTypes: {
    [Type in VertexAttributeUsageType]?: boolean;
  },
): BufferLike[] {
  const results = [];
  for (const [usageType, needsUpdate] of Object.entries(bufferTypes)) {
    if (needsUpdate === true) {
      const drawUsage = toDrawUsage(usageType as VertexAttributeUsageType);
      results.push(
        ...Array.from(buffers.values()).filter(
          (buffer) => buffer.usage === drawUsage,
        ),
      );
    }
  }
  return results;
}

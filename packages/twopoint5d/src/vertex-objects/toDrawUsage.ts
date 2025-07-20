import {DynamicDrawUsage, StaticDrawUsage, StreamDrawUsage} from 'three/webgpu';
import type {DrawUsageType, VertexAttributeUsageType} from './types.js';

export function toDrawUsage(usage: VertexAttributeUsageType): DrawUsageType {
  switch (usage) {
    case 'dynamic':
      return DynamicDrawUsage;
    case 'stream':
      return StreamDrawUsage;
    default:
      return StaticDrawUsage;
  }
}

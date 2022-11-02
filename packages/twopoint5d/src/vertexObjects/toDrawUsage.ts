import {DynamicDrawUsage, StaticDrawUsage, StreamDrawUsage} from 'three';

import {DrawUsageType, VertexAttributeUsageType} from './types';

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

import type {VertexAttributeUsageType, VertexObjectDescription} from './types.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';

export default (
  source: VertexObjectDescriptor | VertexObjectDescription,
  attributeUsage?: {dynamic?: string[]; stream?: string[]; static?: string[]; alias?: Record<string, string | string[]>},
): VertexObjectDescription => {
  const description = source instanceof VertexObjectDescriptor ? source.description : source;
  const target: VertexObjectDescription = {
    vertexCount: description.vertexCount,
    indices: description.indices?.slice(),
    meshCount: description.meshCount,
    attributes: Object.fromEntries(
      Object.entries(description.attributes).map(([name, desc]) => {
        const clonedDesc = 'size' in desc ? {...desc} : {...desc, components: desc.components.slice()};

        if (!attributeUsage) {
          return [name, clonedDesc];
        }

        const dynamics = new Set(attributeUsage.dynamic || []);
        const streams = new Set(attributeUsage.stream || []);
        const statics = new Set(attributeUsage.static || []);

        if (dynamics.size === 0 && streams.size === 0 && statics.size === 0) {
          return [name, clonedDesc];
        }

        if (attributeUsage.alias) {
          for (const [aliasName, aliasValue] of Object.entries(attributeUsage.alias)) {
            const aliases = Array.isArray(aliasValue) ? aliasValue : [aliasValue];
            if (dynamics.has(aliasName)) {
              aliases.forEach((alias) => dynamics.add(alias));
            } else if (streams.has(aliasName)) {
              aliases.forEach((alias) => streams.add(alias));
            } else if (statics.has(aliasName)) {
              aliases.forEach((alias) => statics.add(alias));
            }
          }
        }

        let usage: VertexAttributeUsageType = desc.usage || 'static';

        if (dynamics.has(name)) {
          usage = 'dynamic';
        } else if (streams.has(name)) {
          usage = 'stream';
        } else if (statics.has(name)) {
          usage = 'static';
        }

        return [name, {...clonedDesc, usage}];
      }),
    ),
    basePrototype: description.basePrototype,
  };
  if (description.methods) {
    target.methods = {...description.methods};
  }
  return target;
};

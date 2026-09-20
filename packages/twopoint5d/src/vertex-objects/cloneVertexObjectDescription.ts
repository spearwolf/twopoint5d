import type {
  FrozenVertexObjectDescription,
  VAComponentsDescription,
  VertexAttributeDescription,
  VertexAttributeUsageType,
  VertexObjectDescription,
} from './types.js';
import type {VertexObjectDescriptor} from './VertexObjectDescriptor.js';

/**
 * The attributes of a copied description that take another usage type than the source declares.
 * An attribute named in none of the three lists keeps the usage it has.
 */
export interface VertexAttributeUsageOverrides {
  /** the attributes that become `dynamic` */
  dynamic?: string[];
  /** the attributes that become `stream` */
  stream?: string[];
  /** the attributes that become `static` */
  static?: string[];
  /**
   * Further names an entry of the three lists above applies to as well, keyed by the name that
   * entry uses: `{dynamic: ['position'], alias: {position: 'instancePosition'}}` makes
   * `instancePosition` dynamic along with `position`. This is how a caller asks for an attribute
   * by a word of its own — `position`, `size` — while the description knows that attribute as
   * something else.
   */
  alias?: Record<string, string | string[]>;
}

/**
 * The names each usage type applies to, aliases resolved — the same for every attribute of a
 * description, so it is built once. `undefined` where the overrides name no attribute at all: such
 * a copy leaves every attribute description as it is, `usage` included.
 */
function resolveUsageLookup(attributeUsage: VertexAttributeUsageOverrides | undefined) {
  if (!attributeUsage) return undefined;

  const dynamics = new Set(attributeUsage.dynamic || []);
  const streams = new Set(attributeUsage.stream || []);
  const statics = new Set(attributeUsage.static || []);

  if (dynamics.size === 0 && streams.size === 0 && statics.size === 0) return undefined;

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

  return {dynamics, streams, statics};
}

/**
 * Copies a vertex object description, optionally with a different usage type for some of its
 * attributes — the way to reuse a description of the library for a pool whose attributes change
 * at another rate than the original was written for.
 *
 * The copy owns its structure: the description itself, every attribute description in it, the
 * `components` array of each of those, the `indices` array and the `methods` object are new
 * objects. `basePrototype` and each individual method are taken by reference, because those are
 * the behaviour the copy is meant to share.
 *
 * @param source a description, or a descriptor whose description is copied
 * @param attributeUsage the attributes that take another usage type than the source declares.
 *   Naming no attribute at all in any of the three lists leaves every usage as it is.
 */
export function cloneVertexObjectDescription(
  source: VertexObjectDescriptor | VertexObjectDescription | FrozenVertexObjectDescription,
  attributeUsage?: VertexAttributeUsageOverrides,
): VertexObjectDescription {
  // the union tells the two apart by shape — only a descriptor carries a `description` — which
  // is what lets this module need the descriptor as a type alone, so neither of the two modules
  // has to be there for the other one at runtime
  const description = 'description' in source ? source.description : source;
  const usageLookup = resolveUsageLookup(attributeUsage);
  // every field of a description belongs in here: `new VertexObjectDescriptor()` builds its own
  // copy through this function, so a field this list forgets never reaches a descriptor
  const target: VertexObjectDescription = {
    vertexCount: description.vertexCount,
    indices: description.indices?.slice(),
    attributes: Object.fromEntries(
      Object.entries(description.attributes).map(([name, desc]) => {
        // the clone owns its structure: the spread and the components copy below build new objects,
        // so what comes out is free to change even when the source was a frozen description
        const clonedDesc = {...desc} as VertexAttributeDescription;
        // an attribute is free to declare `size` and `components` together, so a components array
        // is copied wherever there is one: a shared array would let a later push on the source
        // description undo the size-against-components check of VertexObjectDescriptor
        const {components} = clonedDesc as Partial<VAComponentsDescription>;
        if (components != null) {
          (clonedDesc as VAComponentsDescription).components = components.slice();
        }

        if (!usageLookup) {
          return [name, clonedDesc];
        }

        const {dynamics, streams, statics} = usageLookup;

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
}

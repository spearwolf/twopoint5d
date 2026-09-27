import type {FrozenVertexObjectDescription, VertexObjectDescription} from './types.js';

const sameIndices = (live: readonly number[] | undefined, frozen: readonly number[] | undefined): boolean => {
  if (live == null) return frozen == null;
  if (frozen == null || live.length !== frozen.length) return false;
  for (let i = 0; i < live.length; i++) {
    if (live[i] !== frozen[i]) return false;
  }
  return true;
};

const sameValue = (live: unknown, frozen: unknown): boolean => {
  if (Array.isArray(live) && Array.isArray(frozen)) {
    // `components`, the one array an attribute description holds, is copied element by element
    return live.length === frozen.length && live.every((value, i) => value === frozen[i]);
  }
  return live === frozen;
};

const sameAttribute = (live: object, frozen: object): boolean => {
  const keys = Object.keys(live);
  if (keys.length !== Object.keys(frozen).length) return false;
  for (const key of keys) {
    if (!Object.hasOwn(frozen, key)) return false;
    if (!sameValue((live as Record<string, unknown>)[key], (frozen as Record<string, unknown>)[key])) return false;
  }
  return true;
};

/**
 * Whether a copy of `description` would describe what `frozen` — the copy a descriptor holds —
 * does: the vertex count, the indices, the attributes in their order and with every field of
 * each, the base prototype and every method, compared field by field in the shape
 * `cloneVertexObjectDescription()` copies them, which sets the list of fields. In doubt the
 * answer is `false`.
 *
 * @internal
 */
export function sameVertexObjectDescription(
  description: VertexObjectDescription | FrozenVertexObjectDescription,
  frozen: FrozenVertexObjectDescription,
): boolean {
  if (description.vertexCount !== frozen.vertexCount) return false;
  if (!sameIndices(description.indices, frozen.indices)) return false;

  // the order of the names is the order of `VertexObjectDescriptor#attributeNames`
  const names = Object.keys(description.attributes);
  const frozenNames = Object.keys(frozen.attributes);
  if (names.length !== frozenNames.length) return false;
  for (let i = 0; i < names.length; i++) {
    const name = names[i]!;
    if (name !== frozenNames[i]) return false;
    if (!sameAttribute(description.attributes[name]!, frozen.attributes[name]!)) return false;
  }

  if (description.basePrototype !== frozen.basePrototype) return false;

  // a copy of a description without `methods` carries none at all
  if (!description.methods) return frozen.methods === undefined;
  if (frozen.methods == null) return false;
  const methodNames = Object.keys(description.methods);
  if (methodNames.length !== Object.keys(frozen.methods).length) return false;
  for (const name of methodNames) {
    if ((description.methods as Record<string, unknown>)[name] !== (frozen.methods as Record<string, unknown>)[name]) {
      return false;
    }
  }
  return true;
}

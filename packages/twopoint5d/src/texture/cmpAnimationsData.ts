import type {FrameBasedAnimationsDataMap} from './types.js';

// an object as JSON.parse() or a literal builds it, and nothing a class makes
const isPlainObject = (value: object): boolean => {
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

// compares the parts of `a` and `b` with the pair on the path, and takes it off once that is done
const descend = (a: object, b: object, onPath: Map<object, Set<object>>, compareParts: () => boolean): boolean => {
  let partners = onPath.get(a);
  if (partners === undefined) {
    partners = new Set();
    onPath.set(a, partners);
  }
  partners.add(b);
  try {
    return compareParts();
  } finally {
    partners.delete(b);
    if (partners.size === 0) onPath.delete(a);
  }
};

// `onPath` holds, for each object of `a`, the objects of `b` it is being compared with: a pair met again
// further down is a cycle, and it counts as equal, since every other part of both graphs is compared on
// its own — cycles of different periods included
const sameData = (a: unknown, b: unknown, onPath: Map<object, Set<object>>): boolean => {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  if (onPath.get(a)?.has(b)) return true;

  if (a instanceof RegExp || b instanceof RegExp) {
    return a instanceof RegExp && b instanceof RegExp && a.source === b.source && a.flags === b.flags;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return descend(a, b, onPath, () => a.every((element, i) => sameData(element, b[i], onPath)));
  }

  if (!isPlainObject(a) || !isPlainObject(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  // The keys of an object are compared in their order: the animations are registered in the order
  // of `Object.entries()`, and an animation id is that position, so two maps with the same entries
  // in another order build other animations. The same catalog parsed again keeps its order
  const keys = Object.keys(left);
  const otherKeys = Object.keys(right);
  if (keys.length !== otherKeys.length || keys.some((key, i) => key !== otherKeys[i])) return false;
  return descend(a, b, onPath, () => keys.every((key) => sameData(left[key], right[key], onPath)));
};

/**
 * Whether two animation data maps say the same: the same entries with the same fields in the same
 * order, compared value for value. A `RegExp` equals one of the same `source` and `flags`, an array
 * one of the same length whose elements are equal, an object of `Object.prototype` or of none one
 * with the same own enumerable keys in the same order whose values are equal; `NaN` equals `NaN`.
 * Anything else equals only itself — a field that is `undefined` is no field that is missing, and a
 * string is no `RegExp` of the same source.
 */
export const cmpAnimationsData = (
  a: FrameBasedAnimationsDataMap | undefined,
  b: FrameBasedAnimationsDataMap | undefined,
): boolean => sameData(a, b, new Map());

// an array, or an object whose prototype is Object.prototype or null — what a record literal builds
const isPlain = (value: object): boolean => {
  if (Array.isArray(value)) return true;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

function freezeWithin(value: unknown, seen: WeakSet<object>): void {
  if (typeof value !== 'object' || value === null || seen.has(value) || !isPlain(value)) return;
  seen.add(value);
  // frozen or not, the children are walked: a part frozen flat may hold writable records
  Object.freeze(value);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (descriptor !== undefined && 'value' in descriptor) freezeWithin(descriptor.value, seen);
  }
}

/**
 * Freezes `value` and every plain object and array it holds, down to the leaves, and answers it.
 * A plain object is one whose prototype is `Object.prototype` or `null`. Functions, typed arrays
 * and instances of other classes — three.js objects among them — stay as they are, and so does
 * what they hold. Only data properties are followed, string and symbol keys alike; a getter is
 * never called. Safe on cycles and on parts that are frozen already.
 *
 * @internal
 */
export function deepFreeze<T>(value: T): T {
  freezeWithin(value, new WeakSet());
  return value;
}

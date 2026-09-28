/**
 * Returns the value, or throws if it is `null` or `undefined`.
 *
 * For lookups whose result is guaranteed by an invariant the type system cannot see —
 * two maps filled from the same list of names, an array index taken from the length of
 * the very collection it indexes. A broken invariant surfaces here, with the name of
 * what was missing, instead of as a property access on `undefined` a few frames later.
 */
export function expectDefined<T>(value: T | null | undefined, what: string): T {
  if (value == null) {
    throw undefinedValueError(what);
  }
  return value;
}

/**
 * The error {@link expectDefined} throws for a missing `what`. For a hot path that tests the value
 * itself, so that the description is put together only when the value is missing.
 */
export function undefinedValueError(what: string): Error {
  return new Error(`expected ${what} to be defined`);
}

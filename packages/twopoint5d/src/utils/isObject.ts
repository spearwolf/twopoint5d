/**
 * Whether `value` is an object whose fields can be read by name: anything `typeof` calls
 * `'object'` except `null`. Arrays count, functions do not.
 */
export function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

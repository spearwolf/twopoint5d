/**
 * Checks for the layout files of the demos. The generators under `assets-src/` write those
 * files; a check holds a file that someone changed by hand, or a generator that drifted, to what
 * the scene reads, and names the field that does not fit, as `eyes[1].x must be a number, got
 * "4"`. `fetchJson()` runs one on every file it loads. A file may carry more fields than a
 * check names: the generators write more than some scene reads.
 */

/**
 * Checks `value` and returns it as `T`, or throws a `TypeError` that reads `<where> must be
 * <what>, got <value>`. `path` names where the value sits in the file: `''` for the root,
 * `eyes[1].x` for a field of an element of a list.
 */
export type JsonCheck<T> = (value: unknown, path: string) => T;

/** `the root`, or the path of a field. */
const where = (path: string): string => (path === '' ? 'the root' : path);

/** A value as a message shows it: `nothing` for `undefined`, else JSON, cut after 40 characters. */
function show(value: unknown): string {
  if (value === undefined) return 'nothing';
  const json = JSON.stringify(value);
  return json.length > 40 ? `${json.slice(0, 39)}…` : json;
}

function refuse(path: string, what: string, value: unknown): never {
  throw new TypeError(`${where(path)} must be ${what}, got ${show(value)}`);
}

const fieldPath = (path: string, key: string): string => (path === '' ? key : `${path}.${key}`);

/** A number. */
export const jsonNumber: JsonCheck<number> = (value, path) => {
  if (typeof value !== 'number') refuse(path, 'a number', value);
  return value;
};

/** A string. */
export const jsonString: JsonCheck<string> = (value, path) => {
  if (typeof value !== 'string') refuse(path, 'a string', value);
  return value;
};

/** One of the given strings, as the union of their literal types. */
export function jsonOneOf<const V extends readonly string[]>(...values: V): JsonCheck<V[number]> {
  return (value, path) => {
    if (!values.some((v) => v === value)) {
      refuse(path, `one of ${values.map((v) => JSON.stringify(v)).join(', ')}`, value);
    }
    // `value` is one of `values`
    return value as V[number];
  };
}

/** A list of any length whose elements `item` accepts. */
export function jsonList<T>(item: JsonCheck<T>): JsonCheck<T[]> {
  return (value, path) => {
    if (!Array.isArray(value)) refuse(path, 'a list', value);
    value.forEach((element, i) => item(element, `${path}[${i}]`));
    // every element passed `item`
    return value as T[];
  };
}

/** A list of exactly as many elements as there are `items`, each held to the check at its place. */
export function jsonTuple<T extends unknown[]>(...items: {[K in keyof T]: JsonCheck<T[K]>}): JsonCheck<T> {
  return (value, path) => {
    if (!Array.isArray(value) || value.length !== items.length) refuse(path, `a list of ${items.length}`, value);
    items.forEach((item, i) => item(value[i], `${path}[${i}]`));
    // every element passed the check at its place
    return value as T;
  };
}

/** An object of any keys whose values `item` accepts. */
export function jsonRecord<T>(item: JsonCheck<T>): JsonCheck<Record<string, T>> {
  return (value, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) refuse(path, 'an object', value);
    for (const key of Object.keys(value)) item(Reflect.get(value, key), fieldPath(path, key));
    // every value passed `item`
    return value as Record<string, T>;
  };
}

/**
 * An object with the given fields, each accepted by its check. The type of `fields` ties the check
 * to the interface `T`: a field that is missing or checked as another type does not compile. Other
 * fields of the object pass unchecked.
 */
export function jsonObject<T>(fields: {[K in keyof T]-?: JsonCheck<T[K]>}): JsonCheck<T> {
  return (value, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) refuse(path, 'an object', value);
    for (const [key, check] of Object.entries<JsonCheck<unknown>>(fields)) {
      check(Reflect.get(value, key), fieldPath(path, key));
    }
    // every field of `T` passed its check, and the type of `fields` names every field of `T`
    return value as T;
  };
}

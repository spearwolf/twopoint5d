const MAX_ENTRIES = 8;
const MAX_DEPTH = 3;

const BARE_KEY = /^[A-Za-z_$][\w$]*$/;

/**
 * A value the way an error message quotes it, so that the refused value stays readable and
 * tells itself apart from its neighbours: a string in double quotes (`"16"` is not `16`), a
 * BigInt with its `n` (`1n` is not `1`), a function by its name, never its source, and an
 * array or a plain object by its content (`[1.5, NaN, -1]`, `{value: 1n}`), so that one object
 * is told apart from another. Up to eight entries per container and three levels deep are
 * shown, the rest as `…` — that keeps a message short for a large array and ends a cycle.
 * Everything else is written as `String()` writes it. `JSON.stringify()` is no option: it
 * throws for a BigInt, and the message would be lost.
 */
export function describeValue(value: unknown): string {
  return describeAt(value, 1);
}

function describeAt(value: unknown, depth: number): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'function') return value.name ? `[Function: ${value.name}]` : '[Function]';
  if (Array.isArray(value)) {
    if (depth > MAX_DEPTH) return '[…]';
    return `[${describeEntries(value, (entry) => describeAt(entry, depth + 1))}]`;
  }
  if (isPlainObject(value)) {
    if (depth > MAX_DEPTH) return '{…}';
    const record = value as Record<string, unknown>;
    return `{${describeEntries(Object.keys(record), (key) => `${describeKey(key)}: ${describeAt(record[key], depth + 1)}`)}}`;
  }
  return String(value);
}

function describeEntries<T>(entries: readonly T[], describe: (entry: T) => string): string {
  const shown = entries.slice(0, MAX_ENTRIES).map(describe);
  if (entries.length > MAX_ENTRIES) shown.push('…');
  return shown.join(', ');
}

function describeKey(key: string): string {
  return BARE_KEY.test(key) ? key : `"${key}"`;
}

function isPlainObject(value: unknown): value is object {
  if (typeof value !== 'object' || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

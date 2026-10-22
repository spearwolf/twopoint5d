const MAX_ENTRIES = 8;
const MAX_DEPTH = 3;

const BARE_KEY = /^[A-Za-z_$][\w$]*$/;

/**
 * A value the way an error message quotes it, so that the refused value stays readable and
 * tells itself apart from its neighbours: a string in double quotes (`"16"` is not `16`), a
 * symbol as `Symbol(a)`, distinct from the string `"Symbol(a)"`, a BigInt with its `n` (`1n` is
 * not `1`), a function by its name, never its source, and an array or a plain object by its
 * content (`[1.5, NaN, -1]`, `{value: 1n}`), so that one object is told apart from another. Up
 * to eight entries per container and three levels deep are shown, the rest as `…` — that keeps
 * a message short for a large array and ends a cycle. Everything else is written as `String()`
 * writes it. `JSON.stringify()` is no option: it throws for a BigInt, and the message would be
 * lost.
 *
 * An accessor of a plain object or an array stands as `[Getter]`, `[Setter]` or
 * `[Getter/Setter]` and is not called: a message runs no code of the caller. A value that
 * throws while it is shown — a revoked `Proxy`, an object whose `toString()` throws or that has
 * none — stands as `[object]`, a function as `[Function]`, and an entry that throws replaces
 * only itself: no message loses its text to the value it shows.
 */
export function describeValue(value: unknown): string {
  return describeAt(value, 1);
}

function describeAt(value: unknown, depth: number): string {
  try {
    return describeUnguarded(value, depth);
  } catch {
    return typeof value === 'function' ? '[Function]' : '[object]';
  }
}

function describeUnguarded(value: unknown, depth: number): string {
  if (typeof value === 'string') return `"${value}"`;
  if (typeof value === 'bigint') return `${value}n`;
  if (typeof value === 'function') return value.name ? `[Function: ${value.name}]` : '[Function]';
  if (Array.isArray(value)) {
    if (depth > MAX_DEPTH) return '[…]';
    const shown: string[] = [];
    const count = Math.min(value.length, MAX_ENTRIES);
    for (let index = 0; index < count; index++) shown.push(describeProperty(value, index, depth));
    return `[${joinEntries(shown, value.length)}]`;
  }
  if (isPlainObject(value)) {
    if (depth > MAX_DEPTH) return '{…}';
    const keys = Object.keys(value);
    const shown = keys.slice(0, MAX_ENTRIES).map((key) => `${describeKey(key)}: ${describeProperty(value, key, depth)}`);
    return `{${joinEntries(shown, keys.length)}}`;
  }
  return String(value);
}

/** Reads an entry through its own descriptor, so that no getter of the caller runs. */
function describeProperty(container: object, key: string | number, depth: number): string {
  const descriptor = Object.getOwnPropertyDescriptor(container, key);
  if (descriptor === undefined) return Array.isArray(container) ? '' : 'undefined';
  if (descriptor.get && descriptor.set) return '[Getter/Setter]';
  if (descriptor.get) return '[Getter]';
  if (descriptor.set) return '[Setter]';
  return describeAt(descriptor.value, depth + 1);
}

function joinEntries(shown: string[], total: number): string {
  if (total > MAX_ENTRIES) shown.push('…');
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

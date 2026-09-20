import type {TouchBuffersType} from './types.js';

/** Selects buffers of an instanced geometry by usage type, one half of the geometry at a time. */
export type TouchInstancedBuffersType = {
  base?: TouchBuffersType;
  instanced?: TouchBuffersType;
};

/** What a `touch()` call asks for, sorted by the shapes its arguments come in. */
export type TouchArgs = {
  attrNames: string[];
  /** Usage types that apply to every route. */
  flat?: TouchBuffersType;
  /** Usage types that name a half of an instanced geometry. */
  routed?: TouchInstancedBuffersType;
};

/** Sort the arguments of a `touch()` call into attribute names, plain usage types and routed ones. */
export function parseTouchArgs(args: Array<string | TouchBuffersType | TouchInstancedBuffersType>): TouchArgs {
  const attrNames: string[] = [];
  let flat: TouchBuffersType | undefined;
  let routed: TouchInstancedBuffersType | undefined;

  for (const arg of args) {
    if (typeof arg === 'string') {
      attrNames.push(arg);
    } else if ('base' in arg || 'instanced' in arg) {
      // merged per route, not across them: a second {base: …} would otherwise replace the
      // first one whole instead of adding to it
      routed = {base: {...routed?.base, ...arg.base}, instanced: {...routed?.instanced, ...arg.instanced}};
    } else {
      flat = {...flat, ...arg};
    }
  }

  return {attrNames, flat, routed};
}

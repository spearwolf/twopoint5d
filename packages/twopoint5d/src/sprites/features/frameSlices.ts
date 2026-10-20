import type {AsepriteFrameSlice} from '../../texture/AsepriteJson.js';
import type {TextureAtlasFrame} from '../../texture/TextureAtlas.js';
import {isFiniteNumber} from '../../utils/isFiniteNumber.js';
import {isObject} from '../../utils/isObject.js';

/** What a slice lookup looks for, and the words of its refusals. @internal */
export interface SliceWanted {
  /** The field of the slice the caller reads. */
  readonly field: 'pivot' | 'center';
  /** How to give a named slice the field, in Aseprite. */
  readonly named: string;
  /** How to give any slice of the frame the field, in Aseprite. */
  readonly any: string;
  /** How to do without a slice. */
  readonly fix: string;
}

/**
 * The measures of the untrimmed frame, `[width, height]` in pixels: the `sourceSize` of its data where
 * it carries a valid one, else the drawn measures of its coords — turned under `FLIP_DIAGONAL`. For a
 * frame {@link sliceOf} found a slice in, whose data is an object. Writes into `target` and answers
 * it. @internal
 */
export function untrimmedSizeOf(frame: TextureAtlasFrame<unknown>, target: [number, number]): [number, number] {
  const sourceSize = (frame.data as Record<string, unknown>)['sourceSize'];
  const w = isObject(sourceSize) ? sourceSize['w'] : undefined;
  const h = isObject(sourceSize) ? sourceSize['h'] : undefined;
  if (isFiniteNumber(w) && isFiniteNumber(h) && w > 0 && h > 0) {
    target[0] = w;
    target[1] = h;
  } else {
    const {coords} = frame;
    target[0] = coords.flipD ? coords.height : coords.width;
    target[1] = coords.flipD ? coords.width : coords.height;
  }
  return target;
}

const namesOf = (slices: Record<string, unknown>): string => Object.keys(slices).join(', ') || '(none)';

// the refusal of several slices that carry the field — out of sliceOf(): a closure over its locals
// would make V8 build a context for them on every call
function ambiguous(slices: Record<string, unknown>, field: SliceWanted['field'], where: string): Error {
  const holders = Object.keys(slices).filter((key) => (slices[key] as AsepriteFrameSlice)[field] != null);
  return new Error(
    `${where}: the slices ${holders.map((key) => `"${key}"`).join(', ')} of the frame have a ${field} — name one: ${where}(frame, "${holders[0]}")`,
  );
}

/**
 * The Aseprite slice of `frame` named `name`, or — without a name — the one slice of the frame that
 * carries `wanted.field`. The slices are the ones `AsepriteJson.parse()` writes into the frame's data.
 * Refused, in the words of `where`, each naming the fix: a frame without slices, a name it does not
 * carry, a slice without the field, and no or several slices with it. Allocates nothing on its way
 * through. @internal
 */
export function sliceOf(
  frame: TextureAtlasFrame<unknown>,
  name: string | undefined,
  wanted: SliceWanted,
  where: string,
): AsepriteFrameSlice {
  const slices = isObject(frame.data) ? frame.data['slices'] : undefined;
  if (!isObject(slices)) {
    throw new Error(
      `${where}: the frame carries no slices — read the sheet with AsepriteJson.parse(), exported with its slices (--list-slices), or ${wanted.fix}`,
    );
  }
  const {field} = wanted;
  if (name !== undefined) {
    const slice = slices[name] as AsepriteFrameSlice | undefined;
    if (slice == null) throw new Error(`${where}: the frame carries no slice "${name}" — its slices are: ${namesOf(slices)}`);
    if (slice[field] == null)
      throw new Error(`${where}: the slice "${name}" has no ${field} — ${wanted.named}, or ${wanted.fix}`);
    return slice;
  }
  let found: AsepriteFrameSlice | undefined;
  let count = 0;
  // a for…in, not Object.keys(): the lookup runs where a sprite changes its frame, and builds no array
  for (const key in slices) {
    const slice = slices[key] as AsepriteFrameSlice;
    if (slice[field] == null) continue;
    found ??= slice;
    count++;
  }
  if (found == null) {
    throw new Error(
      `${where}: no slice of the frame has a ${field} — its slices are: ${namesOf(slices)}; ${wanted.any}, or ${wanted.fix}`,
    );
  }
  if (count > 1) throw ambiguous(slices, field, where);
  return found;
}

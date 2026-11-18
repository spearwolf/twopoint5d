import {describeValue} from './describeValue.js';

/**
 * A named easing, or a function from the linear progress `0…1` to the eased one. Its answer is
 * clamped to `[0, 1]`, and an answer that is no number counts as 0.
 */
export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | ((t: number) => number);

const EASING_NAMES = ['linear', 'ease-in', 'ease-out', 'ease-in-out'] as const;

/**
 * An easing as its user keeps it: the index of a named one in `EASING_NAMES`, or the function of
 * the caller.
 * @internal
 */
export type EasingSpec = number | ((t: number) => number);

/**
 * The easing an option names, or the function it is. Throws a `TypeError` naming `subject` and the
 * option, `name`, for anything else.
 * @internal
 */
export function easingOf(subject: string, easing: unknown, name = 'easing'): EasingSpec {
  if (typeof easing === 'function') return easing as (t: number) => number;
  const index = typeof easing === 'string' ? EASING_NAMES.indexOf(easing as (typeof EASING_NAMES)[number]) : -1;
  if (index === -1) {
    throw new TypeError(
      `${subject}: ${name} must be 'linear', 'ease-in', 'ease-out', 'ease-in-out' or a function, got ${describeValue(easing)}`,
    );
  }
  return index;
}

/**
 * The eased progress in `slot[0]`, written back into the slot and clamped to `[0, 1]`: an easing
 * that overshoots — a back or an elastic curve of the caller — stops at the ends, and an answer that
 * is no number — `NaN`, `undefined` — counts as 0. For a hot path that keeps its fractions out of
 * the arguments and the answers of calls: V8 boxes a fraction it hands to a call it does not inline,
 * and one such a call answers, while a typed array holds one as it is. The named easings are cubic
 * and worked out on the slot, as products, since `**` hands its double to the runtime; a function of
 * the caller is called with the progress.
 * @internal
 */
export function applyEasingInPlace(spec: EasingSpec, slot: Float64Array): void {
  const t = slot[0]!;
  let e = t;
  if (typeof spec === 'function') {
    e = spec(t);
  } else if (spec === 1) {
    e = t * t * t;
  } else if (spec === 2) {
    const u = 1 - t;
    e = 1 - u * u * u;
  } else if (spec === 3) {
    const u = 2 - 2 * t;
    e = t < 0.5 ? 4 * t * t * t : 1 - (u * u * u) / 2;
  }
  // a comparison is false for NaN and for anything that is no number, so those fall on 0
  // biome-ignore lint/complexity/useMathMinMax: Math.min() and Math.max() carry NaN through, which the comparison drops
  slot[0] = e > 0 ? (e < 1 ? e : 1) : 0;
}

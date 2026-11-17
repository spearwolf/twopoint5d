import {describeValue} from './describeValue.js';

/** A named easing, or a function from the linear progress `0…1` to the eased one. */
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
 * The eased progress of `t` (`0…1`) under `spec`. The named easings are cubic and worked out in
 * place, as products: a double handed to a call that V8 does not inline is boxed, and so is one
 * that `**` hands to the runtime. A function of the caller is called as it is.
 * @internal
 */
export function applyEasing(spec: EasingSpec, t: number): number {
  if (typeof spec === 'function') return spec(t);
  if (spec === 1) return t * t * t;
  if (spec === 2) {
    const u = 1 - t;
    return 1 - u * u * u;
  }
  if (spec === 3) {
    const u = 2 - 2 * t;
    return t < 0.5 ? 4 * t * t * t : 1 - (u * u * u) / 2;
  }
  return t;
}

/**
 * {@link applyEasing} of the progress in `slot[0]`, written back into the slot. For a hot path that
 * keeps its fractions out of the arguments and the answers of calls: V8 boxes a fraction it hands to
 * a call it does not inline, and one such a call answers, while a typed array holds one as it is.
 * The named easings are worked out on the slot, as {@link applyEasing} works them out; a function of
 * the caller is called with the progress.
 * @internal
 */
export function applyEasingInPlace(spec: EasingSpec, slot: Float64Array): void {
  const t = slot[0]!;
  if (typeof spec === 'function') {
    slot[0] = spec(t);
  } else if (spec === 1) {
    slot[0] = t * t * t;
  } else if (spec === 2) {
    const u = 1 - t;
    slot[0] = 1 - u * u * u;
  } else if (spec === 3) {
    const u = 2 - 2 * t;
    slot[0] = t < 0.5 ? 4 * t * t * t : 1 - (u * u * u) / 2;
  }
}

/** the step of the state of the generator */
const STEP = 0x6d2b79f5;

/** the mix of the state of the generator, as a value in [0, 1) */
function mix32(state: number): number {
  let t = state;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** A small seeded generator (a 32-bit mulberry): a seeded scene lays out and flickers the same on every run. */
export class SeededRandom {
  #state: number;

  constructor(seed: number) {
    this.#state = seed >>> 0;
  }

  /** The next value, in [0, 1). */
  next(): number {
    this.#state = (this.#state + STEP) >>> 0;
    return mix32(this.#state);
  }

  /** A value in [min, max), drawn with the next value of the generator. */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
}

/**
 * The value that the `index`-th call of `next()` of a `new SeededRandom(seed)` returns, counted
 * from 0, without the calls before it: a random that hangs on a time step
 * (`Math.floor(time * rate)`) and not on the frame, so every frame rate draws the same values at
 * the same time.
 */
export const randomAt = (seed: number, index: number): number => mix32(((seed >>> 0) + Math.imul(index + 1, STEP)) >>> 0);

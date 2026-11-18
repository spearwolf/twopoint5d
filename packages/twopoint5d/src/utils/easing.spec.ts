import {describe, expect, test} from 'vitest';
import type {StageTransitionEasing, StageTransitionEasingSpec} from '../stage/StageTransition.js';
import {applyEasingInPlace, type Easing, type EasingSpec, easingOf} from './easing.js';

const STEPS = [0, 0.25, 0.5, 0.75, 1];

const curves: Record<string, (t: number) => number> = {
  linear: (t) => t,
  'ease-in': (t) => t * t * t,
  'ease-out': (t) => 1 - (1 - t) ** 3,
  'ease-in-out': (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2),
};

describe('easing', () => {
  for (const [name, curve] of Object.entries(curves)) {
    test(`'${name}' maps t to its curve at 0, 1/4, 1/2, 3/4 and 1`, () => {
      const spec = easingOf('test', name);
      const slot = new Float64Array(1);
      for (const t of STEPS) {
        slot[0] = t;
        applyEasingInPlace(spec, slot);
        expect(slot[0]).toBeCloseTo(curve(t), 12);
      }
    });
  }

  test('applyEasingInPlace() writes the curve into the slot, clamped to [0, 1], for every easing', () => {
    const slot = new Float64Array(1);
    const overshoot = (t: number) => t * 2 - 0.5;
    for (const easing of [...Object.keys(curves), overshoot] as Easing[]) {
      const spec = easingOf('test', easing);
      const curve = typeof easing === 'function' ? easing : curves[easing]!;
      for (const t of [...STEPS, 0.1, 0.49, 0.51, 0.9]) {
        slot[0] = t;
        applyEasingInPlace(spec, slot);
        expect(slot[0]).toBeCloseTo(Math.min(1, Math.max(0, curve(t))), 12);
      }
    }
  });

  test('applyEasingInPlace() clamps an easing that overshoots to [0, 1]', () => {
    const slot = new Float64Array(1);
    const spec = easingOf('test', (t: number) => t * 2 - 0.5);
    for (const [t, expected] of [
      [0, 0],
      [0.125, 0],
      [0.5, 0.5],
      [0.875, 1],
      [1, 1],
    ]) {
      slot[0] = t!;
      applyEasingInPlace(spec, slot);
      expect(slot[0], `at ${t}`).toBe(expected);
    }
  });

  test('applyEasingInPlace() writes 0 for an easing that answers no number', () => {
    const slot = new Float64Array(1);
    const answers: [string, (t: number) => number][] = [
      ['NaN', () => Number.NaN],
      // an easing of the caller that forgot its return
      ['undefined', (() => {}) as unknown as (t: number) => number],
      ['null', (() => null) as unknown as (t: number) => number],
    ];
    for (const [what, fn] of answers) {
      slot[0] = 0.5;
      applyEasingInPlace(easingOf('test', fn), slot);
      expect(slot[0], what).toBe(0);
    }
  });

  test('a function passes through, as it is', () => {
    const fn = (t: number) => t * 2;
    expect(easingOf('test', fn)).toBe(fn);
    const slot = new Float64Array([0.25]);
    applyEasingInPlace(fn, slot);
    expect(slot[0]).toBe(0.5);
  });

  test('an unknown name and a non-function are refused with the subject first', () => {
    const message = `easing must be 'linear', 'ease-in', 'ease-out', 'ease-in-out' or a function, got`;
    expect(() => easingOf('new Thing()', 'bounce')).toThrow(new TypeError(`new Thing(): ${message} "bounce"`));
    expect(() => easingOf('Thing#go()', 3)).toThrow(new TypeError(`Thing#go(): ${message} 3`));
    expect(() => easingOf('Thing#go()', undefined)).toThrow(TypeError);
  });

  test('the transition aliases are the shared types', () => {
    const a: Easing = 'ease-in';
    const b: StageTransitionEasing = a;
    const c: EasingSpec = easingOf('test', b);
    const d: StageTransitionEasingSpec = c;
    expect(d).toBe(1);
  });
});

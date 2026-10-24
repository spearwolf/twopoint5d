import {Vector3} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {deepFreeze} from './deepFreeze.js';

describe('deepFreeze()', () => {
  test('freezes nested records and arrays down to the leaves, and answers the same object', () => {
    const value = {a: {b: [1, {c: 2}]}, d: Object.create(null) as Record<string, unknown>};
    value.d['e'] = [3];

    expect(deepFreeze(value)).toBe(value);
    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(value.a)).toBe(true);
    expect(Object.isFrozen(value.a.b)).toBe(true);
    expect(Object.isFrozen(value.a.b[1])).toBe(true);
    expect(Object.isFrozen(value.d)).toBe(true);
    expect(Object.isFrozen(value.d['e'])).toBe(true);
  });

  test('leaves a function, a typed array with elements and an instance of another class as they are, with what they hold', () => {
    const fn = Object.assign(() => 0, {extra: {x: 1}});
    const floats = new Float32Array([1, 2]);
    const vector = new Vector3(1, 2, 3);
    const value = deepFreeze({fn, floats, vector});

    expect(Object.isFrozen(value)).toBe(true);
    expect(Object.isFrozen(fn)).toBe(false);
    expect(Object.isFrozen(fn.extra)).toBe(false);
    expect(Object.isFrozen(floats)).toBe(false);
    expect(Object.isFrozen(vector)).toBe(false);
    vector.x = 4;
    expect(vector.x).toBe(4);
  });

  test('calls no getter', () => {
    let reads = 0;
    const value = {
      get counted() {
        reads++;
        return {x: 1};
      },
    };

    deepFreeze(value);

    expect(reads).toBe(0);
    expect(Object.isFrozen(value)).toBe(true);
  });

  test('survives a cycle', () => {
    const a: Record<string, unknown> = {};
    const b: Record<string, unknown> = {a};
    a['b'] = b;

    deepFreeze(a);

    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(b)).toBe(true);
  });

  test('walks an object frozen flat down to its children', () => {
    const inner = {x: 1};
    const value = Object.freeze({inner});

    deepFreeze(value);

    expect(Object.isFrozen(inner)).toBe(true);
  });

  test('follows a symbol key', () => {
    const key = Symbol('key');
    const inner = {x: 1};

    deepFreeze({[key]: inner});

    expect(Object.isFrozen(inner)).toBe(true);
  });
});

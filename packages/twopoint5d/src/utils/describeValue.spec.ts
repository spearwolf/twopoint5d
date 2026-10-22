import {describe, expect, test} from 'vitest';
import {describeValue} from './describeValue.js';

describe('describeValue', () => {
  test('shows a string in double quotes, unescaped', () => {
    expect(describeValue('16')).toBe('"16"');
    expect(describeValue('a "b"')).toBe('"a "b""');
  });

  test('shows a BigInt with its n', () => {
    expect(describeValue(1n)).toBe('1n');
  });

  test('shows a function by its name', () => {
    function named() {
      return 1;
    }
    expect(describeValue(named)).toBe('[Function: named]');
    expect(describeValue(Object.defineProperty(() => 1, 'name', {value: ''}))).toBe('[Function]');
  });

  test('shows an array by its entries', () => {
    expect(describeValue([1.5, NaN, -1])).toBe('[1.5, NaN, -1]');
    expect(describeValue(['a', 2])).toBe('["a", 2]');
    expect(describeValue([])).toBe('[]');
  });

  test('shows a plain object by its keys and values', () => {
    expect(describeValue({value: 1n})).toBe('{value: 1n}');
    expect(describeValue({value: NaN, shared: 'yes'})).toBe('{value: NaN, shared: "yes"}');
    expect(describeValue({'a b': 1})).toBe('{"a b": 1}');
    expect(describeValue({})).toBe('{}');
    expect(describeValue(Object.create(null))).toBe('{}');
  });

  test('shows at most eight entries', () => {
    expect(describeValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe('[1, 2, 3, 4, 5, 6, 7, 8, …]');
    expect(describeValue({a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9})).toBe(
      '{a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, …}',
    );
  });

  test('shows three levels and no deeper, a cycle included', () => {
    expect(describeValue([[[[1]]]])).toBe('[[[[…]]]]');
    expect(describeValue({a: {b: {c: {d: 1}}}})).toBe('{a: {b: {c: {…}}}}');
    expect(describeValue([[[[]]]])).toBe('[[[[…]]]]');
    const cycle: unknown[] = [];
    cycle.push(cycle);
    expect(describeValue(cycle)).toBe('[[[[…]]]]');
  });

  test.each([
    [NaN, 'NaN'],
    [-Infinity, '-Infinity'],
    [true, 'true'],
    [null, 'null'],
    [undefined, 'undefined'],
    [Symbol('a'), 'Symbol(a)'],
    [/a/g, '/a/g'],
    [new Map(), '[object Map]'],
    [new (class Thing {})(), '[object Object]'],
  ])('shows anything else as String() does: %s', (value, written) => {
    expect(describeValue(value)).toBe(written);
  });
});

import {describe, expect, test} from 'vitest';
import {describeValue} from './describeValue.js';

describe('describeValue', () => {
  test('shows a string in double quotes, unescaped', () => {
    expect(describeValue('16')).toBe('"16"');
    expect(describeValue('a "b"')).toBe('"a "b""');
  });

  test('cuts a string of more than 120 UTF-16 units short after 120, and keeps one of 120 whole', () => {
    expect(describeValue('a'.repeat(121))).toBe(`"${'a'.repeat(120)}…"`);
    expect(describeValue('a'.repeat(120))).toBe(`"${'a'.repeat(120)}"`);
  });

  test('ends a string it cuts short before a surrogate pair that unit 120 would split', () => {
    // the emoji takes the units 119 and 120 — the 120th unit is its high surrogate
    const value = `${'a'.repeat(119)}😀${'b'.repeat(10)}`;
    expect(describeValue(value)).toBe(`"${'a'.repeat(119)}…"`);
  });

  test('cuts a long string short inside an array as well', () => {
    expect(describeValue(['a'.repeat(200)])).toBe(`["${'a'.repeat(120)}…"]`);
  });

  test('shows a typed array by its kind and its entries, at most eight of them', () => {
    expect(describeValue(new Float32Array([1.5, Number.NaN]))).toBe('Float32Array [1.5, NaN]');
    expect(describeValue(new Uint8Array(10))).toBe('Uint8Array [0, 0, 0, 0, 0, 0, 0, 0, …]');
    expect(describeValue(new BigInt64Array([1n]))).toBe('BigInt64Array [1n]');
    expect(describeValue([[[new Float32Array([1])]]])).toBe('[[[Float32Array […]]]]');
  });

  test('shows a DataView as String() does', () => {
    expect(describeValue(new DataView(new ArrayBuffer(4)))).toBe('[object DataView]');
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

  test('shows an accessor of a plain object by its kind and calls none of them', () => {
    let calls = 0;
    const object = {
      get a() {
        calls++;
        return 1;
      },
      set b(_value: number) {
        calls++;
      },
      get c() {
        calls++;
        return 1;
      },
      set c(_value: number) {
        calls++;
      },
    };
    expect(describeValue(object)).toBe('{a: [Getter], b: [Setter], c: [Getter/Setter]}');
    expect(calls).toBe(0);
  });

  test('shows an accessor of an array the same way, one that throws included', () => {
    const array = [1, 2];
    Object.defineProperty(array, 1, {
      get() {
        throw new Error('read');
      },
      enumerable: true,
    });
    expect(describeValue(array)).toBe('[1, [Getter]]');
  });

  const revoked = (): object => {
    const {proxy, revoke} = Proxy.revocable({}, {});
    revoke();
    return proxy;
  };

  test.each([
    [
      'an object whose toString() throws',
      new (class Hostile {
        toString(): string {
          throw new Error('toString');
        }
      })(),
    ],
    ['an object without a toString()', Object.create(Object.create(null))],
    ['a revoked proxy', revoked()],
    [
      'a proxy whose ownKeys() throws',
      new Proxy(
        {},
        {
          ownKeys() {
            throw new Error('keys');
          },
        },
      ),
    ],
  ])('writes a value that throws while it is shown as [object]: %s', (_name, value) => {
    expect(describeValue(value)).toBe('[object]');
  });

  test('writes a value that throws beside others in its place, and the others as they are', () => {
    expect(describeValue({a: 1, b: revoked()})).toBe('{a: 1, b: [object]}');
    expect(describeValue([1, revoked()])).toBe('[1, [object]]');
  });

  test('writes a function whose name throws as [Function]', () => {
    const fn = Object.defineProperty(function f() {}, 'name', {
      get() {
        throw new Error('name');
      },
    });
    expect(describeValue(fn)).toBe('[Function]');
  });

  test('shows a hole of an array as the array literal does', () => {
    // biome-ignore lint/suspicious/noSparseArray: the hole is the subject of the test
    expect(describeValue([1, , 3])).toBe('[1, , 3]');
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

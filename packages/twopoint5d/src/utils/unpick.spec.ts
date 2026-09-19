import {describe, expect, test} from 'vitest';
import {unpick} from './unpick.js';

describe('unpick', () => {
  test('works as expected', () => {
    expect(unpick({foo: 'bar', xyz: 123}, 'xyz')).toEqual({foo: 'bar'});
  });

  test('with symbols', () => {
    const Plah = Symbol('plah');
    const Other = Symbol('other');
    const result = unpick({foo: 'bar', xyz: 123, [Plah]: 666, [Other]: 42}, Plah)!;

    expect(Object.getOwnPropertySymbols(result)).toEqual([Other]);
    expect((result as Record<symbol, unknown>)[Other]).toBe(42);
    expect(Object.keys(result)).toEqual(['foo', 'xyz']);
  });

  test('with multiple keys', () => {
    const Plah = Symbol('plah');
    const Other = Symbol('other');
    const result = unpick({foo: 'bar', xyz: 123, [Plah]: 666, [Other]: 42}, Plah, 'foo')!;

    expect(Object.getOwnPropertySymbols(result)).toEqual([Other]);
    expect(Object.keys(result)).toEqual(['xyz']);
  });

  test('keeps a symbol key it is not asked to remove', () => {
    const S = Symbol('s');
    const result = unpick({[S]: 1, a: 2}, 'a')!;

    expect(Object.getOwnPropertySymbols(result)).toEqual([S]);
    expect((result as Record<symbol, unknown>)[S]).toBe(1);
    expect(Object.keys(result)).toEqual([]);
  });

  test('takes no property that is not enumerable', () => {
    const S = Symbol('s');
    const source = {a: 1};
    Object.defineProperty(source, 'hidden', {value: 2, enumerable: false});
    Object.defineProperty(source, S, {value: 3, enumerable: false});

    const result = unpick(source)!;

    expect(Reflect.ownKeys(result)).toEqual(['a']);
  });

  test('keeps an own "__proto__" key as a data property and leaves the prototype alone', () => {
    const source: Record<string, unknown> = JSON.parse('{"__proto__": {"polluted": 1}, "a": 2}');
    const result = unpick(source)!;

    expect(Reflect.ownKeys(result)).toEqual(['__proto__', 'a']);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(result, '__proto__')).toEqual({
      value: {polluted: 1},
      writable: true,
      enumerable: true,
      configurable: true,
    });
    expect('polluted' in result).toBe(false);
  });

  test.each([null, 5, 'x'])('keeps an own "__proto__" key whose value is %s', (value) => {
    const source: Record<string, unknown> = JSON.parse(`{"__proto__": ${JSON.stringify(value)}, "a": 2}`);
    const result = unpick(source)!;

    expect(Reflect.ownKeys(result)).toEqual(['__proto__', 'a']);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(result, '__proto__')?.value).toBe(value);
  });

  test('drops an own "__proto__" key it is asked to remove', () => {
    const source: Record<string, unknown> = JSON.parse('{"__proto__": {"polluted": 1}, "a": 2}');
    const result = unpick(source, '__proto__')!;

    expect(Reflect.ownKeys(result)).toEqual(['a']);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  test('return undefined if object is not defined', () => {
    expect(unpick(undefined)).toBeUndefined();
    expect(unpick(undefined as any, 'foo', 'bar')).toBeUndefined();
    expect(unpick(null)).toBeUndefined();
  });
});

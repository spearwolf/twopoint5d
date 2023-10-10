import {unpick} from './unpick.js';

describe('unpick', () => {
  test('works as expected', () => {
    expect(unpick({foo: 'bar', xyz: 123}, 'xyz')).toEqual({foo: 'bar'});
  });

  test('with symbols', () => {
    const Plah = Symbol('plah');
    expect(unpick({foo: 'bar', xyz: 123, [Plah]: 666}, Plah)).toEqual({foo: 'bar', xyz: 123});
  });

  test('with multiple keys', () => {
    const Plah = Symbol('plah');
    expect(unpick({foo: 'bar', xyz: 123, [Plah]: 666}, Plah, 'foo')).toEqual({xyz: 123});
  });

  test('return undefined if object is not defined', () => {
    expect(unpick(undefined)).toBeUndefined();
    expect(unpick(undefined as any, 'foo', 'bar')).toBeUndefined();
    expect(unpick(null)).toBeUndefined();
  });
});

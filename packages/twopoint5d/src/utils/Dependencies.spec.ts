import {Dependencies} from './Dependencies';

describe('Dependencies', () => {
  test('construction', () => {
    const deps = new Dependencies(['a', ['b', (a, b) => a === b]]);
    expect(deps).toBeDefined();
  });

  test('equals without equality callback', () => {
    const deps = new Dependencies(['a', 'b']);

    deps.update({a: 1, b: 'foo'});

    expect(deps.equals({a: 1, b: 'foo'})).toBe(true);
  });

  test('equals with equality callback', () => {
    const deps = new Dependencies([
      ['a', (a: number, b: number) => b === a + 1],
      ['b', (a: string, b: string) => b === `${a}XXX`],
    ]);

    deps.update({a: 1, b: 'foo'});

    expect(deps.equals({a: 1, b: 'foo'})).toBe(false);

    expect(deps.equals({a: 2, b: 'fooXXX'})).toBe(true);
  });

  test('changed() updates the state', () => {
    const deps = new Dependencies([
      ['a', (a: number, b: number) => b === a + 1],
      ['b', (a: string, b: string) => b === `${a}XXX`],
      'c',
      'd',
    ]);

    deps.update({a: 1, b: 'foo', c: undefined});

    expect(deps.changed({a: 2, b: 'fooXXX', c: 23})).toBe(true);

    expect(deps.equals({a: 3, b: 'fooXXXXXX', c: 23})).toBe(true);

    expect(deps.changed({a: 3, b: 'fooXXXXXX', c: 23})).toBe(false);

    expect(deps.equals({a: 3, b: 'fooXXXXXX', c: 23})).toBe(true);
  });
});

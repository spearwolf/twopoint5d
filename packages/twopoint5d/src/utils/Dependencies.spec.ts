import {Vector2} from 'three';
import {describe, expect, test} from 'vitest';

import {Dependencies} from './Dependencies.js';

type Ref = {current: Object};

const refEquals = (a: Ref, b: Ref) => a?.current === b?.current;

describe('Dependencies', () => {
  test('construction', () => {
    const deps = new Dependencies([]);
    expect(deps).toBeDefined();
  });

  test('equals without equality callback', () => {
    const deps = new Dependencies(['a', 'b']);

    deps.update({a: 1, b: 'foo'});

    expect(deps.equals({a: 1, b: 'foo'})).toBe(true);
  });

  test('equals with equality callback', () => {
    const deps = new Dependencies([
      ['a', (a: number, b: number) => a === b],
      ['b', {equals: (a: string, b: string) => a === b}],
      ['c', {equals: refEquals}],
    ]);

    const c = {current: {}};

    deps.update({a: 1, b: 'foo', c});

    expect(deps.equals({a: 1, b: 'foo', c})).toBe(true);
    expect(deps.equals({a: 1, b: 'foo', c: {current: c.current}})).toBe(true);

    expect(deps.equals({a: 2, b: 'foo', c})).toBe(false);
    expect(deps.equals({a: 1, b: 'bar', c})).toBe(false);
    expect(deps.equals({a: 2, b: 'bar', c})).toBe(false);
    expect(deps.equals({a: 1, b: 'foo', c: {current: {}}})).toBe(false);
    expect(deps.equals({a: 1, b: 'foo', c: null})).toBe(false);
    expect(deps.equals({a: 1, b: 'foo', c: undefined})).toBe(false);
    expect(deps.equals({a: 1, b: 'foo'})).toBe(false);

    expect(deps.equals({})).toBe(false);
  });

  test('changed() updates the state', () => {
    const deps = new Dependencies([
      ['a', (a: number, b: number) => b === a],
      ['b', {equals: (a: string, b: string) => b === a}],
      'c',
      'd',
    ]);

    deps.update({a: 1, b: 'foo', c: undefined});

    expect(deps.changed({a: 2, b: 'fooXXX', c: 23})).toBe(true);

    expect(deps.equals({a: 2, b: 'fooXXX', c: 23})).toBe(true);

    expect(deps.changed({a: 2, b: 'fooXXX', c: 23})).toBe(false);

    expect(deps.equals({a: 2, b: 'fooXXX', c: 23})).toBe(true);
  });

  test('copy and clone', () => {
    const deps = new Dependencies([Dependencies.cloneable<Vector2>('v')]);

    expect(deps.changed({v: new Vector2()})).toBe(true);
    expect(deps.changed({v: new Vector2()})).toBe(false);

    const v = new Vector2(1, 2);
    expect(deps.changed({v})).toBe(true);

    const vDeps = {v};
    expect(deps.changed(vDeps)).toBe(false);

    v.set(2, 3);
    expect(deps.changed(vDeps)).toBe(true);

    expect(v.equals(new Vector2(2, 3))).toBe(true);
    expect(deps.value('v').equals(new Vector2(2, 3))).toBe(true);
    expect(deps.value('v')).not.toBe(v);

    expect(deps.changed({v: null})).toBe(true);
    expect(deps.changed({v: undefined})).toBe(false);
    expect(deps.changed({})).toBe(false);
  });
});

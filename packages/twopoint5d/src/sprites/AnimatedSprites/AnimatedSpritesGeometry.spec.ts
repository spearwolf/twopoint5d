import {createSandbox} from 'sinon';
import {afterEach, describe, expect, expectTypeOf, test} from 'vitest';

import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import type {BaseSprite} from '../BaseSprite.js';
import {AnimatedSpritesGeometry} from './AnimatedSpritesGeometry.js';

describe('AnimatedSpritesGeometry', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('builds a sprite pool of 100 and a base pool holding one base sprite by default', () => {
    const geometry = new AnimatedSpritesGeometry();

    expect(geometry.instancedPool.capacity).toBe(100);
    expect(geometry.basePool.capacity).toBe(1);
    expect(geometry.basePool.usedCount).toBe(1);
    expect(geometry.name).toBe('twopoint5d.AnimatedSpritesGeometry');

    geometry.dispose();
  });

  test('makes the base sprite a quad of half width and height 0.5 around the origin', () => {
    const geometry = new AnimatedSpritesGeometry();
    const base = geometry.basePool.getVO(0)!;

    expect([base.x0, base.y0]).toEqual([-0.5, -0.5]);
    expect([base.x1, base.y1]).toEqual([-0.5, 0.5]);
    expect([base.x2, base.y2]).toEqual([0.5, 0.5]);
    expect([base.x3, base.y3]).toEqual([0.5, -0.5]);
    expect([base.z0, base.z1, base.z2, base.z3]).toEqual([0, 0, 0, 0]);
    expect([base.u0, base.v0]).toEqual([0, 1]);
    expect([base.u1, base.v1]).toEqual([0, 0]);
    expect([base.u2, base.v2]).toEqual([1, 0]);
    expect([base.u3, base.v3]).toEqual([1, 1]);

    geometry.dispose();
  });

  test('makes the base sprite from the arguments it is given', () => {
    const geometry = new AnimatedSpritesGeometry(4, [2, 3, 1, 1]);
    const base = geometry.basePool.getVO(0)!;

    expect([base.x0, base.y0]).toEqual([-1, -2]);
    expect([base.x1, base.y1]).toEqual([-1, 4]);
    expect([base.x2, base.y2]).toEqual([3, 4]);
    expect([base.x3, base.y3]).toEqual([3, -2]);

    geometry.dispose();
  });

  test('takes the usage of each attribute from the sprite description', () => {
    const geometry = new AnimatedSpritesGeometry(4);
    const usageOf = (name: string) => geometry.instancedPool.descriptor.getAttribute(name)!.usageType;

    expect(usageOf('quadSize')).toBe('static');
    expect(usageOf('anim')).toBe('static');
    expect(usageOf('instancePosition')).toBe('dynamic');
    expect(usageOf('rotation')).toBe('dynamic');

    geometry.dispose();
  });

  test('throws when the base pool has no room for the base sprite', () => {
    // without the stub this path is unreachable: the base pool is built fresh with a capacity of 1
    sandbox.stub(VertexObjectPool.prototype, 'createVO').returns(undefined);

    expect(() => new AnimatedSpritesGeometry(4)).toThrow(
      'AnimatedSpritesGeometry: the base pool has no room for the base sprite',
    );
  });

  test('declares a base pool that is always there', () => {
    const geometry = new AnimatedSpritesGeometry();

    expectTypeOf(geometry.basePool).toEqualTypeOf<VertexObjectPool<BaseSprite>>();
    expect(geometry.basePool).toBeDefined();

    geometry.dispose();
  });

  test('declares its base pool read-only (a type-level check)', () => {
    const geometry = new AnimatedSpritesGeometry();

    // the @ts-expect-error lines carry the claim: `pnpm typecheck` fails as soon as the field takes a
    // write; Vitest checks nothing here. The function is never called.
    const assignPool = (basePool: VertexObjectPool<BaseSprite>) => {
      // @ts-expect-error the pool is built by the constructor and is read-only
      geometry.basePool = basePool;
    };
    void assignPool;

    geometry.dispose();
  });
});

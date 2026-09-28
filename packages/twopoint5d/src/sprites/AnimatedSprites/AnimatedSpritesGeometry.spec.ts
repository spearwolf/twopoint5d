import {createSandbox} from 'sinon';
import {afterEach, describe, expect, expectTypeOf, test} from 'vitest';

import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {AnimatedSpriteDescriptor} from './AnimatedSprite.js';
import {AnimatedSpritesGeometry, type AnimatedSpritesBasePool, type AnimatedSpritesPool} from './AnimatedSpritesGeometry.js';

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
    expect(geometry.isAnimatedSpritesGeometry).toBe(true);

    geometry.dispose();
  });

  test('shares the descriptors of its pools and the prototype of its sprites with every other geometry', () => {
    const a = new AnimatedSpritesGeometry(10);
    const b = new AnimatedSpritesGeometry(10);

    expect(b.instancedPool.descriptor).toBe(a.instancedPool.descriptor);
    expect(b.basePool.descriptor).toBe(a.basePool.descriptor);
    expect(Object.getPrototypeOf(b.instancedPool.createVO())).toBe(Object.getPrototypeOf(a.instancedPool.createVO()));

    a.dispose();
    b.dispose();
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

  test('gives the attributes named in attributeUsage their usage, size and position included', () => {
    const geometry = new AnimatedSpritesGeometry({
      capacity: 8,
      attributeUsage: {dynamic: ['size', 'anim'], static: ['position', 'rotation']},
    });
    const usageOf = (name: string) => geometry.instancedPool.descriptor.getAttribute(name)!.usageType;

    expect(geometry.instancedPool.capacity).toBe(8);
    expect(usageOf('quadSize')).toBe('dynamic');
    expect(usageOf('anim')).toBe('dynamic');
    expect(usageOf('instancePosition')).toBe('static');
    expect(usageOf('rotation')).toBe('static');

    // the copy did not change the shared description
    expect(AnimatedSpriteDescriptor.attributes['instancePosition']?.usage).toBe('dynamic');

    geometry.dispose();
  });

  test('gives stream through attributeUsage as well', () => {
    const geometry = new AnimatedSpritesGeometry({capacity: 8, attributeUsage: {stream: ['position']}});

    expect(geometry.instancedPool.descriptor.getAttribute('instancePosition')!.usageType).toBe('stream');

    geometry.dispose();
  });

  test('keeps the usage of the sprite description for parameters without attributeUsage', () => {
    const geometry = new AnimatedSpritesGeometry({capacity: 8});
    const usageOf = (name: string) => geometry.instancedPool.descriptor.getAttribute(name)!.usageType;

    expect(geometry.instancedPool.capacity).toBe(8);
    expect(usageOf('quadSize')).toBe('static');
    expect(usageOf('anim')).toBe('static');
    expect(usageOf('instancePosition')).toBe('dynamic');
    expect(usageOf('rotation')).toBe('dynamic');

    geometry.dispose();
  });

  test('shares them for parameters without attributeUsage as well', () => {
    const a = new AnimatedSpritesGeometry({capacity: 4});
    const b = new AnimatedSpritesGeometry(4);

    expect(a.instancedPool.descriptor).toBe(b.instancedPool.descriptor);
    expect(Object.getPrototypeOf(a.instancedPool.createVO())).toBe(Object.getPrototypeOf(b.instancedPool.createVO()));

    a.dispose();
    b.dispose();
  });

  test('builds a descriptor of its own for parameters with attributeUsage', () => {
    const a = new AnimatedSpritesGeometry({capacity: 10, attributeUsage: {static: ['position']}});
    const b = new AnimatedSpritesGeometry({capacity: 10, attributeUsage: {static: ['position']}});
    const fromCapacity = new AnimatedSpritesGeometry(10);

    expect(b.instancedPool.descriptor).not.toBe(a.instancedPool.descriptor);
    expect(a.instancedPool.descriptor).not.toBe(fromCapacity.instancedPool.descriptor);
    expect(b.instancedPool.descriptor).not.toBe(fromCapacity.instancedPool.descriptor);

    a.dispose();
    b.dispose();
    fromCapacity.dispose();
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

    expectTypeOf(geometry.basePool).toEqualTypeOf<AnimatedSpritesBasePool>();
    expect(geometry.basePool).toBeDefined();

    geometry.dispose();
  });

  test('declares its pools read-only (a type-level check)', () => {
    const geometry = new AnimatedSpritesGeometry();

    // the @ts-expect-error lines carry the claim: `pnpm typecheck` fails as soon as a field takes a
    // write; Vitest checks nothing here. The function is never called.
    const assignPools = (basePool: AnimatedSpritesBasePool, instancedPool: AnimatedSpritesPool) => {
      // @ts-expect-error the pools are built by the constructor and are read-only
      geometry.basePool = basePool;
      // @ts-expect-error the pools are built by the constructor and are read-only
      geometry.instancedPool = instancedPool;
    };
    void assignPools;

    geometry.dispose();
  });
});

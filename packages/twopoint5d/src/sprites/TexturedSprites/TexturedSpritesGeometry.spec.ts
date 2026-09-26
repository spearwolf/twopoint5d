import {createSandbox} from 'sinon';
import {afterEach, describe, expect, expectTypeOf, test} from 'vitest';

import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {TexturedSpriteDescriptor} from './TexturedSprite.js';
import {TexturedSpritesGeometry, type TexturedSpritesBasePool} from './TexturedSpritesGeometry.js';

describe('TexturedSpritesGeometry', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  const usageOf = (geometry: TexturedSpritesGeometry, name: string) =>
    geometry.instancedPool.descriptor.getAttribute(name)!.usageType;

  const expectDefaultUsages = (geometry: TexturedSpritesGeometry) => {
    expect(usageOf(geometry, 'quadSize')).toBe('static');
    expect(usageOf(geometry, 'texCoords')).toBe('static');
    expect(usageOf(geometry, 'instancePosition')).toBe('dynamic');
    expect(usageOf(geometry, 'rotation')).toBe('dynamic');
    expect(usageOf(geometry, 'color')).toBe('static');
  };

  test('builds a sprite pool of 100 and a base pool holding one base sprite by default', () => {
    const geometry = new TexturedSpritesGeometry();

    expect(geometry.instancedPool.capacity).toBe(100);
    expect(geometry.basePool.capacity).toBe(1);
    expect(geometry.basePool.usedCount).toBe(1);
    expect(geometry.name).toBe('twopoint5d.TexturedSpritesGeometry');
    expect(geometry.isTexturedSpritesGeometry).toBe(true);

    geometry.dispose();
  });

  test('makes the base sprite a quad of half width and height 0.5 around the origin', () => {
    const geometry = new TexturedSpritesGeometry();
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
    const geometry = new TexturedSpritesGeometry(4, [2, 3, 1, 1]);
    const base = geometry.basePool.getVO(0)!;

    expect([base.x0, base.y0]).toEqual([-1, -2]);
    expect([base.x1, base.y1]).toEqual([-1, 4]);
    expect([base.x2, base.y2]).toEqual([3, 4]);
    expect([base.x3, base.y3]).toEqual([3, -2]);

    geometry.dispose();
  });

  test('takes the usage of each attribute from the sprite description for a capacity number', () => {
    const geometry = new TexturedSpritesGeometry(4);

    expectDefaultUsages(geometry);

    geometry.dispose();
  });

  test('gives the attributes named in attributeUsage their usage, size and position included', () => {
    const geometry = new TexturedSpritesGeometry({
      capacity: 8,
      attributeUsage: {dynamic: ['size'], stream: ['position'], static: ['rotation']},
    });

    expect(geometry.instancedPool.capacity).toBe(8);
    expect(usageOf(geometry, 'quadSize')).toBe('dynamic');
    expect(usageOf(geometry, 'instancePosition')).toBe('stream');
    expect(usageOf(geometry, 'rotation')).toBe('static');
    expect(usageOf(geometry, 'texCoords')).toBe('static');
    expect(usageOf(geometry, 'color')).toBe('static');

    // the copy did not change the shared description
    expect(TexturedSpriteDescriptor.attributes['quadSize']?.usage).toBeUndefined();

    geometry.dispose();
  });

  test.each(['dynamic', 'stream'] as const)(
    'gives texFlipDiagonal the %s usage and the buffer of texCoords when attributeUsage names texCoords',
    (usage) => {
      const geometry = new TexturedSpritesGeometry({capacity: 8, attributeUsage: {[usage]: ['texCoords']}});
      const texCoords = geometry.instancedPool.descriptor.getAttribute('texCoords')!;
      const texFlipDiagonal = geometry.instancedPool.descriptor.getAttribute('texFlipDiagonal')!;

      expect(texCoords.usageType).toBe(usage);
      expect(texFlipDiagonal.usageType).toBe(usage);
      // setFrame() writes both, so a buffer that uploads on its own has to carry both
      expect(texFlipDiagonal.autoTouch).toBe(true);
      expect(texFlipDiagonal.bufferName).toBe(texCoords.bufferName);

      geometry.dispose();
    },
  );

  test('keeps the usage of the sprite description for parameters without attributeUsage', () => {
    const geometry = new TexturedSpritesGeometry({capacity: 8});

    expect(geometry.instancedPool.capacity).toBe(8);
    expectDefaultUsages(geometry);

    geometry.dispose();
  });

  test('throws when the base pool has no room for the base sprite', () => {
    // without the stub this path is unreachable: the base pool is built fresh with a capacity of 1
    sandbox.stub(VertexObjectPool.prototype, 'createVO').returns(undefined);

    expect(() => new TexturedSpritesGeometry(4)).toThrow(
      'TexturedSpritesGeometry: the base pool has no room for the base sprite',
    );
  });

  test('declares a base pool that is always there', () => {
    const geometry = new TexturedSpritesGeometry();

    expectTypeOf(geometry.basePool).toEqualTypeOf<TexturedSpritesBasePool>();
    expect(geometry.basePool).toBeDefined();

    geometry.dispose();
  });

  test('declares its pools read-only (a type-level check)', () => {
    const geometry = new TexturedSpritesGeometry();

    // the @ts-expect-error lines carry the claim: `pnpm typecheck` fails as soon as a field takes a
    // write; Vitest checks nothing here. The function is never called.
    const assignPools = (basePool: TexturedSpritesBasePool, instancedPool: TexturedSpritesGeometry['instancedPool']) => {
      // @ts-expect-error the pools are built by the constructor and are read-only
      geometry.basePool = basePool;
      // @ts-expect-error the pools are built by the constructor and are read-only
      geometry.instancedPool = instancedPool;
    };
    void assignPools;

    geometry.dispose();
  });
});

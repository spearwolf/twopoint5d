import {describe, expect, test} from 'vitest';

import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import type {TileBaseSprite, TileSprite} from './descriptors.js';
import {TileSpritesGeometry} from './TileSpritesGeometry.js';

describe('TileSpritesGeometry', () => {
  // basePool is read without `!` or `?.` on purpose: the line compiles only while the field is
  // typed without `undefined`, which the geometry promises by building the pool itself. That is
  // checked by `pnpm typecheck`; Vitest strips the types and runs the line either way.
  test('builds an instanced pool of the capacity it is given and a base pool holding its one base sprite', () => {
    const geometry = new TileSpritesGeometry(4);

    expect(geometry.instancedPool.capacity).toBe(4);
    expect(geometry.basePool.usedCount).toBe(1);

    geometry.dispose();
  });

  test('declares its pools read-only (a type-level check)', () => {
    const geometry = new TileSpritesGeometry(4);

    // the @ts-expect-error lines carry the claim: `pnpm typecheck` fails as soon as a field takes a
    // write; Vitest checks nothing here. The function is never called.
    const assignPools = (basePool: VertexObjectPool<TileBaseSprite>, instancedPool: VertexObjectPool<TileSprite>) => {
      // @ts-expect-error the pools are built by the constructor and are read-only
      geometry.basePool = basePool;
      // @ts-expect-error the pools are built by the constructor and are read-only
      geometry.instancedPool = instancedPool;
    };
    void assignPools;

    geometry.dispose();
  });
});

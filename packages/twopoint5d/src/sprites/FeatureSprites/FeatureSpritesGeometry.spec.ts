import {describe, expect, expectTypeOf, test} from 'vitest';

import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite} from '../defineSprite.js';
import {AtlasFrame} from '../features/AtlasFrame.js';
import {FlatPlacement} from '../features/FlatPlacement.js';
import {InstancePosition} from '../features/InstancePosition.js';
import {QuadSize} from '../features/QuadSize.js';
import {Rotation} from '../features/Rotation.js';
import {Tint} from '../features/Tint.js';
import {QuadBase, type QuadBaseVO, type SpriteBaseVO} from '../SpriteBase.js';
import {FeatureSpritesGeometry} from './FeatureSpritesGeometry.js';

const kind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AtlasFrame, Tint]});

const usageOf = <Api extends object>(geometry: FeatureSpritesGeometry<Api>, name: string) =>
  geometry.instancedPool.descriptor.getAttribute(name)!.usageType;

describe('FeatureSpritesGeometry', () => {
  test('builds a sprite pool of 100 and a base pool holding one base vertex object by default', () => {
    const geometry = new FeatureSpritesGeometry(kind);

    expect(geometry.instancedPool.capacity).toBe(100);
    expect(geometry.basePool.capacity).toBe(1);
    expect(geometry.basePool.usedCount).toBe(1);
    expect(geometry.kind).toBe(kind);
    expect(geometry.name).toBe('twopoint5d.FeatureSpritesGeometry');
    expect(geometry.isFeatureSpritesGeometry).toBe(true);
    geometry.dispose();
  });

  test('takes a capacity as a number or as a parameter', () => {
    const a = new FeatureSpritesGeometry(kind, 4);
    const b = new FeatureSpritesGeometry(kind, {capacity: 8});

    expect([a.instancedPool.capacity, b.instancedPool.capacity]).toEqual([4, 8]);
    a.dispose();
    b.dispose();
  });

  test('makes the base from its default arguments, or from the baseArgs it is given', () => {
    const unit = new FeatureSpritesGeometry(kind, 1);
    const moved = new FeatureSpritesGeometry(kind, {capacity: 1, baseArgs: [2, 3, 1, 1]});
    const u = unit.basePool.getVO(0) as unknown as QuadBaseVO;
    const m = moved.basePool.getVO(0) as unknown as QuadBaseVO;

    expect([u.x0, u.y0, u.x2, u.y2]).toEqual([-0.5, -0.5, 0.5, 0.5]);
    expect([m.x0, m.y0, m.x2, m.y2]).toEqual([-1, -2, 3, 4]);
    unit.dispose();
    moved.dispose();
  });

  test('takes the usage of each attribute from the kind', () => {
    const geometry = new FeatureSpritesGeometry(kind, 1);

    expect(['quadSize', 'texCoords', 'instancePosition', 'rotation', 'color'].map((n) => usageOf(geometry, n))).toEqual([
      'static',
      'static',
      'dynamic',
      'dynamic',
      'static',
    ]);
    geometry.dispose();
  });

  test('gives the attributes named in attributeUsage their usage, by name or by usage word', () => {
    const geometry = new FeatureSpritesGeometry(kind, {
      capacity: 1,
      attributeUsage: {dynamic: ['size'], stream: ['position'], static: ['rotation']},
    });

    expect(usageOf(geometry, 'quadSize')).toBe('dynamic');
    expect(usageOf(geometry, 'instancePosition')).toBe('stream');
    expect(usageOf(geometry, 'rotation')).toBe('static');
    // the copy did not change the description of the kind
    expect(kind.description.attributes['quadSize']!.usage).toBeUndefined();
    geometry.dispose();
  });

  test.each(['dynamic', 'stream'] as const)(
    'gives texFlipDiagonal and texTrim the %s usage and the buffer of texCoords',
    (usage) => {
      const geometry = new FeatureSpritesGeometry(kind, {capacity: 1, attributeUsage: {[usage]: ['texCoords']}});
      const {descriptor} = geometry.instancedPool;

      for (const name of ['texFlipDiagonal', 'texTrim']) {
        expect(descriptor.getAttribute(name)!.usageType).toBe(usage);
        expect(descriptor.getAttribute(name)!.bufferName).toBe(descriptor.getAttribute('texCoords')!.bufferName);
      }
      geometry.dispose();
    },
  );

  test('shares descriptors and prototype with every geometry of the kind built without attributeUsage', () => {
    const a = new FeatureSpritesGeometry(kind, 2);
    const b = new FeatureSpritesGeometry(kind, {capacity: 2});

    expect(b.instancedPool.descriptor).toBe(a.instancedPool.descriptor);
    expect(b.basePool.descriptor).toBe(a.basePool.descriptor);
    expect(Object.getPrototypeOf(b.instancedPool.createVO())).toBe(Object.getPrototypeOf(a.instancedPool.createVO()));
    a.dispose();
    b.dispose();
  });

  test('builds a descriptor of its own with attributeUsage', () => {
    const a = new FeatureSpritesGeometry(kind, 2);
    const b = new FeatureSpritesGeometry(kind, {capacity: 2, attributeUsage: {dynamic: ['size']}});

    expect(b.instancedPool.descriptor).not.toBe(a.instancedPool.descriptor);
    a.dispose();
    b.dispose();
  });

  test('refuses an attributeUsage word that is neither an attribute nor a usage word of the kind', () => {
    expect(() => new FeatureSpritesGeometry(kind, {capacity: 1, attributeUsage: {dynamic: ['positon']}})).toThrow(
      'FeatureSpritesGeometry: attributeUsage names "positon", which is neither an attribute nor a usage word of the sprite kind; it knows instancePosition, quadSize, rotation, texCoords, texFlipDiagonal, texTrim, color, position, size',
    );
  });

  test('declares its pools read-only and typed by the kind (a type-level check)', () => {
    const geometry = new FeatureSpritesGeometry(kind, 1);

    expectTypeOf(geometry.basePool).toEqualTypeOf<VertexObjectPool<SpriteBaseVO>>();
    expectTypeOf(geometry.instancedPool.createVO()!).toHaveProperty('setFrame');
    const {instancedPool} = geometry;
    // @ts-expect-error the pools are read-only
    geometry.instancedPool = instancedPool;
    geometry.dispose();
  });
});

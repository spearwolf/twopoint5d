import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import type {MeshBasicMaterial} from 'three/webgpu';
import {Scene, Texture} from 'three/webgpu';
import {afterEach, describe, expect, expectTypeOf, test} from 'vitest';

import {defineSprite} from '../defineSprite.js';
import {AtlasFrame} from '../features/AtlasFrame.js';
import {BillboardPlacement} from '../features/BillboardPlacement.js';
import {FlatPlacement} from '../features/FlatPlacement.js';
import {InstancePosition} from '../features/InstancePosition.js';
import {QuadSize} from '../features/QuadSize.js';
import {Rotation} from '../features/Rotation.js';
import {TextureColor} from '../features/TextureColor.js';
import {Tint} from '../features/Tint.js';
import {QuadBase} from '../SpriteBase.js';
import {FeatureSprites} from './FeatureSprites.js';
import {FeatureSpritesGeometry} from './FeatureSpritesGeometry.js';
import {FeatureSpritesMaterial} from './FeatureSpritesMaterial.js';

const kind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AtlasFrame, TextureColor, Tint],
});
const other = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement]});

describe('FeatureSprites', () => {
  const sandbox = createSandbox();
  afterEach(() => sandbox.restore());

  test('builds a geometry of 100 sprites and a material of the kind when it is handed neither', () => {
    const sprites = new FeatureSprites(kind);

    expect(sprites.geometry).toBeInstanceOf(FeatureSpritesGeometry);
    expect(sprites.geometry!.instancedPool.capacity).toBe(100);
    expect(sprites.material).toBeInstanceOf(FeatureSpritesMaterial);
    expect(sprites.kind).toBe(kind);
    expect(sprites.name).toBe('twopoint5d.FeatureSprites');
    expect(sprites.frustumCulled).toBe(false);
    sprites.dispose();
  });

  test('builds its geometry and material from the options', () => {
    const colorMap = new Texture();
    const sprites = new FeatureSprites(kind, {
      capacity: 8,
      attributeUsage: {dynamic: ['size']},
      textures: {colorMap},
      transparent: true,
      placement: BillboardPlacement,
    });

    expect(sprites.spritePool!.capacity).toBe(8);
    expect(sprites.geometry!.instancedPool.descriptor.getAttribute('quadSize')!.usageType).toBe('dynamic');
    expect(sprites.getTexture('colorMap')).toBe(colorMap);
    expect(sprites.material!.transparent).toBe(true);
    expect(sprites.placement).toBe(BillboardPlacement);
    sprites.dispose();
  });

  test('createSprite() hands out a sprite of the kind, freeSprite() takes it back, undefined once full', () => {
    const sprites = new FeatureSprites(kind, {capacity: 1});
    const sprite = sprites.createSprite()!;

    expect(sprites.spritePool!.usedCount).toBe(1);
    expect(sprites.createSprite()).toBeUndefined();
    sprites.freeSprite(sprite);
    expect(sprites.spritePool!.usedCount).toBe(0);
    expectTypeOf(sprite).toHaveProperty('setFrame');
    sprites.dispose();
  });

  test('createSprite() hands out a sprite at the values of an unused slot — 0, and white — whatever its slot held', () => {
    const sprites = new FeatureSprites(kind, {capacity: 1});
    const sprite = sprites.createSprite()!;
    sprite.setSize(4, 4);
    sprite.setPosition(1, 2, 3);
    sprite.rotation = 1;
    sprite.setTexCoords(0.1, 0.2, 0.3, 0.4);
    sprite.setColorValues(0, 0, 0, 0);
    sprites.freeSprite(sprite);

    const again = sprites.createSprite()!;

    expect([again.width, again.height, again.x, again.y, again.z, again.rotation, again.s, again.t, again.u, again.v]).toEqual([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ]);
    expect([again.r, again.g, again.b, again.a]).toEqual([1, 1, 1, 1]);
    sprites.dispose();
  });

  test('the placement setter swaps the placement of the material', () => {
    const sprites = new FeatureSprites(kind);

    sprites.placement = BillboardPlacement;

    expect(sprites.material!.placement).toBe(BillboardPlacement);
    sprites.dispose();
  });

  test('textures and uniforms pass through to the material', () => {
    const timedKind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, TextureColor]});
    const sprites = new FeatureSprites(timedKind);
    const colorMap = new Texture();

    sprites.setTexture('colorMap', colorMap);
    sprites.touchTexture('colorMap');

    expect(sprites.getTexture('colorMap')).toBe(colorMap);
    expect(sprites.uniforms).toBe(sprites.material!.uniforms);
    sprites.dispose();
  });

  describe('refuses', () => {
    test('a geometry or a material built for another kind', () => {
      const geometry = new FeatureSpritesGeometry(other, 1);
      const material = new FeatureSpritesMaterial(other);

      expect(() => new FeatureSprites(kind, {geometry: geometry as never})).toThrow(
        'FeatureSprites: the geometry handed in was built for another sprite kind',
      );
      expect(() => new FeatureSprites(kind, {material: material as never})).toThrow(
        'FeatureSprites: the material handed in was built for another sprite kind',
      );
      geometry.dispose();
      material.dispose();
    });

    test('geometry parameters next to a geometry, and material parameters next to a material', () => {
      const geometry = new FeatureSpritesGeometry(kind, 1);
      const material = new FeatureSpritesMaterial(kind);

      expect(() => new FeatureSprites(kind, {geometry, capacity: 4})).toThrow(
        'FeatureSprites: capacity, attributeUsage and baseArgs build a geometry, and a geometry was handed in',
      );
      expect(() => new FeatureSprites(kind, {material, textures: {colorMap: new Texture()}})).toThrow(
        'FeatureSprites: textures build a material, and a material was handed in',
      );
      expect(() => new FeatureSprites(kind, {material, textures: undefined}).dispose()).not.toThrow();
      geometry.dispose();
      material.dispose();
    });

    test('a three.js material or a texture as its options (a type-level check)', () => {
      const withMaterial = (m: MeshBasicMaterial) =>
        // @ts-expect-error the options of a FeatureSprites only
        new FeatureSprites(kind, m);
      const withTexture = (t: Texture) =>
        // @ts-expect-error the options of a FeatureSprites only
        new FeatureSprites(kind, t);
      void withMaterial;
      void withTexture;
    });
  });

  test('the convenience API answers nothing once the sprites are disposed', () => {
    const sprites = new FeatureSprites(kind, {capacity: 1});
    const sprite = sprites.createSprite()!;

    sprites.dispose();

    expect(sprites.spritePool).toBeUndefined();
    expect(sprites.createSprite()).toBeUndefined();
    expect(() => sprites.freeSprite(sprite)).not.toThrow();
    expect(sprites.placement).toBeUndefined();
    expect(() => {
      sprites.placement = BillboardPlacement;
    }).not.toThrow();
    expect(sprites.uniforms).toBeUndefined();
    expect(sprites.getTexture('colorMap')).toBeUndefined();
    expect(() => sprites.setTexture('colorMap', new Texture())).not.toThrow();
    expect(() => sprites.touchTexture('colorMap')).not.toThrow();
    expect(() => sprites.setUniform('time', 1)).not.toThrow();
  });

  describe('dispose()', () => {
    test('disposes the geometry and the material it built itself', () => {
      const sprites = new FeatureSprites(kind);
      const geometryDispose = sandbox.spy(sprites.geometry!, 'dispose');
      const materialDispose = sandbox.spy(sprites.material!, 'dispose');

      sprites.dispose();

      expect([geometryDispose.calledOnce, materialDispose.calledOnce]).toEqual([true, true]);
    });

    test('does NOT dispose a geometry, a material or a texture handed in', () => {
      const geometry = new FeatureSpritesGeometry(kind, 1);
      const material = new FeatureSpritesMaterial(kind);
      const colorMap = new Texture();
      const geometryDispose = sandbox.spy(geometry, 'dispose');
      const materialDispose = sandbox.spy(material, 'dispose');
      const textureDispose = sandbox.spy(colorMap, 'dispose');

      new FeatureSprites(kind, {geometry, material}).dispose();
      new FeatureSprites(kind, {textures: {colorMap}}).dispose();

      expect([geometryDispose.called, materialDispose.called, textureDispose.called]).toEqual([false, false, false]);
      geometry.dispose();
      material.dispose();
    });

    test('disposes the material it built around a geometry handed in, and leaves the geometry alone', () => {
      const geometry = new FeatureSpritesGeometry(kind, 1);
      const geometryDispose = sandbox.spy(geometry, 'dispose');
      const sprites = new FeatureSprites(kind, {geometry});
      const materialDispose = sandbox.spy(sprites.material!, 'dispose');

      sprites.dispose();

      expect([geometryDispose.called, materialDispose.calledOnce]).toEqual([false, true]);
      geometry.dispose();
    });

    test('takes the mesh out of the scene graph and fires the dispose event of three', () => {
      const scene = new Scene();
      const sprites = new FeatureSprites(kind);
      scene.add(sprites);
      let fired = 0;
      sprites.addEventListener('dispose', () => fired++);

      sprites.dispose();

      expect(sprites.parent).toBeNull();
      expect(fired).toBe(1);
    });

    test('gives up the geometry and the material references', () => {
      const sprites = new FeatureSprites(kind);

      sprites.dispose();

      expect([sprites.geometry, sprites.material]).toEqual([undefined, undefined]);
    });

    test('is safe to call twice', () => {
      const sprites = new FeatureSprites(kind);
      const geometryDispose = sandbox.spy(sprites.geometry!, 'dispose');

      expect(() => {
        sprites.dispose();
        sprites.dispose();
      }).not.toThrow();
      expect(geometryDispose.calledOnce).toBe(true);
    });

    test('does not leak signals or effects', () => {
      const signals = getSignalsCount();
      const effects = getEffectsCount();

      new FeatureSprites(kind, {textures: {colorMap: new Texture()}}).dispose();

      expect([getSignalsCount(), getEffectsCount()]).toEqual([signals, effects]);
    });
  });
  describe('a constructor that throws', () => {
    test('leaves no geometry alive when the material it builds is refused', () => {
      const signals = getSignalsCount();
      const effects = getEffectsCount();
      const geometryDispose = sandbox.spy(FeatureSpritesGeometry.prototype, 'dispose');

      expect(() => new FeatureSprites(kind, {capacity: 4, placement: Tint})).toThrow(TypeError);
      expect(() => new FeatureSprites(kind, {capacity: 4, textures: {unknown: new Texture()}})).toThrow();

      expect(geometryDispose.callCount).toBe(2);
      expect([getSignalsCount(), getEffectsCount()]).toEqual([signals, effects]);
    });

    test('leaves a geometry handed in alone when the material it builds is refused', () => {
      const geometry = new FeatureSpritesGeometry(kind, 1);
      const geometryDispose = sandbox.spy(geometry, 'dispose');

      expect(() => new FeatureSprites(kind, {geometry, placement: Tint})).toThrow(TypeError);

      expect(geometryDispose.called).toBe(false);
      geometry.dispose();
    });
  });
});

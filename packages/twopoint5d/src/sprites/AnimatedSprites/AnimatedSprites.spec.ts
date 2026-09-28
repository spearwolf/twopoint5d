import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import type {MeshBasicMaterial} from 'three/webgpu';
import {Scene, Texture} from 'three/webgpu';
import {afterEach, describe, expect, expectTypeOf, test} from 'vitest';

import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import type {AnimatedSprite} from './AnimatedSprite.js';
import {AnimatedSpriteDescriptor} from './AnimatedSprite.js';
import {AnimatedSprites} from './AnimatedSprites.js';
import {AnimatedSpritesGeometry, type AnimatedSpritesGeometryParameters} from './AnimatedSpritesGeometry.js';
import {AnimatedSpritesMaterial} from './AnimatedSpritesMaterial.js';

describe('AnimatedSprites', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('the sprite methods write every value they are given', () => {
    const pool = new VertexObjectPool<AnimatedSprite>(AnimatedSpriteDescriptor, 1);
    const sprite = pool.createVO()!;

    sprite.setSize(4, 5);
    expect(sprite.width).toBe(4);
    expect(sprite.height).toBe(5);

    sprite.setPosition(1, 2);
    expect(sprite.x).toBe(1);
    expect(sprite.y).toBe(2);
    expect(sprite.z).toBe(0);

    sprite.setPosition(1, 2, 3);
    expect(sprite.z).toBe(3);
  });

  test('setPosition(x, y) keeps the z the sprite was given', () => {
    const pool = new VertexObjectPool<AnimatedSprite>(AnimatedSpriteDescriptor, 1);
    const sprite = pool.createVO()!;

    sprite.setPosition(1, 2, 3);
    sprite.setPosition(4, 5);

    expect([sprite.x, sprite.y, sprite.z]).toEqual([4, 5, 3]);
  });

  test('a sprite out of the pool of an AnimatedSpritesGeometry starts with every attribute at 0, whatever its slot held before', () => {
    const geometry = new AnimatedSpritesGeometry(2);
    const pool = geometry.instancedPool;
    pool.createVO();
    const second = pool.createVO()!;
    // 7 in every element of every buffer stands for whatever the two sprites were given
    for (const {typedArray} of pool.buffer.buffers.values()) typedArray!.fill(7);

    pool.freeVO(second);
    pool.createVO();

    const names = [...pool.descriptor.attributeNames];
    const slot = pool.buffer.toAttributeArrays(names, 1, 2);
    for (const name of names) {
      const {size} = pool.descriptor.getAttribute(name)!;
      expect(Array.from(slot[name]!), `${name} of the new sprite`).toEqual(new Array<number>(size).fill(0));
    }

    geometry.dispose();
  });

  test('builds an AnimatedSpritesGeometry of 100 sprites and an AnimatedSpritesMaterial when it is handed neither', () => {
    const sprites = new AnimatedSprites();

    expectTypeOf(sprites.geometry).toEqualTypeOf<AnimatedSpritesGeometry | undefined>();
    expect(sprites.geometry).toBeInstanceOf(AnimatedSpritesGeometry);
    expect(sprites.geometry!.instancedPool.capacity).toBe(100);

    expectTypeOf(sprites.material).toEqualTypeOf<AnimatedSpritesMaterial | undefined>();
    expect(sprites.material).toBeInstanceOf(AnimatedSpritesMaterial);

    sprites.dispose();
  });

  test('builds its geometry from a capacity', () => {
    const sprites = new AnimatedSprites(8);

    expect(sprites.geometry).toBeInstanceOf(AnimatedSpritesGeometry);
    expect(sprites.spritePool!.capacity).toBe(8);

    sprites.dispose();
  });

  test('builds its geometry from AnimatedSpritesGeometryParameters', () => {
    const parameters: AnimatedSpritesGeometryParameters = {capacity: 8, attributeUsage: {static: ['position']}};
    const sprites = new AnimatedSprites(parameters);

    expect(sprites.spritePool!.capacity).toBe(8);
    expect(sprites.spritePool!.descriptor.getAttribute('instancePosition')!.usageType).toBe('static');

    sprites.dispose();
  });

  test('builds its material from AnimatedSpritesMaterialParameters', () => {
    const sprites = new AnimatedSprites(4, {time: 2});

    expect(sprites.material).toBeInstanceOf(AnimatedSpritesMaterial);
    expect(sprites.material!.time).toBe(2);

    sprites.dispose();
  });

  test('an AnimatedSprites built with an AnimatedSpritesGeometry is typed with it and holds it', () => {
    const geometry = new AnimatedSpritesGeometry(4);
    const sprites = new AnimatedSprites(geometry);

    expectTypeOf(sprites.geometry).toEqualTypeOf<AnimatedSpritesGeometry | undefined>();
    expect(sprites.geometry).toBe(geometry);

    sprites.dispose();
    geometry.dispose();
  });

  test('takes an AnimatedSpritesMaterial or its parameters, no other three.js material and no texture (a type-level check)', () => {
    // the @ts-expect-error lines carry the claim: `pnpm typecheck` fails as soon as the constructor
    // takes another material or a texture; Vitest checks nothing here. The functions are never called.
    const buildWithMaterial = (material: MeshBasicMaterial) => {
      // @ts-expect-error the constructor takes an AnimatedSpritesMaterial or its parameters only
      return new AnimatedSprites(4, material);
    };
    const buildWithTexture = (texture: Texture) => {
      // @ts-expect-error the constructor takes an AnimatedSpritesMaterial or its parameters only
      return new AnimatedSprites(4, texture);
    };
    void buildWithMaterial;
    void buildWithTexture;
  });

  test('createSprite() takes a sprite from the sprite pool', () => {
    const sprites = new AnimatedSprites(4);

    const sprite = sprites.createSprite();

    expect(sprite).toBeDefined();
    expect(sprites.spritePool!.usedCount).toBe(1);
    expect(sprites.spritePool!.containsVO(sprite!)).toBe(true);

    sprites.dispose();
  });

  test('freeSprite() gives a sprite back to the pool', () => {
    const sprites = new AnimatedSprites(4);

    const sprite = sprites.createSprite()!;
    sprites.freeSprite(sprite);

    expect(sprites.spritePool!.usedCount).toBe(0);

    sprites.dispose();
  });

  test('createSprite() answers undefined once the pool is full', () => {
    const sprites = new AnimatedSprites(2);

    sprites.createSprite();
    sprites.createSprite();

    expect(sprites.createSprite()).toBeUndefined();

    sprites.dispose();
  });

  test('the convenience API answers nothing once the sprites are disposed', () => {
    const sprites = new AnimatedSprites(4);
    const sprite = sprites.createSprite()!;

    sprites.dispose();

    expect(sprites.geometry).toBeUndefined();
    expect(sprites.material).toBeUndefined();
    expect(sprites.spritePool).toBeUndefined();
    expect(sprites.createSprite()).toBeUndefined();
    expect(() => sprites.freeSprite(sprite)).not.toThrow();
  });

  test('is named twopoint5d.AnimatedSprites', () => {
    const sprites = new AnimatedSprites();

    expect(sprites.name).toBe('twopoint5d.AnimatedSprites');

    sprites.dispose();
  });

  describe('dispose()', () => {
    // (a) a resource the instance built itself is released exactly once
    test('disposes the geometry and the material it created itself', () => {
      const sprites = new AnimatedSprites(4);
      const geometryDispose = sandbox.spy(sprites.geometry!, 'dispose');
      const materialDispose = sandbox.spy(sprites.material!, 'dispose');

      sprites.dispose();

      expect(geometryDispose.calledOnce).toBe(true);
      expect(materialDispose.calledOnce).toBe(true);
    });

    test('disposes the material it built around a geometry that was handed in, and leaves the geometry alone', () => {
      const geometry = new AnimatedSpritesGeometry(4);
      const geometryDispose = sandbox.spy(geometry, 'dispose');

      const sprites = new AnimatedSprites(geometry, {time: 1});
      const materialDispose = sandbox.spy(sprites.material!, 'dispose');
      sprites.dispose();

      expect(geometryDispose.called).toBe(false);
      expect(materialDispose.calledOnce).toBe(true);

      geometry.dispose();
    });

    // (b) a resource handed in belongs to the caller and is not touched
    test('does NOT dispose the geometry and the material that were handed in', () => {
      const geometry = new AnimatedSpritesGeometry(4);
      const colorMap = new Texture();
      const material = new AnimatedSpritesMaterial({colorMap});
      const geometryDispose = sandbox.spy(geometry, 'dispose');
      const materialDispose = sandbox.spy(material, 'dispose');

      const sprites = new AnimatedSprites(geometry, material);
      sprites.dispose();

      expect(geometryDispose.called).toBe(false);
      expect(materialDispose.called).toBe(false);

      // the material is still usable, which is what "not released" actually means
      expect(material.colorMap).toBe(colorMap);

      geometry.dispose();
      material.dispose();
      colorMap.dispose();
    });

    test('takes the mesh out of the scene graph', () => {
      const scene = new Scene();
      const geometry = new AnimatedSpritesGeometry(4);
      const material = new AnimatedSpritesMaterial();
      const sprites = new AnimatedSprites(geometry, material);
      scene.add(sprites);

      sprites.dispose();

      expect(sprites.parent).toBeNull();
      expect(scene.children).toHaveLength(0);

      geometry.dispose();
      material.dispose();
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    test('gives up the geometry and the material references', () => {
      const geometry = new AnimatedSpritesGeometry(4);
      const material = new AnimatedSpritesMaterial();
      const sprites = new AnimatedSprites(geometry, material);

      sprites.dispose();

      expect(sprites.geometry).toBeUndefined();
      expect(sprites.material).toBeUndefined();

      geometry.dispose();
      material.dispose();
    });

    // (c) for a mesh that built its parts itself: the test "the convenience API answers nothing
    // once the sprites are disposed" one level up

    // (d) the second call throws nothing and releases nothing a second time
    test('is safe to call twice for the parts it built itself', () => {
      const sprites = new AnimatedSprites(4);
      const geometryDispose = sandbox.spy(sprites.geometry!, 'dispose');
      const materialDispose = sandbox.spy(sprites.material!, 'dispose');

      expect(() => {
        sprites.dispose();
        sprites.dispose();
      }).not.toThrow();

      expect(geometryDispose.calledOnce).toBe(true);
      expect(materialDispose.calledOnce).toBe(true);
    });

    test('is safe to call twice', () => {
      const geometry = new AnimatedSpritesGeometry(4);
      const material = new AnimatedSpritesMaterial();
      const sprites = new AnimatedSprites(geometry, material);

      expect(() => {
        sprites.dispose();
        sprites.dispose();
      }).not.toThrow();

      geometry.dispose();
      material.dispose();
    });

    // (e) no signal or effect outlives the instance
    test('does not leak signals or effects', () => {
      const baselineSignals = getSignalsCount();
      const baselineEffects = getEffectsCount();

      // the signals and effects counted here all belong to the material this mesh builds
      // for itself; the geometry side of vertex-objects creates none
      const sprites = new AnimatedSprites(4);

      expect(getSignalsCount()).toBeGreaterThan(baselineSignals);
      expect(getEffectsCount()).toBeGreaterThan(baselineEffects);

      sprites.dispose();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);
    });

    // Assertion (f) of the dispose test pattern in docs/resource-lifecycle.md — "gives every
    // slot it took back" — has no subject here: createSprite() takes a slot from the sprite pool
    // and hands it straight to the caller, keeping no record of it. Giving it back is
    // freeSprite(), and that call is the caller's to make. Where this mesh built the geometry
    // itself, dispose() releases the whole pool with it; where a geometry was handed in, the
    // pool and every slot taken from it stay the caller's.
  });
});

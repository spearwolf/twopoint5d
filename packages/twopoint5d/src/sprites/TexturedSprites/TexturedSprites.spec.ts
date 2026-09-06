import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {Scene, Texture} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {TexturedSprites} from './TexturedSprites.js';
import {TexturedSpritesGeometry} from './TexturedSpritesGeometry.js';
import {TexturedSpritesMaterial} from './TexturedSpritesMaterial.js';

describe('TexturedSprites', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('createSprite() takes a sprite from the sprite pool', () => {
    const sprites = new TexturedSprites(4);

    const sprite = sprites.createSprite();

    expect(sprite).toBeDefined();
    expect(sprites.spritePool!.usedCount).toBe(1);
    expect(sprites.spritePool!.containsVO(sprite!)).toBe(true);

    sprites.dispose();
  });

  test('the sprite of createSprite() writes through to the pool buffer', () => {
    const sprites = new TexturedSprites(4);

    const sprite = sprites.createSprite()!;
    sprite.setPosition(1, 2, 3);

    expect(sprites.spritePool!.getVO(0)!.x).toBe(1);

    sprites.dispose();
  });

  test('freeSprite() gives a sprite back to the pool', () => {
    const sprites = new TexturedSprites(4);

    const sprite = sprites.createSprite()!;
    sprites.freeSprite(sprite);

    expect(sprites.spritePool!.usedCount).toBe(0);

    sprites.dispose();
  });

  test('createSprite() answers undefined once the pool is full', () => {
    const sprites = new TexturedSprites(2);

    sprites.createSprite();
    sprites.createSprite();

    expect(sprites.createSprite()).toBeUndefined();

    sprites.dispose();
  });

  test('the convenience API answers nothing once the sprites are disposed', () => {
    const sprites = new TexturedSprites(4);
    const sprite = sprites.createSprite()!;

    sprites.dispose();

    expect(sprites.geometry).toBeUndefined();
    expect(sprites.material).toBeUndefined();
    expect(sprites.spritePool).toBeUndefined();
    expect(sprites.texture).toBeUndefined();
    expect(sprites.createSprite()).toBeUndefined();
    expect(() => sprites.freeSprite(sprite)).not.toThrow();
    expect(() => {
      sprites.texture = undefined;
    }).not.toThrow();
  });

  describe('dispose()', () => {
    // (a) a resource the instance built itself is released exactly once
    test('disposes the geometry and the material it created itself', () => {
      const sprites = new TexturedSprites(4);
      const geometryDispose = sandbox.spy(sprites.geometry!, 'dispose');
      const materialDispose = sandbox.spy(sprites.material!, 'dispose');

      sprites.dispose();

      expect(geometryDispose.calledOnce).toBe(true);
      expect(materialDispose.calledOnce).toBe(true);
    });

    // (b) a resource handed in belongs to the caller and is not touched
    test('does NOT dispose a geometry that was handed in', () => {
      const geometry = new TexturedSpritesGeometry(4);
      const geometryDispose = sandbox.spy(geometry, 'dispose');

      const sprites = new TexturedSprites(geometry);
      sprites.dispose();

      expect(geometryDispose.called).toBe(false);

      geometry.dispose();
    });

    test('does NOT dispose a material that was handed in', () => {
      const material = new TexturedSpritesMaterial();
      const materialDispose = sandbox.spy(material, 'dispose');

      const sprites = new TexturedSprites(4, material);
      sprites.dispose();

      expect(materialDispose.called).toBe(false);

      material.dispose();
    });

    test('does NOT dispose a texture handed in as the material argument, but disposes the material built around it', () => {
      const texture = new Texture();
      const textureDispose = sandbox.spy(texture, 'dispose');

      const sprites = new TexturedSprites(4, texture);
      const materialDispose = sandbox.spy(sprites.material!, 'dispose');

      sprites.dispose();

      expect(textureDispose.called).toBe(false);
      expect(materialDispose.calledOnce).toBe(true);

      texture.dispose();
    });

    test('takes the mesh out of the scene graph', () => {
      const scene = new Scene();
      const sprites = new TexturedSprites(4);
      scene.add(sprites);

      sprites.dispose();

      expect(sprites.parent).toBeNull();
      expect(scene.children).toHaveLength(0);
    });

    // (c) every public member behaves after dispose() as its TSDoc says. The case is proven
    // one level up, by the test "the convenience API answers nothing once the sprites are
    // disposed": geometry, material, spritePool and texture answer undefined, createSprite()
    // answers undefined, and freeSprite() and the texture setter do nothing.

    // (d) the second call throws nothing and releases nothing a second time
    test('is safe to call twice', () => {
      const sprites = new TexturedSprites(4);
      const geometryDispose = sandbox.spy(sprites.geometry!, 'dispose');
      const materialDispose = sandbox.spy(sprites.material!, 'dispose');

      expect(() => {
        sprites.dispose();
        sprites.dispose();
      }).not.toThrow();

      expect(geometryDispose.calledOnce).toBe(true);
      expect(materialDispose.calledOnce).toBe(true);
    });

    // (e) no signal or effect outlives the instance
    test('does not leak signals or effects', () => {
      const baselineSignals = getSignalsCount();
      const baselineEffects = getEffectsCount();

      // the signals and effects counted here all belong to the material this mesh builds
      // for itself; the geometry side of vertex-objects creates none
      const sprites = new TexturedSprites(4);

      expect(getSignalsCount()).toBeGreaterThan(baselineSignals);
      expect(getEffectsCount()).toBeGreaterThan(baselineEffects);

      sprites.dispose();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);
    });

    // Assertion (f) of the dispose test pattern in docs/resource-lifecycle.md — "gives every
    // slot it took back" — has no subject here, although this is the class that looks like it
    // should: createSprite() takes a slot from the sprite pool and hands it straight to the
    // caller, keeping no record of it. Giving it back is freeSprite(), and that call is the
    // caller's to make. Where this mesh built the geometry itself, dispose() releases the
    // whole pool with it; where a geometry was handed in, the pool and every slot taken from
    // it stay the caller's.
  });
});

import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {Color, Scene, Texture} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import type {TextureAtlasFrame} from '../../texture/TextureAtlas.js';
import {TextureCoords} from '../../texture/TextureCoords.js';
import type {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import type {TexturedSprite} from './TexturedSprite.js';
import {TexturedSprites} from './TexturedSprites.js';
import {TexturedSpritesGeometry} from './TexturedSpritesGeometry.js';
import {TexturedSpritesMaterial} from './TexturedSpritesMaterial.js';

// s, t, u, v of the coords come out as 0.25, 0.5, 0.75, 1
const frame: TextureAtlasFrame = {coords: new TextureCoords(new TextureCoords(0, 0, 4, 2), 1, 1, 3, 2)};

// the frame data TexturePacker writes for a sprite of 5 × 4 trimmed to 2 × 1 at (1, 2): its margins are
// 1/5, 2/4, 2/5 and 1/4 — four different values, so that a mix-up of two sides shows
const trimmedFrame: TextureAtlasFrame = {
  coords: new TextureCoords(new TextureCoords(0, 0, 8, 4), 5, 0, 2, 1),
  data: {trimmed: true, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}},
};
// the buffers hold float32, and a field reads out of them
const TRIMMED_MARGINS = Array.from(new Float32Array([0.2, 0.5, 0.4, 0.25]));

// the values of one attribute of the object at `index`, read straight from the typed array of its buffer
const readAttribute = (pool: VertexObjectPool<TexturedSprite>, name: string, index: number): number[] => {
  const {bufferName, offset} = pool.buffer.bufferAttributes.get(name)!;
  const {itemSize, typedArray} = pool.buffer.buffers.get(bufferName)!;
  const {size} = pool.descriptor.getAttribute(name)!;
  const start = index * pool.descriptor.vertexCount * itemSize + offset;
  return Array.from(typedArray!.subarray(start, start + size));
};

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

  test('the sprite methods write every value they are given', () => {
    const sprites = new TexturedSprites(4);
    const sprite = sprites.createSprite()!;

    expect(sprite.r).toBe(1);
    expect(sprite.g).toBe(1);
    expect(sprite.b).toBe(1);
    expect(sprite.a).toBe(1);

    sprite.setSize(4, 5);
    expect(sprite.width).toBe(4);
    expect(sprite.height).toBe(5);

    sprite.setPosition(1, 2);
    expect(sprite.x).toBe(1);
    expect(sprite.y).toBe(2);
    expect(sprite.z).toBe(0);

    sprite.setPosition(1, 2, 3);
    expect(sprite.z).toBe(3);

    sprite.setFrame(frame);
    expect(sprite.s).toBe(0.25);
    expect(sprite.t).toBe(0.5);
    expect(sprite.u).toBe(0.75);
    expect(sprite.v).toBe(1);

    sprite.setColor(new Color(0.5, 0.25, 0.125), 0.75);
    expect(sprite.r).toBe(0.5);
    expect(sprite.g).toBe(0.25);
    expect(sprite.b).toBe(0.125);
    expect(sprite.a).toBe(0.75);

    sprites.dispose();
  });

  test('setFrame() writes texFlipDiagonal 1 for a frame with FLIP_DIAGONAL and 0 for an upright one after it', () => {
    const sprites = new TexturedSprites(4);
    const sprite = sprites.createSprite()!;
    const turnedCoords = new TextureCoords(new TextureCoords(0, 0, 4, 2), 1, 1, 3, 2);
    turnedCoords.flip = TextureCoords.FLIP_DIAGONAL | TextureCoords.FLIP_VERTICAL;

    sprite.setFrame({coords: turnedCoords});
    expect(sprite.texFlipDiagonal, 'texFlipDiagonal of the turned frame').toBe(1);
    expect(readAttribute(sprites.spritePool!, 'texFlipDiagonal', 0), 'texFlipDiagonal in the buffer').toEqual([1]);

    sprite.setFrame(frame);
    expect(sprite.texFlipDiagonal, 'texFlipDiagonal of the upright frame').toBe(0);
    expect(readAttribute(sprites.spritePool!, 'texFlipDiagonal', 0), 'texFlipDiagonal in the buffer').toEqual([0]);

    sprites.dispose();
  });

  test('setFrame() writes the margins of a trimmed frame to texTrim and four zeros for an untrimmed one after it', () => {
    const sprites = new TexturedSprites(4);
    const sprite = sprites.createSprite()!;

    sprite.setFrame(trimmedFrame);
    expect([sprite.trimLeft, sprite.trimTop, sprite.trimRight, sprite.trimBottom], 'the margins of the trimmed frame').toEqual(
      TRIMMED_MARGINS,
    );
    expect(readAttribute(sprites.spritePool!, 'texTrim', 0), 'texTrim in the buffer').toEqual(TRIMMED_MARGINS);

    sprite.setFrame(frame);
    expect([sprite.trimLeft, sprite.trimTop, sprite.trimRight, sprite.trimBottom], 'the margins of the untrimmed frame').toEqual([
      0, 0, 0, 0,
    ]);
    expect(readAttribute(sprites.spritePool!, 'texTrim', 0), 'texTrim in the buffer').toEqual([0, 0, 0, 0]);

    sprites.dispose();
  });

  test('createSprite() hands out a sprite that starts upright and untrimmed, whatever its slot held before', () => {
    const sprites = new TexturedSprites(4);
    const upright = sprites.createSprite()!;
    upright.setFrame(frame);

    const turnedCoords = new TextureCoords(new TextureCoords(0, 0, 4, 2), 1, 1, 3, 2);
    turnedCoords.flip = TextureCoords.FLIP_DIAGONAL | TextureCoords.FLIP_VERTICAL;
    const turned = sprites.createSprite()!;
    turned.setFrame({coords: turnedCoords, data: trimmedFrame.data});

    // the last sprite of the pool goes back, and the next createSprite() takes its slot again
    sprites.freeSprite(turned);
    const fresh = sprites.createSprite()!;

    expect(fresh.texFlipDiagonal, 'texFlipDiagonal of the new sprite').toBe(0);
    expect(readAttribute(sprites.spritePool!, 'texFlipDiagonal', 1), 'texFlipDiagonal in the buffer').toEqual([0]);
    expect([fresh.trimLeft, fresh.trimTop, fresh.trimRight, fresh.trimBottom], 'the margins of the new sprite').toEqual([
      0, 0, 0, 0,
    ]);
    expect(readAttribute(sprites.spritePool!, 'texTrim', 1), 'texTrim in the buffer').toEqual([0, 0, 0, 0]);

    sprites.dispose();
  });

  test('createSprite() hands out a sprite with every attribute at the value of an unused slot — 0, and white as its color — whatever its slot held before', () => {
    const sprites = new TexturedSprites(4);
    const pool = sprites.spritePool!;
    sprites.createSprite();
    const second = sprites.createSprite()!;
    // 7 in every element of every buffer stands for whatever the two sprites were given
    for (const {typedArray} of pool.buffer.buffers.values()) typedArray!.fill(7);

    // the last sprite of the pool goes back, and the next createSprite() takes its slot again
    sprites.freeSprite(second);
    sprites.createSprite();

    // every attribute the description declares, so that one added later is held to the reset as well
    const names = [...pool.descriptor.attributeNames];
    const slot = pool.buffer.toAttributeArrays(names, 1, 2);
    for (const name of names) {
      const {size} = pool.descriptor.getAttribute(name)!;
      const expected = name === 'color' ? [1, 1, 1, 1] : new Array<number>(size).fill(0);
      expect(Array.from(slot[name]!), `${name} of the new sprite`).toEqual(expected);
    }

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

  test('getColor() answers the rgb of the sprite, in a new Color or in the target it is given', () => {
    const sprites = new TexturedSprites(4);
    const sprite = sprites.createSprite()!;
    sprite.setColor(new Color(0.5, 0.25, 0.125), 0.75);

    const color = sprite.getColor();
    expect(color).toBeInstanceOf(Color);
    expect([color.r, color.g, color.b]).toEqual([0.5, 0.25, 0.125]);

    const target = new Color();
    expect(sprite.getColor(target)).toBe(target);
    expect([target.r, target.g, target.b]).toEqual([0.5, 0.25, 0.125]);

    sprites.dispose();
  });

  test('the sprite methods write through to the buffers of the sprite pool', () => {
    const sprites = new TexturedSprites(4);
    const first = sprites.createSprite()!;
    first.setSize(4, 5);
    first.setPosition(1, 2, 3);
    first.setFrame(frame);
    first.setColor(new Color(0.5, 0.25, 0.125), 0.75);
    sprites.createSprite();

    const pool = sprites.spritePool!;
    expect(readAttribute(pool, 'quadSize', 0)).toEqual([4, 5]);
    expect(readAttribute(pool, 'instancePosition', 0)).toEqual([1, 2, 3]);
    expect(readAttribute(pool, 'texCoords', 0)).toEqual([0.25, 0.5, 0.75, 1]);
    expect(readAttribute(pool, 'color', 0)).toEqual([0.5, 0.25, 0.125, 0.75]);
    // the white default of [voInitialize], read from the buffer
    expect(readAttribute(pool, 'color', 1)).toEqual([1, 1, 1, 1]);

    sprites.dispose();
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

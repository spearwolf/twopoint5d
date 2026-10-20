import {Object3D, PerspectiveCamera, Texture, type Vector4} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import type {VertexObjectBuffersData} from '../../vertex-objects/types.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {VOUtils} from '../../vertex-objects/VOUtils.js';
import {planeOf} from '../bindings/planeOf.js';
import {ReflectionPass, ShadowPass} from '../passes/passPresets.js';
import {TexturedSpriteKind, type TexturedSprite} from '../presets.js';
import type {QuadBaseVO} from '../SpriteBase.js';
import {FeatureSprites} from './FeatureSprites.js';
import {FeatureSpritesGeometry} from './FeatureSpritesGeometry.js';

const quiet = () => vi.spyOn(console, 'info').mockImplementation(() => {});

// every value of a sprite follows from its id, so a value read back names the sprite it belongs to
function writeSprite(sprite: TexturedSprite, id: number): void {
  sprite.setPosition(id, 2 * id, 3 * id);
  sprite.setSize(10 + id, 20 + id);
  sprite.rotation = id / 4;
  sprite.setTexCoords(id / 8, id / 16, 0.5, 0.25);
  sprite.setColorValues(id / 10, 0.5, 1, 0.75);
}

function makeGrowing(capacity: number, count: number, options = {}) {
  const sprites = new FeatureSprites(TexturedSpriteKind, {capacity, grow: true, ...options});
  const all = Array.from({length: count}, (_, id) => {
    const sprite = sprites.createSprite()!;
    writeSprite(sprite, id);
    return sprite;
  });
  return {sprites, all};
}

// the slots in use of every buffer of the pool, as plain arrays
function usedSlotsOf(pool: VertexObjectPool<unknown>): Record<string, number[]> {
  const data: VertexObjectBuffersData = pool.toBuffersData();
  const {vertexCount} = pool.descriptor;
  return Object.fromEntries(
    pool.buffer.bufferList.map((record) => [
      record.bufferName,
      Array.from(data.buffers[record.bufferName]!.subarray(0, pool.usedCount * vertexCount * record.itemSize)),
    ]),
  );
}

describe('FeatureSprites with grow: true', () => {
  test('a full pool grows to twice its capacity, and every sprite moves over with its values', () => {
    quiet();
    const {sprites, all} = makeGrowing(2, 2);
    const oldGeometry = sprites.geometry!;
    const oldPool = sprites.spritePool!;
    const before = usedSlotsOf(oldPool as VertexObjectPool<unknown>);

    const third = sprites.createSprite();

    expect(third).toBeDefined();
    const pool = sprites.spritePool!;
    expect(pool).not.toBe(oldPool);
    expect(pool.capacity).toBe(4);
    expect(pool.usedCount).toBe(3);
    expect(sprites.geometry).not.toBe(oldGeometry);
    expect(sprites.geometry!.instancedPool).toBe(pool);
    // the old geometry is the mesh's own, and goes; its pool with it, holding no sprite any more
    expect(oldPool.isDisposed).toBe(true);
    // the handles are the same objects in the same slots, reading the new pool
    all.forEach((sprite, id) => {
      expect(pool.getVO(id)).toBe(sprite);
      expect(pool.containsVO(sprite)).toBe(true);
      expect([sprite.x, sprite.y, sprite.z, sprite.width, sprite.height, sprite.rotation]).toEqual([
        id,
        2 * id,
        3 * id,
        10 + id,
        20 + id,
        id / 4,
      ]);
    });
    expect(pool.getVO(2)).toBe(third);
    // every attribute of the two sprites of before, bit for bit
    const after = usedSlotsOf(pool as VertexObjectPool<unknown>);
    for (const [bufferName, values] of Object.entries(before)) {
      expect(after[bufferName]!.slice(0, values.length), bufferName).toEqual(values);
    }
    sprites.dispose();
  });

  test('grows as often as it has to, and frees an old handle from the new pool', () => {
    quiet();
    const {sprites, all} = makeGrowing(1, 5);

    expect(sprites.spritePool!.capacity).toBe(8);
    expect(sprites.spritePool!.usedCount).toBe(5);

    sprites.freeSprite(all[0]!);
    expect(sprites.spritePool!.usedCount).toBe(4);
    expect(VOUtils.hasBuffer(all[0]!)).toBe(false);
    // the last sprite moved into the freed slot, as freeSprite() always does
    expect(sprites.spritePool!.getVO(0)).toBe(all[4]);
    expect(all[4]!.x).toBe(4);
    sprites.dispose();
  });

  test('a capacity of 0 grows to 1, then to 2', () => {
    quiet();
    const {sprites} = makeGrowing(0, 1);
    expect(sprites.spritePool!.capacity).toBe(1);
    sprites.createSprite();
    expect(sprites.spritePool!.capacity).toBe(2);
    sprites.dispose();
  });

  test('the passes draw the new geometry, and their materials stay what they were', () => {
    quiet();
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1, grow: true, passes: [ShadowPass, ReflectionPass]});
    const material = sprites.material;
    const passMaterials = Object.values(sprites.passes).map((mesh) => mesh.material);
    sprites.createSprite();
    sprites.createSprite();

    for (const mesh of Object.values(sprites.passes)) expect(mesh.geometry).toBe(sprites.geometry);
    expect(sprites.material).toBe(material);
    expect(Object.values(sprites.passes).map((mesh) => mesh.material)).toEqual(passMaterials);
    sprites.dispose();
  });

  test('textures, uniforms and their bindings stay as they were', () => {
    quiet();
    const colorMap = new Texture();
    const ground = new Object3D();
    ground.position.z = 3;
    const sprites = new FeatureSprites(TexturedSpriteKind, {
      capacity: 1,
      grow: true,
      passes: [ReflectionPass],
      textures: {colorMap},
    });
    sprites.bindUniform('mirrorPlane', planeOf(ground));
    sprites.setUniform('reflectionColor', 0.5, 0.5, 0.5, 1);
    sprites.createSprite();
    sprites.createSprite();

    sprites.update();

    expect(sprites.getTexture('colorMap')).toBe(colorMap);
    expect((sprites.uniforms!['reflectionColor']!.value as Vector4).toArray()).toEqual([0.5, 0.5, 0.5, 1]);
    // the binding still writes, through the update() after the growth
    expect((sprites.uniforms!['mirrorPlane']!.value as Vector4).toArray()).toEqual([0, 0, 1, 3]);
    sprites.dispose();
    colorMap.dispose();
  });

  test('update() after a growth draws every sprite of the new geometry', () => {
    quiet();
    const {sprites} = makeGrowing(2, 3);

    sprites.update();

    expect(sprites.geometry!.instanceCount).toBe(3);
    sprites.dispose();
  });

  test('a sorted pool stays sorted, and sorts after the growth', () => {
    quiet();
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 3, grow: true});
    const all = [5, 1, 3].map((y) => {
      const sprite = sprites.createSprite()!;
      sprite.setPosition(0, y, 0);
      return sprite;
    });
    sprites.sortBy('y');
    const yInSlotOrder = () => Array.from({length: sprites.spritePool!.usedCount}, (_, i) => sprites.spritePool!.getVO(i)!.y);
    expect(yInSlotOrder()).toEqual([1, 3, 5]);

    const fourth = sprites.createSprite()!;
    fourth.setPosition(0, 2, -10);
    expect(yInSlotOrder()).toEqual([1, 3, 5, 2]);

    expect(sprites.sortBy('y')).toBe(true);
    expect(yInSlotOrder()).toEqual([1, 2, 3, 5]);
    // the view depth sizes its keys to the grown capacity: the camera on +z sees z = -10 farthest
    const camera = new PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 20);
    expect(sprites.sortByViewDepth(camera)).toBe(true);
    expect(sprites.spritePool!.getVO(0)).toBe(fourth);
    expect(all.map((sprite) => sprite.y)).toEqual([5, 1, 3]);
    sprites.dispose();
  });

  test('keeps the usage of attributeUsage, the base of baseArgs and the name of the geometry', () => {
    quiet();
    const sprites = new FeatureSprites(TexturedSpriteKind, {
      capacity: 1,
      grow: true,
      attributeUsage: {static: ['position'], dynamic: ['size']},
      baseArgs: [2, 3],
    });
    const descriptor = sprites.spritePool!.descriptor;
    const base = sprites.geometry!.basePool.getVO(0) as QuadBaseVO;
    const baseValues = [base.x0, base.y0, base.x2, base.y2];
    sprites.geometry!.name = 'enemies';
    sprites.createSprite();

    sprites.createSprite();

    expect(sprites.spritePool!.descriptor).toBe(descriptor);
    expect(sprites.spritePool!.descriptor.attributes.get('quadSize')!.usageType).toBe('dynamic');
    expect(sprites.spritePool!.descriptor.attributes.get('instancePosition')!.usageType).toBe('static');
    const grownBase = sprites.geometry!.basePool.getVO(0) as QuadBaseVO;
    expect([grownBase.x0, grownBase.y0, grownBase.x2, grownBase.y2]).toEqual(baseValues);
    expect(baseValues).toEqual([-2, -3, 2, 3]);
    expect(sprites.geometry!.name).toBe('enemies');
    sprites.dispose();
  });

  test('the onCreateVO hook of the pool moves to the new pool', () => {
    quiet();
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1, grow: true});
    const created: unknown[] = [];
    sprites.spritePool!.onCreateVO = (vo) => {
      created.push(vo);
    };
    sprites.createSprite();

    const second = sprites.createSprite();

    expect(created).toEqual([expect.anything(), second]);
    sprites.dispose();
  });

  describe('the note on the console', () => {
    test('says once, through console.info, that the pool grew and what it costs', () => {
      const info = quiet();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const {sprites} = makeGrowing(2, 9);

      expect(info.mock.calls).toEqual([
        [
          'FeatureSprites "twopoint5d.FeatureSprites": the pool was full at 2 sprites and grew to 4 — a frame hitch: a new geometry, every sprite copied over and every attribute uploaded anew. Where this many sprites are the rule, start with new FeatureSprites(kind, {capacity: 4, grow: true}). This note is shown once per FeatureSprites.',
        ],
      ]);
      // the pool is never full, so the warning of a full pool never comes
      expect(warn).not.toHaveBeenCalled();
      sprites.dispose();
    });

    test('names the mesh', () => {
      const info = quiet();
      const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 0, grow: true});
      sprites.name = 'bullets';
      sprites.createSprite();

      expect(info.mock.calls[0]![0]).toMatch(/^FeatureSprites "bullets": the pool was full at 0 sprites and grew to 1 —/);
      sprites.dispose();
    });
  });

  describe('refuses', () => {
    test('grow next to a geometry handed in, which the sprites do not own', () => {
      const geometry = new FeatureSpritesGeometry(TexturedSpriteKind, 2);

      expect(() => new FeatureSprites(TexturedSpriteKind, {geometry, grow: true})).toThrow(
        new TypeError(
          'FeatureSprites: grow builds a larger geometry once the pool is full, and a geometry was handed in, which the sprites do not own — leave out grow, or leave out the geometry and give the sprites the capacity (attributeUsage, baseArgs) to build their own',
        ),
      );
      // grow: false asks for nothing the geometry stands in the way of
      const sprites = new FeatureSprites(TexturedSpriteKind, {geometry, grow: false});
      sprites.dispose();
      expect(geometry.instancedPool.isDisposed).toBe(false);
      geometry.dispose();
    });

    test('a grow that is no boolean', () => {
      expect(() => new FeatureSprites(TexturedSpriteKind, {grow: 'yes' as unknown as boolean})).toThrow(
        new TypeError('FeatureSprites: grow is true or false, got "yes"'),
      );
    });

    test('to grow a geometry with pools attached, before anything is built', () => {
      quiet();
      const {sprites, all} = makeGrowing(1, 1);
      const extra = new VertexObjectPool({attributes: {extra: {size: 1}}}, 1);
      sprites.geometry!.attachInstancedPool('extra', extra);
      const geometry = sprites.geometry;

      expect(() => sprites.createSprite()).toThrow(
        'FeatureSprites#createSprite(): the pool is full and cannot grow — the geometry of the sprites has pools attached (attachInstancedPool()), which a grown geometry would leave behind. Detach them, or build the sprites without grow and with the capacity they need',
      );
      expect(sprites.geometry).toBe(geometry);
      expect(sprites.spritePool!.getVO(0)).toBe(all[0]);
      sprites.dispose();
      extra.dispose();
    });
  });

  test('a growth that throws leaves the sprites drawing the geometry they had', () => {
    quiet();
    const {sprites, all} = makeGrowing(1, 1);
    const geometry = sprites.geometry!;
    vi.spyOn(FeatureSpritesGeometry.prototype, 'grown').mockImplementation(() => {
      throw new RangeError('Array buffer allocation failed');
    });

    expect(() => sprites.createSprite()).toThrow('Array buffer allocation failed');
    expect(sprites.geometry).toBe(geometry);
    expect(geometry.instancedPool.isDisposed).toBe(false);
    expect(geometry.instancedPool.getVO(0)).toBe(all[0]);
    sprites.dispose();
  });

  test('disposed sprites do not grow', () => {
    const info = quiet();
    const {sprites} = makeGrowing(1, 1);
    info.mockClear();
    sprites.dispose();

    expect(sprites.createSprite()).toBeUndefined();
    expect(info).not.toHaveBeenCalled();
  });

  test('a pool without grow still fills up and refuses', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1, grow: false});
    sprites.createSprite();
    expect(sprites.createSprite()).toBeUndefined();
    expect(sprites.spritePool!.capacity).toBe(1);
    sprites.dispose();
  });
});

describe('FeatureSpritesGeometry#grown()', () => {
  test('builds a geometry of the capacity on the same descriptor, the base copied and the sprites adopted', () => {
    const geometry = new FeatureSpritesGeometry(TexturedSpriteKind, {capacity: 2, baseArgs: [4, 4]});
    const sprite = geometry.instancedPool.createVO()!;
    sprite.setPosition(1, 2, 3);

    const grown = geometry.grown(5);

    expect(grown.kind).toBe(TexturedSpriteKind);
    expect(grown.instancedPool.capacity).toBe(5);
    expect(grown.instancedPool.descriptor).toBe(geometry.instancedPool.descriptor);
    expect(grown.instancedPool.getVO(0)).toBe(sprite);
    expect(geometry.instancedPool.usedCount).toBe(0);
    expect((grown.basePool.getVO(0) as QuadBaseVO).x0).toBe(-4);
    // a geometry built afterwards on its own takes the description of the kind again
    const plain = new FeatureSpritesGeometry(TexturedSpriteKind, {capacity: 1, attributeUsage: {dynamic: ['size']}});
    expect(plain.instancedPool.descriptor).not.toBe(geometry.instancedPool.descriptor);
    plain.dispose();
    grown.dispose();
    geometry.dispose();
  });
});

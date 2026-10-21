import {describe, expect, test} from 'vitest';

import {sharedVertexObjectDescriptor} from './sharedVertexObjectDescriptor.js';
import type {VO, VertexObjectDescription} from './types.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectPool} from './VertexObjectPool.js';
import {VOUtils} from './VOUtils.js';

interface Thing extends VO {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  weight: number;
}

// a dynamic float32 buffer, a padded interleaved uint8 normalized buffer and a static float32 buffer
const thingDescription: VertexObjectDescription = {
  attributes: {
    position: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    tint: {components: ['r', 'g', 'b'], type: 'uint8', normalized: true, bufferName: 'packed'},
    weight: {size: 1},
  },
};

const descriptor = sharedVertexObjectDescriptor(thingDescription);

function writeThing(thing: Thing, id: number): void {
  thing.x = id;
  thing.y = id * 2;
  thing.z = id + 0.5;
  thing.r = id;
  thing.g = 2 * id;
  thing.b = 3 * id;
  thing.weight = id + 0.25;
}

const valuesOf = (thing: Thing) => [thing.x, thing.y, thing.z, thing.r, thing.g, thing.b, thing.weight];
const expectedValues = (id: number) => [id, id * 2, id + 0.5, id, 2 * id, 3 * id, id + 0.25];

// the hull around the recorded ranges of a buffer: the pairs are ascending and apart, so it runs from the
// first start to the last end, and is [-1, -1] while nothing is recorded
const hullOf = (record: {dirtyRanges: Int32Array; dirtyRangeCount: number}): [number, number] =>
  record.dirtyRangeCount === 0 ? [-1, -1] : [record.dirtyRanges[0]!, record.dirtyRanges[2 * record.dirtyRangeCount - 1]!];

function makeThings(count: number, capacity = count) {
  const pool = new VertexObjectPool<Thing>(descriptor, capacity);
  const things = Array.from({length: count}, (_, id) => {
    const thing = pool.createVO()!;
    writeThing(thing, id);
    return thing;
  });
  return {pool, things};
}

describe('VertexObjectPool#adoptVOs()', () => {
  test('takes over the slots in use, the values of every buffer and every handle', () => {
    const {pool: source, things} = makeThings(3);
    const pool = new VertexObjectPool<Thing>(descriptor, 6);

    pool.adoptVOs(source);

    expect(pool.usedCount).toBe(3);
    things.forEach((thing, id) => {
      // the same object, in the same slot, reading the buffer of the new pool
      expect(pool.getVO(id)).toBe(thing);
      expect(VOUtils.getIndex(thing)).toBe(id);
      expect(pool.containsVO(thing)).toBe(true);
      expect(valuesOf(thing)).toEqual(expectedValues(id));
    });
    // every buffer of the new pool holds the values, read straight from its arrays
    const position = pool.buffer.buffers.get(pool.buffer.bufferAttributes.get('position')!.bufferName)!;
    expect(Array.from(position.typedArray!.subarray(0, 9))).toEqual([0, 0, 0.5, 1, 2, 1.5, 2, 4, 2.5]);
    const packed = pool.buffer.buffers.get('packed')!;
    expect(packed.typedArray!.length).toBe(6 * 4);
    expect(Array.from(packed.typedArray!.subarray(0, 12))).toEqual([0, 0, 0, 0, 1, 2, 3, 0, 2, 4, 6, 0]);
    pool.dispose();
    source.dispose();
  });

  test('a write through a handle lands in the new buffer, and the source is left empty with its data', () => {
    const {pool: source, things} = makeThings(2);
    const pool = new VertexObjectPool<Thing>(descriptor, 4);

    pool.adoptVOs(source);
    things[1]!.x = 42;

    expect(pool.getVO(1)!.x).toBe(42);
    expect(source.usedCount).toBe(0);
    expect(source.containsVO(things[0]!)).toBe(false);
    expect(source.getVO(0)).toBeUndefined();
    // the source keeps what was written into it before
    const sourcePosition = source.buffer.buffers.get(source.buffer.bufferAttributes.get('position')!.bufferName)!;
    expect(sourcePosition.typedArray![3]).toBe(1);
    pool.dispose();
    source.dispose();
  });

  test('a dispose() of the source afterwards unlinks no handle', () => {
    const {pool: source, things} = makeThings(2);
    const pool = new VertexObjectPool<Thing>(descriptor, 2);

    pool.adoptVOs(source);
    source.dispose();

    expect(VOUtils.isBuffer(things[0]!, pool.buffer)).toBe(true);
    expect(valuesOf(things[1]!)).toEqual(expectedValues(1));
    pool.dispose();
  });

  test('marks every buffer of the new pool for upload', () => {
    const {pool: source} = makeThings(3);
    const pool = new VertexObjectPool<Thing>(descriptor, 6);

    pool.adoptVOs(source);

    for (const record of pool.buffer.bufferList) {
      expect([record.bufferName, ...hullOf(record)]).toEqual([record.bufferName, 0, 2]);
    }
    pool.dispose();
    source.dispose();
  });

  test('freeVO(), createVO() and sortBy() work on the adopted handles', () => {
    const {pool: source, things} = makeThings(3);
    const pool = new VertexObjectPool<Thing>(descriptor, 4);
    pool.adoptVOs(source);

    pool.freeVO(things[0]!);
    expect(pool.getVO(0)).toBe(things[2]);
    expect(VOUtils.getIndex(things[2]!)).toBe(0);
    expect(VOUtils.hasBuffer(things[0]!)).toBe(false);

    const fresh = pool.createVO()!;
    writeThing(fresh, 7);
    expect(pool.sortBy('x', {descending: true})).toBe(true);
    expect([pool.getVO(0), pool.getVO(1), pool.getVO(2)]).toEqual([fresh, things[2], things[1]]);
    pool.dispose();
    source.dispose();
  });

  test('a slot that holds no vertex object yet stays empty and materializes in the new pool', () => {
    const source = new VertexObjectPool<Thing>(descriptor, 2);
    source.createFromAttributes({position: [4, 5, 6, 7, 8, 9]});
    const pool = new VertexObjectPool<Thing>(descriptor, 4);

    pool.adoptVOs(source);

    expect(pool.usedCount).toBe(2);
    const second = pool.getVO(1)!;
    expect([second.x, second.y, second.z]).toEqual([7, 8, 9]);
    expect(pool.containsVO(second)).toBe(true);
    pool.dispose();
    source.dispose();
  });

  test('an empty source leaves the pool empty', () => {
    const source = new VertexObjectPool<Thing>(descriptor, 2);
    const pool = new VertexObjectPool<Thing>(descriptor, 2);

    pool.adoptVOs(source);

    expect(pool.usedCount).toBe(0);
    pool.dispose();
    source.dispose();
  });

  describe('the source pool afterwards', () => {
    test('hands the onCreateVO hook of the source to a pool without one, keeps the own hook of one that has it, and the source keeps its hook', () => {
      const calls: string[] = [];
      const hA = () => {
        calls.push('hA');
      };
      const hC = () => {
        calls.push('hC');
      };
      const {pool: a} = makeThings(1, 2);
      a.onCreateVO = hA;
      const b = new VertexObjectPool<Thing>(descriptor, 4);

      b.adoptVOs(a);

      expect(b.onCreateVO).toBe(hA);
      expect(a.onCreateVO).toBe(hA);
      b.createVO();
      expect(calls).toEqual(['hA']);

      const c = new VertexObjectPool<Thing>(descriptor, 4);
      c.onCreateVO = hC;
      c.adoptVOs(b);
      expect(c.onCreateVO).toBe(hC);
      expect(b.onCreateVO).toBe(hA);
      a.dispose();
      b.dispose();
      c.dispose();
    });

    test('a source pool used again gives the replacement of its onCreateVO hook its own slot', () => {
      const {pool: a} = makeThings(2);
      const b = new VertexObjectPool<Thing>(descriptor, 4);
      b.adoptVOs(a);
      a.onCreateVO = (vo) => Object.create(vo);

      const handed = [a.createVO()!, a.createVO()!];

      expect(a.getVO(0)).toBe(handed[0]);
      expect(a.getVO(1)).toBe(handed[1]);
      const keyed: Thing[] = [];
      a.sortBy((thing) => {
        keyed.push(thing);
        return 0;
      });
      expect(new Set(keyed)).toEqual(new Set(handed));
      a.dispose();
      b.dispose();
    });

    test("two pools of one capacity adopt each other's vertex objects back and forth, and createVO() with a replacing hook returns", () => {
      const {pool: a, things} = makeThings(2, 4);
      const b = new VertexObjectPool<Thing>(descriptor, 4);
      const replace = (vo: Thing) => Object.create(vo) as Thing;

      b.adoptVOs(a);
      a.adoptVOs(b);
      a.onCreateVO = replace;
      const intoA = a.createVO()!;

      expect(a.getVO(2)).toBe(intoA);
      expect(a.getVO(0)).toBe(things[0]);
      expect(a.getVO(1)).toBe(things[1]);

      b.adoptVOs(a);
      b.onCreateVO = replace;
      const intoB = b.createVO()!;

      expect(b.getVO(3)).toBe(intoB);
      expect(b.getVO(2)).toBe(intoA);
      expect(b.usedCount).toBe(4);
      a.dispose();
      b.dispose();
    });
  });

  describe('from inside an onCreateVO hook', () => {
    // a hook that makes the pool adopted while createVO() hands out its last free slot: what
    // FeatureSprites#createSprite() does under grow when a hook of the pool calls it again
    const adoptingHook = (source: VertexObjectPool<Thing>, replace?: (vo: Thing) => Thing) => {
      const target = new VertexObjectPool<Thing>(descriptor, 4);
      source.onCreateVO = (vo) => {
        source.onCreateVO = undefined;
        writeThing(vo, 9);
        target.adoptVOs(source);
        return replace?.(vo);
      };
      return target;
    };

    test('the vertex object handed out moves along with the others', () => {
      const {pool: source, things} = makeThings(1, 2);
      const target = adoptingHook(source);

      const last = source.createVO()!;

      expect(target.usedCount).toBe(2);
      expect(target.getVO(0)).toBe(things[0]);
      expect(target.getVO(1)).toBe(last);
      expect(target.containsVO(last)).toBe(true);
      expect(valuesOf(last)).toEqual(expectedValues(9));
      last.x = 5;
      expect(target.getVO(1)!.x).toBe(5);
      // the slot is marked in the pool that holds it now
      expect(target.buffer.bufferList.every((record) => hullOf(record)[1] >= 1)).toBe(true);
      target.dispose();
      source.dispose();
    });

    test('a replacement the hook answers takes the slot in the pool that adopted it', () => {
      const {pool: source} = makeThings(1, 2);
      const target = adoptingHook(source, (vo) => Object.create(vo) as Thing);

      const last = source.createVO()!;

      expect(target.getVO(1)).toBe(last);
      expect(last.x).toBe(9);
      target.dispose();
      source.dispose();
    });

    test('a replacement the hook answers takes the slot, and none for a vertex object the hook freed', () => {
      const pool = new VertexObjectPool<Thing>(descriptor, 2);
      pool.onCreateVO = (vo) => Object.create(vo) as Thing;
      const replaced = pool.createVO()!;
      expect(pool.getVO(0)).toBe(replaced);

      pool.onCreateVO = (vo) => {
        pool.freeVO(vo);
        return Object.create(vo) as Thing;
      };
      pool.createVO();
      expect(pool.usedCount).toBe(1);
      expect(pool.getVO(0)).toBe(replaced);
      pool.dispose();
    });
  });

  describe('refuses, before anything moves', () => {
    const expectNothingMoved = (source: VertexObjectPool<Thing>, things: Thing[]) => {
      expect(source.usedCount).toBe(things.length);
      things.forEach((thing, id) => {
        expect(source.getVO(id)).toBe(thing);
        expect(source.containsVO(thing)).toBe(true);
        expect(valuesOf(thing)).toEqual(expectedValues(id));
      });
    };

    test('a disposed pool', () => {
      const {pool: source, things} = makeThings(2);
      const pool = new VertexObjectPool<Thing>(descriptor, 4);
      pool.dispose();

      expect(() => pool.adoptVOs(source)).toThrow('VertexObjectPool#adoptVOs(): this pool has been disposed');
      expectNothingMoved(source, things);
      source.dispose();
    });

    test('a disposed source', () => {
      const source = new VertexObjectPool<Thing>(descriptor, 2);
      source.dispose();
      const pool = new VertexObjectPool<Thing>(descriptor, 4);

      expect(() => pool.adoptVOs(source)).toThrow('VertexObjectPool#adoptVOs(): the source pool has been disposed');
      expect(pool.usedCount).toBe(0);
      pool.dispose();
    });

    test('itself', () => {
      const {pool, things} = makeThings(2, 4);

      expect(() => pool.adoptVOs(pool)).toThrow('VertexObjectPool#adoptVOs(): a pool cannot adopt its own vertex objects');
      expectNothingMoved(pool, things);
      pool.dispose();
    });

    test('a source of another descriptor', () => {
      const {pool: source, things} = makeThings(2);
      const pool = new VertexObjectPool<Thing>(new VertexObjectDescriptor(thingDescription), 4);

      expect(() => pool.adoptVOs(source)).toThrow(
        'VertexObjectPool#adoptVOs(): the source pool is built on another descriptor — build this pool on source.descriptor',
      );
      expectNothingMoved(source, things);
      expect(pool.usedCount).toBe(0);
      pool.dispose();
      source.dispose();
    });

    test('a pool with vertex objects in use', () => {
      const {pool: source, things} = makeThings(2);
      const pool = new VertexObjectPool<Thing>(descriptor, 4);
      const own = pool.createVO()!;

      expect(() => pool.adoptVOs(source)).toThrow(
        'VertexObjectPool#adoptVOs(): this pool has 1 vertex objects in use — adopt into an empty pool',
      );
      expectNothingMoved(source, things);
      expect(pool.usedCount).toBe(1);
      expect(pool.getVO(0)).toBe(own);
      pool.dispose();
      source.dispose();
    });

    test('a pool smaller than the capacity of the source', () => {
      const {pool: source, things} = makeThings(1, 4);
      const pool = new VertexObjectPool<Thing>(descriptor, 2);

      expect(() => pool.adoptVOs(source)).toThrow(
        'VertexObjectPool#adoptVOs(): the source pool holds 4 slots, this pool 2 — adopt into a pool of at least the capacity of the source',
      );
      expectNothingMoved(source, things);
      expect(pool.usedCount).toBe(0);
      pool.dispose();
      source.dispose();
    });
  });
});

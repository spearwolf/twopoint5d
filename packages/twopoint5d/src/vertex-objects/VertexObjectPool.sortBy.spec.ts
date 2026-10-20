import type {BufferAttribute, BufferGeometry, InterleavedBufferAttribute} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import type {BufferLike, VO, VertexObjectDescription} from './types.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';
import {VertexObjectPool} from './VertexObjectPool.js';
import {VOUtils} from './VOUtils.js';

interface Thing extends VO {
  x: number;
  y: number;
  z: number;
  rotation: number;
  r: number;
  g: number;
  b: number;
  layer: number;
  h0: number;
  h1: number;
  weight: number;
  label(): string;
}

// a buffer of every kind the pool can hold: dynamic float32 with autoTouch shared by an attribute
// without it, a padded interleaved uint8 normalized buffer, an int16 of one value laid out as int32,
// float16, and a static float32 buffer
const thingDescription: VertexObjectDescription = {
  attributes: {
    position: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    rotation: {size: 1, usage: 'dynamic', autoTouch: false},
    tint: {components: ['r', 'g', 'b'], type: 'uint8', normalized: true, bufferName: 'packed'},
    layer: {components: ['layer'], type: 'int16'},
    half: {components: ['h0', 'h1'], type: 'float16'},
    weight: {size: 1},
  },
  methods: {
    label(this: Thing) {
      return `thing ${this.x}`;
    },
  },
};

// every value of a thing follows from its id, so a value read back names the thing it belongs to
function writeThing(thing: Thing, id: number, key: number): void {
  thing.x = id;
  thing.y = key;
  thing.z = id * 2;
  thing.rotation = id / 2;
  thing.r = id;
  thing.g = 2 * id;
  thing.b = 3 * id;
  thing.layer = 100 - id;
  thing.h0 = id;
  thing.h1 = id + 0.5;
  thing.weight = id + 0.25;
}

function expectThing(thing: Thing, id: number, key: number): void {
  expect([thing.x, thing.y, thing.z, thing.rotation], `thing ${id}`).toEqual([id, key, id * 2, id / 2]);
  expect([thing.r, thing.g, thing.b, thing.layer, thing.h0, thing.h1, thing.weight], `thing ${id}`).toEqual([
    id,
    2 * id,
    3 * id,
    100 - id,
    id,
    id + 0.5,
    id + 0.25,
  ]);
}

function makeThings(keys: number[], capacity = keys.length) {
  const pool = new VertexObjectPool<Thing>(thingDescription, capacity);
  const things = keys.map((key, id) => {
    const thing = pool.createVO()!;
    writeThing(thing, id, key);
    return thing;
  });
  return {pool, things};
}

const idsInSlotOrder = (pool: VertexObjectPool<Thing>): number[] =>
  Array.from({length: pool.usedCount}, (_, i) => pool.getVO(i)!.x);

// the slot of each record that shows the dirty range of every buffer, read through the public bookkeeping
const dirtyHullOf = (pool: VertexObjectPool<Thing>) =>
  pool.buffer.bufferList.map((record) => [record.bufferName, record.dirtyFrom, record.dirtyTo]);

describe('VertexObjectPool#sortBy()', () => {
  describe('by the name of a value property', () => {
    test('puts the slots in the order of the values, the lowest first', () => {
      const {pool, things} = makeThings([5, 3, 9, 1, 7]);

      expect(pool.sortBy('y')).toBe(true);

      expect(idsInSlotOrder(pool)).toEqual([3, 1, 0, 4, 2]);
      // every handle is the object it was, and reads and writes its own values from its new slot
      things.forEach((thing, id) => expectThing(thing, id, [5, 3, 9, 1, 7][id]!));
      expect(pool.getVO(0)).toBe(things[3]);
      expect(things[3]!.label()).toBe('thing 3');
      pool.dispose();
    });

    test('descending puts the highest first', () => {
      const {pool} = makeThings([5, 3, 9, 1, 7]);
      pool.sortBy('y', {descending: true});
      expect(idsInSlotOrder(pool)).toEqual([2, 4, 0, 1, 3]);
      pool.dispose();
    });

    test('takes every value property: an attribute of one value, a component of another buffer', () => {
      const {pool} = makeThings([0, 0, 0, 0]);
      pool.getVO(0)!.rotation = 9;
      pool.getVO(1)!.layer = -50;

      pool.sortBy('rotation');
      expect(idsInSlotOrder(pool)).toEqual([1, 2, 3, 0]);
      pool.sortBy('layer');
      expect(idsInSlotOrder(pool)).toEqual([1, 3, 2, 0]);
      pool.dispose();
    });

    test('takes the component of one vertex on a vertex object of several', () => {
      const pool = new VertexObjectPool<VO & {x0: number; x3: number; getPosition(): ArrayLike<number>}>(
        {vertexCount: 4, attributes: {position: {components: ['x', 'y', 'z']}}, indices: [0, 1, 2, 0, 2, 3]},
        3,
      );
      const quads = [30, 10, 20].map((x3) => {
        const quad = pool.createVO()!;
        quad.x3 = x3;
        quad.x0 = -x3;
        return quad;
      });

      pool.sortBy('x3');

      expect([0, 1, 2].map((i) => pool.getVO(i))).toEqual([quads[1], quads[2], quads[0]]);
      expect(Array.from(quads[1]!.getPosition())).toEqual([-10, 0, 0, 0, 0, 0, 0, 0, 0, 10, 0, 0]);
      pool.dispose();
    });

    test('refuses a name that is no value property and names the ones there are', () => {
      const {pool} = makeThings([2, 1]);
      for (const name of ['depth', 'label', 'setPosition', 'position', 'tint']) {
        expect(() => pool.sortBy(name), name).toThrow(
          `VertexObjectPool#sortBy(): "${name}" is no value property of the vertex objects of this pool — name one of`,
        );
      }
      expect(() => pool.sortBy('depth')).toThrow(
        /name one of x, y, z, rotation, r, g, b, layer, h0, h1, weight, or hand in a key function/,
      );
      // nothing moved
      expect(idsInSlotOrder(pool)).toEqual([0, 1]);
      pool.dispose();
    });

    test('lists at most twelve names in the refusal', () => {
      const components = Array.from({length: 4}, (_, i) => `c${i}`);
      const pool = new VertexObjectPool({vertexCount: 4, attributes: {a: {components}}}, 2);
      pool.createVO();
      pool.createVO();
      expect(() => pool.sortBy('nope')).toThrow(
        /name one of c00, c01, c02, c03, c10, c11, c12, c13, c20, c21, c22, c23, …, or hand in/,
      );
      pool.dispose();
    });
  });

  describe('by a key function', () => {
    test('calls it once per slot in use, in slot order, before anything moves', () => {
      const {pool, things} = makeThings([5, 3, 9]);
      const seen: number[] = [];
      const key = vi.fn((thing: Thing) => {
        seen.push(pool.getVO(seen.length) === thing ? thing.x : -1);
        return -thing.y;
      });

      expect(pool.sortBy(key)).toBe(true);

      expect(seen).toEqual([0, 1, 2]);
      expect(idsInSlotOrder(pool)).toEqual([2, 0, 1]);
      things.forEach((thing, id) => expectThing(thing, id, [5, 3, 9][id]!));
      pool.dispose();
    });

    test('materializes a vertex object for a slot filled from attributes, once', () => {
      const pool = new VertexObjectPool<Thing>(thingDescription, 4);
      pool.createFromAttributes({position: [0, 3, 0, 1, 1, 0, 2, 2, 0]});

      pool.sortBy((thing) => thing.y);

      expect(idsInSlotOrder(pool)).toEqual([1, 2, 0]);
      const first = pool.getVO(0);
      pool.sortBy((thing) => -thing.y);
      expect(pool.getVO(2)).toBe(first);
      pool.dispose();
    });

    test('refuses a key function that creates or frees vertex objects, and the sort moves nothing', () => {
      const {pool, things} = makeThings([2, 1, 0]);
      expect(() =>
        pool.sortBy((thing) => {
          if (thing === things[0]) pool.freeVO(things[2]!);
          return thing.y;
        }),
      ).toThrow(
        'VertexObjectPool#sortBy(): the key function changed usedCount from 3 to 2 — create and free vertex objects before or after the sort, not inside the key function',
      );
      expect(idsInSlotOrder(pool)).toEqual([0, 1]);
      pool.dispose();
    });

    test('a key function that frees the last vertex object leaves no vertex object behind in a slot out of use', () => {
      // slots without a vertex object, so that the sort materializes them as it goes
      const pool = new VertexObjectPool<Thing>(thingDescription, 4);
      pool.createFromAttributes({position: [0, 2, 0, 1, 1, 0, 2, 0, 0]});
      const created: Thing[] = [];
      pool.onCreateVO = (thing) => {
        created.push(thing);
      };

      expect(() =>
        pool.sortBy((thing) => {
          if (pool.usedCount === 3) pool.freeVO(pool.getVO(2)!);
          return thing.y;
        }),
      ).toThrow('VertexObjectPool#sortBy(): the key function changed usedCount from 3 to 2');

      // every vertex object the pool built along the way is either let go of or sits in a slot in use
      for (const thing of created) {
        if (pool.containsVO(thing)) expect(VOUtils.getIndex(thing)).toBeLessThan(pool.usedCount);
      }
      expect(idsInSlotOrder(pool)).toEqual([0, 1]);
      pool.dispose();
    });

    test('a key function that throws leaves the pool as it was and marks nothing', () => {
      const {pool} = makeThings([2, 1, 0]);
      const before = dirtyHullOf(pool);
      const serials = pool.buffer.bufferList.map((record) => record.serial);
      expect(() =>
        pool.sortBy((thing) => {
          if (thing.x === 2) throw new Error('no key');
          return thing.y;
        }),
      ).toThrow('no key');
      expect(idsInSlotOrder(pool)).toEqual([0, 1, 2]);
      expect(dirtyHullOf(pool)).toEqual(before);
      expect(pool.buffer.bufferList.map((record) => record.serial)).toEqual(serials);
      pool.dispose();
    });
  });

  describe('the order', () => {
    test('is stable: equal keys keep their slot order in both directions', () => {
      const {pool} = makeThings([1, 0, 1, 0, 1]);
      pool.sortBy('y');
      expect(idsInSlotOrder(pool)).toEqual([1, 3, 0, 2, 4]);
      pool.sortBy('y', {descending: true});
      expect(idsInSlotOrder(pool)).toEqual([0, 2, 4, 1, 3]);
      pool.dispose();
    });

    test('puts a NaN key last in both directions, and takes -0 for 0', () => {
      const keys = [Number.NaN, 2, -0, 0, 1];
      const {pool} = makeThings([0, 0, 0, 0, 0]);
      const byId = (thing: Thing) => keys[thing.x]!;
      pool.sortBy(byId);
      expect(idsInSlotOrder(pool)).toEqual([2, 3, 4, 1, 0]);
      pool.sortBy(byId, {descending: true});
      expect(idsInSlotOrder(pool)).toEqual([1, 4, 2, 3, 0]);
      pool.dispose();
    });

    test('puts a NaN key behind an infinite one in both directions, by every form of key', () => {
      // a NaN in the first slot, in front of either infinity: the two NaN keep their slot order
      // behind everything else
      const keys = [Number.NaN, Number.POSITIVE_INFINITY, 0, Number.NEGATIVE_INFINITY, Number.NaN];
      const expected = {ascending: [3, 2, 1, 0, 4], descending: [1, 2, 3, 0, 4]};

      for (const [direction, options] of [
        ['ascending', undefined],
        ['descending', {descending: true}],
      ] as const) {
        const byFunction = makeThings([0, 0, 0, 0, 0]).pool;
        byFunction.sortBy((thing) => keys[thing.x]!, options);
        expect(idsInSlotOrder(byFunction), `a key function, ${direction}`).toEqual(expected[direction]);
        byFunction.dispose();

        // the value property y holds the keys, read from a float32 buffer
        const byName = makeThings(keys).pool;
        byName.sortBy('y', options);
        expect(idsInSlotOrder(byName), `a name, ${direction}`).toEqual(expected[direction]);
        byName.dispose();

        const byKeys = makeThings([0, 0, 0, 0, 0]).pool;
        byKeys.sortByKeys(keys, options);
        expect(idsInSlotOrder(byKeys), `keys, ${direction}`).toEqual(expected[direction]);
        byKeys.dispose();
      }
    });

    test('answers false for keys that are all NaN, and moves nothing', () => {
      const {pool} = makeThings([0, 0, 0]);
      expect(pool.sortByKeys([Number.NaN, Number.NaN, Number.NaN])).toBe(false);
      expect(pool.sortByKeys([Number.NaN, 1, Number.NaN])).toBe(true);
      expect(idsInSlotOrder(pool)).toEqual([1, 0, 2]);
      pool.dispose();
    });

    test('answers false and marks nothing for a pool in order, for one slot and for none', () => {
      const {pool} = makeThings([1, 2, 3]);
      const serials = pool.buffer.bufferList.map((record) => record.serial);
      const key = vi.fn((thing: Thing) => thing.y);

      expect(pool.sortBy('y')).toBe(false);
      expect(pool.sortBy(key)).toBe(false);
      expect(pool.buffer.bufferList.map((record) => record.serial)).toEqual(serials);

      const one = makeThings([4]).pool;
      const none = new VertexObjectPool<Thing>(thingDescription, 2);
      const unused = vi.fn((thing: Thing) => thing.y);
      expect(one.sortBy(unused)).toBe(false);
      expect(none.sortBy(unused)).toBe(false);
      expect(unused).not.toHaveBeenCalled();

      for (const p of [pool, one, none]) p.dispose();
    });
  });

  describe('what moves', () => {
    test('marks the slots between the first and the last that changed, in every buffer', () => {
      const {pool} = makeThings([0, 1, 5, 3, 4, 2, 6]);
      // a fresh range for every buffer: everything recorded so far has been taken up
      for (const record of pool.buffer.bufferList) pool.buffer.pickUpDirtyRanges(record, 0, pool.usedCount, new Int32Array(18));

      pool.sortBy('y');

      expect(idsInSlotOrder(pool)).toEqual([0, 1, 5, 3, 4, 2, 6]);
      expect(dirtyHullOf(pool)).toEqual(pool.buffer.bufferList.map((record) => [record.bufferName, 2, 5]));
      pool.dispose();
    });

    test('the update() after a sort uploads the moved slots of a static buffer and leaves the index alone', () => {
      const geometry = new VertexObjectGeometry<Thing>(
        {...thingDescription, vertexCount: 1, indices: [0, 0, 0]} as VertexObjectDescription,
        8,
      );
      const {pool} = geometry;
      [0, 1, 5, 3, 4, 2, 6].forEach((key, id) => writeThing(pool.createVO()!, id, key));
      geometry.update();
      const index = Array.from(geometry.index!.array);
      for (const buffer of geometry.buffers.values()) buffer.clearUpdateRanges();

      pool.sortBy('y');
      geometry.update();

      // the static buffer of `weight`: slots 2 … 5, one float each
      expect(rangesOf(geometry, 'weight')).toEqual([{start: 2, count: 4}]);
      // the interleaved static buffer: 4 bytes per slot
      expect(rangesOf(geometry, 'tint')).toEqual([{start: 2 * 4, count: 4 * 4}]);
      // the dynamic buffer with autoTouch goes up whole as on every update()
      expect(rangesOf(geometry, 'position')).toEqual([{start: 0, count: 7 * 4}]);
      expect(Array.from(geometry.index!.array)).toEqual(index);
      geometry.dispose();
    });

    test('the update() of an instanced geometry uploads the moved instances', () => {
      const geometry = new InstancedVertexObjectGeometry<Thing, VO>(
        thingDescription,
        8,
        {vertexCount: 4, attributes: {position: {size: 3}}, indices: [0, 1, 2, 0, 2, 3]},
        1,
      );
      geometry.basePool!.createVO();
      const pool = geometry.instancedPool;
      [3, 2, 1, 0].forEach((key, id) => writeThing(pool.createVO()!, id, key));
      geometry.update();
      for (const buffer of geometry.instancedBuffers.values()) buffer.clearUpdateRanges();

      pool.sortBy('y');
      geometry.update();

      expect(rangesOf(geometry, 'weight')).toEqual([{start: 0, count: 4}]);
      expect(geometry.instanceCount).toBe(4);
      geometry.dispose();
    });

    test('toBuffersData() hands out the arrays in the new order', () => {
      const {pool} = makeThings([2, 1, 0]);
      pool.sortBy('y');
      const data = pool.toBuffersData({copy: true});
      const copy = new VertexObjectPool<Thing>(thingDescription, data);
      [2, 1, 0].forEach((id, i) => expectThing(copy.getVO(i)!, id, 2 - id));
      pool.dispose();
      copy.dispose();
    });
  });

  describe('beside the other calls of the pool', () => {
    test('a freeVO() after a sort moves the last slot into the freed one, and a sort after it orders again', () => {
      const {pool, things} = makeThings([4, 3, 2, 1, 0]);
      pool.sortBy('y');
      expect(idsInSlotOrder(pool)).toEqual([4, 3, 2, 1, 0]);

      pool.freeVO(things[3]!);
      expect(idsInSlotOrder(pool)).toEqual([4, 0, 2, 1]);
      expect(pool.containsVO(things[3]!)).toBe(false);

      pool.sortBy('y');
      expect(idsInSlotOrder(pool)).toEqual([4, 2, 1, 0]);
      [0, 1, 2, 4].forEach((id) => expectThing(things[id]!, id, 4 - id));

      const added = pool.createVO()!;
      writeThing(added, 9, 2.5);
      pool.sortBy('y');
      expect(idsInSlotOrder(pool)).toEqual([4, 2, 9, 1, 0]);
      pool.dispose();
    });

    test('a smaller usedCount after a sort lets go of the vertex objects now in the slots above it', () => {
      const {pool, things} = makeThings([2, 1, 0]);
      pool.sortBy('y');
      pool.usedCount = 1;
      expect(pool.containsVO(things[2]!)).toBe(true);
      expect(pool.containsVO(things[0]!)).toBe(false);
      expect(pool.containsVO(things[1]!)).toBe(false);
      pool.dispose();
    });

    test('sorts after a resize()', () => {
      const {pool, things} = makeThings([2, 1, 0], 3);
      pool.sortBy('y');
      pool.resize(40);
      const more = Array.from({length: 30}, (_, k) => {
        const thing = pool.createVO()!;
        writeThing(thing, 10 + k, -k);
        return thing;
      });
      pool.sortBy('y');
      expect(pool.getVO(0)).toBe(more[29]);
      expect(pool.getVO(32)).toBe(things[0]);
      things.forEach((thing, id) => expectThing(thing, id, 2 - id));
      pool.dispose();
    });

    test('does nothing on a disposed pool and answers false', () => {
      const {pool} = makeThings([2, 1, 0]);
      pool.dispose();
      const key = vi.fn(() => 0);
      expect(pool.sortBy('y')).toBe(false);
      expect(pool.sortBy('depth')).toBe(false);
      expect(pool.sortBy(key)).toBe(false);
      expect(pool.sortByKeys([1, 2, 3])).toBe(false);
      expect(key).not.toHaveBeenCalled();
    });
  });
});

describe('VertexObjectPool#sortByKeys()', () => {
  test('orders slot i by keys[i], and leaves the keys as they were', () => {
    const {pool, things} = makeThings([0, 0, 0, 0]);
    const keys = new Float64Array([0.5, -1, 3, 0.25]);

    expect(pool.sortByKeys(keys)).toBe(true);

    expect(idsInSlotOrder(pool)).toEqual([1, 3, 0, 2]);
    expect(Array.from(keys)).toEqual([0.5, -1, 3, 0.25]);
    things.forEach((thing, id) => expectThing(thing, id, 0));

    pool.sortByKeys([1, 2, 3, 4], {descending: true});
    expect(idsInSlotOrder(pool)).toEqual([2, 0, 3, 1]);
    pool.dispose();
  });

  test('keeps an attached pool paired when both are sorted by the same keys', () => {
    const geometry = new InstancedVertexObjectGeometry<Thing, VO>(
      thingDescription,
      4,
      {vertexCount: 4, attributes: {position: {size: 3}}, indices: [0, 1, 2, 0, 2, 3]},
      1,
    );
    const extra = geometry.attachInstancedPool<VO & {impact: number}>('extra', {attributes: {impact: {size: 1}}});
    [3, 1, 2].forEach((key, id) => {
      writeThing(geometry.instancedPool.createVO()!, id, key);
      extra.createVO()!.impact = 10 * id;
    });

    // worked out once, before either pool moves
    const keys = Float64Array.from({length: 3}, (_, i) => geometry.instancedPool.getVO(i)!.y);
    geometry.instancedPool.sortByKeys(keys);
    extra.sortByKeys(keys);

    expect([0, 1, 2].map((i) => [geometry.instancedPool.getVO(i)!.x * 10, extra.getVO(i)!.impact])).toEqual([
      [10, 10],
      [20, 20],
      [0, 0],
    ]);
    geometry.dispose();
  });

  test('reads only the first usedCount keys', () => {
    const {pool} = makeThings([0, 0], 4);
    pool.sortByKeys([2, 1, -5, -9]);
    expect(idsInSlotOrder(pool)).toEqual([1, 0]);
    pool.dispose();
  });

  test('refuses fewer keys than slots in use, before anything moves', () => {
    const {pool} = makeThings([0, 0, 0]);
    expect(() => pool.sortByKeys([2, 1])).toThrow(
      new RangeError(
        'VertexObjectPool#sortByKeys(): 2 keys for 3 vertex objects in use — hand in a key for every slot below usedCount',
      ),
    );
    expect(idsInSlotOrder(pool)).toEqual([0, 1, 2]);
    pool.dispose();
  });
});

function rangesOf(geometry: BufferGeometry, attrName: string): {start: number; count: number}[] {
  const attr = geometry.getAttribute(attrName) as BufferAttribute | InterleavedBufferAttribute;
  const buffer: BufferLike = (attr as InterleavedBufferAttribute).isInterleavedBufferAttribute
    ? (attr as InterleavedBufferAttribute).data
    : (attr as BufferAttribute);
  return buffer.updateRanges.map(({start, count}) => ({start, count}));
}

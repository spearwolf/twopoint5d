import type {BufferAttribute} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {measureAllocatedBytes} from '../testing/measureAllocatedBytes.js';
import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import type {TouchInstancedBuffersType} from './InstancedVOBufferGeometry.js';
import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import type {TouchBuffersType, VO, VOAttrSetter, VertexObjectDescription} from './types.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';
import {VertexObjectPool} from './VertexObjectPool.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths measured below
// 0.4 B per call when these limits were set — the noise of a few hundred bytes per round,
// spread over a thousand calls
const BYTES_PER_CALL_LIMIT = 1;

// a vertex object from Object.create(proto) with two fields measured 56 B when this limit was set,
// one built with property descriptors 552 B
const BYTES_PER_VERTEX_OBJECT_LIMIT = 128;

// the rounds of each size, taking turns, before the first measurement of `measureDifference()`
const DIFFERENCE_SETTLE_ROUNDS = 200;
// the rounds a size runs before each of its measurements, and the rounds measured
const DIFFERENCE_WARM_UP_ROUNDS = 20;
const DIFFERENCE_MEASURED_ROUNDS = 50;
const DIFFERENCE_GROUPS = 5;
// how far the two measurements of one size in a group may lie apart for the group to count as one
// in which nothing moved: half the smallest heap object, per call
const STILL_BYTES = 8;

// long enough for a compile job that waited for a free core to finish, as in
// `measureSettledBytes()`
const compilerPause = () => new Promise<void>((resolve) => setTimeout(resolve, 20));

const median = (values: readonly number[]): number => {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
};

const measureDifferenceRound = (round: () => void): number =>
  measureAllocatedBytes(round, {warmUpRounds: DIFFERENCE_WARM_UP_ROUNDS, rounds: DIFFERENCE_MEASURED_ROUNDS});

/**
 * The bytes a call of `big` allocates beyond a call of `small`, where the two differ only in how
 * much they take on: what a call costs whatever its size drops out.
 *
 * That fixed amount — the result object, the tuple, the shell of the typed array — stands at both
 * sizes alike, and it falls while the measurements run, until the compiler has taken the function
 * over. So the two sizes take turns: after the settle rounds, in groups of small, big, big, small,
 * so that a step inside a group falls on both sides alike, and what counts is the median of the
 * groups in which the two measurements of each size agree — no full collection and no compile job
 * landed there —, and the median of all groups where none does. `measurePerTile()` in
 * `src/map2d/hot-path-allocations.tilted-view.spec.ts` carries the whole argument.
 */
async function measureDifference(small: () => void, big: () => void): Promise<{difference: number; message: string}> {
  for (let i = 0; i < DIFFERENCE_SETTLE_ROUNDS; i++) {
    small();
    big();
  }
  (globalThis as {gc?: () => void}).gc?.();

  const differences: number[] = [];
  const stillDifferences: number[] = [];
  const groups: string[] = [];
  for (let i = 0; i < DIFFERENCE_GROUPS; i++) {
    await compilerPause();
    const small1 = measureDifferenceRound(small);
    const big1 = measureDifferenceRound(big);
    const big2 = measureDifferenceRound(big);
    const small2 = measureDifferenceRound(small);
    const difference = (big1 + big2 - small1 - small2) / 2;
    differences.push(difference);
    if (Math.abs(big1 - big2) < STILL_BYTES && Math.abs(small1 - small2) < STILL_BYTES) stillDifferences.push(difference);
    groups.push(`${big1.toFixed(1)} ${big2.toFixed(1)} / ${small1.toFixed(1)} ${small2.toFixed(1)}`);
  }

  const counted = stillDifferences.length > 0 ? stillDifferences : differences;
  return {
    difference: median(counted),
    message: `the median of ${counted.length} of ${DIFFERENCE_GROUPS} groups — per group, the bytes of the big call, twice, against the small one: ${groups.join(', ')}`,
  };
}

interface SpriteVO extends VO {
  x: number;
  y: number;
  z: number;
  rotation: number;
  setPosition(x: number, y: number, z: number): void;
  getPosition(target: Float32Array): Float32Array;
  setColor(color: readonly [number, number, number, number]): void;
}

interface QuadVO {
  x0: number;
  y3: number;
  z2: number;
  getPosition(target: Float32Array): Float32Array;
  setPosition: VOAttrSetter;
}

interface HexVO {
  setPosition: VOAttrSetter;
}

const spriteDescription: VertexObjectDescription = {
  vertexCount: 1,
  attributes: {
    position: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    color: {components: ['r', 'g', 'b', 'a']},
    rotation: {size: 1, usage: 'dynamic'},
  },
};

// the position is written through touchVO() or touch(), the colour is static
const untouchedSpriteDescription: VertexObjectDescription = {
  vertexCount: 1,
  attributes: {
    position: {components: ['x', 'y', 'z'], usage: 'dynamic', autoTouch: false},
    color: {components: ['r', 'g', 'b', 'a']},
  },
};

const instanceDescription: VertexObjectDescription = {
  attributes: {
    offset: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    tint: {components: ['r', 'g', 'b']},
  },
};

const extraInstanceDescription: VertexObjectDescription = {
  attributes: {impact: {size: 1, usage: 'dynamic'}},
};

// an integer attribute without `normalized`, whose array three's WebGPU backend widens to 32 bits
const levelDescription: VertexObjectDescription = {
  attributes: {level: {components: ['a', 'b'], type: 'uint16', usage: 'dynamic'}},
};

const quadDescription: VertexObjectDescription = {
  vertexCount: 4,
  attributes: {position: {components: ['x', 'y', 'z']}},
  indices: [0, 1, 2, 0, 2, 3],
};

// eighteen values, more than a setter declares parameters for
const hexDescription: VertexObjectDescription = {vertexCount: 6, attributes: {position: {components: ['x', 'y', 'z']}}};

const quadPositions = new Float32Array(12);

describe('vertex objects on the hot path', () => {
  test('the generated accessors of up to four values allocate nothing per call', async () => {
    const pool = new VertexObjectPool<SpriteVO>(spriteDescription, 1000);
    const vos = Array.from({length: 1000}, () => pool.createVO()!);
    const colorScratch: [number, number, number, number] = [1, 0.5, 0.25, 1];
    const positionTarget = new Float32Array(3);
    let sum = 0;

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < vos.length; i++) {
        const vo = vos[i]!;
        vo.x = i;
        vo.rotation = i;
        vo.setPosition(i, 1, 2);
        vo.setColor(colorScratch);
        vo.getPosition(positionTarget);
        sum += vo.y;
      }
    });
    const bytesPerCall = bytesPerRound / (vos.length * 6);

    expect(sum).toBeGreaterThan(0);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

    pool.dispose();
  });

  test('the accessors of a multi-vertex object allocate nothing per call', async () => {
    const pool = new VertexObjectPool<QuadVO>(quadDescription, 1000);
    const vos = Array.from({length: 1000}, () => pool.createVO()!);
    const target = new Float32Array(12);
    let sum = 0;

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < vos.length; i++) {
        const vo = vos[i]!;
        vo.setPosition(quadPositions);
        vo.setPosition(i, 1, 2, i, 1, 2, i, 1, 2, i, 1, 2);
        vo.x0 = i;
        vo.y3 = i;
        sum += vo.z2;
        vo.getPosition(target);
      }
    });
    const bytesPerCall = bytesPerRound / (vos.length * 6);

    // z2 is the third value setPosition() writes to every vertex: 2
    expect(sum).toBeGreaterThan(0);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

    pool.dispose();
  });

  test('a setter of more than sixteen values takes an array-like without allocating', async () => {
    const pool = new VertexObjectPool<HexVO>(hexDescription, 1000);
    const vos = Array.from({length: 1000}, () => pool.createVO()!);
    const hexPositions = new Float32Array(18);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < vos.length; i++) vos[i]!.setPosition(hexPositions);
    });
    const bytesPerCall = bytesPerRound / vos.length;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

    pool.dispose();
  });

  // a vertex object that allocates anything costs 16 B at least: one such allocation in every 16
  // objects reads 1 B per object, the limit
  test('toAttributeArrays() allocates its result and nothing per vertex', async () => {
    const pool = new VertexObjectPool(quadDescription, 1000);
    for (let i = 0; i < 1000; i++) pool.createVO();

    const {difference, message} = await measureDifference(
      () => {
        pool.buffer.toAttributeArrays(['position'], 0, 10);
      },
      () => {
        pool.buffer.toAttributeArrays(['position'], 0, 1000);
      },
    );
    const bytesPerObject = difference / 990;

    expect(Math.abs(bytesPerObject), `${bytesPerObject.toFixed(2)} bytes per further vertex object, ${message}`).toBeLessThan(
      BYTES_PER_CALL_LIMIT,
    );

    pool.dispose();
  });

  test('createVO() allocates the vertex object and nothing else', async () => {
    const pool = new VertexObjectPool<SpriteVO>(spriteDescription, 1100);
    for (let i = 0; i < 1000; i++) pool.createVO();

    // created at the end and freed as the last slot, so the pool stays at 1000 objects in use
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < 100; i++) {
        const vo = pool.createVO()!;
        pool.freeVO(vo);
      }
    });
    const bytesPerVO = bytesPerRound / 100;

    expect(bytesPerVO, `${bytesPerVO.toFixed(2)} bytes per vertex object`).toBeLessThan(BYTES_PER_VERTEX_OBJECT_LIMIT);

    pool.dispose();
  });

  describe('the upload path', () => {
    // Not measured here: after a real render three takes the update ranges of an attribute up, and
    // the next update() adds one {start, count} per range through three's addUpdateRange(). The
    // geometries below never render, so a range stays standing from one update() to the next —
    // the state that isolates what the upload path of this library allocates in between.

    test('update() of a geometry allocates nothing per call', async () => {
      const geometry = new VertexObjectGeometry<SpriteVO>(spriteDescription, 1000);
      for (let i = 0; i < 1000; i++) geometry.pool.createVO();
      geometry.update();

      const bytesPerRound = await measureSettledBytes(() => {
        for (let i = 0; i < 1000; i++) geometry.update();
      });
      const bytesPerCall = bytesPerRound / 1000;

      expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

      geometry.dispose();
    });

    test('update() of an instanced geometry with an attached pool allocates nothing per call', async () => {
      const geometry = new InstancedVertexObjectGeometry(instanceDescription, 1000, quadDescription, 1);
      geometry.basePool!.createVO();
      for (let i = 0; i < 1000; i++) geometry.instancedPool.createVO();
      const extra = geometry.attachInstancedPool('extra', extraInstanceDescription);
      for (let i = 0; i < 1000; i++) extra.createVO();
      geometry.update();

      const bytesPerRound = await measureSettledBytes(() => {
        for (let i = 0; i < 1000; i++) geometry.update();
      });
      const bytesPerCall = bytesPerRound / 1000;

      expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

      geometry.dispose();
    });

    test('update() of a geometry whose array three widened allocates nothing per call', async () => {
      // few objects: every update() copies all of them into the widened array, and a thousand
      // would spend the measurement on that copy
      const geometry = new VertexObjectGeometry(levelDescription, 16);
      for (let i = 0; i < 16; i++) geometry.pool.createVO();
      geometry.update();

      // what three's WebGPU backend does as it builds the gpu buffer of this attribute
      const attr = geometry.getAttribute('level') as BufferAttribute;
      attr.array = new Uint32Array(attr.array);
      attr.clearUpdateRanges();

      const bytesPerRound = await measureSettledBytes(() => {
        for (let i = 0; i < 1000; i++) geometry.update();
      });
      const bytesPerCall = bytesPerRound / 1000;

      expect(attr.array).toBeInstanceOf(Uint32Array);
      expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

      geometry.dispose();
    });

    test('touch() allocates nothing per call', async () => {
      const geometry = new VertexObjectGeometry<SpriteVO>(untouchedSpriteDescription, 1000);
      for (let i = 0; i < 1000; i++) geometry.pool.createVO();
      geometry.update();

      const instanced = new InstancedVertexObjectGeometry(instanceDescription, 1000, quadDescription, 1);
      instanced.basePool!.createVO();
      for (let i = 0; i < 1000; i++) instanced.instancedPool.createVO();
      instanced.update();

      // the arguments are built once: an object literal per call would be the allocation of the
      // caller, not of touch()
      const dynamicBuffers: TouchBuffersType = {dynamic: true};
      const dynamicInstances: TouchInstancedBuffersType = {instanced: {dynamic: true}};

      const bytesPerRound = await measureSettledBytes(() => {
        for (let i = 0; i < 1000; i++) geometry.touch('position');
        for (let i = 0; i < 1000; i++) geometry.touch(dynamicBuffers);
        for (let i = 0; i < 1000; i++) instanced.touch(dynamicInstances);
      });
      const bytesPerCall = bytesPerRound / 3000;

      expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

      geometry.dispose();
      instanced.dispose();
    });

    test('touchVO() and the update() after it allocate nothing per call', async () => {
      const geometry = new VertexObjectGeometry<SpriteVO>(untouchedSpriteDescription, 1000);
      const {pool} = geometry;
      const vos = Array.from({length: 1000}, () => pool.createVO()!);
      geometry.update();

      // every tenth object: a hundred disjoint slots, more than a buffer keeps ranges for
      const bytesPerRound = await measureSettledBytes(() => {
        for (let i = 0; i < 100; i++) {
          const vo = vos[i * 10]!;
          vo.x = i;
          pool.touchVO(vo, 'position');
          pool.touchVO(vo);
        }
        geometry.update();
      });
      const bytesPerCall = bytesPerRound / 201;

      expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

      geometry.dispose();
    });
  });
});

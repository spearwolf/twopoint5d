import type {BufferAttribute} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {measureAllocatedBytes} from '../testing/measureAllocatedBytes.js';
import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import type {TouchInstancedBuffersType} from './InstancedVOBufferGeometry.js';
import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import type {TouchBuffersType, VO, VertexObjectDescription} from './types.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';
import {VertexObjectPool} from './VertexObjectPool.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths measured below
// 0.4 B per call when these limits were set — the noise of a few hundred bytes per round,
// spread over a thousand calls
const BYTES_PER_CALL_LIMIT = 1;

// a vertex object from Object.create(proto) with two fields measured 56 B when this limit was set,
// one built with property descriptors 552 B
const BYTES_PER_VERTEX_OBJECT_LIMIT = 128;

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

describe('vertex objects on the hot path', () => {
  test('the generated accessors of up to four values allocate nothing per call', () => {
    const pool = new VertexObjectPool<SpriteVO>(spriteDescription, 1000);
    const vos = Array.from({length: 1000}, () => pool.createVO()!);
    const colorScratch: [number, number, number, number] = [1, 0.5, 0.25, 1];
    const positionTarget = new Float32Array(3);
    let sum = 0;

    const bytesPerRound = measureAllocatedBytes(() => {
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

  test('the per-vertex component accessors of a multi-vertex object allocate nothing per call', () => {
    const pool = new VertexObjectPool<QuadVO>(quadDescription, 1000);
    const vos = Array.from({length: 1000}, () => pool.createVO()!);
    const target = new Float32Array(12);
    let sum = 0;

    // setPosition() of this attribute is left out: with twelve values it takes a rest parameter
    // and allocates an array per call
    const bytesPerRound = measureAllocatedBytes(() => {
      for (let i = 0; i < vos.length; i++) {
        const vo = vos[i]!;
        vo.x0 = i;
        vo.y3 = i;
        sum += vo.z2;
        vo.getPosition(target);
      }
    });
    const bytesPerCall = bytesPerRound / (vos.length * 4);

    expect(sum).toBe(0);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

    pool.dispose();
  });

  test('createVO() allocates the vertex object and nothing else', () => {
    const pool = new VertexObjectPool<SpriteVO>(spriteDescription, 1100);
    for (let i = 0; i < 1000; i++) pool.createVO();

    // created at the end and freed as the last slot, so the pool stays at 1000 objects in use
    // after the default warm-up an occasional run measured three times the bytes of the others;
    // after 1000 rounds the value holds from run to run
    const bytesPerRound = measureAllocatedBytes(
      () => {
        for (let i = 0; i < 100; i++) {
          const vo = pool.createVO()!;
          pool.freeVO(vo);
        }
      },
      {warmUpRounds: 1000},
    );
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

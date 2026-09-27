import {describe, expect, test} from 'vitest';

import {measureAllocatedBytes} from '../testing/measureAllocatedBytes.js';
import type {VertexObjectDescription} from './types.js';
import {VertexObjectPool} from './VertexObjectPool.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths measured below
// 0.4 B per call when these limits were set — the noise of a few hundred bytes per round,
// spread over a thousand calls
const BYTES_PER_CALL_LIMIT = 1;

// a vertex object from Object.create(proto) with two fields measured 56 B when this limit was set,
// one built with property descriptors 552 B
const BYTES_PER_VERTEX_OBJECT_LIMIT = 128;

interface SpriteVO {
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
});

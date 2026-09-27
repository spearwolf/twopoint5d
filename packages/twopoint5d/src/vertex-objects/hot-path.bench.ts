import {test} from 'vitest';

import type {VertexObjectDescription} from './types.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectPool} from './VertexObjectPool.js';

const options = {time: 500, warmupTime: 200};

interface PositionVO {
  x: number;
  y: number;
  z: number;
}

interface SpriteVO extends PositionVO {
  setPosition(x: number, y: number, z: number): void;
  getPosition(target: Float32Array): Float32Array;
}

type Writer = (vos: readonly PositionVO[], n: number) => void;

const spriteDescription: VertexObjectDescription = {
  vertexCount: 1,
  attributes: {
    position: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    color: {components: ['r', 'g', 'b', 'a']},
    rotation: {size: 1, usage: 'dynamic'},
  },
};

// the same position attribute in every description, next to an extra attribute whose size and
// name differ from one description to the next
const description = (k: number): VertexObjectDescription => ({
  vertexCount: 1,
  attributes: {
    position: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    [`extra${k}`]: {size: 1 + (k % 3), usage: 'dynamic'},
  },
});

// new Function gives every pool a writer with a call site of its own, the way an application has
// an update loop of its own per sprite type. Closures of one function literal share their inline
// caches and would make the call site itself megamorphic — what is measured here is the inside of
// the generated accessors
const makeWriter = (): Writer =>
  new Function(
    'vos',
    'n',
    'for (let i = 0; i < vos.length; i++) { const vo = vos[i]; vo.x = i + n; vo.y = n; vo.z = i; }',
  ) as Writer;

const fillPool = <VOType extends object>(pool: VertexObjectPool<VOType>, count: number) =>
  Array.from({length: count}, () => pool.createVO()!);

test('generated setters across vertex object descriptors', async ({bench}) => {
  const shared = new VertexObjectDescriptor(description(0));
  // only pools on the very same descriptor instance share a prototype; one description per pool
  // builds a descriptor, and with it a prototype, per pool
  const onePools = Array.from({length: 6}, () => new VertexObjectPool<PositionVO>(shared, 10_000));
  const sixPools = Array.from({length: 6}, (_, k) => new VertexObjectPool<PositionVO>(description(k), 10_000));

  const oneVOs = onePools.map((pool) => fillPool(pool, 10_000));
  const sixVOs = sixPools.map((pool) => fillPool(pool, 10_000));
  const oneWriters = onePools.map(makeWriter);
  const sixWriters = sixPools.map(makeWriter);

  let n = 0;

  // one after the other instead of bench.compare(), which warms up every variant before it measures
  // the first: the accessors of all descriptors come from the same function literals and share
  // their inline caches, so the six descriptors would have made them megamorphic before the one
  // descriptor is timed
  await bench('six pools, one descriptor', () => {
    n++;
    for (let k = 0; k < 6; k++) oneWriters[k]!(oneVOs[k]!, n);
  }).run(options);
  await bench('six pools, six descriptors', () => {
    n++;
    for (let k = 0; k < 6; k++) sixWriters[k]!(sixVOs[k]!, n);
  }).run(options);

  for (const pool of [...onePools, ...sixPools]) pool.dispose();
});

test('generated accessors of one descriptor', async ({bench}) => {
  const pool = new VertexObjectPool<SpriteVO>(spriteDescription, 10_000);
  const vos = fillPool(pool, 10_000);
  const target = new Float32Array(3);

  await bench.compare(
    bench('component setters x, y, z', () => {
      for (let i = 0; i < vos.length; i++) {
        const vo = vos[i]!;
        vo.x = i;
        vo.y = 1;
        vo.z = 2;
      }
    }),
    bench('setPosition(x, y, z)', () => {
      for (let i = 0; i < vos.length; i++) vos[i]!.setPosition(i, 1, 2);
    }),
    bench('getPosition(target)', () => {
      for (let i = 0; i < vos.length; i++) vos[i]!.getPosition(target);
    }),
    options,
  );

  pool.dispose();
});

test('createVO() and freeVO()', async ({bench}) => {
  const pool = new VertexObjectPool<SpriteVO>(spriteDescription, 1100);
  fillPool(pool, 1000);

  await bench('100 × createVO() and freeVO()', () => {
    for (let i = 0; i < 100; i++) pool.freeVO(pool.createVO()!);
  }).run(options);

  pool.dispose();
});

import {expect, test} from 'vitest';

import type {VO, VertexObjectDescription} from './types.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';
import {VertexObjectPool} from './VertexObjectPool.js';

const options = {time: 500, warmupTime: 200};

interface PositionVO {
  x: number;
  y: number;
  z: number;
}

interface SpriteVO extends PositionVO, VO {
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

// the sprite of above whose position uploads through touchVO() instead of on every update()
const untouchedSpriteDescription: VertexObjectDescription = {
  vertexCount: 1,
  attributes: {
    position: {components: ['x', 'y', 'z'], usage: 'dynamic', autoTouch: false},
    color: {components: ['r', 'g', 'b', 'a']},
    rotation: {size: 1, usage: 'dynamic', autoTouch: false},
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

// every writer comes from new Function with a source of its own, the way an application has an
// update loop of its own per sprite type: V8 compiles a source it has already seen only once and
// hands every function made from it the same inline caches, so writers of one source would share
// their call sites just as closures of one function literal do. What the first two benches
// measure is the inside of the generated accessors
let writers = 0;
const makeWriter = (): Writer =>
  new Function(
    'vos',
    'n',
    `// writer ${writers++}\nfor (let i = 0; i < vos.length; i++) { const vo = vos[i]; vo.x = i + n; vo.y = n; vo.z = i; }`,
  ) as Writer;

interface WriterState {
  n: number;
  readonly lists: readonly (readonly PositionVO[])[];
}

// the writer for all pools is itself the function the bench calls, bound to its state. A writer
// the bench function calls at a call site of its own is inlined into it, and V8 then runs the loop
// of the writer in code that does not inline the accessors — six pools of one prototype take about
// 38 ns per object in that shape, against about 3 ns for a writer per pool, which would hide what
// the variant is there to show
const makeWriterForAll = (): ((state: WriterState) => void) =>
  new Function(
    'state',
    `// writer ${writers++}\nconst n = ++state.n; const lists = state.lists;\nfor (let k = 0; k < lists.length; k++) { const vos = lists[k]; for (let i = 0; i < vos.length; i++) { const vo = vos[i]; vo.x = i + n; vo.y = n; vo.z = i; } }`,
  ) as (state: WriterState) => void;

const fillPool = <VOType extends object>(pool: VertexObjectPool<VOType>, count: number) =>
  Array.from({length: count}, () => pool.createVO()!);

test('generated setters across vertex object descriptors', async ({bench}) => {
  const shared = new VertexObjectDescriptor(description(0));
  // pools handed the same descriptor share its prototype, and so do pools built from the same
  // description object; `description(k)` builds a new object on every call, so each of the six
  // pools below builds a descriptor and a prototype of its own
  const onePools = Array.from({length: 6}, () => new VertexObjectPool<PositionVO>(shared, 10_000));
  const sixPools = Array.from({length: 6}, (_, k) => new VertexObjectPool<PositionVO>(description(k), 10_000));
  const sharedDescription = description(0);
  const describedPools = Array.from({length: 6}, () => new VertexObjectPool<PositionVO>(sharedDescription, 10_000));

  const oneVOs = onePools.map((pool) => fillPool(pool, 10_000));
  const sixVOs = sixPools.map((pool) => fillPool(pool, 10_000));
  const describedVOs = describedPools.map((pool) => fillPool(pool, 10_000));
  const oneWriters = onePools.map(() => makeWriter());
  const sixWriters = sixPools.map(() => makeWriter());

  // without one descriptor for all six, the variant below would measure the megamorphic case
  // without a word
  expect(new Set(describedPools.map((pool) => pool.descriptor)).size).toBe(1);

  let n = 0;

  // one after the other instead of bench.compare(), which warms up every variant before it measures
  // the first: the one descriptor is timed before an accessor has seen a second prototype
  await bench('six pools, one descriptor', () => {
    n++;
    for (let k = 0; k < 6; k++) oneWriters[k]!(oneVOs[k]!, n);
  }).run(options);
  await bench('six pools, six descriptors', () => {
    n++;
    for (let k = 0; k < 6; k++) sixWriters[k]!(sixVOs[k]!, n);
  }).run(options);

  // six pools built from one description object share one prototype, so one writer for all of
  // them sees one prototype
  await bench('six pools, one description, one writer for all', makeWriterForAll().bind(null, {n: 0, lists: describedVOs})).run(
    options,
  );

  // the six pools of six descriptors, all written by one writer: its call sites see the vertex
  // objects of six prototypes and go megamorphic, which is what a loop costs that serves more than
  // four descriptors. It runs last, since it leaves the caches of the accessors megamorphic
  await bench('six pools, six descriptors, one writer for all', makeWriterForAll().bind(null, {n: 0, lists: sixVOs})).run(
    options,
  );

  for (const pool of [...onePools, ...sixPools, ...describedPools]) pool.dispose();
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

// what a render does to the buffers of a geometry after an update(): three takes the update ranges
// up as it uploads them, so the next update() names its own ranges again
const uploaded = (geometry: VertexObjectGeometry<SpriteVO>) => {
  for (const buffer of geometry.buffers.values()) buffer.clearUpdateRanges();
};

test('geometry update()', async ({bench}) => {
  const autoTouched = new VertexObjectGeometry<SpriteVO>(spriteDescription, 10_000);
  fillPool(autoTouched.pool, 10_000);

  const untouched = new VertexObjectGeometry<SpriteVO>(untouchedSpriteDescription, 10_000);
  const untouchedVOs = fillPool(untouched.pool, 10_000);

  const churned = new VertexObjectGeometry<SpriteVO>(untouchedSpriteDescription, 10_000);
  fillPool(churned.pool, 10_000);

  for (const geometry of [autoTouched, untouched, churned]) {
    geometry.update();
    uploaded(geometry);
  }

  let n = 0;

  await bench.compare(
    bench('update() of 10 000 sprites with autoTouch', () => {
      autoTouched.update();
      uploaded(autoTouched);
    }),
    bench('touchVO() on 100 of 10 000 sprites without autoTouch, then update()', () => {
      n++;
      // every hundredth sprite: more disjoint slots than a buffer keeps ranges for
      for (let i = 0; i < 100; i++) {
        const vo = untouchedVOs[i * 100]!;
        vo.x = n;
        untouched.pool.touchVO(vo, 'position');
      }
      untouched.update();
      uploaded(untouched);
    }),
    bench('freeVO() in the middle and createVO(), then update()', () => {
      churned.pool.freeVO(churned.pool.getVO(5_000)!);
      churned.pool.createVO();
      churned.update();
      uploaded(churned);
    }),
    options,
  );

  for (const geometry of [autoTouched, untouched, churned]) geometry.dispose();
});

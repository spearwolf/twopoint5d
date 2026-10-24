import {createSandbox} from 'sinon';
import type {BufferAttribute, InterleavedBufferAttribute} from 'three/webgpu';
import {InstancedInterleavedBuffer} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {InstancedVOBufferGeometry} from './InstancedVOBufferGeometry.js';
import {InstancedVertexObjectGeometry} from './InstancedVertexObjectGeometry.js';
import {VOBufferPool} from './VOBufferPool.js';
import {VertexObjectDescriptor} from './VertexObjectDescriptor.js';
import {VertexObjectGeometry} from './VertexObjectGeometry.js';
import {VertexObjectPool} from './VertexObjectPool.js';
import type {VO, VertexObjectDescription} from './types.js';

describe('InstancedVertexObjectGeometry', () => {
  const baseDescriptor = new VertexObjectDescriptor({
    vertexCount: 4,
    indices: [0, 1, 2, 0, 2, 3],

    attributes: {
      position: {
        components: ['x', 'y', 'z'],
        type: 'float32',
      },
    },
  });

  const instancedDescriptor = new VertexObjectDescriptor({
    attributes: {
      color: {
        components: ['r', 'g', 'b'],
        type: 'float32',
        usage: 'dynamic',
      },
      strength: {
        size: 1,
        type: 'float32',
        usage: 'static',
      },
      impact: {
        size: 1,
        type: 'uint32',
        usage: 'dynamic',
      },
    },
  });

  const extraInstancedDescriptor = new VertexObjectDescriptor({
    attributes: {
      extra: {
        size: 1,
        bufferName: 'extraBuffer',
      },
    },
  });

  // shares no attribute name with `extraInstancedDescriptor`, so both fit on one geometry
  const secondExtraInstancedDescriptor = new VertexObjectDescriptor({
    attributes: {
      extraToo: {
        size: 1,
        bufferName: 'extraTooBuffer',
      },
    },
  });

  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('construct with base and instanced descriptor', () => {
    const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);

    expect(geometry).toBeDefined();
    expect(geometry.baseBuffers).toBeDefined();
    expect(geometry.instancedBuffers).toBeDefined();

    expect(geometry.baseBuffers!.get('static_float32')!.array).toBe(
      geometry.basePool!.buffer.buffers.get('static_float32')!.typedArray,
    );
    expect(geometry.instancedBuffers.get('dynamic_float32')!.array).toBe(
      geometry.instancedPool.buffer.buffers.get('dynamic_float32')!.typedArray,
    );
    expect(geometry.instancedBuffers.get('static_float32')!.array).toBe(
      geometry.instancedPool.buffer.buffers.get('static_float32')!.typedArray,
    );
    expect(geometry.instancedBuffers.get('dynamic_uint32')!.array).toBe(
      geometry.instancedPool.buffer.buffers.get('dynamic_uint32')!.typedArray,
    );
  });

  test('construct with base, instanced and extra-instanced descriptors', () => {
    const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);

    const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);

    expect(extraPool).toBeDefined();

    expect(geometry.extraInstancedBuffers.get('extraPool')!.get('extraBuffer')!.array).toBe(
      extraPool.buffer.buffers.get('extraBuffer')!.typedArray,
    );

    expect(geometry.getAttribute('extra')).toBeDefined();
  });

  test('pools attached from one description on two geometries share its descriptor', () => {
    const extraDescription: VertexObjectDescription = {attributes: {extra: {size: 1, bufferName: 'extraBuffer'}}};
    const firstGeometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
    const secondGeometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);

    const first = firstGeometry.attachInstancedPool('extraPool', extraDescription);
    const second = secondGeometry.attachInstancedPool('extraPool', extraDescription);

    expect(second.descriptor).toBe(first.descriptor);

    firstGeometry.dispose();
    secondGeometry.dispose();
  });

  test('index array buffer is created', () => {
    const capacity = 10;
    const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 1, baseDescriptor, capacity);

    expect(geometry.index).toBeDefined();
    expect(geometry.index!.array.length).toBe(baseDescriptor.indices.length * capacity);

    // biome-ignore format: the line breaks lay the numbers out row by row
    expect(Array.from(geometry.index!.array).slice(0, baseDescriptor.indices.length * 3)).toEqual([
      0, 1, 2, 0, 2, 3,
      4, 5, 6, 4, 6, 7,
      8, 9, 10, 8, 10, 11,
    ]);
  });

  test('an explicit base capacity of 0 reaches the base pool', () => {
    const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 0);

    expect(geometry.basePool!.capacity).toBe(0);
  });

  describe('dispose()', () => {
    // (a) a resource the instance built itself is released exactly once
    test('disposes basePool and instancedPool it built itself', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);

      const baseDispose = sandbox.spy(geometry.basePool!, 'dispose');
      const instancedDispose = sandbox.spy(geometry.instancedPool!, 'dispose');

      geometry.dispose();

      expect(baseDispose.calledOnce).toBe(true);
      expect(instancedDispose.calledOnce).toBe(true);
    });

    test('disposes extra instanced pools it built itself', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);

      const extraDispose = sandbox.spy(extraPool, 'dispose');

      geometry.dispose();

      expect(extraDispose.calledOnce).toBe(true);
    });

    test('disposes extra instanced pools when autoDispose is explicitly true', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor, {autoDispose: true});

      const extraDispose = sandbox.spy(extraPool, 'dispose');

      geometry.dispose();

      expect(extraDispose.calledOnce).toBe(true);
    });

    test('does NOT dispose extra instanced pools when autoDispose is false', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor, {autoDispose: false});

      const extraDispose = sandbox.spy(extraPool, 'dispose');

      geometry.dispose();

      expect(extraDispose.called).toBe(false);
    });

    test('respects per-pool autoDispose flags independently', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);

      const ownedPool = geometry.attachInstancedPool('owned', extraInstancedDescriptor);
      const sharedPool = geometry.attachInstancedPool('shared', secondExtraInstancedDescriptor, {autoDispose: false});

      const ownedDispose = sandbox.spy(ownedPool, 'dispose');
      const sharedDispose = sandbox.spy(sharedPool, 'dispose');

      geometry.dispose();

      expect(ownedDispose.calledOnce).toBe(true);
      expect(sharedDispose.called).toBe(false);
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    test('empties all extra-instanced bookkeeping maps', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      geometry.attachInstancedPool('a', extraInstancedDescriptor);
      geometry.attachInstancedPool('b', secondExtraInstancedDescriptor, {autoDispose: false});

      expect(geometry.extraInstancedPools.size).toBe(2);
      expect(geometry.extraInstancedBuffers.size).toBe(2);
      expect(geometry.extraInstancedBufferSerials.size).toBe(2);

      geometry.dispose();

      expect(geometry.extraInstancedPools.size).toBe(0);
      expect(geometry.extraInstancedBuffers.size).toBe(0);
      expect(geometry.extraInstancedBufferSerials.size).toBe(0);
    });

    test('a pool that was detached is not disposed a second time by geometry.dispose()', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);

      geometry.detachInstancedPool('extraPool');

      // the detach released it already — the geometry built this pool
      expect(extraPool.isDisposed).toBe(true);

      const extraDispose = sandbox.spy(extraPool, 'dispose');

      geometry.dispose();

      expect(extraDispose.called).toBe(false);
    });

    // (d) the second call throws nothing and releases nothing a second time
    test('is safe to call twice', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);

      const baseDispose = sandbox.spy(geometry.basePool!, 'dispose');
      const instancedDispose = sandbox.spy(geometry.instancedPool!, 'dispose');
      const extraDispose = sandbox.spy(extraPool, 'dispose');

      expect(() => {
        geometry.dispose();
        geometry.dispose();
      }).not.toThrow();

      expect(baseDispose.calledOnce).toBe(true);
      expect(instancedDispose.calledOnce).toBe(true);
      expect(extraDispose.calledOnce).toBe(true);
    });

    test('a second dispose() sends no second dispose event', () => {
      const geometries = [
        new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1),
        new VertexObjectGeometry(baseDescriptor, 10),
      ];

      for (const geometry of geometries) {
        let events = 0;
        geometry.addEventListener('dispose', () => events++);

        geometry.dispose();
        geometry.dispose();

        expect(events, geometry.name).toBe(1);
      }
    });

    test('a dispose listener that throws holds up nothing, and its error comes out once the geometry is down', () => {
      const handedIn = new VertexObjectPool<VO>(instancedDescriptor, 10);
      const geometry = new InstancedVertexObjectGeometry(handedIn, 10, baseDescriptor, 1);
      const extra = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);

      let events = 0;
      geometry.addEventListener('dispose', () => {
        events++;
        throw new Error('a listener of dispose');
      });

      expect(() => geometry.dispose()).toThrow('a listener of dispose');

      expect(handedIn.isAttachedToGeometry).toBe(false);
      expect(handedIn.isDisposed).toBe(false);
      expect(geometry.basePool!.isDisposed).toBe(true);
      expect(extra.isDisposed).toBe(true);
      expect(Object.keys(geometry.attributes)).toEqual([]);
      expect(geometry.index).toBeNull();
      expect(geometry.extraInstancedPools.size).toBe(0);

      expect(() => geometry.dispose()).not.toThrow();
      expect(events).toBe(1);

      const pool = new VertexObjectPool<VO>(baseDescriptor, 10);
      const plain = new VertexObjectGeometry(pool, 10);
      let plainEvents = 0;
      plain.addEventListener('dispose', () => {
        plainEvents++;
        throw new Error('a listener of dispose');
      });

      expect(() => plain.dispose()).toThrow('a listener of dispose');

      expect(pool.isAttachedToGeometry).toBe(false);
      expect(pool.isDisposed).toBe(false);
      expect(Object.keys(plain.attributes)).toEqual([]);

      expect(() => plain.dispose()).not.toThrow();
      expect(plainEvents).toBe(1);
    });

    // (b) a resource handed in belongs to the caller and is not touched
    test('does NOT dispose an instanced pool that was handed in through the constructor', () => {
      const handedInPool = new VertexObjectPool<VO>(instancedDescriptor, 10);
      const geometry = new InstancedVertexObjectGeometry(handedInPool, 10, baseDescriptor, 1);

      const instancedDispose = sandbox.spy(handedInPool, 'dispose');

      geometry.dispose();

      expect(instancedDispose.called).toBe(false);
      expect(handedInPool.isDisposed).toBe(false);
      expect(geometry.basePool!.isDisposed).toBe(true);
    });

    test('attachInstancedPool() on a disposed geometry throws and attaches nothing', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      geometry.dispose();

      expect(() => geometry.attachInstancedPool('extraPool', extraInstancedDescriptor)).toThrow(
        /InstancedVOBufferGeometry#attachInstancedPool\("extraPool"\)/,
      );

      const livePool = new VertexObjectPool<VO>(secondExtraInstancedDescriptor, 2);

      expect(() => geometry.attachInstancedPool('extraPool2', livePool)).toThrow(
        /InstancedVOBufferGeometry#attachInstancedPool\("extraPool2"\)/,
      );

      expect(livePool.isAttachedToGeometry).toBe(false);
      expect(livePool.isDisposed).toBe(false);
      expect(Object.keys(geometry.attributes)).toEqual([]);
    });

    // (e) has no subject here: nothing in vertex-objects creates a signal or an effect.

    // Assertion (f) of the dispose test pattern in docs/resource-lifecycle.md — "gives every
    // slot it took back" — has no subject here: this geometry never calls createVO(). It
    // holds pools, not vertex objects: a pool it built itself is released, and one handed in
    // stays the caller's together with every slot the caller took from it.
  });

  describe('detachInstancedPool()', () => {
    test('the attribute a detached route leaves behind holds an empty array of its type, and is lent back for the dispose event', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);
      const attr = geometry.getAttribute('extra') as BufferAttribute;
      const type = attr.array.constructor;

      geometry.detachInstancedPool('extraPool');

      expect(attr.array.length).toBe(0);
      expect(attr.array.constructor).toBe(type);
      expect(attr.count).toBe(0);

      let lent: unknown;
      geometry.addEventListener('dispose', () => {
        lent = geometry.getAttribute('extra');
      });
      geometry.dispose();

      expect(lent).toBe(attr);
    });

    test('the interleaved attributes a detached route leaves behind share one empty array of its type, and are lent back for the dispose event', () => {
      const pairDescriptor = new VertexObjectDescriptor({
        attributes: {
          pairA: {size: 1, bufferName: 'pairBuffer'},
          pairB: {size: 1, bufferName: 'pairBuffer'},
        },
      });
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      geometry.attachInstancedPool('pairs', pairDescriptor);
      const attr = geometry.getAttribute('pairA') as InterleavedBufferAttribute;
      const type = attr.data.array.constructor;

      geometry.detachInstancedPool('pairs');

      expect(attr.data.array.length).toBe(0);
      expect(attr.data.array.constructor).toBe(type);
      expect(attr.data.count).toBe(0);

      let lentA: unknown;
      let lentB: InterleavedBufferAttribute | undefined;
      geometry.addEventListener('dispose', () => {
        lentA = geometry.getAttribute('pairA');
        lentB = geometry.getAttribute('pairB') as InterleavedBufferAttribute;
      });
      geometry.dispose();

      expect(lentA).toBe(attr);
      expect(lentB!.data).toBe(attr.data);
    });
  });

  test('attaching a pool leaves the static buffers of the routes that were already there alone', () => {
    const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
    const versionOf = (attrName: string) => (geometry.getAttribute(attrName) as BufferAttribute).version;

    geometry.instancedPool.createVO();
    geometry.update();

    const baseStatic = versionOf('position');
    const instancedStatic = versionOf('strength');

    // with an object in use: a route without one owes its first upload until it has one
    geometry.attachInstancedPool('extraPool', extraInstancedDescriptor).createVO();
    geometry.update();

    expect(versionOf('position'), 'the static buffer of the base route').toBe(baseStatic);
    expect(versionOf('strength'), 'the static buffer of the instanced route').toBe(instancedStatic);
    expect(versionOf('extra'), 'the static buffer the new route owes its first upload').toBeGreaterThan(0);
  });

  test('touchBuffers({instanced}) reaches the buffers of an attached pool', () => {
    const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
    const extraPool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);
    extraPool.createVO();
    geometry.update();

    const buffer = geometry.extraInstancedBuffers.get('extraPool')!.get('extraBuffer')! as BufferAttribute;
    const versionBeforeInstanced = buffer.version;

    geometry.touchBuffers({instanced: {static: true}});
    geometry.update();

    expect(buffer.version).toBeGreaterThan(versionBeforeInstanced);

    const versionBeforeBase = buffer.version;

    geometry.touchBuffers({base: {static: true}});
    geometry.update();

    expect(buffer.version).toBe(versionBeforeBase);
  });

  /** A geometry with one base and one instanced object, past its first update(), and the version of a static buffer per half. */
  const settledWithStaticVersions = () => {
    const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 1, baseDescriptor);
    geometry.basePool!.createVO();
    geometry.instancedPool.createVO();
    geometry.update();

    // `position` is the static attribute of the base half, `strength` the one of the instanced half
    const versionOf = (attrName: string) => (geometry.getAttribute(attrName) as BufferAttribute).version;
    return {geometry, base: () => versionOf('position'), instanced: () => versionOf('strength')};
  };

  test('touch() reaches the attribute names and the halves it is given, on the next update()', () => {
    const {geometry, base, instanced} = settledWithStaticVersions();
    const [baseBefore, instancedBefore] = [base(), instanced()];

    geometry.touch('strength', {instanced: {dynamic: true}});
    expect(instanced(), 'not before update()').toBe(instancedBefore);
    geometry.update();

    expect(instanced(), 'the attribute named').toBeGreaterThan(instancedBefore);
    expect(base(), 'the half nothing named').toBe(baseBefore);

    const [baseNext, instancedNext] = [base(), instanced()];
    geometry.touch({base: {static: true}});
    geometry.update();

    expect(base(), 'the half named').toBeGreaterThan(baseNext);
    expect(instanced(), 'the other half').toBe(instancedNext);
  });

  test('touch() applies both argument forms when they are mixed in one call', () => {
    const {geometry, base, instanced} = settledWithStaticVersions();
    const [baseBefore, instancedBefore] = [base(), instanced()];

    geometry.touch({dynamic: true}, {base: {static: true}});
    geometry.update();

    expect(base(), 'the routed form reaches the half it names').toBeGreaterThan(baseBefore);
    expect(instanced(), 'the flat form names dynamic buffers alone').toBe(instancedBefore);

    const [baseNext, instancedNext] = [base(), instanced()];
    geometry.touch({static: true}, {instanced: {dynamic: true}});
    geometry.update();

    expect(base(), 'the flat form reaches every route').toBeGreaterThan(baseNext);
    expect(instanced(), 'the flat form reaches every route').toBeGreaterThan(instancedNext);
  });

  test('an instanced attribute whose buffer carries padding reaches the geometry through an InstancedInterleavedBuffer', () => {
    const geometry = new InstancedVertexObjectGeometry(
      {attributes: {tint: {size: 3, type: 'uint8', normalized: true}}},
      4,
      baseDescriptor,
      1,
    );

    const tint = geometry.getAttribute('tint') as InterleavedBufferAttribute;
    expect(tint.isInterleavedBufferAttribute).toBe(true);
    expect(tint.data).toBeInstanceOf(InstancedInterleavedBuffer);
    expect(tint.data.stride).toBe(4);
    expect(tint.itemSize).toBe(3);
    expect(tint.offset).toBe(0);
  });

  describe('a pool that has been disposed', () => {
    test('the constructor refuses it as the instanced source', () => {
      const instancedPool = new VertexObjectPool<VO>(instancedDescriptor, 10);
      instancedPool.dispose();

      const build = () => new InstancedVertexObjectGeometry(instancedPool, 10, baseDescriptor, 1);
      expect(build, 'the message names the class').toThrow(/InstancedVOBufferGeometry/);
      expect(build, 'the message names which of the two sources it is about').toThrow(/instanced/);
      expect(build, 'the message names the state').toThrow(/disposed/);
    });

    test('the constructor refuses it as the base source', () => {
      const basePool = new VertexObjectPool<VO>(baseDescriptor, 1);
      basePool.dispose();

      const build = () => new InstancedVertexObjectGeometry(instancedDescriptor, 10, basePool, 1);
      expect(build, 'the message names the class').toThrow(/InstancedVOBufferGeometry/);
      expect(build, 'the message names which of the two sources it is about').toThrow(/base/);
      expect(build, 'the message names the state').toThrow(/disposed/);
    });

    test('attachInstancedPool() refuses it and leaves the geometry exactly as it was', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const extraPool = new VertexObjectPool<VO>(extraInstancedDescriptor, 2);
      extraPool.dispose();

      const attributesBefore = Object.keys(geometry.attributes).sort();

      const attach = () => geometry.attachInstancedPool('extraPool', extraPool);
      expect(attach, 'the message names the call').toThrow(/InstancedVOBufferGeometry#attachInstancedPool\("extraPool"\)/);
      expect(attach, 'the message names the state').toThrow(/disposed/);

      expect(Object.keys(geometry.attributes).sort()).toEqual(attributesBefore);
      expect(geometry.extraInstancedPools.size).toBe(0);
      expect(geometry.extraInstancedBuffers.size).toBe(0);
      expect(geometry.extraInstancedBufferSerials.size).toBe(0);

      // a pool the geometry had taken on would be released with it
      const extraDispose = sandbox.spy(extraPool, 'dispose');
      geometry.dispose();
      expect(extraDispose.called, "the refused pool is not one of the geometry's own").toBe(false);
    });

    test('attachInstancedPool() refuses it under a name that is taken and leaves that route whole', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const livePool = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);

      const deadPool = new VertexObjectPool<VO>(secondExtraInstancedDescriptor, 2);
      deadPool.dispose();

      const attach = () => geometry.attachInstancedPool('extraPool', deadPool);
      expect(attach, 'the message names the call').toThrow(/InstancedVOBufferGeometry#attachInstancedPool\("extraPool"\)/);
      expect(attach, 'the message names the state').toThrow(/disposed/);

      expect(geometry.extraInstancedPools.get('extraPool')).toBe(livePool);
      expect(geometry.extraInstancedBuffers.get('extraPool')!.get('extraBuffer')!.array).toBe(
        livePool.buffer.buffers.get('extraBuffer')!.typedArray,
      );
      expect(geometry.getAttribute('extra')).toBeDefined();
      expect(livePool.isAttachedToGeometry, 'the route that holds the name still reads the pool').toBe(true);
      expect(livePool.isDisposed).toBe(false);
    });
  });

  /** The pools built for `descriptor` that `dispose` saw a call on, each once. */
  const disposedPoolsOf = (dispose: {thisValues: unknown[]}, descriptor: VertexObjectDescriptor) => [
    ...new Set((dispose.thisValues as VOBufferPool[]).filter((pool) => pool.descriptor === descriptor)),
  ];

  describe('attachInstancedPool() that fails', () => {
    // two attributes in buffers of their own, so an attach sets two slots one after the other
    const twinDescriptor = new VertexObjectDescriptor({
      attributes: {
        twinA: {size: 1, bufferName: 'twinABuffer'},
        twinB: {size: 1, bufferName: 'twinBBuffer'},
      },
    });

    test('a refused descriptor leaves no pool behind: the one built for it is disposed', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      geometry.attachInstancedPool('first', extraInstancedDescriptor);

      const dispose = sandbox.spy(VOBufferPool.prototype, 'dispose');

      expect(() => geometry.attachInstancedPool('second', extraInstancedDescriptor)).toThrow(/"extra"/);

      expect(dispose.callCount).toBe(1);
      const refused = dispose.thisValues[0] as VOBufferPool;
      expect(refused.descriptor).toBe(extraInstancedDescriptor);
      expect(refused).not.toBe(geometry.extraInstancedPools.get('first'));
      expect(refused.isDisposed).toBe(true);
    });

    test('a throw while the attributes are built leaves the route under the name, its pool and the slots as they were', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const live = geometry.attachInstancedPool('extraPool', extraInstancedDescriptor);
      const attributesBefore = Object.keys(geometry.attributes).sort();

      const dispose = sandbox.spy(VOBufferPool.prototype, 'dispose');
      const setAttribute = sandbox.stub(geometry, 'setAttribute').callThrough();
      setAttribute.onSecondCall().throws(new Error('setAttribute'));

      expect(() => geometry.attachInstancedPool('extraPool', twinDescriptor)).toThrow('setAttribute');

      expect(geometry.extraInstancedPools.get('extraPool')).toBe(live);
      expect(live.isDisposed).toBe(false);
      expect(live.isAttachedToGeometry).toBe(true);
      expect(geometry.getAttribute('extra')).toBeDefined();
      expect(Object.keys(geometry.attributes).sort()).toEqual(attributesBefore);

      const built = disposedPoolsOf(dispose, twinDescriptor);
      expect(built).toHaveLength(1);
      expect(built[0]!.isDisposed).toBe(true);

      setAttribute.restore();

      geometry.attachInstancedPool('twins', twinDescriptor);
      expect(geometry.getAttribute('twinA')).toBeDefined();
      expect(geometry.getAttribute('twinB')).toBeDefined();
    });

    test('a throw while the attributes of a pool handed in are built leaves that pool unattached and alive', () => {
      const geometry = new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, 1);
      const twins = new VertexObjectPool<VO>(twinDescriptor, 10);

      const setAttribute = sandbox.stub(geometry, 'setAttribute').callThrough();
      setAttribute.onSecondCall().throws(new Error('setAttribute'));

      expect(() => geometry.attachInstancedPool('twins', twins)).toThrow('setAttribute');

      expect(twins.isAttachedToGeometry).toBe(false);
      expect(twins.isDisposed).toBe(false);
      expect(geometry.extraInstancedPools.size).toBe(0);
      expect(geometry.getAttribute('twinA')).toBeUndefined();
    });
  });

  describe('a constructor that throws', () => {
    test('disposes the instanced pool it built when the base pool handed in has been disposed', () => {
      const disposedBase = new VertexObjectPool<VO>(baseDescriptor, 1);
      disposedBase.dispose();
      const dispose = sandbox.spy(VOBufferPool.prototype, 'dispose');

      // built once, so that one pool is built for the call
      expect(() => new InstancedVertexObjectGeometry(instancedDescriptor, 10, disposedBase)).toThrow(/base.*disposed/);

      const built = disposedPoolsOf(dispose, instancedDescriptor);
      expect(built).toHaveLength(1);
      expect(built[0]!.isDisposed).toBe(true);
    });

    test('disposes the base pool it built when the instanced pool handed in has been disposed', () => {
      const disposedInstanced = new VertexObjectPool<VO>(instancedDescriptor, 10);
      disposedInstanced.dispose();
      const dispose = sandbox.spy(VOBufferPool.prototype, 'dispose');

      expect(() => new InstancedVertexObjectGeometry(disposedInstanced, 10, baseDescriptor, 1)).toThrow(/disposed/);

      const built = disposedPoolsOf(dispose, baseDescriptor);
      expect(built).toHaveLength(1);
      expect(built[0]!.isDisposed).toBe(true);
    });

    test('disposes the instanced pool it built when the base capacity is refused', () => {
      const dispose = sandbox.spy(VOBufferPool.prototype, 'dispose');

      expect(() => new InstancedVertexObjectGeometry(instancedDescriptor, 10, baseDescriptor, -1)).toThrow(RangeError);

      const built = disposedPoolsOf(dispose, instancedDescriptor);
      expect(built).toHaveLength(1);
      expect(built[0]!.isDisposed).toBe(true);
    });

    test('InstancedVOBufferGeometry disposes the instanced pool it built when the base capacity is refused', () => {
      const dispose = sandbox.spy(VOBufferPool.prototype, 'dispose');

      expect(() => new InstancedVOBufferGeometry(instancedDescriptor, 10, baseDescriptor, 1.5)).toThrow(RangeError);

      const built = disposedPoolsOf(dispose, instancedDescriptor);
      expect(built).toHaveLength(1);
      expect(built[0]!.isDisposed).toBe(true);
    });

    test('leaves an instanced pool handed in alive and unattached when the base capacity is refused', () => {
      const handedIn = new VertexObjectPool<VO>(instancedDescriptor, 10);

      expect(() => new InstancedVertexObjectGeometry(handedIn, 10, baseDescriptor, -1)).toThrow(RangeError);

      expect(handedIn.isDisposed).toBe(false);
      expect(handedIn.isAttachedToGeometry).toBe(false);
    });
  });
});

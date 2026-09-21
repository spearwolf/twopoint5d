import {expect} from '@esm-bundle/chai';
import {Display, InstancedVertexObjectGeometry, VertexObjects} from '@spearwolf/twopoint5d';
import {attribute} from 'three/tsl';
import {MeshBasicNodeMaterial, PerspectiveCamera, Scene} from 'three/webgpu';

/** @import {VO, VOAttrSetter, VertexObjectDescription} from '@spearwolf/twopoint5d' */
/** @typedef {VO & {setPosition: VOAttrSetter}} QuadVO */
/** @typedef {VO & {setInstanceOffset: VOAttrSetter}} InstanceVO */

const FIXTURE_ID = 'vertex-objects-heap-fixture';

// The absolute heap size of the test page depends on the V8 version and on what three loads; a
// limit measured against the run's own first sample holds across versions. The samples grow
// linearly, about 13.5 KB per round — 11.8 % of the first sample, measured on Chromium 153 with
// three 0.185 and its WebGL2 backend. Heap snapshots show three retaining what grows, and JIT code
// the page compiles meanwhile counts too. A plain three mesh with the same attributes grows 5.2 %
// in the same rounds; the rest are objects of this library that three keeps along the same path:
// - every mesh rendered with the shared material gets a `RenderObject`, held by its dispose
//   listener on the material. It keeps the mesh, the disposed geometry and its own uniform group.
//   `geometry.dispose()` leaves the listener in place; three releases the `RenderObject` on
//   `material.dispose()` or when its cache key changes. A material that is only garbage
//   collected takes the `RenderObject` along, but not its uniform group: the renderer's
//   `info.memoryMap` keeps that until `material.dispose()` or `renderer.dispose()`.
// - that `RenderObject` also keeps the typed arrays of the geometry through `attributes`: three
//   clears the field on the dispose event of the geometry, and its geometry bookkeeping fills it
//   again while handling the same event, because the geometry still holds its attributes then.
//   With the pool capacities of this test (1 quad, 8 instances) that is 144 bytes of vertex data
//   per round; it grows with the capacity of the pools.
// - the WebGL backend caches a vertex array object per attribute set in `vaoCache` and never
//   deletes one; they go only when the renderer itself is garbage collected.
// Disposing the material every 20 rounds leaves about 3 KB per round (2.2 % over 80 rounds);
// the snapshots trace about 1.6 KB of it to the vertex-array cache and name no owner for the
// rest. Runs repeat to within 0.01 points; the limit sits three points above them, so a shift in
// three or V8 does not fail the test, while a leak on the scale of what three keeps here pushes
// the growth past it.
const MAX_HEAP_GROWTH = 0.15;

function makeContainer({width = 320, height = 200} = {}) {
  const el = document.createElement('div');
  el.id = `${FIXTURE_ID}-${Math.random().toString(36).slice(2, 8)}`;
  el.style.position = 'absolute';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  document.body.appendChild(el);
  return el;
}

/** Teardown must not mask the failure that got it here: no display, or a display that fails to go down. */
function disposeDisplay(display) {
  if (!display) return;
  try {
    display.dispose();
  } catch {
    // ignore — the fixture still has to leave the dom
  }
}

/** @type {VertexObjectDescription} */
const quadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
};

/** @type {VertexObjectDescription} */
const instancedDescription = {
  attributes: {instanceOffset: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
};

// Chrome's non-standard heap counter; Firefox has none, which the `before()` hook checks for
/** @type {Performance & {memory?: {usedJSHeapSize: number}}} */
const chromePerformance = performance;

/**
 * A single GC pass only clears the young generation, so a raw heap reading still climbs
 * monotonically even without a leak — it just reflects whatever hasn't been collected yet.
 * Forcing three synchronous major collections before each sample, with a short pause for
 * the collector to actually run, is what makes a leak-free run and a leaking run tell apart.
 */
async function sampleHeap() {
  for (let i = 0; i < 3; i++) {
    globalThis.gc({execution: 'sync', type: 'major'});
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
  return chromePerformance.memory.usedJSHeapSize;
}

describe('vertex-objects — heap', function () {
  before(function () {
    // Firefox has neither performance.memory nor globalThis.gc and cannot take a single sample —
    // skip before beforeEach starts a Display, so this file starts no GPU device in a browser it
    // cannot measure.
    if (typeof chromePerformance.memory === 'undefined' || typeof globalThis.gc !== 'function') {
      this.skip();
    }
  });

  // the display comes up in the hook — renderer init included — and hooks have their own budget
  this.timeout(30000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  let scene;
  let camera;
  let material;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    scene = new Scene();
    camera = new PerspectiveCamera(75, 1.6, 0.1, 100);
    camera.position.z = 5;

    // one material for the whole loop: a fresh one each round would force the
    // `WebGPURenderer` to build a fresh pipeline each round, and the test would measure
    // that cache instead of the pool/geometry path it's actually after. The render objects
    // three keeps on this material are most of the growth `MAX_HEAP_GROWTH` allows for.
    material = new MeshBasicNodeMaterial();
    // an attribute has to be read by a shader, otherwise three never builds a gpu buffer for it
    material.positionNode = attribute('position', /** @type {const} */ ('vec3')).add(attribute('instanceOffset', 'vec3'));
  });

  afterEach(() => {
    disposeDisplay(display);
    display = undefined;
    material = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  it('does not leak geometries or heap across many create/render/dispose rounds', async function () {
    async function round() {
      /** @type {InstancedVertexObjectGeometry<InstanceVO, QuadVO>} */
      const geometry = new InstancedVertexObjectGeometry(instancedDescription, 8, quadDescription, 1);
      geometry.basePool.createVO().setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
      geometry.instancedPool.createVO().setInstanceOffset([1, 1, 1]);
      const mesh = new VertexObjects(geometry, material);
      scene.add(mesh);
      display.renderer.render(scene, camera);
      await display.nextFrame();
      scene.remove(mesh);
      geometry.dispose();
    }

    for (let i = 0; i < 20; i++) {
      await round();
    }

    const geometriesBefore = display.renderer.info.memory.geometries;
    const heapSamples = [await sampleHeap()];

    for (let i = 0; i < 100; i++) {
      await round();
      if ((i + 1) % 20 === 0) {
        heapSamples.push(await sampleHeap());
      }
    }

    expect(display.renderer.info.memory.geometries, 'geometries the renderer still counts after the rounds').to.equal(
      geometriesBefore,
    );

    const heapGrowth = heapSamples[heapSamples.length - 1] - heapSamples[0];
    const growthRatio = heapGrowth / heapSamples[0];
    console.debug(`[heap] samples ${heapSamples.join(', ')} · growth ${(growthRatio * 100).toFixed(2)} % of the first sample`);
    expect(
      growthRatio,
      `heap grew by ${heapGrowth} bytes (${(growthRatio * 100).toFixed(2)} %) across the samples ${heapSamples.join(', ')}`,
    ).to.be.below(MAX_HEAP_GROWTH);
  });
});

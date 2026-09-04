import {expect} from '@esm-bundle/chai';
import {Display, InstancedVertexObjectGeometry, VertexObjects} from '@spearwolf/twopoint5d';
import {attribute} from 'three/tsl';
import {MeshBasicNodeMaterial, PerspectiveCamera, Scene} from 'three/webgpu';

const FIXTURE_ID = 'vertex-objects-heap-fixture';

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

const quadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
};

const instancedDescription = {
  meshCount: 1,
  attributes: {instanceOffset: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
};

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
  return performance.memory.usedJSHeapSize;
}

describe('vertex-objects — heap', function () {
  before(function () {
    // Firefox has neither performance.memory nor globalThis.gc, and on this machine it
    // gets no GL context at all — skip before a Display ever starts, so Firefox's error
    // count stays exactly where it was before this file existed.
    if (typeof performance.memory === 'undefined' || typeof globalThis.gc !== 'function') {
      this.skip();
    }
  });

  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
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
    // WebGPURenderer to build a fresh pipeline each round, and the test would measure
    // that cache instead of the pool/geometry path it's actually after.
    material = new MeshBasicNodeMaterial();
    // an attribute has to be read by a shader, otherwise three never builds a gpu buffer for it
    material.positionNode = attribute('position', 'vec3').add(attribute('instanceOffset', 'vec3'));
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

    expect(display.renderer.info.memory.geometries, 'geometries given up their renderer slot').to.equal(geometriesBefore);

    const heapGrowth = heapSamples[heapSamples.length - 1] - heapSamples[0];
    const FOUR_MIB = 4 * 1024 * 1024;
    expect(heapGrowth, `heap grew by ${heapGrowth} bytes across the samples ${heapSamples.join(', ')}`).to.be.below(FOUR_MIB);
  });
});

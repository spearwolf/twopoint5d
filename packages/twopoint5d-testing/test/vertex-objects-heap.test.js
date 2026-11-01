import {expect} from 'chai';
import {Display, InstancedVertexObjectGeometry, VertexObjects} from '@spearwolf/twopoint5d';
import {attribute} from 'three/tsl';
import {MeshBasicNodeMaterial, PerspectiveCamera, Scene} from 'three/webgpu';
import {makeContainer, disposeDisplay, quadDescription, instancedDescription} from './helpers/fixtures.js';

/** @import {VO, VOAttrSetter} from '@spearwolf/twopoint5d' */
/** @typedef {VO & {setPosition: VOAttrSetter}} QuadVO */
/** @typedef {VO & {setInstanceOffset: VOAttrSetter}} InstanceVO */

// The absolute heap size of the test page depends on the V8 version and on what three loads; a
// limit measured against the run's own first sample holds across versions. The samples grow
// linearly, about 11 KB per round — 7.9 % of the first sample under WebGL2 and 8.0 % under
// WebGPU, measured on Chromium 156 with three 0.187.0. JIT code the page compiles meanwhile
// counts too. A plain three mesh with the same attributes grows 4.5 % in the same rounds; the
// rest are objects of this library that three 0.187.0 keeps along the same path:
// - every mesh rendered with the shared material gets a `RenderObject`, held by its dispose
//   listener on the material. It keeps the mesh, the disposed geometry with its typed arrays and
//   its own uniform group. `geometry.dispose()` leaves that listener in place; three releases the
//   `RenderObject` on `material.dispose()`, on the `dispose()` of the mesh — from three 0.186 on,
//   which this test does not call — or when its cache key changes. A material that is only
//   garbage collected takes the `RenderObject` along: the renderer's `info.memoryMap` holds its
//   keys weakly from three 0.186 on.
// - on the dispose event of the geometry the `RenderObject` drops the attributes it built from
//   nodes and its vertex array object, and clears its `attributes`. Under WebGL2 the backend
//   shares a vertex array object between the render objects on the same gpu buffers and deletes
//   it once the last of them lets go of it or one of its buffers is destroyed
//   (`webgl-fallback/utils/WebGLVertexArrayUtils.js`), so none outlives its round.
// Disposing the material every 20 rounds leaves about 2.5 KB per round (1.8 % over 100 rounds under
// WebGL2 and 1.9 % under WebGPU, measured as above). Runs repeat to within 0.01 points. The limit
// sits about seven points above them, so a shift in three or V8 does not fail the test, while a
// leak of some 10 KB per round on top of what three keeps here pushes the growth past it.
const MAX_HEAP_GROWTH = 0.15;

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
    // three keeps a render object per rendered mesh on the material until the material is
    // disposed; it goes while the renderer that built them is still there
    material?.dispose();
    material = undefined;
    disposeDisplay(display);
    display = undefined;
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
      // without it the instance count stays at three's default of Infinity: WebGL2 draws no
      // instance at all then, and WebGPU's drawIndexed() refuses the value
      mesh.update();
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

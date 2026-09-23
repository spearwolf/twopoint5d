import {expect} from '@esm-bundle/chai';
import {Display, InstancedVertexObjectGeometry, VertexObjectGeometry, VertexObjects} from '@spearwolf/twopoint5d';
import {attribute} from 'three/tsl';
import {MeshBasicMaterial, MeshBasicNodeMaterial, PerspectiveCamera, Scene} from 'three/webgpu';

/** @import {VO, VOAttrSetter, VertexObjectDescription} from '@spearwolf/twopoint5d' */
/** @typedef {VO & {setPosition: VOAttrSetter}} QuadVO */
/** @typedef {VO & {setInstanceOffset: VOAttrSetter}} InstanceVO */
/** @typedef {VO & {setPosition: VOAttrSetter, setColor: VOAttrSetter}} ColoredQuadVO */

const FIXTURE_ID = 'vertex-objects-gpu-upload-fixture';

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

/** The buffer behind an attribute — that is where the update ranges live that steer the upload. */
function bufferOf(attr) {
  return attr.isInterleavedBufferAttribute ? attr.data : attr;
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

/** Reads an attribute back out of the gpu buffer three has uploaded it into. */
async function readBack(display, attr) {
  return Array.from(new Float32Array(await display.renderer.getArrayBufferAsync(attr)));
}

/**
 * Reads an interleaved attribute back out of the gpu buffer it shares with its siblings.
 *
 * On the WebGL backend three 0.185.1 answers an empty buffer for it: in
 * `src/renderers/webgl-fallback/utils/WebGLAttributeUtils.js`, `createAttribute()` files the
 * record that carries `byteLength` under the attribute wrapper, while `getArrayBufferAsync()`
 * looks it up under the shared buffer, `attribute.data`. The gl buffer is read directly
 * instead; the WebGPU backend takes the usual path.
 *
 * "three still reads an interleaved attribute back as an empty buffer on the WebGL backend"
 * fails once a three release reads the whole buffer back — this helper and that test go then.
 */
async function readBackInterleaved(display, attr) {
  if (display.isWebGPUBackend) return readBack(display, attr);

  const {gl} = display.renderer.backend;
  const buffer = bufferOf(attr);
  const out = new Float32Array(buffer.array.length);
  const previous = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
  try {
    gl.bindBuffer(gl.ARRAY_BUFFER, display.renderer.backend.get(buffer).bufferGPU);
    gl.getBufferSubData(gl.ARRAY_BUFFER, 0, out);
  } finally {
    gl.bindBuffer(gl.ARRAY_BUFFER, previous);
  }
  return Array.from(out);
}

/** @type {VertexObjectDescription} */
const quadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
};

// static and therefore without autoTouch: what reaches the gpu here comes from the pool having
// written something, which is the whole point of this test
/** @type {VertexObjectDescription} */
const staticQuadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'static'}},
};

/** @type {VertexObjectDescription} */
const instancedDescription = {
  attributes: {instanceOffset: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
};

// both attributes share the buffer name `dynamic_float32`, so they interleave into one buffer of stride 6
/** @type {VertexObjectDescription} */
const interleavedQuadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {
    position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'},
    color: {components: ['r', 'g', 'b'], type: 'float32', usage: 'dynamic'},
  },
};

describe('vertex-objects — gpu upload', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  let scene;
  let camera;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    console.debug(`Display: backend is ${display.isWebGPUBackend ? 'WebGPU' : 'WebGL'}`);
    scene = new Scene();
    camera = new PerspectiveCamera(75, 1.6, 0.1, 100);
    camera.position.z = 5;
  });

  afterEach(() => {
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  it('every vertex of a used object reaches the gpu, not just the first', async function () {
    /** @type {VertexObjectGeometry<QuadVO>} */
    const geometry = new VertexObjectGeometry(quadDescription, 8);
    const mesh = new VertexObjects(geometry, new MeshBasicMaterial());
    scene.add(mesh);

    const quad = geometry.pool.createVO();
    quad.setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);

    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const position = geometry.getAttribute('position');

    // rewrite the tail of the very same object: only vertex 0 keeps the values it had
    quad.setPosition([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
    mesh.update();

    // itemSize (3) * vertexCount (4) * usedCount (1) — a range of 3 would carry vertex 0 alone
    expect(bufferOf(position).updateRanges).to.deep.equal([{start: 0, count: 12}]);

    display.renderer.render(scene, camera);
    await display.nextFrame();

    expect((await readBack(display, position)).slice(0, 12)).to.deep.equal([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
  });

  it('a spawn in a large, mostly static pool uploads the new object alone', async function () {
    /** @type {VertexObjectGeometry<QuadVO>} */
    const geometry = new VertexObjectGeometry(staticQuadDescription, 64);
    const mesh = new VertexObjects(geometry, new MeshBasicMaterial());
    scene.add(mesh);

    // one quad per object, side by side along x, so every object carries values of its own
    const quadAt = (i) => [i, 0, 0, i + 1, 0, 0, i + 1, 1, 0, i, 1, 0];
    for (let i = 0; i < 32; i++) {
      geometry.pool.createVO().setPosition(quadAt(i));
    }

    // this pass spends the auto-touch round that uploads a static buffer once in full; from here
    // on the upload hangs on the pool having written something
    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const position = geometry.getAttribute('position');

    // the pass above built the gpu buffer out of the whole array and left its range standing —
    // three takes a range up only on an upload that follows one. This spawn is that upload, and
    // the pool is in its steady state afterwards, which is where a sprite spawn really happens
    geometry.pool.createVO().setPosition(quadAt(100));
    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    geometry.pool.createVO().setPosition(quadAt(200));
    mesh.update();

    // the 34th object and nothing else: 4 vertices of 3 components, at object 33
    expect(bufferOf(position).updateRanges).to.deep.equal([{start: 33 * 4 * 3, count: 4 * 3}]);

    display.renderer.render(scene, camera);
    await display.nextFrame();

    const onTheGpu = await readBack(display, position);

    expect(onTheGpu.slice(33 * 12, 34 * 12), 'the object that was spawned').to.deep.equal(quadAt(200));
    expect(onTheGpu.slice(32 * 12, 33 * 12), 'the object of the spawn before it').to.deep.equal(quadAt(100));
    expect(onTheGpu.slice(5 * 12, 6 * 12), 'an object that nobody touched').to.deep.equal(quadAt(5));
  });

  it('an instanced geometry uploads its base quad and every used instance', async function () {
    /** @type {InstancedVertexObjectGeometry<InstanceVO, QuadVO>} */
    const geometry = new InstancedVertexObjectGeometry(instancedDescription, 8, quadDescription, 1);
    const material = new MeshBasicNodeMaterial();
    // an attribute has to be read by a shader, otherwise three never builds a gpu buffer for it
    material.positionNode = attribute('position', /** @type {const} */ ('vec3')).add(attribute('instanceOffset', 'vec3'));
    const mesh = new VertexObjects(geometry, material);
    scene.add(mesh);

    const quad = geometry.basePool.createVO();
    quad.setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    geometry.instancedPool.createVO().setInstanceOffset([1, 1, 1]);

    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const position = geometry.getAttribute('position');
    const instanceOffset = geometry.getAttribute('instanceOffset');

    quad.setPosition([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
    for (let i = 1; i < 4; i++) {
      geometry.instancedPool.createVO().setInstanceOffset([i * 10, i * 10, i * 10]);
    }

    mesh.update();

    // the base pool counts vertices per object, the instanced pool counts instances
    expect(bufferOf(position).updateRanges, 'base pool').to.deep.equal([{start: 0, count: 12}]);
    expect(bufferOf(instanceOffset).updateRanges, 'instanced pool').to.deep.equal([{start: 0, count: 12}]);

    display.renderer.render(scene, camera);
    await display.nextFrame();

    expect((await readBack(display, position)).slice(0, 12), 'base quad').to.deep.equal([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
    expect((await readBack(display, instanceOffset)).slice(0, 12), 'instances').to.deep.equal([
      1, 1, 1, 10, 10, 10, 20, 20, 20, 30, 30, 30,
    ]);
  });

  it('an object whose indices leave a vertex unused is drawn from its own vertices', async function () {
    // four vertices per object, of which the indices name three: the second object starts at vertex 4
    /** @type {VertexObjectDescription} */
    const description = {
      vertexCount: 4,
      indices: [0, 1, 2],
      attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
    };
    /** @type {VertexObjectGeometry<QuadVO>} */
    const geometry = new VertexObjectGeometry(description, 2);
    const mesh = new VertexObjects(geometry, new MeshBasicMaterial());
    scene.add(mesh);

    geometry.pool.createVO().setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 9, 9, 9]);
    geometry.pool.createVO().setPosition([2, 0, 0, 3, 0, 0, 3, 1, 0, 9, 9, 9]);

    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const indices = Array.from(new Uint32Array(await display.renderer.getArrayBufferAsync(geometry.index)));

    expect(indices.slice(0, 6)).to.deep.equal([0, 1, 2, 4, 5, 6]);
  });

  it('two attributes that share a buffer upload the whole stride of every used vertex', async function () {
    /** @type {VertexObjectGeometry<ColoredQuadVO>} */
    const geometry = new VertexObjectGeometry(interleavedQuadDescription, 8);
    const material = new MeshBasicNodeMaterial();
    // an attribute has to be read by a shader, otherwise three never builds a gpu buffer for it
    material.positionNode = attribute('position', 'vec3');
    material.colorNode = attribute('color', 'vec3');
    const mesh = new VertexObjects(geometry, material);
    scene.add(mesh);

    const quad = geometry.pool.createVO();
    quad.setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    quad.setColor([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0]);

    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const position = geometry.getAttribute('position');
    const color = geometry.getAttribute('color');

    expect(bufferOf(position), 'one interleaved buffer carries both attributes').to.equal(bufferOf(color));

    // rewrite both attributes of the very same object
    quad.setPosition([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
    quad.setColor([2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
    mesh.update();

    // itemSize (6, the stride) * vertexCount (4) * usedCount (1) — a range of 12 would ignore the stride
    expect(bufferOf(position).updateRanges).to.deep.equal([{start: 0, count: 24}]);

    display.renderer.render(scene, camera);
    await display.nextFrame();

    // the attributes sit in alphabetical order inside the stride: color at offset 0, position at offset 3
    expect((await readBackInterleaved(display, position)).slice(0, 24)).to.deep.equal([
      2, 2, 2, 0, 0, 0, 3, 3, 3, 7, 7, 7, 4, 4, 4, 8, 8, 8, 5, 5, 5, 9, 9, 9,
    ]);
  });

  it('three still reads an interleaved attribute back as an empty buffer on the WebGL backend', async function () {
    if (!display.isWebGLBackend) this.skip();

    /** @type {VertexObjectGeometry<ColoredQuadVO>} */
    const geometry = new VertexObjectGeometry(interleavedQuadDescription, 8);
    const material = new MeshBasicNodeMaterial();
    // an attribute has to be read by a shader, otherwise three never builds a gpu buffer for it
    material.positionNode = attribute('position', 'vec3');
    material.colorNode = attribute('color', 'vec3');
    const mesh = new VertexObjects(geometry, material);
    scene.add(mesh);

    const quad = geometry.pool.createVO();
    quad.setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    quad.setColor([1, 0, 0, 0, 1, 0, 0, 0, 1, 1, 1, 0]);

    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    /** @type {any} */
    const position = geometry.getAttribute('position');
    const bytes = await display.renderer.getArrayBufferAsync(position);
    expect(
      bytes.byteLength,
      'three reads an interleaved attribute back by itself now: readBackInterleaved() and this test can go',
    ).to.equal(0);
  });
});

import {expect} from '@esm-bundle/chai';
import {Display, InstancedVertexObjectGeometry, VertexObjectGeometry, VertexObjects} from '@spearwolf/twopoint5d';
import {attribute} from 'three/tsl';
import {MeshBasicMaterial, MeshBasicNodeMaterial, PerspectiveCamera, Scene} from 'three/webgpu';

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
async function readBack(renderer, attr) {
  return Array.from(new Float32Array(await renderer.getArrayBufferAsync(attr)));
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

    expect((await readBack(display.renderer, position)).slice(0, 12)).to.deep.equal([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
  });

  it('an instanced geometry uploads its base quad and every used instance', async function () {
    const geometry = new InstancedVertexObjectGeometry(instancedDescription, 8, quadDescription, 1);
    const material = new MeshBasicNodeMaterial();
    // an attribute has to be read by a shader, otherwise three never builds a gpu buffer for it
    material.positionNode = attribute('position', 'vec3').add(attribute('instanceOffset', 'vec3'));
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

    expect((await readBack(display.renderer, position)).slice(0, 12), 'base quad').to.deep.equal([
      0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9,
    ]);
    expect((await readBack(display.renderer, instanceOffset)).slice(0, 12), 'instances').to.deep.equal([
      1, 1, 1, 10, 10, 10, 20, 20, 20, 30, 30, 30,
    ]);
  });
});

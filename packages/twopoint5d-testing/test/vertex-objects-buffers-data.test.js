import {expect} from '@esm-bundle/chai';
import {Display, VertexObjectBuffer, VertexObjectGeometry, VertexObjectPool, VertexObjects} from '@spearwolf/twopoint5d';
import {MeshBasicMaterial, PerspectiveCamera, Scene} from 'three/webgpu';

const FIXTURE_ID = 'vertex-objects-buffers-data-fixture';

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

/** Reads an attribute back out of the gpu buffer three has uploaded it into. */
async function readBack(renderer, attr) {
  return Array.from(new Float32Array(await renderer.getArrayBufferAsync(attr)));
}

const quadDescription = {
  vertexCount: 4,
  indices: [0, 1, 2, 0, 2, 3],
  attributes: {position: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
};

describe('vertex-objects — buffers data', function () {
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

  it('a pool restored from buffers data renders the values it was handed', async function () {
    const source = new VertexObjectPool(quadDescription, 2);
    source.createVO().setPosition([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);

    const buffersData = source.toBuffersData();

    const restored = new VertexObjectPool(quadDescription, 2);
    // exercises the raw constructor path itself, not VOBufferPool#fromBuffersData(); capacity
    // is 2 on both sides on purpose, since this constructor does not reconcile a mismatch
    restored.buffer = new VertexObjectBuffer(restored.buffer, buffersData);
    restored.usedCount = buffersData.usedCount;

    const geometry = new VertexObjectGeometry(restored, 2);
    const mesh = new VertexObjects(geometry, new MeshBasicMaterial());
    scene.add(mesh);

    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const position = geometry.getAttribute('position');
    expect((await readBack(display.renderer, position)).slice(0, 12)).to.deep.equal([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);
  });
});

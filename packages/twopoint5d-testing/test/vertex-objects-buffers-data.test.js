import {expect} from '@esm-bundle/chai';
import {Display, VertexObjectGeometry, VertexObjectPool, VertexObjects} from '@spearwolf/twopoint5d';
import {MeshBasicMaterial, PerspectiveCamera, Scene} from 'three/webgpu';
import {makeContainer, disposeDisplay, readBack, quadDescription} from './helpers/fixtures.js';

/** @import {VO, VOAttrSetter} from '@spearwolf/twopoint5d' */
/** @typedef {VO & {setPosition: VOAttrSetter}} QuadVO */

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
    /** @type {VertexObjectPool<QuadVO>} */
    const source = new VertexObjectPool(quadDescription, 2);
    source.createVO().setPosition([0, 0, 0, 7, 7, 7, 8, 8, 8, 9, 9, 9]);

    const buffersData = source.toBuffersData();

    // the way a caller restores a pool: its constructor takes the buffers data, usedCount included
    /** @type {VertexObjectPool<QuadVO>} */
    const restored = new VertexObjectPool(quadDescription, buffersData);

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

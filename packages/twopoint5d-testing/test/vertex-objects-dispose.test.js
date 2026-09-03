import {expect} from '@esm-bundle/chai';
import {Display, InstancedVertexObjectGeometry, VertexObjectGeometry, VertexObjects} from '@spearwolf/twopoint5d';
import {attribute} from 'three/tsl';
import {MeshBasicMaterial, MeshBasicNodeMaterial, PerspectiveCamera, Scene} from 'three/webgpu';

const FIXTURE_ID = 'vertex-objects-dispose-fixture';

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

const extraInstancedDescription = {
  meshCount: 1,
  attributes: {extraOffset: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
};

describe('vertex-objects — dispose', function () {
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

  /** Renders the mesh once, so the renderer has built its bookkeeping for this geometry. */
  async function renderOnce(mesh) {
    scene.add(mesh);
    mesh.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();
  }

  it('a rendered geometry disposes and gives up its slots', async function () {
    const geometry = new VertexObjectGeometry(quadDescription, 8);
    geometry.pool.createVO().setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    await renderOnce(new VertexObjects(geometry, new MeshBasicMaterial()));

    expect(() => geometry.dispose()).to.not.throw();

    // the slots are given up either way — that is what keeps a re-added geometry from
    // getting fresh gpu buffers built out of the old typed arrays
    expect(Object.keys(geometry.attributes)).to.deep.equal([]);
    expect(geometry.index).to.be.null;
  });

  it('a rendered geometry taken out of the scene disposes and gives up its slots', async function () {
    const geometry = new VertexObjectGeometry(quadDescription, 8);
    geometry.pool.createVO().setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    const mesh = new VertexObjects(geometry, new MeshBasicMaterial());
    await renderOnce(mesh);

    // the path a consumer walks: TexturedSprites#dispose() calls geometry.dispose()
    // on a geometry that has rendered
    scene.remove(mesh);
    display.renderer.render(scene, camera);
    await display.nextFrame();

    expect(() => geometry.dispose()).to.not.throw();
    expect(Object.keys(geometry.attributes)).to.deep.equal([]);
    expect(geometry.index).to.be.null;
  });

  it('a rendered instanced geometry disposes and gives up its slots', async function () {
    const geometry = new InstancedVertexObjectGeometry(instancedDescription, 8, quadDescription, 1);
    const material = new MeshBasicNodeMaterial();
    // an attribute has to be read by a shader, otherwise three never builds a gpu buffer for it
    material.positionNode = attribute('position', 'vec3').add(attribute('instanceOffset', 'vec3'));
    geometry.basePool.createVO().setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    geometry.instancedPool.createVO().setInstanceOffset([1, 1, 1]);
    await renderOnce(new VertexObjects(geometry, material));

    expect(() => geometry.dispose()).to.not.throw();

    expect(Object.keys(geometry.attributes)).to.deep.equal([]);
    expect(geometry.index).to.be.null;
  });

  /** A geometry with a third route, and a material whose shader reads all three attributes. */
  function makeGeometryWithExtraRoute() {
    const geometry = new InstancedVertexObjectGeometry(instancedDescription, 8, quadDescription, 1);
    const extraPool = geometry.attachInstancedPool('extra', extraInstancedDescription);
    const material = new MeshBasicNodeMaterial();
    material.positionNode = attribute('position', 'vec3')
      .add(attribute('instanceOffset', 'vec3'))
      .add(attribute('extraOffset', 'vec3'));
    geometry.basePool.createVO().setPosition([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]);
    geometry.instancedPool.createVO().setInstanceOffset([1, 1, 1]);
    extraPool.createVO().setExtraOffset([0, 0, 0]);
    return {geometry, material};
  }

  it('a rendered geometry disposes after one of its routes was detached', async function () {
    const {geometry, material} = makeGeometryWithExtraRoute();
    await renderOnce(new VertexObjects(geometry, material));

    geometry.detachInstancedPool('extra');
    expect(geometry.getAttribute('extraOffset'), 'the detached route gives up its slot').to.be.undefined;

    const geometriesBefore = display.renderer.info.memory.geometries;
    expect(() => geometry.dispose()).to.not.throw();

    // the dispose event reached the renderer's handler, so this is the real path and not a
    // geometry it never saw
    expect(display.renderer.info.memory.geometries).to.equal(geometriesBefore - 1);
    expect(Object.keys(geometry.attributes)).to.deep.equal([]);
    expect(geometry.index).to.be.null;
  });

  it('a rendered geometry disposes after a route was replaced by one with other attributes', async function () {
    const {geometry, material} = makeGeometryWithExtraRoute();
    await renderOnce(new VertexObjects(geometry, material));

    geometry.attachInstancedPool('extra', {
      meshCount: 1,
      attributes: {someOtherOffset: {components: ['x', 'y', 'z'], type: 'float32', usage: 'dynamic'}},
    });
    expect(geometry.getAttribute('extraOffset'), 'the replaced route gives up its slot').to.be.undefined;

    const geometriesBefore = display.renderer.info.memory.geometries;
    expect(() => geometry.dispose()).to.not.throw();

    // the dispose event reached the renderer's handler, so this is the real path and not a
    // geometry it never saw
    expect(display.renderer.info.memory.geometries).to.equal(geometriesBefore - 1);
    expect(Object.keys(geometry.attributes)).to.deep.equal([]);
    expect(geometry.index).to.be.null;
  });
});

import {expect} from '@esm-bundle/chai';
import {CameraBasedVisibility, Display} from '@spearwolf/twopoint5d';
import {PerspectiveCamera, Scene, Vector3} from 'three/webgpu';
import {makeContainer, disposeDisplay, makeMap} from './helpers/fixtures.js';

/** The tilted camera the map is watched through, looking at `x` on the ground plane from behind and above. */
function makeCamera(x = 0) {
  const camera = new PerspectiveCamera(75, 1.6, 0.1, 4000);
  camera.position.set(x, 350, 500);
  camera.lookAt(x, 0, 0);
  return camera;
}

describe('map2d — placement of a moved map', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
  });

  afterEach(() => {
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  /** Two frames: the first render puts the camera projection onto the coordinate system of the renderer. */
  async function renderTwice(map2d, scene, camera) {
    for (let i = 0; i < 2; i++) {
      map2d.update();
      display.renderer.render(scene, camera);
      await display.nextFrame();
    }
  }

  it('a moved map draws as many tiles as the same map at the origin', async function () {
    const originCamera = makeCamera();
    const origin = makeMap(new CameraBasedVisibility(originCamera));
    const originScene = new Scene();
    originScene.add(origin.map2d);
    await renderTwice(origin.map2d, originScene, originCamera);

    const usedCount = origin.tileSprites.geometry.instancedPool.usedCount;
    // without tiles the comparison below would hold for two empty maps
    expect(usedCount, 'tiles on screen for the map at the origin').to.be.greaterThan(0);

    const movedCamera = makeCamera(4096);
    const moved = makeMap(new CameraBasedVisibility(movedCamera));
    moved.map2d.position.x = 4096;
    const movedScene = new Scene();
    movedScene.add(moved.map2d);
    await renderTwice(moved.map2d, movedScene, movedCamera);

    expect(moved.tileSprites.geometry.instancedPool.usedCount, 'tiles on screen for the moved map').to.equal(usedCount);

    const nodeWorld = moved.tileRenderer.node.getWorldPosition(new Vector3());
    expect(nodeWorld.distanceTo(new Vector3(4096 - 128, 0, -128)), 'world position of the renderer node').to.be.lessThan(1e-6);
  });
});

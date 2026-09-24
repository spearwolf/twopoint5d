import {expect} from '@esm-bundle/chai';
import {CameraBasedVisibility, Display} from '@spearwolf/twopoint5d';
import {PerspectiveCamera, Scene} from 'three/webgpu';
import {makeContainer, disposeDisplay, bufferOf, makeMap} from './helpers/fixtures.js';

describe('map2d — tile attribute upload', function () {
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
    // the camera belongs to the test and not to the display, so a resize does not move it
    camera = new PerspectiveCamera(75, 1.6, 0.1, 4000);
    camera.position.set(0, 350, 500);
    camera.lookAt(0, 0, 0);
  });

  afterEach(() => {
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  it('a second frame with a still camera touches no tile attribute buffer', async function () {
    const {map2d, tileSprites} = makeMap(new CameraBasedVisibility(camera));
    scene.add(map2d);

    // the first render puts the camera projection onto the coordinate system of the renderer,
    // which moves the projection matrix once; from the second frame on it stands still
    map2d.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    map2d.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const usedCount = tileSprites.geometry.instancedPool.usedCount;
    // without tiles the whole test would pass on an empty buffer
    expect(usedCount, 'tiles on screen after the first frame').to.be.greaterThan(0);

    const instancePosition = tileSprites.geometry.getAttribute('instancePosition');
    const version = bufferOf(instancePosition).version;

    map2d.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    expect(bufferOf(instancePosition).version, 'buffer version after a still frame').to.equal(version);
    expect(tileSprites.geometry.instancedPool.usedCount, 'tiles still on screen').to.equal(usedCount);
  });

  it('a frame that moves the map touches the tile attribute buffers again', async function () {
    const {map2d, tileSprites} = makeMap(new CameraBasedVisibility(camera));
    scene.add(map2d);

    // the first render puts the camera projection onto the coordinate system of the renderer,
    // which moves the projection matrix once; from the second frame on it stands still
    map2d.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    map2d.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const instancePosition = tileSprites.geometry.getAttribute('instancePosition');
    const version = bufferOf(instancePosition).version;

    map2d.centerX = 1024;

    map2d.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    expect(bufferOf(instancePosition).version, 'buffer version after a moved frame').to.be.greaterThan(version);
  });
});

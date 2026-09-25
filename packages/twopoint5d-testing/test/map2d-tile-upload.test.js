import {expect} from '@esm-bundle/chai';
import {CameraBasedVisibility, Display, RectangularVisibilityArea} from '@spearwolf/twopoint5d';
import {Scene} from 'three/webgpu';
import {makeContainer, disposeDisplay, bufferOf, makeCamera, makeMap} from './helpers/fixtures.js';

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
    camera = makeCamera();
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

  it('a frame that moves tiles into and out of the view touches the tile attribute buffers again', async function () {
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

    // four tile widths: tiles leave the view and others come into it, and those are what is
    // written — a move within the tiles on show writes nothing
    map2d.centerX = 1024;

    map2d.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    expect(bufferOf(instancePosition).version, 'buffer version after a moved frame').to.be.greaterThan(version);
  });

  it('a frame that moves the view within the tiles it shows touches no tile attribute buffer', async function () {
    const {map2d, tileSprites, tileRenderer} = makeMap(new RectangularVisibilityArea(1024, 1024));
    scene.add(map2d);

    map2d.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    map2d.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    const usedCount = tileSprites.geometry.instancedPool.usedCount;
    expect(usedCount, 'tiles on screen after the first frame').to.be.greaterThan(0);

    const instancePosition = tileSprites.geometry.getAttribute('instancePosition');
    const version = bufferOf(instancePosition).version;
    const nodeX = tileRenderer.node.position.x;

    // columns -2 … 2 of the 256 grid, offset by -128, cover the view both around 0 and around 10
    map2d.centerX = 10;

    map2d.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();

    expect(bufferOf(instancePosition).version, 'buffer version after a moved view').to.equal(version);
    expect(tileSprites.geometry.instancedPool.usedCount, 'tiles still on screen').to.equal(usedCount);
    expect(tileRenderer.node.position.x, 'the renderer node follows the view').to.equal(nodeX - 10);
  });
});

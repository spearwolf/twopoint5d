import {expect} from '@esm-bundle/chai';
import {
  CameraBasedVisibility,
  Display,
  Map2D,
  Map2DTileRenderer,
  RepeatingTilesProvider,
  TextureCoords,
  TileSet,
  TileSprites,
  TileSpritesFactory,
  TileSpritesGeometry,
  TileSpritesMaterial,
} from '@spearwolf/twopoint5d';
import {PerspectiveCamera, Scene} from 'three/webgpu';

const FIXTURE_ID = 'map2d-tile-upload-fixture';

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

/** The buffer behind an attribute — that is where the version lives that counts the uploads. */
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

/** A map on the XZ ground plane, without a loaded texture: the tile set builds its own atlas. */
function makeMap(camera) {
  const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
  const tileData = new RepeatingTilesProvider([
    [1, 2],
    [3, 4],
  ]);
  const tileSprites = new TileSprites(new TileSpritesGeometry(512), new TileSpritesMaterial());
  const tileRenderer = new Map2DTileRenderer(new TileSpritesFactory(tileSprites, tileSet, tileData));

  const map2d = new Map2D();
  map2d.tileWidth = 256;
  map2d.tileHeight = 256;
  map2d.xOffset = -128;
  map2d.yOffset = -128;
  map2d.visibilitor = new CameraBasedVisibility(camera);
  map2d.addTileRenderer(tileRenderer);

  return {map2d, tileSprites};
}

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
    const {map2d, tileSprites} = makeMap(camera);
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
    const {map2d, tileSprites} = makeMap(camera);
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

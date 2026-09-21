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
import {PerspectiveCamera, Scene, Vector3} from 'three/webgpu';
import {stopAndDrain} from './support/stopAndDrain.js';

const FIXTURE_ID = 'map2d-placement-fixture';

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
async function disposeDisplay(display) {
  if (!display) return;
  await stopAndDrain(display);
  try {
    display.dispose();
  } catch {
    // ignore — the fixture still has to leave the dom
  }
}

/** The tilted camera the map is watched through, looking at `x` on the ground plane from behind and above. */
function makeCamera(x = 0) {
  const camera = new PerspectiveCamera(75, 1.6, 0.1, 4000);
  camera.position.set(x, 350, 500);
  camera.lookAt(x, 0, 0);
  return camera;
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

  return {map2d, tileSprites, tileRenderer};
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

  afterEach(async () => {
    await disposeDisplay(display);
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
    const origin = makeMap(originCamera);
    const originScene = new Scene();
    originScene.add(origin.map2d);
    await renderTwice(origin.map2d, originScene, originCamera);

    const usedCount = origin.tileSprites.geometry.instancedPool.usedCount;
    // without tiles the comparison below would hold for two empty maps
    expect(usedCount, 'tiles on screen for the map at the origin').to.be.greaterThan(0);

    const movedCamera = makeCamera(4096);
    const moved = makeMap(movedCamera);
    moved.map2d.position.x = 4096;
    const movedScene = new Scene();
    movedScene.add(moved.map2d);
    await renderTwice(moved.map2d, movedScene, movedCamera);

    expect(moved.tileSprites.geometry.instancedPool.usedCount, 'tiles on screen for the moved map').to.equal(usedCount);

    const nodeWorld = moved.tileRenderer.node.getWorldPosition(new Vector3());
    expect(nodeWorld.distanceTo(new Vector3(4096 - 128, 0, -128)), 'world position of the renderer node').to.be.lessThan(1e-6);
  });
});

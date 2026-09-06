import {expect} from '@esm-bundle/chai';
import {
  CameraBasedVisibility,
  CameraBasedVisibilityHelpers,
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

const FIXTURE_ID = 'map2d-visibility-helpers-fixture';

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

/** A map on the XZ ground plane, without a loaded texture: the tile set builds its own atlas. */
function makeMap(camera) {
  const tileSet = new TileSet(new TextureCoords(0, 0, 256, 256), {tileWidth: 128, tileHeight: 128});
  const tileData = new RepeatingTilesProvider([
    [1, 2],
    [3, 4],
  ]);
  const tileSprites = new TileSprites(new TileSpritesGeometry(512), new TileSpritesMaterial());
  const tileRenderer = new Map2DTileRenderer(new TileSpritesFactory(tileSprites, tileSet, tileData));

  const visibility = new CameraBasedVisibility(camera);

  const map2d = new Map2D();
  map2d.tileWidth = 256;
  map2d.tileHeight = 256;
  map2d.xOffset = -128;
  map2d.yOffset = -128;
  map2d.visibilitor = visibility;
  map2d.addTileRenderer(tileRenderer);

  return {map2d, visibility};
}

/** Every node the helpers put into the scene graph carries the mark HelpersManager sets. */
function helperNodes(...roots) {
  const found = [];
  for (const root of roots) {
    for (const child of root.children) {
      if (child.userData.isHelper) found.push(child);
    }
  }
  return found;
}

/** The values every box helper shows, as one string: it changes as soon as one box moves. */
function boxSignature(nodes) {
  return nodes
    .filter((node) => node.box != null)
    .map((node) => `${node.box.min.toArray().join()}|${node.box.max.toArray().join()}`)
    .join(';');
}

describe('map2d — visibility helper nodes', function () {
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

  async function frame(map2d, helpers) {
    map2d.update();
    helpers.update();
    display.renderer.render(scene, camera);
    await display.nextFrame();
  }

  it('a still frame leaves every helper node in place', async function () {
    const {map2d, visibility} = makeMap(camera);
    scene.add(map2d);

    const helpers = new CameraBasedVisibilityHelpers(visibility);
    helpers.add(map2d);
    helpers.show = true;

    // the first render puts the camera projection onto the coordinate system of the renderer,
    // which moves the projection matrix once; from the second frame on it stands still
    await frame(map2d, helpers);
    await frame(map2d, helpers);

    const before = helperNodes(scene, map2d);
    expect(before.length, 'helper nodes after the warm-up frames').to.be.greaterThan(0);
    const geometries = before.map((node) => node.geometry);
    const serial = visibility.serial;

    await frame(map2d, helpers);

    expect(visibility.serial, 'the visibility recomputed nothing').to.equal(serial);

    const after = helperNodes(scene, map2d);
    expect(after.length, 'the number of helper nodes').to.equal(before.length);
    for (let i = 0; i < after.length; ++i) {
      expect(after[i], `helper node ${i}`).to.equal(before[i]);
      expect(after[i].geometry, `geometry of helper node ${i}`).to.equal(geometries[i]);
    }
  });

  it('a moved map writes into the helper nodes it already has', async function () {
    const {map2d, visibility} = makeMap(camera);
    scene.add(map2d);

    const helpers = new CameraBasedVisibilityHelpers(visibility);
    helpers.add(map2d);
    helpers.show = true;

    await frame(map2d, helpers);
    await frame(map2d, helpers);

    const before = helperNodes(scene, map2d);
    expect(before.length, 'helper nodes after the warm-up frames').to.be.greaterThan(0);
    const signature = boxSignature(before);
    const serial = visibility.serial;

    map2d.centerX = 1024;
    await frame(map2d, helpers);

    expect(visibility.serial, 'the visibility recomputed').to.be.greaterThan(serial);

    const after = helperNodes(scene, map2d);
    expect(after.length, 'no node was taken out').to.be.at.least(before.length);
    for (let i = 0; i < before.length; ++i) {
      expect(after[i], `helper node ${i} survived the recomputation`).to.equal(before[i]);
    }
    expect(boxSignature(after), 'the boxes moved with the map').to.not.equal(signature);
  });
});

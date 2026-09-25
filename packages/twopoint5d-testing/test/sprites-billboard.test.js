import {expect} from '@esm-bundle/chai';
import {Display, TexturedSprites} from '@spearwolf/twopoint5d';
import {Group, OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {coveredBox, disposeDisplay, makeContainer, renderToPixels} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;

describe('sprites — billboards on a moved and turned mesh', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {RenderTarget | undefined} */
  let target;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
  });

  afterEach(() => {
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  /**
   * Draws one billboard of `width` × `height` units at the local origin of a mesh that `place`
   * puts into the scene, looks at it from straight in front of the world point (2, 0, 0), and
   * measures what it covers.
   */
  async function renderBillboard({width, height, place}) {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.set(2, 0, 10);

    const sprites = new TexturedSprites(1, {renderAsBillboards: true});
    sprites.frustumCulled = false;
    const sprite = sprites.createSprite();
    sprite.setSize(width, height);
    sprite.setPosition(0, 0, 0);

    const scene = new Scene();
    place(scene, sprites);
    sprites.update();

    const pixels = await renderToPixels(display.renderer, scene, camera, target);

    sprites.dispose();

    return coveredBox(pixels, TARGET_SIZE);
  }

  it('a billboard on a mesh moved and turned by a quarter faces the camera', async function () {
    const box = await renderBillboard({
      width: 4,
      height: 1,
      place: (scene, mesh) => {
        mesh.position.set(2, 0, 0);
        mesh.rotation.y = Math.PI / 2;
        scene.add(mesh);
      },
    });

    expect(box, 'a billboard that faces the camera, not one turned with its mesh').to.deep.equal({
      width: 4 * PIXELS_PER_UNIT,
      height: 1 * PIXELS_PER_UNIT,
    });
  });

  it('a billboard on a mesh whose parent is moved and turned by a quarter faces the camera', async function () {
    const box = await renderBillboard({
      width: 4,
      height: 1,
      place: (scene, mesh) => {
        const group = new Group();
        group.position.set(2, 0, 0);
        group.rotation.y = Math.PI / 2;
        group.add(mesh);
        scene.add(group);
      },
    });

    expect(box, 'a billboard that faces the camera, not one turned with its mesh').to.deep.equal({
      width: 4 * PIXELS_PER_UNIT,
      height: 1 * PIXELS_PER_UNIT,
    });
  });

  it('a billboard on a mesh scaled by 2 grows with it and faces the camera', async function () {
    const box = await renderBillboard({
      width: 2,
      height: 0.5,
      place: (scene, mesh) => {
        mesh.position.set(2, 0, 0);
        mesh.rotation.y = Math.PI / 2;
        mesh.scale.setScalar(2);
        scene.add(mesh);
      },
    });

    expect(box, 'a billboard that faces the camera, not one turned with its mesh').to.deep.equal({
      width: 4 * PIXELS_PER_UNIT,
      height: 1 * PIXELS_PER_UNIT,
    });
  });
});

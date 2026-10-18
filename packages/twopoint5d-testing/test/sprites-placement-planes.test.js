import {expect} from '@esm-bundle/chai';
import {
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  flatPlacement,
  GroundPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  Rotation,
  TextureColor,
  Yaw,
} from '@spearwolf/twopoint5d';
import {Group, OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  diffPixels,
  disposeDisplay,
  isNearColor,
  makeColorTexture,
  makeContainer,
  readsTopDown,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];
const BLUE = [0, 0, 255, 255];
const WHITE = [255, 255, 255, 255];

// an image of four quarters, row by row from the top: red and green above, blue and white below
const QUARTERS = [RED, GREEN, BLUE, WHITE];

const PlainKind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, Rotation, TextureColor]});
const GroundKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, GroundPlacement, QuadSize, Rotation, TextureColor],
});
const YawKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, flatPlacement({orientation: 'yaw'}), Yaw, QuadSize, Rotation, TextureColor],
});
const GroundYawKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, flatPlacement({plane: 'xz', orientation: 'yaw'}), Yaw, QuadSize, Rotation, TextureColor],
});

const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;

/**
 * An orthographic camera at `position`, looking at the origin with `up` as the top of the picture.
 *
 * @param {[number, number, number]} position
 * @param {[number, number, number]} [up]
 */
function cameraAt(position, up = [0, 1, 0]) {
  const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
  camera.up.set(...up);
  camera.position.set(...position);
  camera.lookAt(0, 0, 0);
  return camera;
}

describe('sprites — the plane of a flat sprite and its yaw', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {RenderTarget | undefined} */
  let target;
  /** @type {import('three/webgpu').DataTexture | undefined} */
  let colorMap;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
    colorMap = makeColorTexture(QUARTERS, 2, 2);
  });

  afterEach(() => {
    colorMap?.dispose();
    colorMap = undefined;
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
   * Renders one sprite of `kind` and answers the pixels. `setup(sprite, sprites)` writes the sprite
   * and may turn or move the mesh; `parent` takes the mesh in place of the scene.
   *
   * @param {import('@spearwolf/twopoint5d').SpriteKind<any>} kind
   * @param {import('three/webgpu').Camera} camera
   * @param {(sprite: any, sprites: FeatureSprites<any>) => void} setup
   * @param {{parent?: Group}} [options]
   */
  async function render(kind, camera, setup, {parent} = {}) {
    const sprites = new FeatureSprites(kind, {capacity: 1, textures: {colorMap}});
    sprites.frustumCulled = false;
    const sprite = sprites.createSprite();
    sprite.setSize(4, 4);
    setup(sprite, sprites);
    const scene = new Scene();
    if (parent != null) {
      parent.add(sprites);
      scene.add(parent);
    } else {
      scene.add(sprites);
    }
    sprites.update();
    const pixels = await renderToPixels(display.renderer, scene, camera, target);
    sprites.dispose();
    return pixels;
  }

  /** The colors at the middle of the four quarters of the picture, top left, top right, bottom left, bottom right. */
  async function quartersOf(pixels) {
    const topDown = await readsTopDown(display.renderer, target);
    const at = (x, y) => {
      const rgb = rgbAt(pixels, TARGET_SIZE, x, topDown ? y : TARGET_SIZE - 1 - y);
      return [RED, GREEN, BLUE, WHITE].find((color) => isNearColor(rgb, color)) ?? rgb;
    };
    const near = TARGET_SIZE / 2 - PIXELS_PER_UNIT;
    const far = TARGET_SIZE / 2 + PIXELS_PER_UNIT;
    return [at(near, near), at(far, near), at(near, far), at(far, far)];
  }

  it('a flat sprite seen from the front shows the top left of its image at the top left', async function () {
    const pixels = await render(PlainKind, cameraAt([0, 0, 10]), (sprite) => sprite.setPosition(0, 0, 0));

    expect(await quartersOf(pixels)).to.deep.equal([RED, GREEN, BLUE, WHITE]);
  });

  it('a positive rotation turns a flat sprite counter-clockwise, as seen from its front', async function () {
    const pixels = await render(PlainKind, cameraAt([0, 0, 10]), (sprite) => {
      sprite.setPosition(0, 0, 0);
      sprite.rotation = Math.PI / 2;
    });

    expect(await quartersOf(pixels), 'the top left quarter turned to the bottom left').to.deep.equal([GREEN, WHITE, RED, BLUE]);
  });

  it('a ground sprite seen from above faces up, the top of its image towards -z', async function () {
    const pixels = await render(GroundKind, cameraAt([0, 10, 0], [0, 0, -1]), (sprite) => sprite.setPosition(0, 0, 0));

    expect(await quartersOf(pixels)).to.deep.equal([RED, GREEN, BLUE, WHITE]);
  });

  it('a ground sprite in a moved and turned mesh draws as a flat sprite in a mesh turned down by hand', async function () {
    const camera = cameraAt([3, 8, 6]);
    const transform = (group) => {
      group.position.set(0.5, 0.25, -0.5);
      group.rotation.y = 0.4;
      return group;
    };

    const grounded = await render(
      GroundKind,
      camera,
      (sprite) => {
        sprite.setSize(4, 2);
        sprite.setPosition(-0.5, 0.25, 1);
        sprite.rotation = 0.3;
      },
      {parent: transform(new Group())},
    );
    const turnedByHand = await render(
      PlainKind,
      camera,
      (sprite, sprites) => {
        sprites.rotation.x = -Math.PI / 2;
        sprite.setSize(4, 2);
        // world (x, y, z) is local (x, -z, y) of the mesh turned down
        sprite.setPosition(-0.5, -1, 0.25);
        sprite.rotation = 0.3;
      },
      {parent: transform(new Group())},
    );

    const {lit, differing} = diffPixels(grounded, turnedByHand);
    expect(lit, 'the ground sprite is drawn').to.be.greaterThan(200);
    expect(differing).to.equal(0);
  });

  for (const yaw of [0.6, Math.PI / 2, -0.4]) {
    it(`a yaw of ${yaw.toFixed(2)} draws as a mesh turned by rotation.y = ${yaw.toFixed(2)}`, async function () {
      const camera = cameraAt([5, 6, 8]);
      const position = [0.5, 0.25, -0.75];

      const turned = await render(YawKind, camera, (sprite) => {
        sprite.setPosition(...position);
        sprite.yaw = yaw;
      });
      const meshTurned = await render(PlainKind, camera, (sprite, sprites) => {
        sprites.rotation.y = yaw;
        // the position into the local space of the turned mesh: turned back by the yaw
        const [x, y, z] = position;
        sprite.setPosition(x * Math.cos(yaw) - z * Math.sin(yaw), y, x * Math.sin(yaw) + z * Math.cos(yaw));
      });

      const {lit, differing} = diffPixels(turned, meshTurned);
      expect(lit, 'the sprite faces the camera and is drawn').to.be.greaterThan(100);
      expect(differing).to.equal(0);
    });
  }

  it('on the ground, a yaw turns as a rotation of the same angle does', async function () {
    const camera = cameraAt([2, 9, 4]);

    const byYaw = await render(GroundYawKind, camera, (sprite) => {
      sprite.setSize(4, 2);
      sprite.setPosition(0, 0, 0);
      sprite.yaw = 0.7;
    });
    const byRotation = await render(GroundKind, camera, (sprite) => {
      sprite.setSize(4, 2);
      sprite.setPosition(0, 0, 0);
      sprite.rotation = 0.7;
    });

    const {lit, differing} = diffPixels(byYaw, byRotation);
    expect(lit).to.be.greaterThan(200);
    expect(differing).to.equal(0);
  });
});

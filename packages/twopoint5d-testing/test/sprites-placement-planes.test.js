import {expect} from '@esm-bundle/chai';
import {
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  flatPlacement,
  GroundPlacement,
  InstancePosition,
  Orientation,
  QuadBase,
  QuadSize,
  Rotation,
  TextureColor,
  Yaw,
} from '@spearwolf/twopoint5d';
import {Euler, Group, OrthographicCamera, Quaternion, RenderTarget, Scene, Vector3} from 'three/webgpu';
import {
  diffPixels,
  disposeDisplay,
  disposeKept,
  isNearColor,
  keep,
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

const QuaternionKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, flatPlacement({orientation: 'quaternion'}), Orientation, QuadSize, Rotation, TextureColor],
});
const GroundQuaternionKind = defineSprite({
  base: QuadBase,
  features: [
    InstancePosition,
    flatPlacement({plane: 'xz', orientation: 'quaternion'}),
    Orientation,
    QuadSize,
    Rotation,
    TextureColor,
  ],
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

describe('sprites — the plane of a flat sprite, its yaw and its quaternion', function () {
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
    disposeKept();
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
    const sprites = keep(new FeatureSprites(kind, {capacity: 1, textures: {colorMap}}));
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
    return renderToPixels(display.renderer, scene, camera, target);
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

  /**
   * Renders the sprite turned by `quaternion` at `position` twice: once through `kind`, a kind with
   * the quaternion placement, and once through `plainKind` in a mesh turned by the same quaternion,
   * with the position turned back into the local space of that mesh.
   *
   * @param {[import('@spearwolf/twopoint5d').SpriteKind<any>, import('@spearwolf/twopoint5d').SpriteKind<any>]} kinds
   * @param {Quaternion} quaternion
   * @param {[number, number, number]} position
   */
  async function renderTurnedTwice([kind, plainKind], quaternion, position) {
    const camera = cameraAt([5, 6, 8]);

    const turned = await render(kind, camera, (sprite) => {
      sprite.setSize(4, 2);
      sprite.setPosition(...position);
      sprite.setQuaternion(quaternion);
    });
    const meshTurned = await render(plainKind, camera, (sprite, sprites) => {
      sprites.quaternion.copy(quaternion);
      sprite.setSize(4, 2);
      const local = new Vector3(...position).applyQuaternion(quaternion.clone().invert());
      sprite.setPosition(local.x, local.y, local.z);
    });
    return diffPixels(turned, meshTurned);
  }

  const TILTS = /** @type {const} */ ([
    ['tilted back, then turned towards +x', new Quaternion().setFromEuler(new Euler(-0.5, 0.6, 0.2, 'YXZ'))],
    ['turned about a slanted axis', new Quaternion().setFromAxisAngle(new Vector3(1, 1, 0).normalize(), 0.5)],
  ]);

  for (const [what, quaternion] of TILTS) {
    it(`a flat sprite ${what} draws as a mesh turned by that quaternion`, async function () {
      const {lit, differing} = await renderTurnedTwice([QuaternionKind, PlainKind], quaternion, [0.5, 0.25, -0.75]);

      expect(lit, 'the sprite faces the camera and is drawn').to.be.greaterThan(100);
      expect(differing).to.equal(0);
    });
  }

  it('a ground sprite on a slope draws as a ground sprite in a mesh tilted by that quaternion', async function () {
    const slope = new Quaternion().setFromEuler(new Euler(0.5, 0, 0.3));

    const {lit, differing} = await renderTurnedTwice([GroundQuaternionKind, GroundKind], slope, [-0.25, 0.5, 0.5]);

    expect(lit, 'the sprite faces the camera and is drawn').to.be.greaterThan(100);
    expect(differing).to.equal(0);
  });

  it('setYaw() turns as a yaw of the same angle does', async function () {
    const camera = cameraAt([5, 6, 8]);

    const bySetYaw = await render(QuaternionKind, camera, (sprite) => {
      sprite.setPosition(0.5, 0.25, -0.75);
      sprite.setYaw(0.6);
    });
    const byYaw = await render(YawKind, camera, (sprite) => {
      sprite.setPosition(0.5, 0.25, -0.75);
      sprite.yaw = 0.6;
    });

    const {lit, differing} = diffPixels(bySetYaw, byYaw);
    expect(lit).to.be.greaterThan(100);
    expect(differing).to.equal(0);
  });
});

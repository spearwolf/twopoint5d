import {expect} from '@esm-bundle/chai';
import {
  AnimatedSpriteKind,
  BillboardPlacement,
  Display,
  FeatureSprites,
  FrameBasedAnimations,
  ShadowPass,
  TextureCoords,
  TexturedSpriteKind,
} from '@spearwolf/twopoint5d';
import {Color, Mesh, MeshBasicNodeMaterial, OrthographicCamera, PlaneGeometry, RenderTarget, Scene} from 'three/webgpu';
import {
  compareWithModel,
  countColor,
  disposeDisplay,
  isNearColor,
  makeCameraAboveGround,
  makeColorTexture,
  makeContainer,
  readsTopDown,
  renderToPixels,
} from './helpers/fixtures.js';

const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;
const RED = [255, 0, 0, 255];
const CLEAR = [0, 0, 0, 0];
const BLUE = [0, 0, 255];

// the scene on the ground: 4 world units across 64 pixels
const GROUND_PIXELS_PER_UNIT = 16;
const WHITE = [255, 255, 255, 255];
const BLACK = [0, 0, 0, 255];
const SHADOW_BLUE = [0, 0, 255, 255];
// the direction the light of the start value of shadowLight travels in: -[-0.4, 1, -0.3]
const LIGHT = [0.4, -1, 0.3];

/**
 * The picture of a sprite 2 units square that stands on the XZ ground at the origin, facing the
 * camera of makeCameraAboveGround(), and of its shadow on the ground: a point `h` units up the
 * sprite falls along the light to `h · (L.x, 0, L.z)` beside its foot, `(x, 0.6 h)` of the view for
 * the sprite and `(x + L.x · h, -0.8 · L.z · h)` for the shadow. With a `ground` color, a ground
 * mesh 4 units square lies around the foot of the sprite, from `-1.6` to `1.6` up the view.
 */
function groundShadowAt(ground) {
  return (x, y) => {
    const up = y / 0.6;
    if (up >= 0 && up <= 2 && Math.abs(x) <= 1) return WHITE;
    const shadowUp = -y / (0.8 * LIGHT[2]);
    if (shadowUp >= 0 && shadowUp <= 2 && Math.abs(x - LIGHT[0] * shadowUp) <= 1) return SHADOW_BLUE;
    if (ground != null && Math.abs(y) <= 1.6) return ground;
    return BLACK;
  };
}

/** The columns, left to right, in which some pixel has the color `rgb`. */
function columnsOf(pixels, rgb) {
  const columns = new Set();
  for (let y = 0; y < TARGET_SIZE; y++) {
    for (let x = 0; x < TARGET_SIZE; x++) {
      const i = (y * TARGET_SIZE + x) * 4;
      if (isNearColor([pixels[i], pixels[i + 1], pixels[i + 2]], rgb)) columns.add(x);
    }
  }
  return columns.size === 0 ? {from: -1, to: -1} : {from: Math.min(...columns), to: Math.max(...columns)};
}

describe('sprites — a shadow pass', function () {
  this.timeout(20000);
  let display;
  let host;
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
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  function makeCamera() {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.set(-1, 0, 10);
    return camera;
  }

  function aimTheShadow(sprites) {
    sprites.setUniform('shadowLight', -0.5, 0, 1, 0);
    sprites.setUniform('groundPlane', 0, 0, 1, 0);
    sprites.setUniform('shadowColor', 0, 0, 1, 1);
  }

  it('draws the shadow of a sprite where the light projects it, in the shadow color, flat and as a billboard', async function () {
    const colorMap = makeColorTexture([RED, RED, RED, RED], 2, 2);
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1, textures: {colorMap}, passes: [ShadowPass]});
    aimTheShadow(sprites);
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    sprite.setPosition(-1, 0, 4);
    sprite.setTexCoords(0, 0, 1, 1);
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const flat = await renderToPixels(display.renderer, scene, makeCamera(), target);
    sprites.placement = BillboardPlacement;
    const billboard = await renderToPixels(display.renderer, scene, makeCamera(), target);

    sprites.dispose();
    colorMap.dispose();

    for (const pixels of [flat, billboard]) {
      expect(columnsOf(pixels, [255, 0, 0]), 'the sprite at x ∈ [-2, 0]').to.deep.equal({from: CENTER - 8, to: CENTER + 7});
      expect(columnsOf(pixels, BLUE), 'its shadow at x ∈ [0, 2]').to.deep.equal({from: CENTER + 8, to: CENTER + 23});
    }
  });

  /**
   * Renders a sprite 2 units square standing at the origin with its shadow, the light and the ground
   * at their start values, through makeCameraAboveGround() — over an opaque ground mesh in the plane
   * of the shadow when `ground` is set — and holds the picture to {@link groundShadowAt}.
   */
  async function renderOnTheGround(ground) {
    const topDown = await readsTopDown(display.renderer, target);
    const colorMap = makeColorTexture([WHITE, WHITE, WHITE, WHITE], 2, 2);
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1, textures: {colorMap}, passes: [ShadowPass]});
    sprites.setUniform('shadowColor', 0, 0, 1, 1);
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    sprite.setPosition(0, 1, 0);
    sprite.setTexCoords(0, 0, 1, 1);
    const scene = new Scene();
    scene.add(sprites);
    let groundMesh;
    if (ground != null) {
      groundMesh = new Mesh(
        new PlaneGeometry(4, 4),
        new MeshBasicNodeMaterial({color: new Color(...ground.slice(0, 3).map((c) => c / 255))}),
      );
      groundMesh.rotation.x = -Math.PI / 2;
      scene.add(groundMesh);
    }
    sprites.update();

    const pixels = await renderToPixels(
      display.renderer,
      scene,
      makeCameraAboveGround(TARGET_SIZE, GROUND_PIXELS_PER_UNIT),
      target,
    );

    sprites.dispose();
    colorMap.dispose();
    groundMesh?.geometry.dispose();
    groundMesh?.material.dispose();

    return {
      pixels,
      ...compareWithModel(pixels, {
        size: TARGET_SIZE,
        pixelsPerUnit: GROUND_PIXELS_PER_UNIT,
        topDown,
        black: BLACK,
        colorAt: groundShadowAt(ground),
      }),
    };
  }

  // mirroring or projecting a vertex in the shader turns the winding of a triangle whenever the
  // image falls towards the camera; three culls by the side of the material alone
  it('draws the shadow on the XZ ground in front of a sprite standing on it, the camera in front and above', async function () {
    const {pixels, lit, differing} = await renderOnTheGround();

    // the sprite covers 2 × 1.2 units of the view, 614 pixels
    expect(countColor(pixels, WHITE), 'the pixels of the sprite').to.be.within(560, 670);
    // the shadow covers 2 × 0.48 units, 246 pixels
    expect(countColor(pixels, BLUE), 'the pixels of the shadow').to.be.within(220, 270);
    expect(lit, 'the lit pixels of the sprite and its shadow the model checks').to.be.greaterThan(600);
    expect(differing.length, `the pixels against the model, first ones: ${differing.slice(0, 4).join('; ')}`).to.equal(0);
  });

  // the shadow lies in the plane of the ground: without its polygon offset the two would fight over
  // the depth of every pixel
  it('draws the shadow over an opaque ground mesh in its plane', async function () {
    const {pixels, lit, differing} = await renderOnTheGround(RED);

    expect(countColor(pixels, BLUE), 'the pixels of the shadow').to.be.within(220, 270);
    expect(lit, 'the lit pixels of the sprite, its shadow and the ground the model checks').to.be.greaterThan(2500);
    expect(differing.length, `the pixels against the model, first ones: ${differing.slice(0, 4).join('; ')}`).to.equal(0);
  });

  it('shows the shadow of the frame the animated sprite shows at the same time', async function () {
    // frame 0 is opaque red, frame 1 transparent: the shadow is there at the start and gone three quarters in
    const texels = [RED, CLEAR];
    const colorMap = makeColorTexture(texels);
    const frames = new TextureCoords(0, 0, texels.length, 1);
    const anims = new FrameBasedAnimations();
    anims.add(
      'blink',
      1,
      [0, 1].map((i) => new TextureCoords(frames, i, 0, 1, 1)),
    );
    const animsMap = anims.bakeDataTexture();

    const sprites = new FeatureSprites(AnimatedSpriteKind, {capacity: 1, textures: {colorMap, animsMap}, passes: [ShadowPass]});
    aimTheShadow(sprites);
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    sprite.setPosition(-1, 0, 4);
    sprite.animId = anims.animId('blink');
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    sprites.setUniform('time', 0);
    const atStart = await renderToPixels(display.renderer, scene, makeCamera(), target);
    sprites.setUniform('time', 0.75);
    const later = await renderToPixels(display.renderer, scene, makeCamera(), target);

    sprites.dispose();
    colorMap.dispose();
    animsMap.dispose();

    expect(columnsOf(atStart, BLUE).from, 'a shadow of the opaque frame').to.equal(CENTER + 8);
    expect(columnsOf(later, BLUE).from, 'no shadow of the transparent frame').to.equal(-1);
  });
});

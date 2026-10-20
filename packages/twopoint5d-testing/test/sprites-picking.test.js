import {expect} from '@esm-bundle/chai';
import {
  AxisBillboardPlacement,
  BillboardPlacement,
  defineSprite,
  Display,
  Fade,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  SpritePicker,
  TextureColor,
  Tint,
} from '@spearwolf/twopoint5d';
import {Color, OrthographicCamera, PerspectiveCamera, Scene, Vector3} from 'three/webgpu';
import {disposeDisplay, makeColorTexture, makeContainer} from './helpers/fixtures.js';

const WHITE = [255, 255, 255, 255];
const CLEAR = [0, 0, 0, 0];

const FlatKind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, TextureColor, Tint, Fade]});
const BillboardKind = defineSprite({base: QuadBase, features: [InstancePosition, BillboardPlacement, QuadSize, TextureColor]});
const AxisKind = defineSprite({base: QuadBase, features: [InstancePosition, AxisBillboardPlacement, QuadSize, TextureColor]});

/** The pointer at the world point `(x, y, z)` as `camera` sees it. */
const pointerAt = (camera, x, y, z = 0) => {
  // project() reads the inverse of the world matrix, which lookAt() and a moved position leave stale
  camera.updateMatrixWorld();
  const ndc = new Vector3(x, y, z).project(camera);
  return {x: ndc.x, y: ndc.y};
};

describe('sprites — picking', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  let display;
  let host;
  let picker;
  let disposables;

  beforeEach(async () => {
    host = makeContainer({width: 64, height: 64});
    display = new Display(host);
    await display.start();
    picker = new SpritePicker(display.renderer);
    disposables = [];
  });

  afterEach(() => {
    picker?.dispose();
    picker = undefined;
    for (const disposable of disposables) disposable.dispose();
    disposables = undefined;
    disposeDisplay(display);
    display = undefined;
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  // 8 world units across the view, the camera on +z looking along -z
  const makeFlatCamera = () => {
    const camera = new OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    camera.position.z = 10;
    return camera;
  };

  /**
   * Sprites of `kind` 2 units square at the positions given, drawn on a texture of `texels` (2 × 2 or 1 × 1).
   *
   * @param {import('@spearwolf/twopoint5d').SpriteKind<any>} kind
   * @param {number[][]} positions
   * @param {Record<string, any>} [options] `texels`, `capacity` and the options of the sprites
   */
  const makeSprites = (kind, positions, {texels = [WHITE], capacity = positions.length, ...options} = {}) => {
    const colorMap = makeColorTexture(texels, texels.length === 4 ? 2 : 1, texels.length === 4 ? 2 : 1);
    const sprites = new FeatureSprites(kind, {capacity, textures: {colorMap}, ...options});
    disposables.push(sprites, colorMap);
    const all = positions.map(([x, y, z]) => {
      const sprite = sprites.createSprite();
      sprite.setSize(2, 2);
      sprite.setPosition(x, y, z);
      return sprite;
    });
    sprites.update();
    return {sprites, all};
  };

  it('picks the front sprite where two overlap, and the back one where it shows alone', async () => {
    const camera = makeFlatCamera();
    // the back sprite first, so that the slot order is not what decides
    const {sprites, all} = makeSprites(FlatKind, [
      [-0.5, 0, 0],
      [0.5, 0, 1],
    ]);
    const [back, front] = all;

    const overlap = await picker.pick(camera, pointerAt(camera, 0, 0), [sprites]);
    const alone = await picker.pick(camera, pointerAt(camera, -1.25, 0), [sprites]);
    const frontAlone = await picker.pick(camera, pointerAt(camera, 1.25, 0), [sprites]);

    expect(overlap?.sprite === front, 'the front sprite in the overlap').to.be.true;
    expect(overlap?.sprites === sprites).to.be.true;
    expect(overlap?.index).to.equal(1);
    expect(alone?.sprite === back, 'the back sprite where it shows alone').to.be.true;
    expect(frontAlone?.sprite === front).to.be.true;
  });

  it('picks the sprite behind through the transparent corner of a frame', async () => {
    const camera = makeFlatCamera();
    // the top left texel of the frame is transparent: the quarter of each sprite left of and above its centre
    const {sprites, all} = makeSprites(
      FlatKind,
      [
        [-0.5, 0, 0],
        [0.5, 0, 1],
      ],
      {texels: [CLEAR, WHITE, WHITE, WHITE]},
    );
    const [back, front] = all;

    // left of and above the centre of the front sprite: its transparent texel, over the opaque quarter of the back one
    const throughCorner = await picker.pick(camera, pointerAt(camera, 0, 0.5), [sprites]);
    // below its centre the front sprite is opaque
    const belowCorner = await picker.pick(camera, pointerAt(camera, 0, -0.5), [sprites]);
    // the transparent quarter of the back sprite, where nothing lies behind
    const nothing = await picker.pick(camera, pointerAt(camera, -1.25, 0.5), [sprites]);

    expect(throughCorner?.sprite === back, 'through the transparent corner, the sprite behind').to.be.true;
    expect(belowCorner?.sprite === front, 'the opaque part of the front sprite').to.be.true;
    expect(nothing, 'a transparent texel over nothing').to.be.undefined;
  });

  it('answers the same handles after a sort, and nothing where no sprite is', async () => {
    const camera = makeFlatCamera();
    const {sprites, all} = makeSprites(FlatKind, [
      [2, 0, 0],
      [-2, 0, 0],
      [0, 2, 0],
    ]);
    const moved = sprites.sortBy('x');
    sprites.update();

    const left = await picker.pick(camera, pointerAt(camera, -2, 0), [sprites]);
    const right = await picker.pick(camera, pointerAt(camera, 2, 0), [sprites]);
    const top = await picker.pick(camera, pointerAt(camera, 0, 2), [sprites]);
    const nothing = await picker.pick(camera, pointerAt(camera, 0, -3), [sprites]);

    expect(moved).to.be.true;
    expect(left?.sprite === all[1] && left.index === 0, `the left sprite, now in slot 0: ${left?.index}`).to.be.true;
    expect(right?.sprite === all[0] && right.index === 2, `the right sprite, now in slot 2: ${right?.index}`).to.be.true;
    expect(top?.sprite === all[2]).to.be.true;
    expect(nothing).to.be.undefined;
  });

  it('picks billboards and axis billboards under a camera that looks down at a slant', async () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 6, 8);
    camera.lookAt(0, 0, 0);
    const billboards = makeSprites(BillboardKind, [
      [-2, 1, 0],
      [2, 1, 0],
    ]);
    const axis = makeSprites(AxisKind, [
      [-2, 1, -3],
      [2, 1, -3],
    ]);
    const list = [billboards.sprites, axis.sprites];

    const hits = [];
    for (const [x, y, z] of [
      [-2, 1, 0],
      [2, 1, 0],
      [-2, 1, -3],
      [2, 1, -3],
    ]) {
      hits.push(await picker.pick(camera, pointerAt(camera, x, y, z), list));
    }
    const between = await picker.pick(camera, pointerAt(camera, 0, 1, 0), list);

    expect(hits[0]?.sprite === billboards.all[0], 'the left billboard').to.be.true;
    expect(hits[1]?.sprite === billboards.all[1], 'the right billboard').to.be.true;
    expect(hits[2]?.sprite === axis.all[0] && hits[2].sprites === axis.sprites, 'the left axis billboard').to.be.true;
    expect(hits[3]?.sprite === axis.all[1], 'the right axis billboard').to.be.true;
    expect(between, 'between the sprites').to.be.undefined;
  });

  it('tells two meshes in one list apart', async () => {
    const camera = makeFlatCamera();
    const left = makeSprites(FlatKind, [[-2, 0, 0]]);
    const right = makeSprites(FlatKind, [[2, 0, 0]]);

    const hitLeft = await picker.pick(camera, pointerAt(camera, -2, 0), [right.sprites, left.sprites]);
    const hitRight = await picker.pick(camera, pointerAt(camera, 2, 0), [right.sprites, left.sprites]);

    expect(hitLeft?.sprites === left.sprites && hitLeft.sprite === left.all[0]).to.be.true;
    expect(hitRight?.sprites === right.sprites && hitRight.sprite === right.all[0]).to.be.true;
  });

  it('picks a sprite created past the first capacity of a mesh that grows', async () => {
    const info = console.info;
    console.info = () => {};
    try {
      const camera = makeFlatCamera();
      const {sprites, all} = makeSprites(
        FlatKind,
        [
          [-2, 0, 0],
          [0, 0, 0],
          [2, 0, 0],
        ],
        {capacity: 1, grow: true},
      );

      const hit = await picker.pick(camera, pointerAt(camera, 2, 0), [sprites]);

      expect(sprites.spritePool.capacity).to.equal(4);
      expect(hit?.sprite === all[2] && hit.index === 2).to.be.true;
    } finally {
      console.info = info;
    }
  });

  it('does not hit a sprite faded to nothing, but what lies behind it', async () => {
    const camera = makeFlatCamera();
    const {sprites, all} = makeSprites(FlatKind, [
      [0, 0, 0],
      [0, 0, 1],
    ]);
    const [back, front] = all;
    front.fade = 0;
    sprites.update();

    const hit = await picker.pick(camera, pointerAt(camera, 0, 0), [sprites]);

    expect(hit?.sprite === back, 'the faded front sprite lets the pick through').to.be.true;
  });

  it('leaves the renderer as it found it', async () => {
    const renderer = display.renderer;
    const camera = makeFlatCamera();
    const {sprites} = makeSprites(FlatKind, [[0, 0, 0]]);
    renderer.setClearColor(0x336699, 0.75);
    renderer.autoClear = false;

    const hit = await picker.pick(camera, pointerAt(camera, 0, 0), [sprites]);

    expect(hit).to.not.be.undefined;
    expect(renderer.getRenderTarget()).to.be.null;
    expect(renderer.getClearColor(new Color()).getHex()).to.equal(0x336699);
    expect(renderer.getClearAlpha()).to.equal(0.75);
    expect(renderer.autoClear).to.be.false;
    // and it renders the scene as before
    renderer.autoClear = true;
    const scene = new Scene();
    scene.add(sprites);
    expect(() => renderer.render(scene, camera)).to.not.throw();
  });
});

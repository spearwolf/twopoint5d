import {expect} from '@esm-bundle/chai';
import {
  AxisBillboardPlacement,
  BillboardPlacement,
  defineSprite,
  Display,
  FeatureSprites,
  FlatPlacement,
  flatPlacement,
  FrameTable,
  InstancePosition,
  QuadBase,
  QuadSize,
  TableFrame,
  tableFrame,
  TexturedSpriteKind,
  TexturePackerJson,
  TextureColor,
  TextureCoords,
  Yaw,
} from '@spearwolf/twopoint5d';
import {OrthographicCamera, RenderTarget, Scene} from 'three/webgpu';
import {
  diffPixels,
  disposeDisplay,
  isNearColor,
  makeColorTexture,
  makeContainer,
  makeTrimmedSheet,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

const TARGET_SIZE = 64;

const TableKind = defineSprite({base: QuadBase, features: [InstancePosition, FlatPlacement, QuadSize, TableFrame, TextureColor]});

const ViewKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, AxisBillboardPlacement, QuadSize, Yaw, tableFrame({views: 8}), TextureColor],
});

const SphericalViewKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, BillboardPlacement, QuadSize, Yaw, tableFrame({views: 8}), TextureColor],
});

const FlatViewKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, flatPlacement({orientation: 'yaw'}), QuadSize, Yaw, tableFrame({views: 8}), TextureColor],
});

// sixteen colours, far enough apart for the tolerance of isNearColor(): two blocks of eight views
const COLORS = Array.from({length: 16}, (_, i) => [(i * 16 + 8) % 256, 255 - i * 15, i % 2 === 0 ? 40 : 220, 255]);

describe('sprites — tableFrame()', function () {
  // a cold webgpu start — adapter plus device — happens in the hook, and hooks have their own budget
  this.timeout(20000);

  let display;
  let host;
  let target;
  const disposables = [];

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    target = new RenderTarget(TARGET_SIZE, TARGET_SIZE);
  });

  afterEach(() => {
    for (const item of disposables.splice(0)) item.dispose();
    target?.dispose();
    target = undefined;
    disposeDisplay(display);
    display = undefined;
    host?.parentNode?.removeChild(host);
    host = undefined;
  });

  const keep = (item) => {
    disposables.push(item);
    return item;
  };

  /** Renders `sprites` alone, seen straight on from +z, 8 units across. */
  const renderFront = async (sprites) => {
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const camera = new OrthographicCamera(-4, 4, 4, -4, 0.1, 100);
    camera.position.z = 10;
    const pixels = await renderToPixels(display.renderer, scene, camera, target);
    scene.remove(sprites);
    return pixels;
  };

  /**
   * The colour at the middle of the view of `sprites` from the camera at `angle` about +y, counted from
   * +z, around the point `centre` of the world; `angle` null puts the camera straight above it.
   */
  const centreSeenFrom = async (sprites, angle, centre = [0, 0, 0]) => {
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    const [cx, cy, cz] = centre;
    if (angle === null) {
      camera.position.set(cx, cy + 10, cz);
      camera.up.set(0, 0, -1);
    } else {
      camera.position.set(cx + 10 * Math.sin(angle), cy, cz + 10 * Math.cos(angle));
    }
    camera.lookAt(cx, cy, cz);
    const pixels = await renderToPixels(display.renderer, scene, camera, target);
    scene.remove(sprites);
    return rgbAt(pixels, TARGET_SIZE, TARGET_SIZE / 2, TARGET_SIZE / 2);
  };

  /** A colour map of the sixteen colours side by side, and a frame table of one texel each. */
  const colourTable = () => {
    const colorMap = keep(makeColorTexture(COLORS, 16, 1));
    const root = new TextureCoords(0, 0, 16, 1);
    const table = new FrameTable(COLORS.map((_, i) => new TextureCoords(root, i, 0, 1, 1)));
    return {colorMap, frameTable: keep(table.bakeDataTexture())};
  };

  it('draws an upright, a trimmed and a turned trimmed frame where AtlasFrame draws them, and clamps an index outside the table', async () => {
    const {texture: colorMap, json} = makeTrimmedSheet();
    keep(colorMap);
    const [atlas] = TexturePackerJson.parse(json);
    const names = ['reference', 'trimmed', 'trimmed-turned'];
    const table = FrameTable.fromAtlas(atlas, names);

    const viaTable = keep(
      new FeatureSprites(TableKind, {capacity: 1, textures: {colorMap, frameTable: keep(table.bakeDataTexture())}}),
    );
    const tableSprite = viaTable.createSprite();
    tableSprite.setSize(5, 4);
    const viaAtlas = keep(new FeatureSprites(TexturedSpriteKind, {capacity: 1, textures: {colorMap}}));
    const atlasSprite = viaAtlas.createSprite();
    atlasSprite.setSize(5, 4);

    const expected = [];
    for (const name of names) {
      atlasSprite.setFrame(atlas.frame(name));
      viaAtlas.spritePool.touchVO(atlasSprite, 'texCoords');
      expected.push(await renderFront(viaAtlas));
    }

    for (const [index, shown] of [
      [0, 0],
      [1, 1],
      [2, 2],
      [7, 2],
      [-3, 0],
      [1.4, 1],
    ]) {
      tableSprite.frameIndex = index;
      viaTable.spritePool.touchVO(tableSprite, 'frameIndex');
      const {lit, differing} = diffPixels(await renderFront(viaTable), expected[shown]);
      expect(lit, `frameIndex ${index}`).to.be.greaterThan(0);
      expect(differing, `frameIndex ${index} shows ${names[shown]}`).to.equal(0);
    }
  });

  it('reads frames whose three texels straddle the end of a row of the table', async () => {
    const {texture: colorMap, json} = makeTrimmedSheet();
    keep(colorMap);
    const [atlas] = TexturePackerJson.parse(json);
    const names = ['reference', 'trimmed', 'trimmed-turned'];
    // three times over, nine frames in 28 texels, eight a row: frame 2 takes texels 7, 8 and 9 — the end
    // of the first row and the start of the second — and frame 7 the texels 22 to 24 across the next end
    const frames = [...names, ...names, ...names].map((name) => atlas.frame(name));
    const frameTable = keep(new FrameTable(frames).bakeDataTexture({maxTextureSize: 8}));
    expect([frameTable.image.width, frameTable.image.height]).to.deep.equal([8, 4]);

    const viaTable = keep(new FeatureSprites(TableKind, {capacity: 1, textures: {colorMap, frameTable}}));
    const tableSprite = viaTable.createSprite();
    tableSprite.setSize(5, 4);
    const viaAtlas = keep(new FeatureSprites(TexturedSpriteKind, {capacity: 1, textures: {colorMap}}));
    const atlasSprite = viaAtlas.createSprite();
    atlasSprite.setSize(5, 4);

    const expected = [];
    for (const name of names) {
      atlasSprite.setFrame(atlas.frame(name));
      viaAtlas.spritePool.touchVO(atlasSprite, 'texCoords');
      expected.push(await renderFront(viaAtlas));
    }
    for (let index = 0; index < frames.length; index++) {
      tableSprite.frameIndex = index;
      viaTable.spritePool.touchVO(tableSprite, 'frameIndex');
      const {lit, differing} = diffPixels(await renderFront(viaTable), expected[index % 3]);
      expect(lit, `frameIndex ${index}`).to.be.greaterThan(0);
      expect(differing, `frameIndex ${index} shows ${names[index % 3]}`).to.equal(0);
    }
  });

  it('picks view k of eight for the camera k · 45° counter-clockwise, seen from above, from the front', async () => {
    const textures = colourTable();
    const sprites = keep(new FeatureSprites(ViewKind, {capacity: 1, textures}));
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);

    for (let k = 0; k < 8; k++) {
      for (const offset of [0, 0.3, -0.3]) {
        const rgb = await centreSeenFrom(sprites, (k * Math.PI) / 4 + offset);
        expect(isNearColor(rgb, COLORS[k]), `camera at ${k} · 45° ${offset >= 0 ? '+' : ''}${offset}: ${rgb}`).to.be.true;
      }
    }
  });

  it('a yaw turns the views with the sprite, and frameIndex picks the frame whose views the shader reads', async () => {
    const textures = colourTable();
    const sprites = keep(new FeatureSprites(ViewKind, {capacity: 1, textures}));
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    // facing +x: the camera on +z sees the sprite from its right — view 6, two steps short of a turn
    sprite.yaw = Math.PI / 2;
    sprite.frameIndex = 1;
    sprites.spritePool.touchVO(sprite);

    for (let k = 0; k < 8; k++) {
      const rgb = await centreSeenFrom(sprites, (k * Math.PI) / 4);
      expect(isNearColor(rgb, COLORS[8 + ((k + 6) % 8)]), `camera at ${k} · 45°: ${rgb}`).to.be.true;
    }
  });

  it('a frameIndex past the last frame shows the view of the last frame, one below the first that of the first', async () => {
    // sixteen entries: two frames of eight views each
    const textures = colourTable();
    const sprites = keep(new FeatureSprites(ViewKind, {capacity: 1, textures}));
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);

    for (const [frameIndex, frame] of [
      [5, 1],
      [-3, 0],
      [0.6, 1],
    ]) {
      sprite.frameIndex = frameIndex;
      sprites.spritePool.touchVO(sprite, 'frameIndex');
      for (let k = 0; k < 8; k++) {
        const rgb = await centreSeenFrom(sprites, (k * Math.PI) / 4);
        expect(isNearColor(rgb, COLORS[frame * 8 + k]), `frameIndex ${frameIndex}, camera at ${k} · 45°: ${rgb}`).to.be.true;
      }
    }
  });

  it('a frameIndex of 2.5 shows frame 3, one of 1.5 frame 2', async () => {
    // sixteen frames of one colour each; a half rounds up on WebGPU and WebGL 2 alike
    const textures = colourTable();
    const sprites = keep(new FeatureSprites(TableKind, {capacity: 1, textures}));
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);

    for (const [frameIndex, frame] of [
      [2.5, 3],
      [1.5, 2],
    ]) {
      sprite.frameIndex = frameIndex;
      sprites.spritePool.touchVO(sprite, 'frameIndex');
      const rgb = await centreSeenFrom(sprites, 0);
      expect(isNearColor(rgb, COLORS[frame]), `frameIndex ${frameIndex}: ${rgb}`).to.be.true;
    }
  });

  it('measures the views in the local space of a moved and turned mesh', async () => {
    const textures = colourTable();
    const sprites = keep(new FeatureSprites(ViewKind, {capacity: 1, textures}));
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    sprite.setPosition(1, 0, -1);
    // the mesh turned by 90°: the sprite of yaw 0 faces +x of the world. Its local (1, 0, −1) lies at
    // (−1, 0, −1) turned, at (2, 0.5, −4) moved
    sprites.rotation.y = Math.PI / 2;
    sprites.position.set(3, 0.5, -3);
    const centre = [2, 0.5, -4];

    for (let k = 0; k < 8; k++) {
      const rgb = await centreSeenFrom(sprites, Math.PI / 2 + (k * Math.PI) / 4, centre);
      expect(isNearColor(rgb, COLORS[k]), `camera ${k} · 45° from the front: ${rgb}`).to.be.true;
    }
  });

  it('straight above the sprite the camera sees the front view, whatever the yaw', async () => {
    const textures = colourTable();
    const sprites = keep(new FeatureSprites(SphericalViewKind, {capacity: 1, textures}));
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    sprite.yaw = 1.2;
    sprites.spritePool.touchVO(sprite);

    const rgb = await centreSeenFrom(sprites, null);
    expect(isNearColor(rgb, COLORS[0]), `from above: ${rgb}`).to.be.true;
  });

  it('a flat sprite turned by its yaw picks the same views', async () => {
    const textures = colourTable();
    const sprites = keep(new FeatureSprites(FlatViewKind, {capacity: 1, textures}));
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    sprite.yaw = 0.3;
    sprites.spritePool.touchVO(sprite);

    for (const k of [7, 0, 1]) {
      const rgb = await centreSeenFrom(sprites, 0.3 + (k * Math.PI) / 4);
      expect(isNearColor(rgb, COLORS[k]), `camera ${k} · 45° from the front: ${rgb}`).to.be.true;
    }
  });
});

import {expect} from '@esm-bundle/chai';
import {
  AxisBillboardPlacement,
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

  /** The colour at the middle of the view of `sprites` from the camera at `angle` about +y, counted from +z. */
  const centreSeenFrom = async (sprites, angle) => {
    const scene = new Scene();
    scene.add(sprites);
    sprites.update();
    const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 100);
    camera.position.set(10 * Math.sin(angle), 0, 10 * Math.cos(angle));
    camera.lookAt(0, 0, 0);
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

  it('a yaw turns the views with the sprite, and frameIndex picks the block of views', async () => {
    const textures = colourTable();
    const sprites = keep(new FeatureSprites(ViewKind, {capacity: 1, textures}));
    const sprite = sprites.createSprite();
    sprite.setSize(2, 2);
    // facing +x: the camera on +z sees the sprite from its right — view 6, two steps short of a turn
    sprite.yaw = Math.PI / 2;
    sprite.frameIndex = 8;
    sprites.spritePool.touchVO(sprite);

    for (let k = 0; k < 8; k++) {
      const rgb = await centreSeenFrom(sprites, (k * Math.PI) / 4);
      expect(isNearColor(rgb, COLORS[8 + ((k + 6) % 8)]), `camera at ${k} · 45°: ${rgb}`).to.be.true;
    }
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

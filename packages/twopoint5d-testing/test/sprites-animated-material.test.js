import {expect} from '@esm-bundle/chai';
import {
  AnimatedSpriteKind,
  Display,
  FeatureSprites,
  FeatureSpritesGeometry,
  FeatureSpritesMaterial,
  FrameBasedAnimations,
  TextureCoords,
} from '@spearwolf/twopoint5d';
import {DataTexture, FloatType, OrthographicCamera, RenderTarget, RGBAFormat, Scene} from 'three/webgpu';
import {
  disposeDisplay,
  disposeKept,
  isNearColor,
  keep,
  makeColorTexture,
  makeContainer,
  renderToPixels,
  rgbAt,
} from './helpers/fixtures.js';

// 8 world units across 64 pixels: one unit is 8 pixels
const TARGET_SIZE = 64;
const PIXELS_PER_UNIT = 8;
const CENTER = TARGET_SIZE / 2;

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];
const BLUE = [0, 0, 255, 255];

describe('sprites — AnimatedSpriteKind draws the frame the time points at', function () {
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
    disposeKept();
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
   * Draws one sprite of 4 × 4 units over the middle of the target at `time` and answers the color of
   * the middle pixel. The color map is `texels`, one texel high.
   *
   * The sprite draws the animation named `draw` out of `animations`, each a name, a duration and the
   * indices of the texels of the color map its frames show — by default one animation over one
   * second, a frame for each texel, the first frame on the left texel. `bakeOptions` go to
   * `bakeDataTexture()`. An `animsMap` handed in takes the place of the bake, and the sprite then
   * draws the animation of id 0 out of it; the helper disposes it like one it baked.
   *
   * @param {number} time
   * @param {{
   *   texels?: number[][],
   *   animations?: {name: string, duration: number, texelIndices: number[]}[],
   *   draw?: string,
   *   animOffset?: number,
   *   bakeOptions?: {includeTextureSize: boolean},
   *   animsMap?: import('three/webgpu').DataTexture,
   * }} [options]
   */
  async function renderAt(time, {texels = [RED, GREEN], animations, draw, animOffset = 0, bakeOptions, animsMap} = {}) {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;

    const colorMap = keep(makeColorTexture(texels));

    let animId = 0;
    if (animsMap == null) {
      const frames = new TextureCoords(0, 0, texels.length, 1);
      const anims = new FrameBasedAnimations();
      animations ??= [{name: 'blink', duration: 1, texelIndices: texels.map((_, i) => i)}];
      for (const {name, duration, texelIndices} of animations) {
        anims.add(
          name,
          duration,
          texelIndices.map((i) => new TextureCoords(frames, i, 0, 1, 1)),
        );
      }
      animsMap = anims.bakeDataTexture(bakeOptions);
      animId = anims.animId(draw ?? animations[0].name);
    }
    keep(animsMap);

    // the mesh gives geometry and material up; both, like the two textures, are the caller's
    const geometry = keep(new FeatureSpritesGeometry(AnimatedSpriteKind, 1));
    const material = keep(new FeatureSpritesMaterial(AnimatedSpriteKind, {textures: {colorMap, animsMap}, uniforms: {time}}));
    const sprites = keep(new FeatureSprites(AnimatedSpriteKind, {geometry, material}));
    sprites.frustumCulled = false;

    const sprite = geometry.instancedPool.createVO();
    sprite.setSize(4, 4);
    sprite.setPosition(0, 0, 0);
    sprite.animId = animId;
    sprite.animOffset = animOffset;

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const pixels = await renderToPixels(display.renderer, scene, camera, target);

    return rgbAt(pixels, TARGET_SIZE, CENTER, CENTER);
  }

  it('shows the first frame at the start of the animation', async function () {
    const rgb = await renderAt(0);

    expect(rgb, 'the red of the first frame').to.satisfy((c) => isNearColor(c, [255, 0, 0]));
  });

  it('shows the second frame three quarters into the animation', async function () {
    const rgb = await renderAt(0.75);

    expect(rgb, 'the green of the second frame').to.satisfy((c) => isNearColor(c, [0, 255, 0]));
  });

  // three frames, not two: read one texel too early, the second frame hits the size texel
  // [1, 1, 0, 0] of the first, whose corner (1, 1) lies on the last texel of the color map — blue
  // here, and with two frames the very green that is expected
  it('shows the second frame of an animsMap baked with includeTextureSize in the middle of that frame', async function () {
    const rgb = await renderAt(0.5, {texels: [RED, GREEN, BLUE], bakeOptions: {includeTextureSize: true}});

    expect(rgb, 'the green of the second frame').to.satisfy((c) => isNearColor(c, [0, 255, 0]));
  });

  // a duration of 0 would divide the animation time by 0, and a frame index out of NaN points
  // anywhere in the animsMap — the header texel among it
  it('shows the first frame of an animation whose duration is 0, at the start and later on', async function () {
    const still = [{name: 'still', duration: 0, texelIndices: [0, 1, 2]}];

    const atStart = await renderAt(0, {texels: [RED, GREEN, BLUE], animations: still});
    const later = await renderAt(0.75, {texels: [RED, GREEN, BLUE], animations: still});

    expect(atStart, 'the red of the first frame at time 0').to.satisfy((c) => isNearColor(c, [255, 0, 0]));
    expect(later, 'the red of the first frame at time 0.75').to.satisfy((c) => isNearColor(c, [255, 0, 0]));
  });

  it('starts a sprite into its animation by its animOffset', async function () {
    const rgb = await renderAt(0, {animOffset: 0.75});

    expect(rgb, 'the green of the second frame').to.satisfy((c) => isNearColor(c, [0, 255, 0]));
  });

  it('runs the animation again once its duration has passed', async function () {
    const early = await renderAt(1.25);
    const late = await renderAt(1.75);

    expect(early, 'the red of the first frame a quarter into the second run').to.satisfy((c) => isNearColor(c, [255, 0, 0]));
    expect(late, 'the green of the second frame three quarters into the second run').to.satisfy((c) =>
      isNearColor(c, [0, 255, 0]),
    );
  });

  it('reads the header of the second animation from its own texel', async function () {
    const rgb = await renderAt(0, {
      texels: [RED, GREEN, BLUE],
      animations: [
        {name: 'first', duration: 1, texelIndices: [0, 1]},
        {name: 'second', duration: 1, texelIndices: [2]},
      ],
      draw: 'second',
    });

    expect(rgb, 'the blue of the frame of the second animation').to.satisfy((c) => isNearColor(c, [0, 0, 255]));
  });

  it('an animsMap swapped for a bake of another size draws the frame the new one points at', async function () {
    const half = TARGET_SIZE / PIXELS_PER_UNIT / 2;
    const camera = new OrthographicCamera(-half, half, half, -half, 0.1, 100);
    camera.position.z = 10;

    const texels = [RED, GREEN, BLUE];
    const colorMap = keep(makeColorTexture(texels));
    const frames = new TextureCoords(0, 0, texels.length, 1);
    const frameOf = (i) => new TextureCoords(frames, i, 0, 1, 1);

    // animation 0 of the first bake shows red; animation 0 of the second shows green, and a second
    // animation of six frames makes that bake wider
    const redAnims = new FrameBasedAnimations();
    redAnims.add('red', 1, [frameOf(0)]);
    const redBake = keep(redAnims.bakeDataTexture());

    const greenAnims = new FrameBasedAnimations();
    greenAnims.add('green', 1, [frameOf(1)]);
    greenAnims.add('padding', 1, [0, 1, 2, 0, 1, 2].map(frameOf));
    const greenBake = keep(greenAnims.bakeDataTexture());

    const geometry = keep(new FeatureSpritesGeometry(AnimatedSpriteKind, 1));
    const material = keep(new FeatureSpritesMaterial(AnimatedSpriteKind, {textures: {colorMap, animsMap: redBake}}));
    const sprites = keep(new FeatureSprites(AnimatedSpriteKind, {geometry, material}));

    const sprite = sprites.createSprite();
    sprite.setSize(4, 4);
    sprite.setPosition(0, 0, 0);

    const scene = new Scene();
    scene.add(sprites);
    sprites.update();

    const before = rgbAt(await renderToPixels(display.renderer, scene, camera, target), TARGET_SIZE, CENTER, CENTER);

    const {positionNode, colorNode, version} = material;
    material.setTexture('animsMap', greenBake);
    sprites.update();

    const after = rgbAt(await renderToPixels(display.renderer, scene, camera, target), TARGET_SIZE, CENTER, CENTER);

    // the swap reached the gpu through the texture nodes and the size uniform alone
    const rebuilt = material.positionNode !== positionNode || material.colorNode !== colorNode || material.version !== version;
    const widths = [redBake.image.width, greenBake.image.width];

    expect(widths[1], 'the width of the second bake').to.not.equal(widths[0]);
    expect(before, 'the red of the first bake').to.satisfy((c) => isNearColor(c, [255, 0, 0]));
    expect(rebuilt, 'the lookups were built anew').to.equal(false);
    expect(after, 'the green of the second bake').to.satisfy((c) => isNearColor(c, [0, 255, 0]));
  });

  // In the layout before the second header texel, the texel behind the frames of an animation is the
  // first frame of the next one. A frame turned as TexturePacker turns it carries FLIP_VERTICAL, and
  // one as high as its image a `v` of exactly -1 — which must not pass for a second header: read as
  // one, [1, 0, …] would make the first animation a 'once' and hold its last frame
  it('plays an animsMap of the old layout as a loop, the next animation starting with a turned frame of the full height', async function () {
    const data = new Float32Array(8 * 4);
    const setTexel = (index, values) => data.set(values, index * 4);

    // two headers: two frames at texel 2, a duration of 1; one frame at texel 4
    setTexel(0, [2, 1, 2, 1]);
    setTexel(1, [1, 1, 4, 1]);
    // the red and the green texel of the color map
    setTexel(2, [0, 0, 0.5, 1]);
    setTexel(3, [0.5, 0, 0.5, 1]);
    // the turned frame of the second animation, the whole height of its image
    setTexel(4, [1, 0, 0.5, -1]);

    const animsMap = new DataTexture(data, 8, 1, RGBAFormat, FloatType);
    animsMap.needsUpdate = true;

    const rgb = await renderAt(1.25, {texels: [RED, GREEN], animsMap});

    expect(rgb, 'the red of the first frame a quarter into the second run').to.satisfy((c) => isNearColor(c, [255, 0, 0]));
  });

  // bakeDataTexture() builds one row, so only an animsMap built by hand reaches a texel in a second row
  it('reads a frame out of the second row of an animsMap it is handed', async function () {
    const width = 4;
    const height = 2;
    const data = new Float32Array(width * height * 4);
    const setTexel = (index, values) => data.set(values, index * 4);

    // the header: one frame, a duration of 1, the frame at texel 6, one texel per frame
    setTexel(0, [1, 1, 6, 1]);
    // texel 6 is column 2 of row 1: the tex coords of the green texel of the color map
    setTexel(6, [0.5, 0, 0.5, 1]);
    // the tex coords of the red texel at column 2 of row 0 and at column 1 of row 1 — what a lookup
    // reads that passes the row over or swaps column and row
    setTexel(2, [0, 0, 0.5, 1]);
    setTexel(5, [0, 0, 0.5, 1]);

    const animsMap = new DataTexture(data, width, height, RGBAFormat, FloatType);
    animsMap.needsUpdate = true;

    const rgb = await renderAt(0, {texels: [RED, GREEN], animsMap});

    expect(rgb, 'the green the frame in the second row points at').to.satisfy((c) => isNearColor(c, [0, 255, 0]));
  });
});

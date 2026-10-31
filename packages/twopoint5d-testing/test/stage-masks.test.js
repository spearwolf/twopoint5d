import {expect} from '@esm-bundle/chai';
import {on} from '@spearwolf/eventize';
import {
  Display,
  OnStageUpdateFrame,
  OrthographicProjection,
  Stage2D,
  StageDirector,
  StageMask,
  StageRenderer,
  createMaskNode,
  matte,
} from '@spearwolf/twopoint5d';
import {Color, Mesh, MeshBasicMaterial, PlaneGeometry, RenderPipeline, RenderTarget, Scene} from 'three/webgpu';
import {mix} from 'three/tsl';
import {
  disposeDisplay,
  disposeKept,
  isNearColor,
  keep,
  makeContainer,
  makeFilledStage,
  readsTopDown,
  rgbAt,
} from './helpers/fixtures.js';

// 64 pixels wide: rgbAt() reads the rows at that length
const SIZE = 64;

/** The 8-bit sRGB value of a linear channel, as the output transform of the pipeline writes it. */
const srgb = (linear) => Math.round(255 * (linear <= 0.0031308 ? linear * 12.92 : 1.055 * linear ** (1 / 2.4) - 0.055));

/** The color of an opaque red slot masked by `coverage` over an opaque blue one, premultiplied: `red·m + blue·(1 − m)`. */
const redOverBlue = (coverage) => [srgb(coverage), 0, srgb(1 - coverage)];

// the three thirds of the picture a mask stage with bands draws in: x of the middle of each
const LEFT = 8;
const MIDDLE = 32;
const RIGHT = 56;
const THIRD = 21;

describe('StageDirector — masked slots on the GPU', () => {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {RenderTarget} */
  let target;
  /** @type {StageDirector} */
  let director;

  /** Counts the node builders the backend creates until `stop()`, as stage-transitions.test.js does. */
  function countNodeBuilds() {
    const backend = /** @type {{createNodeBuilder: (...args: unknown[]) => unknown}} */ (
      /** @type {unknown} */ (display.renderer.backend)
    );
    const createNodeBuilder = backend.createNodeBuilder;
    const counter = {
      count: 0,
      stop: () => {
        backend.createNodeBuilder = createNodeBuilder;
      },
    };
    backend.createNodeBuilder = function (...args) {
      counter.count++;
      return createNodeBuilder.apply(this, args);
    };
    return counter;
  }

  async function draw() {
    director.updateFrame(0, 0, 0);
    director.renderTo(display.renderer);
    return display.renderer.readRenderTargetPixelsAsync(target, 0, 0, SIZE, SIZE);
  }

  /**
   * A mask stage with a band of its own in each third of the picture, from the left: `bands` is
   * three `[color, opacity]`, or `undefined` for a third that draws nothing.
   */
  function bandsStage(name, bands) {
    const filled = makeFilledStage(name, undefined);
    bands.forEach((band, i) => {
      if (band) filled.fill(band[0], band[1], {x: i * THIRD, y: 0, width: i === 2 ? SIZE - 2 * THIRD : THIRD, height: SIZE});
    });
    return filled.stage;
  }

  beforeEach(async () => {
    host = makeContainer({width: SIZE, height: SIZE});
    display = new Display(host);
    await display.start();
    target = keep(new RenderTarget(SIZE, SIZE));
    // driven by hand, no host
    director = new StageDirector().setClearColor(new Color('#000'), 1);
    director.outputRenderTarget = target;
    director.resize(SIZE, SIZE);
  });

  afterEach(() => {
    director.dispose();
    disposeKept();
    disposeDisplay(display);
    display = undefined;
    host?.remove();
    host = undefined;
  });

  it('a masked slot over a slot below reads coverage 0, 0.5 and 1 as premultiplied colors', async () => {
    const blue = makeFilledStage('blue', '#00f');
    const red = makeFilledStage('red', '#f00');
    // nothing on the left, a half transparent white in the middle, an opaque one on the right
    const mask = bandsStage('mask', [undefined, ['#fff', 0.5], ['#fff', 1]]);
    director.setStack([blue.stage, red.stage]);
    director.setMask(red.stage, new StageMask(mask));

    const pixels = await draw();
    expect(isNearColor(rgbAt(pixels, SIZE, LEFT, 32), redOverBlue(0), 3), 'coverage 0').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, MIDDLE, 32), redOverBlue(0.5), 3), 'coverage 0.5').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, RIGHT, 32), redOverBlue(1), 3), 'coverage 1').to.be.true;
  });

  it('a half transparent slot is masked in all four channels: c·m over the slot below', async () => {
    const blue = makeFilledStage('blue', '#00f');
    const halfRed = makeFilledStage('half red', '#f00', {opacity: 0.5});
    const mask = bandsStage('mask', [undefined, ['#fff', 0.5], ['#fff', 1]]);
    director.setStack([blue.stage, halfRed.stage]);
    director.setMask(halfRed.stage, new StageMask(mask));

    const pixels = await draw();
    // out = c·m + below·(1 − c.a·m), c = (0.5, 0, 0, 0.5)
    const at = (m) => [srgb(0.5 * m), 0, srgb(1 - 0.5 * m)];
    expect(isNearColor(rgbAt(pixels, SIZE, LEFT, 32), at(0), 3), 'coverage 0').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, MIDDLE, 32), at(0.5), 3), 'coverage 0.5').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, RIGHT, 32), at(1), 3), 'coverage 1').to.be.true;
  });

  it('a mask stage that draws its top half masks the top half', async () => {
    const topDown = await readsTopDown(display.renderer, target);
    const blue = makeFilledStage('blue', '#00f');
    const red = makeFilledStage('red', '#f00');
    // the stage draws with its origin at the bottom left: its y from 32 up is the top half of the picture
    const top = makeFilledStage('top', '#fff', {rect: {x: 0, y: SIZE / 2, width: SIZE, height: SIZE / 2}});
    director.setStack([blue.stage, red.stage]);
    director.setMask(red.stage, new StageMask(top.stage));

    const pixels = await draw();
    const row = (fromTop) => (topDown ? fromTop : SIZE - 1 - fromTop);
    expect(isNearColor(rgbAt(pixels, SIZE, 32, row(8)), [255, 0, 0]), 'the top half shows the slot').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, 32, row(56)), [0, 0, 255]), 'the bottom half shows the slot below').to.be.true;
  });

  describe('invert and every source', () => {
    // the bands of the mask stage are red, green and blue; the coverage each source reads there
    // the luminance of the premultiplied rgb in the linear working space: Rec. 709 weights
    const LUMA_RED = 0.2126;
    const LUMA_GREEN = 0.7152;
    const LUMA_BLUE = 0.0722;
    /** @type {{source: 'alpha' | 'luminance' | 'red' | 'green' | 'blue', coverage: number[]}[]} */
    const cases = [
      {source: 'alpha', coverage: [1, 1, 1]},
      {source: 'red', coverage: [1, 0, 0]},
      {source: 'green', coverage: [0, 1, 0]},
      {source: 'blue', coverage: [0, 0, 1]},
      {source: 'luminance', coverage: [LUMA_RED, LUMA_GREEN, LUMA_BLUE]},
    ];

    for (const {source, coverage} of cases) {
      for (const invert of [false, true]) {
        it(`source "${source}"${invert ? ', inverted' : ''}`, async () => {
          const blue = makeFilledStage('blue', '#00f');
          const red = makeFilledStage('red', '#f00');
          const mask = bandsStage('mask', [
            ['#f00', 1],
            ['#0f0', 1],
            ['#00f', 1],
          ]);
          director.setStack([blue.stage, red.stage]);
          director.setMask(red.stage, new StageMask(mask, {source, invert}));

          const pixels = await draw();
          const bands = [LEFT, MIDDLE, RIGHT];
          bands.forEach((x, i) => {
            const m = invert ? 1 - coverage[i] : coverage[i];
            expect(isNearColor(rgbAt(pixels, SIZE, x, 32), redOverBlue(m), 3), `band ${i}, coverage ${m}`).to.be.true;
          });
        });
      }
    }
  });

  it('one mask on two slots draws its stage once per frame and masks both', async () => {
    const topDown = await readsTopDown(display.renderer, target);
    const blue = makeFilledStage('blue', '#00f');
    const red = makeFilledStage('red', '#f00', {rect: {x: 0, y: 0, width: SIZE / 2, height: SIZE}});
    const green = makeFilledStage('green', '#0f0', {rect: {x: SIZE / 2, y: 0, width: SIZE / 2, height: SIZE}});
    const top = makeFilledStage('top', '#fff', {rect: {x: 0, y: SIZE / 2, width: SIZE, height: SIZE / 2}});
    let updates = 0;
    const updateFrame = top.stage.updateFrame.bind(top.stage);
    top.stage.updateFrame = (...args) => {
      updates++;
      return updateFrame(...args);
    };
    const mask = new StageMask(top.stage);
    director.setStack([blue.stage, red.stage, green.stage]);
    director.setMask(red.stage, mask);
    director.setMask(green.stage, mask);
    expect(director.maskOf(red.stage)).to.equal(mask);
    expect(director.maskOf(green.stage)).to.equal(mask);

    const pixels = await draw();
    const row = (fromTop) => (topDown ? fromTop : SIZE - 1 - fromTop);
    expect(isNearColor(rgbAt(pixels, SIZE, 16, row(8)), [255, 0, 0]), 'red, top left').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, 48, row(8)), [0, 255, 0]), 'green, top right').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, 16, row(56)), [0, 0, 255]), 'blue, bottom left').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, 48, row(56)), [0, 0, 255]), 'blue, bottom right').to.be.true;
    expect(updates, 'updates of the mask stage in one frame').to.equal(1);
  });

  it('a frozen mask keeps masking after its scene changed', async () => {
    const blue = makeFilledStage('blue', '#00f');
    const red = makeFilledStage('red', '#f00');
    const white = makeFilledStage('mask', '#fff');
    director.setStack([blue.stage, red.stage]);
    director.setMask(red.stage, new StageMask(white.stage));
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [255, 0, 0]), 'the mask covers').to.be.true;

    director.freeze(white.stage);
    white.meshes[0].visible = false;
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [255, 0, 0]), 'frozen: it covers still').to.be.true;
    director.run(white.stage);
    expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), [0, 0, 255]), 'running: the new scene masks').to.be.true;
  });

  /** Sets the masked shape of a stack of blue and red up, draws its first frame and answers the node builders it created. */
  async function maskedFirstFrame(precompile) {
    const blue = makeFilledStage('blue', '#00f');
    const red = makeFilledStage('red', '#f00');
    const white = makeFilledStage('mask', '#fff', {opacity: 0.5});
    director.setStack([blue.stage, red.stage]);
    await draw();

    if (precompile) {
      // the mask in the shape is another StageMask of the same options on the same stage: the shape counts by those
      const shapeMask = new StageMask(white.stage);
      try {
        await director.precompile(display.renderer, [['layer', {mask: shapeMask}]], {layers: [white.stage]});
      } finally {
        shapeMask.dispose();
      }
    }
    const builds = countNodeBuilds();
    try {
      director.setMask(red.stage, new StageMask(white.stage));
      expect(isNearColor(rgbAt(await draw(), SIZE, 32, 32), redOverBlue(0.5), 3), 'the masked shape').to.be.true;
      return builds.count;
    } finally {
      builds.stop();
    }
  }

  it('precompile(): the first frame of a masked shape creates no node builder', async () => {
    expect(await maskedFirstFrame(true), 'node builds in the first frame of the shape').to.equal(0);
  });

  it('without precompile() the first frame of a masked shape builds nodes: the count of the test above counts', async () => {
    expect(await maskedFirstFrame(false), 'node builds in the first frame of the shape').to.be.greaterThan(0);
  });

  it('createMaskNode() in a plain composing renderer masks one stage by another', async () => {
    director.dispose();
    const red = makeFilledStage('red', '#f00');
    const mask = bandsStage('mask', [undefined, ['#fff', 0.5], ['#fff', 1]]);
    const sr = keep(new StageRenderer().setClearColor(new Color('#000'), 0).add(red.stage).add(mask));
    sr.outputRenderTarget = target;
    sr.pipeline = keep(new RenderPipeline(display.renderer));
    sr.buildOutputNode = ([scene, coverage]) => createMaskNode(scene, coverage, {source: 'alpha'});
    sr.resize(SIZE, SIZE);
    sr.updateFrame(0, 0, 0);
    sr.renderTo(display.renderer);
    const pixels = await display.renderer.readRenderTargetPixelsAsync(target, 0, 0, SIZE, SIZE);

    // red·m on the black of the target; into a render target the pipeline writes the linear value, no output transform
    expect(isNearColor(rgbAt(pixels, SIZE, LEFT, 32), [0, 0, 0], 3), 'coverage 0').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, MIDDLE, 32), [128, 0, 0], 3), 'coverage 0.5').to.be.true;
    expect(isNearColor(rgbAt(pixels, SIZE, RIGHT, 32), [255, 0, 0], 3), 'coverage 1').to.be.true;
  });

  describe('matte() — a transition through a living stage', () => {
    // from is red, to is green: a pixel tells which side of the transition it shows
    const FROM = [255, 0, 0];
    const TO = [0, 255, 0];

    /** A mask stage with one white rectangle from the left edge that is `fraction()` of the picture wide, set in every update. */
    function growingStage(name, fraction) {
      const filled = makeFilledStage(name, undefined);
      const mesh = filled.fill('#fff', 1, {x: 0, y: 0, width: SIZE, height: SIZE});
      on(filled.stage, OnStageUpdateFrame, () => {
        const width = Math.max(fraction(), 1e-4);
        mesh.scale.x = width;
        mesh.position.x = (width * SIZE - SIZE) / 2;
      });
      return filled.stage;
    }

    /** red `from` replaced by green `to` through `effect`, driven by hand; the stack is red alone below nothing. */
    function transitionThrough(effect) {
      const red = makeFilledStage('red', '#f00');
      const green = makeFilledStage('green', '#0f0');
      director.setStack([red.stage]);
      return director.replace(red.stage, green.stage, {effect, manual: true});
    }

    /** The colors at the left, the middle and the right band of the picture. */
    const bandsOf = (pixels) => [LEFT, MIDDLE, RIGHT].map((x) => rgbAt(pixels, SIZE, x, 32));

    it('coverage mode at progress 0, 0.5 and 1 against a mask stage whose coverage follows mask.progress', async () => {
      /** @type {StageMask} */
      let ink;
      ink = new StageMask(growingStage('ink', () => ink.progress));
      const t = transitionThrough(matte({mask: ink}));

      t.progress = 0;
      let pixels = await draw();
      expect(ink.progress, 'the mask follows the progress').to.equal(0);
      expect(isNearColor(rgbAt(pixels, SIZE, LEFT, 32), FROM), 'progress 0: from at the left').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, RIGHT, 32), FROM), 'progress 0: from at the right').to.be.true;

      t.progress = 0.5;
      pixels = await draw();
      expect(ink.progress, 'the mask follows the progress').to.equal(0.5);
      expect(ink.progressNode.value, 'and so does its node').to.equal(0.5);
      expect(isNearColor(rgbAt(pixels, SIZE, LEFT, 32), TO), 'progress 0.5: the covered left half shows to').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, RIGHT, 32), FROM), 'progress 0.5: the right half still shows from').to.be.true;

      t.progress = 1;
      pixels = await draw();
      expect(isNearColor(rgbAt(pixels, SIZE, LEFT, 32), TO), 'progress 1: to at the left').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, RIGHT, 32), TO), 'progress 1: to at the right').to.be.true;

      t.complete();
      expect(ink.progress, 'a finished transition leaves 1 behind').to.equal(1);
      expect(isNearColor(rgbAt(await draw(), SIZE, RIGHT, 32), TO), 'the end').to.be.true;
    });

    it('coverage mode holds both ends whatever the mask draws: nothing at 1, everything at 0', async () => {
      const nothing = new StageMask(bandsStage('nothing', [undefined, undefined, undefined]));
      const t = transitionThrough(matte({mask: nothing}));
      t.progress = 0.5;
      let pixels = await draw();
      bandsOf(pixels).forEach((rgb, i) => expect(isNearColor(rgb, FROM), `nothing, 0.5, band ${i}: from`).to.be.true);
      t.progress = 1;
      pixels = await draw();
      bandsOf(pixels).forEach((rgb, i) => expect(isNearColor(rgb, TO), `nothing, 1, band ${i}: to`).to.be.true);
      t.cancel();

      const everything = new StageMask(
        bandsStage('everything', [
          ['#fff', 1],
          ['#fff', 1],
          ['#fff', 1],
        ]),
      );
      const u = transitionThrough(matte({mask: everything}));
      u.progress = 0.5;
      pixels = await draw();
      bandsOf(pixels).forEach((rgb, i) => expect(isNearColor(rgb, TO), `everything, 0.5, band ${i}: to`).to.be.true);
      u.progress = 0;
      pixels = await draw();
      bandsOf(pixels).forEach((rgb, i) => expect(isNearColor(rgb, FROM), `everything, 0, band ${i}: from`).to.be.true);
    });

    it('threshold mode: the coverage is the progress at which a pixel switches, the ends hold', async () => {
      // switching points 0.25, 0.75 and 1 from the left; the alpha is the coverage
      const gradient = new StageMask(
        bandsStage('gradient', [
          ['#fff', 0.25],
          ['#fff', 0.75],
          ['#fff', 1],
        ]),
      );
      const t = transitionThrough(matte({mask: gradient, mode: 'threshold', softness: 0}));

      t.progress = 0;
      let pixels = await draw();
      bandsOf(pixels).forEach((rgb, i) => expect(isNearColor(rgb, FROM), `progress 0, band ${i}: from`).to.be.true);

      t.progress = 0.5;
      pixels = await draw();
      expect(isNearColor(rgbAt(pixels, SIZE, LEFT, 32), TO), 'progress 0.5: the 0.25 band has switched').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, MIDDLE, 32), FROM), 'progress 0.5: the 0.75 band has not').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, RIGHT, 32), FROM), 'progress 0.5: the 1 band has not').to.be.true;

      t.progress = 0.9;
      pixels = await draw();
      expect(isNearColor(rgbAt(pixels, SIZE, MIDDLE, 32), TO), 'progress 0.9: the 0.75 band has switched').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, RIGHT, 32), FROM), 'progress 0.9: the 1 band has not').to.be.true;

      t.progress = 1;
      pixels = await draw();
      bandsOf(pixels).forEach((rgb, i) => expect(isNearColor(rgb, TO), `progress 1, band ${i}: to`).to.be.true);
    });

    it('threshold mode: a mask that draws nothing switches first, and the ends hold', async () => {
      const nothing = new StageMask(bandsStage('nothing', [undefined, undefined, undefined]));
      const t = transitionThrough(matte({mask: nothing, mode: 'threshold', softness: 0}));
      t.progress = 0;
      let pixels = await draw();
      bandsOf(pixels).forEach((rgb, i) => expect(isNearColor(rgb, FROM), `progress 0, band ${i}: from`).to.be.true);
      t.progress = 0.5;
      pixels = await draw();
      bandsOf(pixels).forEach((rgb, i) => expect(isNearColor(rgb, TO), `progress 0.5, band ${i}: to`).to.be.true);
    });

    it('threshold mode blends a pixel near its switching point by softness', async () => {
      const gradient = new StageMask(bandsStage('gradient', [undefined, ['#fff', 0.5], undefined]));
      const t = transitionThrough(matte({mask: gradient, mode: 'threshold', softness: 0.5}));
      t.progress = 0.5;
      const [, mixed] = bandsOf(await draw());
      expect(mixed[0], 'some of from is left').to.be.greaterThan(40);
      expect(mixed[1], 'some of to has come').to.be.greaterThan(40);
    });

    it('a matte inside a masked slot runs under the mask of the slot', async () => {
      const blue = makeFilledStage('blue', '#00f');
      const red = makeFilledStage('red', '#f00');
      const green = makeFilledStage('green', '#0f0');
      const fog = new StageMask(bandsStage('fog', [undefined, ['#fff', 1], ['#fff', 1]]));
      const everything = new StageMask(
        bandsStage('everything', [
          ['#fff', 1],
          ['#fff', 1],
          ['#fff', 1],
        ]),
      );
      director.setStack([blue.stage, red.stage]);
      director.setMask(red.stage, fog);
      const t = director.replace(red.stage, green.stage, {effect: matte({mask: everything}), manual: true});

      const BLUE = [0, 0, 255];
      t.progress = 0;
      let pixels = await draw();
      expect(isNearColor(rgbAt(pixels, SIZE, LEFT, 32), BLUE), 'progress 0: the fog hides the slot at the left').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, RIGHT, 32), FROM), 'progress 0: from where the fog covers').to.be.true;

      t.progress = 0.5;
      pixels = await draw();
      expect(isNearColor(rgbAt(pixels, SIZE, LEFT, 32), BLUE), 'progress 0.5: still hidden at the left').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, MIDDLE, 32), TO), 'progress 0.5: to inside the fog').to.be.true;

      t.complete();
      expect(director.maskOf(green.stage), 'the mask stays with the slot').to.equal(fog);
      pixels = await draw();
      expect(isNearColor(rgbAt(pixels, SIZE, LEFT, 32), BLUE), 'the end: hidden at the left').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, RIGHT, 32), TO), 'the end: to where the fog covers').to.be.true;
    });

    it("an effect of one's own reads input.mask(m).coverage(uv)", async () => {
      const mask = new StageMask(bandsStage('mask', [undefined, ['#fff', 0.5], ['#fff', 1]]));
      // reads the coverage alone, to tell the two sources apart by it: 1 shows from, 0 shows to
      const own = {
        name: 'own',
        masks: [mask],
        build: ({from, to, uv, mask: maskOf}) => mix(to.sample(uv), from.sample(uv), maskOf(mask).coverage(uv)),
      };
      transitionThrough(own);
      const [left, middle, right] = bandsOf(await draw());
      expect(isNearColor(left, TO), 'coverage 0: to').to.be.true;
      expect(isNearColor(middle, [srgb(0.5), srgb(0.5), 0], 3), 'coverage 0.5: half of both').to.be.true;
      expect(isNearColor(right, FROM), 'coverage 1: from').to.be.true;
    });
  });

  describe('a mask in the world of a stage', () => {
    const RED = [255, 0, 0];
    const BLUE = [0, 0, 255];

    /**
     * The world: a `Stage2D` of a fill projection (one unit per pixel, the camera at the origin),
     * sized by hand to the picture; and a scene of one white square of 16 units at the origin, which
     * the mask draws through the camera of the world. Blue below, red above, the mask on red.
     */
    function maskedByASquareInTheWorld() {
      const world = keep(new Stage2D(new OrthographicProjection('xy|bottom-left')));
      world.name = 'world';
      world.resize(SIZE, SIZE, 1);
      const scene = new Scene();
      const square = new Mesh(keep(new PlaneGeometry(16, 16)), keep(new MeshBasicMaterial({color: new Color('#fff')})));
      scene.add(square);
      const mask = StageMask.inWorldOf(world, scene, {source: 'alpha'});
      const blue = makeFilledStage('blue', '#00f');
      const red = makeFilledStage('red', '#f00');
      director.setStack([blue.stage, red.stage]);
      director.setMask(red.stage, mask);
      return {world, mask, red};
    }

    it('follows a moved camera: the masked area moves with the world', async () => {
      const {world} = maskedByASquareInTheWorld();

      let pixels = await draw();
      expect(isNearColor(rgbAt(pixels, SIZE, 32, 32), RED), 'the square in the middle: the slot shows').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, 16, 32), BLUE), 'beside it: the slot below').to.be.true;

      // the camera moves 16 units to the right: the square, a thing of the world, moves 16 pixels to the left
      world.camera.position.x += 16;
      pixels = await draw();
      expect(isNearColor(rgbAt(pixels, SIZE, 32, 32), BLUE), 'the middle is the slot below now').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, 16, 32), RED), 'the slot shows where the square has moved to').to.be.true;
    });

    it('follows a new projection: the next frame draws through the new camera', async () => {
      const {world} = maskedByASquareInTheWorld();
      let pixels = await draw();
      expect(isNearColor(rgbAt(pixels, SIZE, 20, 32), BLUE), 'one pixel per unit: the square is 16 pixels wide').to.be.true;

      const oldCamera = world.camera;
      // two pixels per unit: the same square covers 32 pixels
      world.projection = new OrthographicProjection('xy|bottom-left', {pixelZoom: 2});
      expect(world.camera, 'the projection built a camera of its own').not.to.equal(oldCamera);
      pixels = await draw();
      expect(isNearColor(rgbAt(pixels, SIZE, 20, 32), RED), 'the square has grown over x = 20').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, 12, 32), BLUE), 'and stops where 32 pixels end').to.be.true;
    });

    it('a disposed mask leaves its slot: the whole slot shows again', async () => {
      const {mask} = maskedByASquareInTheWorld();
      let pixels = await draw();
      expect(isNearColor(rgbAt(pixels, SIZE, 8, 32), BLUE), 'masked: the slot below at the left').to.be.true;

      mask.dispose();
      pixels = await draw();
      expect(isNearColor(rgbAt(pixels, SIZE, 8, 32), RED), 'the slot shows at the left').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, 32, 32), RED), 'and in the middle').to.be.true;
      expect(isNearColor(rgbAt(pixels, SIZE, 56, 32), RED), 'and at the right').to.be.true;
    });
  });

  describe('a mask at a share of the resolution', () => {
    // a white rectangle with hard edges at x = 16 and x = 48: on the grid of the half-size target too
    const EDGES = [16, 48];
    const RED = [255, 0, 0];
    const BLUE = [0, 0, 255];

    /** The picture of a red slot over a blue one, masked by `maskStage` at `scale`. */
    async function maskedAt(maskStage, scale) {
      const blue = makeFilledStage('blue', '#00f');
      const red = makeFilledStage('red', '#f00');
      director.setStack([blue.stage, red.stage]);
      director.setMask(red.stage, new StageMask(maskStage, {scale}));
      return draw();
    }

    const bar = (name) => makeFilledStage(name, '#fff', {rect: {x: 16, y: 0, width: 32, height: SIZE}});

    /** Every pixel farther from an edge than the texel of the coarser grid (2 pixels), compared at the tolerance of a filtered fetch. */
    function expectSameArea(half, full) {
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          if (EDGES.some((edge) => Math.abs(x - edge) <= 2)) continue;
          expect(isNearColor(rgbAt(half, SIZE, x, y), rgbAt(full, SIZE, x, y), 3), `pixel ${x}, ${y}`).to.be.true;
        }
      }
    }

    it('masks the same area as a mask at scale 1, within one texel of the coarser grid', async () => {
      const full = await maskedAt(bar('bar').stage, 1);
      expect(isNearColor(rgbAt(full, SIZE, 8, 32), BLUE), 'scale 1: outside').to.be.true;
      expect(isNearColor(rgbAt(full, SIZE, 32, 32), RED), 'scale 1: inside').to.be.true;

      // a fresh stack for the second mask: one stage has one scale, and this is another stage
      director.setStack([]);
      const half = await maskedAt(bar('bar at half').stage, 0.5);
      expectSameArea(half, full);
    });

    it('draws a line of one pixel at scale 1 and loses it at scale 0.5: the coarser grid is the one in use', async () => {
      // 1 pixel wide and between the centers of two texels of the half-size target (32.0 and 34.0)
      const line = (name) => makeFilledStage(name, '#fff', {rect: {x: 33.25, y: 0, width: 1, height: SIZE}});
      const full = await maskedAt(line('line').stage, 1);
      expect(isNearColor(rgbAt(full, SIZE, 33, 32), RED), 'scale 1: the line masks its pixel').to.be.true;

      director.setStack([]);
      const half = await maskedAt(line('line at half').stage, 0.5);
      expect(isNearColor(rgbAt(half, SIZE, 33, 32), BLUE), 'scale 0.5: no texel center lies on the line').to.be.true;
    });

    it("masks the same area through a caller's StageRenderer as the mask stage", async () => {
      const full = await maskedAt(bar('bar').stage, 1);

      director.setStack([]);
      const own = keep(new StageRenderer().setClearColor(new Color('#000'), 0).add(bar('bar of a renderer').stage));
      const half = await maskedAt(own, 0.5);
      expectSameArea(half, full);
    });
  });
});

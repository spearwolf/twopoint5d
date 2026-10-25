import {expect} from '@esm-bundle/chai';
import {Display, OrthographicProjection, ParallaxProjection, Stage2D} from '@spearwolf/twopoint5d';
import {Mesh, MeshBasicNodeMaterial, PlaneGeometry, RenderTarget} from 'three/webgpu';
import {disposeDisplay, makeColorTexture, makeContainer, renderToPixels} from './helpers/fixtures.js';

// The drawing buffer: 64 pixels wide, as the read-back needs (see rgbAt() in the fixtures), and an
// odd 63 high, so that a frustum centred on the projection plane puts the edges of the texels half
// a pixel off the edges of the pixels
const BUFFER_WIDTH = 64;
const BUFFER_HEIGHT = 63;

// a checkerboard of red and green, one texel per unit, 128 × 128 units around the origin of the
// XY plane — larger than every view of these tests
const CHECKER_SIZE = 128;

const RED = [255, 0, 0, 255];
const GREEN = [0, 255, 0, 255];

function makeChecker() {
  const texels = Array.from({length: CHECKER_SIZE * CHECKER_SIZE}, (_, i) =>
    ((i % CHECKER_SIZE) + Math.floor(i / CHECKER_SIZE)) % 2 ? GREEN : RED,
  );
  const texture = makeColorTexture(texels, CHECKER_SIZE, CHECKER_SIZE);
  const material = new MeshBasicNodeMaterial({map: texture});
  const mesh = new Mesh(new PlaneGeometry(CHECKER_SIZE, CHECKER_SIZE), material);
  return {mesh, material, texture};
}

/** The lengths of the runs of one color along a line of pixels, `[r, g, b]` each. */
function runLengths(line) {
  const runs = [];
  let run = 1;
  for (let i = 1; i < line.length; i++) {
    if (line[i][0] === line[i - 1][0] && line[i][1] === line[i - 1][1]) {
      run++;
    } else {
      runs.push(run);
      run = 1;
    }
  }
  runs.push(run);
  return runs;
}

/**
 * The lengths of the runs of every row and every column of the read-back buffer, the first and the
 * last run of each left out: the edge of the view may cut a texel short.
 */
function innerRuns(pixels) {
  const at = (x, y) => {
    const i = (y * BUFFER_WIDTH + x) * 4;
    return [pixels[i], pixels[i + 1], pixels[i + 2]];
  };
  const lines = [];
  for (let y = 0; y < BUFFER_HEIGHT; y++) lines.push(Array.from({length: BUFFER_WIDTH}, (_, x) => at(x, y)));
  for (let x = 0; x < BUFFER_WIDTH; x++) lines.push(Array.from({length: BUFFER_HEIGHT}, (_, y) => at(x, y)));
  return lines.flatMap((line) => runLengths(line).slice(1, -1));
}

describe('stage — pixelSnap: every texel covers the same whole number of buffer pixels', function () {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {RenderTarget | undefined} */
  let target;
  /** @type {ReturnType<typeof makeChecker> | undefined} */
  let checker;

  beforeEach(async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    target = new RenderTarget(BUFFER_WIDTH, BUFFER_HEIGHT);
    checker = makeChecker();
  });

  afterEach(() => {
    checker?.mesh.geometry.dispose();
    checker?.texture.dispose();
    checker?.material.dispose();
    checker = undefined;
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
   * Fits `projection` into a container of the CSS size that gives the drawing buffer of these tests
   * at `pixelRatio`, and reads back the checkerboard as its stage draws it.
   */
  async function render(projection, pixelRatio) {
    const stage = new Stage2D(projection);
    stage.scene.add(checker.mesh);
    stage.resize(BUFFER_WIDTH / pixelRatio, BUFFER_HEIGHT / pixelRatio, pixelRatio);
    try {
      return await renderToPixels(display.renderer, stage.scene, stage.camera, target);
    } finally {
      stage.scene.remove(checker.mesh);
      stage.dispose();
    }
  }

  // the contain fit zooms by 2.5 CSS pixels per unit: 2.5 buffer pixels at a ratio of 1, rounded
  // down to 2, and 5 at a ratio of 2
  const cases = [
    {pixelRatio: 1, zoom: 2},
    {pixelRatio: 2, zoom: 5},
  ];

  for (const {name, Projection} of [
    {name: 'OrthographicProjection', Projection: OrthographicProjection},
    {name: 'ParallaxProjection', Projection: ParallaxProjection},
  ]) {
    for (const {pixelRatio, zoom} of cases) {
      it(`${name} at a pixel ratio of ${pixelRatio}: ${zoom} pixels per texel, on every row and column`, async function () {
        const width = BUFFER_WIDTH / pixelRatio / 2.5;
        const pixels = await render(new Projection('xy|bottom-left', {fit: 'contain', width, pixelSnap: true}), pixelRatio);
        const runs = innerRuns(pixels);
        expect(runs.length, 'the checkerboard is drawn').to.be.greaterThan(BUFFER_WIDTH);
        expect(
          runs.filter((run) => run !== zoom),
          `runs other than ${zoom}`,
        ).to.deep.equal([]);
      });
    }

    it(`${name} without pixelSnap draws texels of uneven size at a zoom of 2.5`, async function () {
      const pixels = await render(new Projection('xy|bottom-left', {fit: 'contain', width: BUFFER_WIDTH / 2.5}), 1);
      expect(new Set(innerRuns(pixels)).size, 'more than one run length').to.be.greaterThan(1);
    });
  }
});

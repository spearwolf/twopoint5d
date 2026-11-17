import {expect} from 'chai';
import {CameraRig, Display, OrthographicProjection, ParallaxProjection, StageRenderer} from '@spearwolf/twopoint5d';
import {Color} from 'three/webgpu';
import {
  disposeDisplay,
  diffPixels,
  disposeKept,
  isNearColor,
  keep,
  makeContainer,
  makeFilledStage,
  pageScreenshot,
} from './helpers/fixtures.js';

// a square of 64 CSS pixels, one unit of the plane per pixel under the fill of the projections
const SIZE = 64;

const RED = [255, 0, 0];

describe('CameraRig — a lifted camera', () => {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {StageRenderer[]} */
  let renderers;

  beforeEach(async () => {
    host = makeContainer({width: SIZE, height: SIZE});
    display = new Display(host);
    await display.start();
    renderers = [];
  });

  afterEach(() => {
    // the renderers let go first, then the rigs, the stages and what they used, the display last
    for (const sr of renderers) sr.dispose();
    disposeKept();
    disposeDisplay(display);
    display = undefined;
    host?.remove();
    host = undefined;
  });

  /**
   * A stage with a red marker two units high across the plane, centred on the point the camera
   * looks at, and a rig on it; `projection` replaces the orthographic projection of the fixture.
   *
   * @param {import('@spearwolf/twopoint5d').IProjection} [projection]
   */
  function makeMarkerStage(projection) {
    const {stage} = makeFilledStage('marker', '#f00', {rect: {x: 0, y: SIZE / 2 - 1, width: SIZE, height: 2}, size: SIZE});
    if (projection) stage.projection = projection;
    const rig = keep(new CameraRig(stage));
    const sr = new StageRenderer(display).add(stage);
    // over black in every frame, so that a frame shows where the marker is and not where it was
    sr.clearColor = new Color('#000');
    renderers.push(sr);
    return {stage, rig};
  }

  /** The rows of the middle column of the canvas that show the marker, top down. */
  async function markerRows() {
    for (let i = 0; i < 4; i++) await display.nextFrame();
    const image = await pageScreenshot({x: 0, y: 0, width: SIZE, height: SIZE});
    const rows = [];
    for (let y = 0; y < SIZE; y++) {
      const i = (y * image.width + SIZE / 2) * 4;
      if (isNearColor([image.data[i], image.data[i + 1], image.data[i + 2]], RED, 6)) rows.push(y);
    }
    return rows;
  }

  for (const [name, projection] of /** @type {const} */ ([
    ['OrthographicProjection', () => undefined],
    ['ParallaxProjection', () => new ParallaxProjection('xy|bottom-left', {fit: 'fill'})],
  ])) {
    it(`moves the marker up by the share of the picture height under a ${name}`, async () => {
      const {rig} = makeMarkerStage(projection());

      expect(await markerRows(), 'at rest, in the middle').to.deep.equal([SIZE / 2 - 1, SIZE / 2]);

      // a quarter of 64 pixels: 16 rows up
      rig.reframe({lift: 0.25});
      expect(await markerRows(), 'lifted by a quarter').to.deep.equal([SIZE / 2 - 17, SIZE / 2 - 16]);

      rig.reframe({});
      expect(await markerRows(), 'back at rest').to.deep.equal([SIZE / 2 - 1, SIZE / 2]);
    });
  }
});

describe('CameraRig — a lens change', () => {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {StageRenderer[]} */
  let renderers;

  beforeEach(async () => {
    host = makeContainer({width: SIZE, height: SIZE});
    display = new Display(host);
    await display.start();
    renderers = [];
  });

  afterEach(() => {
    for (const sr of renderers) sr.dispose();
    disposeKept();
    disposeDisplay(display);
    display = undefined;
    host?.remove();
    host = undefined;
  });

  // how far the markers stand in front of and behind the plane, and the depth the move names
  const DEPTH = 32;

  const MARKERS = /** @type {const} */ ([
    // in front of the plane, up left: a parallax projection draws it larger and further out
    {name: 'red', color: '#f00', channel: 0, area: {x: 4, y: 48, width: 8, height: 8}, z: DEPTH},
    // behind the plane, down right: drawn smaller and further in
    {name: 'green', color: '#0f0', channel: 1, area: {x: 52, y: 8, width: 8, height: 8}, z: -DEPTH},
    // on the plane, in the middle: the dolly zoom keeps it where it is
    {name: 'blue', color: '#00f', channel: 2, area: {x: 28, y: 28, width: 8, height: 8}, z: 0},
  ]);

  /** A stage under a parallax projection, one unit of the plane per pixel, with the markers, and a rig on it. */
  function makeMarkerStage() {
    const {stage, fill} = makeFilledStage('lens change', undefined, {size: SIZE});
    for (const marker of MARKERS) fill(marker.color, 1, marker.area).position.z = marker.z;
    stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'fill'});
    const rig = keep(new CameraRig(stage));
    const sr = new StageRenderer(display).add(stage);
    sr.clearColor = new Color('#000');
    renderers.push(sr);
    return {stage, rig};
  }

  /** The picture on the screen once the frames have drawn what the rig stands at. */
  async function picture() {
    for (let i = 0; i < 4; i++) await display.nextFrame();
    return pageScreenshot({x: 0, y: 0, width: SIZE, height: SIZE});
  }

  /**
   * Where each marker stands in `image`: the centroid of its color channel, weighted by the value,
   * so that the coverage of an edge pixel counts by its share.
   *
   * @param {ImageData} image
   */
  function centroids(image) {
    return MARKERS.map(({name, channel}) => {
      let sum = 0;
      let x = 0;
      let y = 0;
      for (let py = 0; py < image.height; py++) {
        for (let px = 0; px < image.width; px++) {
          const value = image.data[(py * image.width + px) * 4 + channel];
          if (value < 16) continue;
          sum += value;
          x += (px + 0.5) * value;
          y += (py + 0.5) * value;
        }
      }
      expect(sum, `the ${name} marker is on the screen`).to.be.greaterThan(0);
      return {name, x: x / sum, y: y / sum};
    });
  }

  /** The largest distance, in pixels, between the markers of two pictures. */
  function shift(a, b) {
    const ca = centroids(a);
    const cb = centroids(b);
    return Math.max(...ca.map((m, i) => Math.hypot(m.x - cb[i].x, m.y - cb[i].y)));
  }

  it('moves from a parallax into an orthographic projection, swaps by less than a pixel and ends on the picture of the orthographic projection alone', async () => {
    const {stage, rig} = makeMarkerStage();
    const atRest = await picture();

    const ortho = new OrthographicProjection('xy|bottom-left', {fit: 'fill'});
    const moved = rig.moveTo(ortho, 1, {depth: DEPTH, easing: 'linear'});

    // the last frame of the perspective camera, then the frame of the swap
    rig.step(1 - 1e-6);
    const before = await picture();
    expect(stage.projection, 'not arrived yet').to.not.equal(ortho);

    rig.step(1);
    await moved;
    expect(stage.projection, 'arrived').to.equal(ortho);
    expect(rig.camera.type, 'swapped').to.equal('OrthographicCamera');
    const swapped = await picture();

    expect(shift(atRest, swapped), 'the markers off the plane moved through the change').to.be.greaterThan(1.5);
    expect(shift(before, swapped), 'the swap moves the markers by less than a pixel').to.be.lessThan(1);

    // the orthographic projection alone: the stage with its own camera, once the rig is gone
    rig.dispose();
    const alone = await picture();
    const {lit, differing} = diffPixels(swapped.data, alone.data);
    expect(lit, 'the markers are drawn').to.be.greaterThan(3 * 60);
    expect(differing, 'the end of the move is the picture of the orthographic projection').to.equal(0);
  });
});

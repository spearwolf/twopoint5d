import {expect} from 'chai';
import {
  CameraProjection,
  CameraRig,
  Display,
  OrthographicProjection,
  ParallaxProjection,
  Stage2D,
  StageDirector,
  StageRenderer,
  crossfade,
} from '@spearwolf/twopoint5d';
import {Color, Group, Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry} from 'three/webgpu';
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

describe('CameraProjection — the authored frame in the container', () => {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {StageRenderer[]} */
  let renderers;

  afterEach(() => {
    for (const sr of renderers) sr.dispose();
    disposeKept();
    disposeDisplay(display);
    display = undefined;
    host?.remove();
    host = undefined;
  });

  // the frame the source was authored for: 3:2, which the containers below hold in whole pixels
  const ASPECT = 1.5;
  const FOV = 50;
  // how far in front of the source the markers stand
  const DEPTH = 100;

  // a quarter of the frame in height and a half in width at each corner, its outer corner on the
  // corner of the frame: wide enough to reach into the picture where cover cuts the sides
  const MARKERS = /** @type {const} */ ([
    {name: 'red', color: '#f00', rgb: [255, 0, 0], right: false, top: true},
    {name: 'green', color: '#0f0', rgb: [0, 255, 0], right: true, top: true},
    {name: 'blue', color: '#00f', rgb: [0, 0, 255], right: false, top: false},
    {name: 'white', color: '#fff', rgb: [255, 255, 255], right: true, top: false},
  ]);

  /**
   * A display of `width` × `height`, and a stage that looks through a perspective source, turned and
   * moved off the origin, with the markers on the corners of its frame.
   *
   * @param {number} width
   * @param {number} height
   * @param {'contain' | 'cover'} fit
   */
  async function makeFrameStage(width, height, fit) {
    host = makeContainer({width, height});
    display = new Display(host);
    await display.start();
    renderers = [];

    const source = new PerspectiveCamera(FOV, ASPECT, 1, 1000);
    source.position.set(40, -25, 300);
    source.rotation.set(0.2, -0.35, 0.1);

    const stage = keep(new Stage2D(new CameraProjection(source, {fit})));
    // the markers in the space of the source
    const frame = new Group();
    frame.position.copy(source.position);
    frame.quaternion.copy(source.quaternion);
    stage.scene.add(frame);

    const halfHeight = DEPTH * Math.tan(((FOV / 2) * Math.PI) / 180);
    const halfWidth = halfHeight * ASPECT;
    for (const marker of MARKERS) {
      const material = keep(new MeshBasicMaterial({color: new Color(marker.color)}));
      const mesh = new Mesh(keep(new PlaneGeometry(halfWidth, halfHeight / 2)), material);
      mesh.position.set((marker.right ? 1 : -1) * (halfWidth / 2), (marker.top ? 1 : -1) * (halfHeight * 0.75), -DEPTH);
      frame.add(mesh);
    }

    const sr = new StageRenderer(display).add(stage);
    sr.clearColor = new Color('#000');
    renderers.push(sr);
  }

  /**
   * The box of the pixels each marker covers on the screen, `[left, top, right, bottom]` with the
   * right and the bottom edge exclusive.
   *
   * @param {number} width
   * @param {number} height
   */
  async function markerBoxes(width, height) {
    for (let i = 0; i < 4; i++) await display.nextFrame();
    const image = await pageScreenshot({x: 0, y: 0, width, height});
    return MARKERS.map(({rgb}) => {
      const box = [Infinity, Infinity, -Infinity, -Infinity];
      for (let y = 0; y < image.height; y++) {
        for (let x = 0; x < image.width; x++) {
          const i = (y * image.width + x) * 4;
          if (!isNearColor([image.data[i], image.data[i + 1], image.data[i + 2]], rgb, 6)) continue;
          box[0] = Math.min(box[0], x);
          box[1] = Math.min(box[1], y);
          box[2] = Math.max(box[2], x + 1);
          box[3] = Math.max(box[3], y + 1);
        }
      }
      return box;
    });
  }

  /**
   * Where the markers must be: the frame fitted into the container and centred, each marker clipped
   * to the container.
   *
   * @param {number} width
   * @param {number} height
   * @param {'contain' | 'cover'} fit
   */
  function expectedBoxes(width, height, fit) {
    const containerAspect = width / height;
    const keepsHeight = fit === 'contain' ? containerAspect >= ASPECT : containerAspect <= ASPECT;
    const frameHeight = keepsHeight ? height : width / ASPECT;
    const frameWidth = keepsHeight ? height * ASPECT : width;
    const left = (width - frameWidth) / 2;
    const top = (height - frameHeight) / 2;
    return MARKERS.map((marker) => {
      const x = marker.right ? left + frameWidth / 2 : left;
      const y = marker.top ? top : top + (frameHeight * 3) / 4;
      return [Math.max(x, 0), Math.max(y, 0), Math.min(x + frameWidth / 2, width), Math.min(y + frameHeight / 4, height)];
    });
  }

  for (const [shape, width, height] of /** @type {const} */ ([
    ['wider', 120, 60],
    ['narrower', 60, 120],
  ])) {
    for (const fit of /** @type {const} */ (['contain', 'cover'])) {
      it(`${fit} puts the markers on the corners of the frame in a container ${shape} than the frame`, async () => {
        await makeFrameStage(width, height, fit);
        const boxes = await markerBoxes(width, height);
        const expected = expectedBoxes(width, height, fit);
        for (const [i, marker] of MARKERS.entries()) {
          expect(boxes[i], `the ${marker.name} marker`).to.deep.equal(expected[i]);
        }
      });
    }
  }
});

describe('CameraRig.across() — a flight across a crossfade', () => {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;
  /** @type {StageDirector | undefined} */
  let director;

  beforeEach(async () => {
    host = makeContainer({width: SIZE, height: SIZE});
    display = new Display(host);
    await display.start();
  });

  afterEach(() => {
    director?.dispose();
    director = undefined;
    disposeKept();
    disposeDisplay(display);
    display = undefined;
    host?.remove();
    host = undefined;
  });

  // the red marker of `from` is centred on the screen at rest, the green one of `to` 12 pixels
  // right of the centre; the camera of `to` ends 16 units right of its rest, which puts the green
  // marker 4 pixels left of the centre. The two worlds share their coordinates: halfway the shared
  // viewpoint stands 8 units right, so the red marker shows 8 pixels left of the centre, the green
  // one 4 pixels right of it
  const MARKER = 8;
  const RED_AT = SIZE / 2;
  const GREEN_AT = SIZE / 2 + 12;
  const END = 16;

  /** A director on the display, over opaque black, showing `from`, and a manual crossfade to `to`. */
  function makeFlight() {
    const from = makeFilledStage('from', '#f00', {
      rect: {x: RED_AT - MARKER / 2, y: SIZE / 2 - MARKER / 2, width: MARKER, height: MARKER},
      size: SIZE,
    });
    const to = makeFilledStage('to', '#0f0', {
      rect: {x: GREEN_AT - MARKER / 2, y: SIZE / 2 - MARKER / 2, width: MARKER, height: MARKER},
      size: SIZE,
    });
    keep(new CameraRig(from.stage));
    keep(new CameraRig(to.stage));
    director = new StageDirector(display).setClearColor(new Color('#000'), 1);
    director.show(from.stage);
    const transition = director.replace(from.stage, to.stage, {effect: crossfade(), manual: true});
    const flight = CameraRig.across(transition, {to: {position: [END, 0]}});
    return {transition, flight};
  }

  /** The picture on the screen once the frames have drawn the progress. */
  async function picture() {
    for (let i = 0; i < 4; i++) await display.nextFrame();
    return pageScreenshot({x: 0, y: 0, width: SIZE, height: SIZE});
  }

  /**
   * The centroid of `channel` along x — weighted by its value, so that the coverage of an edge
   * pixel counts by its share —, and the sum of its values; the other channels must stay dark there.
   *
   * @param {ImageData} image
   * @param {number} channel
   */
  function marker(image, channel) {
    let sum = 0;
    let x = 0;
    for (let py = 0; py < image.height; py++) {
      for (let px = 0; px < image.width; px++) {
        const value = image.data[(py * image.width + px) * 4 + channel];
        if (value < 16) continue;
        sum += value;
        x += (px + 0.5) * value;
      }
    }
    return {sum, x: sum > 0 ? x / sum : Number.NaN};
  }

  it('shows the picture of from at progress 0, the one of to at 1, and halfway the markers of both where the shared viewpoint puts them', async () => {
    const {transition, flight} = makeFlight();

    transition.progress = 0;
    const atStart = await picture();
    const redAtStart = marker(atStart, 0);
    expect(marker(atStart, 1).sum, 'no green at the start').to.equal(0);
    expect(redAtStart.x, 'the red marker of from at rest').to.be.closeTo(RED_AT, 0.01);
    expect(redAtStart.sum, 'the red marker whole').to.be.closeTo(MARKER * MARKER * 255, MARKER * 4);

    transition.progress = 0.5;
    const halfway = await picture();
    expect(marker(halfway, 0).x, 'the red marker, seen from the shared viewpoint').to.be.closeTo(RED_AT - END / 2, 0.01);
    expect(marker(halfway, 1).x, 'the green marker, seen from the shared viewpoint').to.be.closeTo(GREEN_AT - END / 2, 0.01);
    expect(marker(halfway, 0).sum, 'the red marker half faded').to.be.lessThan(redAtStart.sum);

    transition.progress = 1;
    const atEnd = await picture();
    expect(marker(atEnd, 0).sum, 'no red at the end').to.equal(0);
    expect(marker(atEnd, 1).x, 'the green marker where the target of to puts it').to.be.closeTo(GREEN_AT - END, 0.01);

    // the end of the flight is the picture to shows on its own target
    transition.complete();
    await flight.finished;
    const after = await picture();
    const {lit, differing} = diffPixels(atEnd.data, after.data);
    expect(lit, 'the green marker is drawn').to.be.greaterThan(MARKER * MARKER - 1);
    expect(differing, 'the picture at progress 1 is the one to holds afterwards').to.equal(0);
  });
});

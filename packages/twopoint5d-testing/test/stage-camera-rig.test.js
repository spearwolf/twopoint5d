import {expect} from 'chai';
import {CameraRig, Display, ParallaxProjection, StageRenderer} from '@spearwolf/twopoint5d';
import {Color} from 'three/webgpu';
import {
  disposeDisplay,
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

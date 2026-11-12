import {Color, RenderPipeline, RenderTarget, type WebGPURenderer} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D} from './Stage2D.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths below
// measure a small fraction of a byte per call, the noise of a round spread over its calls
const BYTES_PER_CALL_LIMIT = 1;
const CALLS = 1000;

const bytesPerCall = async (round: () => void) => (await measureSettledBytes(round)) / CALLS;

/** A renderer as far as a post-processed stage reads and writes it, with nothing allocated in a call. */
const makeRenderer = (target: RenderTarget | null) => {
  const clearColor = new Color(0x336699);
  let clearAlpha = 0.5;
  return {
    toneMapping: 0,
    outputColorSpace: 'srgb',
    autoClear: false,
    autoClearColor: true,
    autoClearDepth: true,
    getRenderTarget: () => target,
    getOutputRenderTarget: () => null,
    getClearColor: (out: Color) => out.copy(clearColor),
    getClearAlpha: () => clearAlpha,
    setClearColor: (color: Color, alpha: number) => {
      clearColor.copy(color);
      clearAlpha = alpha;
    },
  } as unknown as WebGPURenderer;
};

const makeStage = () => {
  const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
  stage.resize(320, 200);
  stage.postProcess = {build: ({pass}) => pass};
  return stage;
};

describe('Stage2D with a post-process on the hot path', () => {
  // the draw of three.js' pipeline is not what is measured here: what the stage does around it is
  const withoutPipelineDraw = () => {
    let draws = 0;
    RenderPipeline.prototype.render = function () {
      draws++;
    };
    return () => draws;
  };

  const render = RenderPipeline.prototype.render;
  afterEach(() => {
    RenderPipeline.prototype.render = render;
  });

  test.each([
    ['onto the canvas', null],
    ['into a render target', new RenderTarget(4, 4)],
  ])('renderTo() %s allocates nothing', async (_name, target) => {
    const draws = withoutPipelineDraw();
    const stage = makeStage();
    const renderer = makeRenderer(target);
    stage.renderTo(renderer);

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) stage.renderTo(renderer);
    });

    expect(draws(), 'every call drew').toBeGreaterThan(CALLS);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('asPassNode() of a build that stands allocates nothing', async () => {
    const stage = makeStage();
    const renderer = makeRenderer(null);
    const node = stage.asPassNode(renderer);
    let same = true;

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) same = stage.asPassNode(renderer) === node && same;
    });

    expect(same).toBe(true);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });
});

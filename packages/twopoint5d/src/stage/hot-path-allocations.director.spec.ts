import {ACESFilmicToneMapping, Color, FloatType, RenderPipeline, SRGBColorSpace} from 'three/webgpu';
import {describe, expect, test} from 'vitest';
import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import {StageDirector} from './StageDirector.js';
import {StageMask} from './StageMask.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths below
// measure a small fraction of a byte per call, the noise of a round spread over its calls
const BYTES_PER_CALL_LIMIT = 1;
const CALLS = 1000;

const stage = (name: string): IStage & IRenderable => ({name, resize() {}, updateFrame() {}, renderTo() {}});

describe('StageDirector on the hot path', () => {
  test('updateFrame() with a running transition allocates nothing per call', async () => {
    const director = new StageDirector();
    director.resize(64, 64);
    const from = stage('from');
    const to = stage('to');
    director.setStack([stage('below'), from]);
    // long enough that no round reaches its end
    director.replace(from, to, {duration: 1e9, easing: 'ease-in-out'});
    // the first frame starts the transition and builds the order of the layers
    director.updateFrame(0, 0, 0);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) director.updateFrame(0, 1, 0);
    });
    const bytesPerCall = bytesPerRound / CALLS;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    director.dispose();
  });

  test('updateFrame() and renderTo() with a masked slot allocate nothing per call', async () => {
    // the parts of a WebGPURenderer the director touches, as plain functions: a mock records its calls
    let target: unknown = null;
    const clearColor = new Color(0x111111);
    const renderer = {
      autoClear: true,
      autoClearColor: true,
      autoClearDepth: true,
      autoClearStencil: true,
      samples: 0,
      toneMapping: ACESFilmicToneMapping,
      outputColorSpace: SRGBColorSpace,
      xr: {enabled: false},
      initialized: true,
      setClearColor() {},
      getClearColor: (out: Color) => out.copy(clearColor),
      setClearAlpha() {},
      getClearAlpha: () => 1,
      clear() {},
      render() {},
      setRenderTarget(rt: unknown) {
        target = rt;
      },
      getRenderTarget: () => target,
      getPixelRatio: () => 1,
      getOutputBufferType: () => FloatType,
    };
    // the pipeline would draw on the GPU
    const render = RenderPipeline.prototype.render;
    RenderPipeline.prototype.render = function () {};
    try {
      const director = new StageDirector();
      director.resize(64, 64);
      const level = stage('level');
      const fog = stage('fog');
      director.setStack([stage('below'), level]);
      director.setMask(level, new StageMask(fog));
      // the first frame builds the order of the layers; the first draw builds the shape
      director.updateFrame(0, 0, 0);
      director.renderTo(renderer as any);

      const bytesPerRound = await measureSettledBytes(() => {
        for (let i = 0; i < CALLS; i++) {
          director.updateFrame(0, 1, 0);
          director.renderTo(renderer as any);
        }
      });
      const bytesPerCall = bytesPerRound / CALLS;

      expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
      director.dispose();
    } finally {
      RenderPipeline.prototype.render = render;
    }
  });
});

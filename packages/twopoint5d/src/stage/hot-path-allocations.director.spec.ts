import {mix} from 'three/tsl';
import {ACESFilmicToneMapping, Color, FloatType, type Node, RenderPipeline, SRGBColorSpace} from 'three/webgpu';
import {describe, expect, test} from 'vitest';
import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import {StageDirector} from './StageDirector.js';
import {StageMask} from './StageMask.js';
import type {StageTransitionEffect} from './transitionEffects.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths below
// measure a small fraction of a byte per call, the noise of a round spread over its calls
const BYTES_PER_CALL_LIMIT = 1;
const CALLS = 1000;

const stage = (name: string): IStage & IRenderable => ({name, resize() {}, updateFrame() {}, renderTo() {}});

/** The parts of a WebGPURenderer the director touches, as plain functions: a mock records its calls. */
function plainRenderer() {
  let target: unknown = null;
  const clearColor = new Color(0x111111);
  return {
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
}

/** Measures `updateFrame()` and `renderTo()` of `director` per call, the pipeline kept off the GPU. */
async function bytesPerFrame(director: StageDirector): Promise<number> {
  const renderer = plainRenderer();
  const render = RenderPipeline.prototype.render;
  RenderPipeline.prototype.render = function () {};
  try {
    // the first frame builds the order of the layers; the first draw builds the shape
    director.updateFrame(0, 0, 0);
    director.renderTo(renderer as any);
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) {
        director.updateFrame(0, 1, 0);
        director.renderTo(renderer as any);
      }
    });
    return bytesPerRound / CALLS;
  } finally {
    RenderPipeline.prototype.render = render;
  }
}

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
    const director = new StageDirector();
    director.resize(64, 64);
    const level = stage('level');
    director.setStack([stage('below'), level]);
    director.setMask(level, new StageMask(stage('fog')));

    const bytesPerCall = await bytesPerFrame(director);

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    director.dispose();
  });

  test('a running transition whose effect names a mask allocates nothing', async () => {
    const director = new StageDirector();
    director.resize(64, 64);
    const from = stage('from');
    const ink = new StageMask(stage('ink'), {source: 'luminance'});
    const inkIn: StageTransitionEffect = {
      name: 'inkIn',
      masks: [ink],
      build: ({from, to, uv, mask}) => mix(from.sample(uv), to.sample(uv), mask(ink).coverage(uv)) as Node<'vec4'>,
    };
    director.setStack([stage('below'), from]);
    // long enough that no round reaches its end
    const t = director.replace(from, stage('to'), {effect: inkIn, manual: true});
    t.progress = 0.25;

    const bytesPerCall = await bytesPerFrame(director);

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    expect(director.transitions).toHaveLength(1);
    director.dispose();
  });

  test('a running matte allocates nothing', async () => {
    const director = new StageDirector();
    director.resize(64, 64);
    const from = stage('from');
    // a mask stage that reads the progress of its mask in every frame, as a living matte does
    let reads = 0;
    const inkStage: IStage & IRenderable = {
      ...stage('ink'),
      updateFrame() {
        if (ink.progress > 0) reads++;
      },
    };
    const ink = new StageMask(inkStage, {source: 'luminance'});
    const inkIn: StageTransitionEffect = {
      name: 'inkIn',
      masks: [ink],
      build: ({from, to, uv, mask}) =>
        mix(from.sample(uv), to.sample(uv), mask(ink).coverage(uv).mul(ink.progressNode)) as Node<'vec4'>,
    };
    director.setStack([stage('below'), from]);
    // a fixed progress: a uniform written with a changing double boxes it, 16 B per write
    const t = director.replace(from, stage('to'), {effect: inkIn, manual: true});
    t.progress = 0.25;

    const bytesPerCall = await bytesPerFrame(director);

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    expect(ink.progress).toBe(0.25);
    expect(ink.progressNode.value).toBe(0.25);
    expect(reads).toBeGreaterThan(0);
    director.dispose();
  });
});

import type {RenderTarget} from 'three/webgpu';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {createRendererMock, type FakeStage, fakeStage} from '../testing/stageFixtures.js';
import {RootRenderPipeline} from './RootRenderPipeline.js';
import {StageDirector} from './StageDirector.js';
import {crossfade, type StageTransitionEffect, type StageTransitionInput} from './transitionEffects.js';

/** A crossfade of its own, whose `build()` and `dispose()` are mocks. */
function spiedEffect(name: string) {
  const base = crossfade();
  return {
    name,
    build: vi.fn((input: StageTransitionInput) => base.build(input)),
    dispose: vi.fn(),
  } satisfies StageTransitionEffect;
}

type SpiedEffect = ReturnType<typeof spiedEffect>;

/** The node the first `build()` of `effect` answered. */
const nodeOf = (effect: SpiedEffect) => effect.build.mock.results[0]!.value;

describe('StageDirector shapes', () => {
  let renderer: ReturnType<typeof createRendererMock>;
  let director: StageDirector;
  let a: FakeStage;
  let b: FakeStage;
  let c: FakeStage;

  const frame = (deltaTime = 0.25) => director.updateFrame(0, deltaTime, 0);
  const draw = () => director.renderTo(renderer as any);

  /** The stage the stack holds, and the one the next replace() brings. */
  let current: FakeStage;
  let other: FakeStage;

  /** One transition through `effect` in the only slot, drawn once while it runs and once after its end. */
  const drawThrough = (effect: StageTransitionEffect) => {
    const t = director.replace(current, other, {effect, manual: true});
    draw();
    t.complete();
    draw();
    [current, other] = [other, current];
  };

  beforeEach(() => {
    renderer = createRendererMock();
    director = new StageDirector();
    director.resize(64, 64);
    a = fakeStage('a');
    b = fakeStage('b');
    c = fakeStage('c');
    current = a;
    other = b;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    if (!director.isDisposed) director.dispose();
  });

  it('a transition without an effect takes one shared crossfade, so that its shapes are the same', () => {
    director.setStack([a]);
    draw();
    const effects = new Set<StageTransitionEffect>();
    const pipelines = new Set([director.pipeline]);
    for (let i = 0; i < 5; i++) {
      const pushed = director.push(c, {duration: 0.2});
      effects.add(pushed.effect);
      draw();
      pipelines.add(director.pipeline);
      frame();
      frame();
      expect(pushed.state).toBe('finished');
      draw();
      pipelines.add(director.pipeline);

      const popped = director.pop({duration: 0.2});
      effects.add(popped.effect);
      draw();
      pipelines.add(director.pipeline);
      frame();
      frame();
      draw();
      pipelines.add(director.pipeline);
    }
    expect(effects.size).toBe(1);
    expect(Object.isFrozen([...effects][0])).toBe(true);
    // [layer], [layer, transition] and [layer, layer]
    expect(pipelines.size).toBe(3);
  });

  it('lets go of the shape it drew longest ago once it holds more than 16 it drew itself', () => {
    const effects = Array.from({length: 17}, (_, i) => spiedEffect(`effect ${i}`));
    director.setStack([a]);
    for (const effect of effects) drawThrough(effect);

    // 17 shapes of a transition and the one of the layer: the two drawn longest ago are gone
    expect(effects[0]!.dispose).toHaveBeenCalledTimes(1);
    expect(effects[0]!.dispose).toHaveBeenCalledWith(nodeOf(effects[0]!));
    expect(effects[1]!.dispose).toHaveBeenCalledTimes(1);
    expect(effects[1]!.dispose).toHaveBeenCalledWith(nodeOf(effects[1]!));
    expect(effects[2]!.dispose).not.toHaveBeenCalled();

    // a shape it let go of builds again
    director.replace(current, other, {effect: effects[0]!, manual: true});
    draw();
    expect(effects[0]!.build).toHaveBeenCalledTimes(2);
  });

  it('keeps a shape precompile() compiled, however many it draws after it', async () => {
    const pinned = spiedEffect('pinned');
    await director.precompile(renderer as any, [[pinned]]);
    director.setStack([a]);
    for (let i = 0; i < 20; i++) drawThrough(spiedEffect(`effect ${i}`));

    expect(pinned.dispose).not.toHaveBeenCalled();
    director.replace(current, other, {effect: pinned, manual: true});
    draw();
    expect(pinned.build).toHaveBeenCalledTimes(1);
  });

  it('builds its shapes again for another renderer and lets go of those of the first', () => {
    const second = createRendererMock();
    const cleared: unknown[] = [];
    second.clear.mockImplementation(() => {
      cleared.push(second.__renderTarget);
    });
    const pipelineDispose = vi.spyOn(RootRenderPipeline.prototype, 'dispose');
    const effect = spiedEffect('fadeIn');
    director.setStack([a]);
    director.replace(a, b, {effect, manual: true});
    draw();
    const first = director.pipeline;

    director.renderTo(second as any);
    expect(director.pipeline).toBeDefined();
    expect(director.pipeline).not.toBe(first);
    expect(pipelineDispose.mock.contexts).toContain(first);
    expect(effect.dispose).toHaveBeenCalledWith(nodeOf(effect));
    expect(effect.build).toHaveBeenCalledTimes(2);
    // the placeholders are made again, through the second renderer
    expect(second.getOutputBufferType).toHaveBeenCalled();
    expect(cleared.some((target) => (target as RenderTarget | null)?.width === 1)).toBe(true);
  });

  it('draws a frozen layer once for another renderer, which has no picture of it yet', () => {
    const second = createRendererMock();
    director.setStack([a]);
    director.freeze(a);
    draw();
    draw();
    expect(a.renderTo).toHaveBeenCalledTimes(1);
    director.renderTo(second as any);
    expect(a.renderTo).toHaveBeenCalledTimes(2);
    director.renderTo(second as any);
    expect(a.renderTo).toHaveBeenCalledTimes(2);
  });

  it('precompile() rejects with the error of a failed compile and those of the shapes it let go of', async () => {
    const disposeError = new Error('dispose failed');
    const compileError = new Error('compile failed');
    const first = spiedEffect('first');
    first.dispose.mockImplementation(() => {
      throw disposeError;
    });
    director.setStack([a]);
    director.replace(a, b, {effect: first, manual: true});
    draw();

    const second = createRendererMock();
    second.compileAsync.mockRejectedValueOnce(compileError);
    let thrown: unknown;
    try {
      await director.precompile(second as any, [[spiedEffect('other')]]);
    } catch (caught) {
      thrown = caught;
    }
    expect(thrown).toBeInstanceOf(AggregateError);
    expect((thrown as AggregateError).errors).toEqual([compileError, disposeError]);
  });

  it('dispose() goes on past an effect whose dispose() throws, and throws its error afterwards', () => {
    const error = new Error('dispose failed');
    const first = spiedEffect('first');
    first.dispose.mockImplementation(() => {
      throw error;
    });
    const second = spiedEffect('second');
    director.setStack([a]);
    director.replace(a, b, {effect: first, manual: true});
    draw();
    // ends the first transition and starts the second: two shapes, one of each effect
    director.replace(b, c, {effect: second, manual: true});
    draw();

    const pipelineDispose = vi.spyOn(RootRenderPipeline.prototype, 'dispose');
    let thrown: unknown;
    try {
      director.dispose();
    } catch (caught) {
      thrown = caught;
    }
    expect(thrown).toBe(error);
    expect(second.dispose).toHaveBeenCalledTimes(1);
    expect(pipelineDispose).toHaveBeenCalledTimes(2);
    expect(director.isDisposed).toBe(true);
  });
});

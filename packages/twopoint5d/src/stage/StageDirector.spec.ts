import {on} from '@spearwolf/eventize';
import {ACESFilmicToneMapping, Color, FloatType, NoToneMapping, RenderPipeline, RenderTarget, SRGBColorSpace} from 'three/webgpu';
import {beforeEach, describe, expect, it, type Mock, vi} from 'vitest';
import {OnStageTransitionEnd, OnStageTransitionStart, type StageTransitionProps} from '../events.js';
import {ClearStage} from './ClearStage.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import {StageDirector} from './StageDirector.js';
import {StageRenderer} from './StageRenderer.js';
import {crossfade, wipe} from './transitionEffects.js';

// the parts of a WebGPURenderer the director and its pipelines touch, as StageRenderer.spec.ts mocks them
function createRendererMock() {
  const m = {
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    autoClearStencil: true,
    __clearColor: new Color(0x111111),
    __clearAlpha: 1,
    __renderTarget: null as unknown,
    setClearColor: vi.fn(),
    getClearColor: vi.fn(),
    setClearAlpha: vi.fn(),
    getClearAlpha: vi.fn(),
    clear: vi.fn(),
    render: vi.fn(),
    setRenderTarget: vi.fn(),
    getRenderTarget: vi.fn(),
    getPixelRatio: vi.fn(() => 1),
    samples: 0,
    getOutputBufferType: vi.fn(() => FloatType),
    toneMapping: ACESFilmicToneMapping,
    outputColorSpace: SRGBColorSpace,
    xr: {enabled: false},
    initialized: true,
    init: vi.fn(async () => {}),
    compileAsync: vi.fn(async (_scene: unknown, _camera: unknown) => {}),
  };
  m.setRenderTarget.mockImplementation((rt) => {
    m.__renderTarget = rt;
  });
  m.getRenderTarget.mockImplementation(() => m.__renderTarget);
  m.setClearColor.mockImplementation((c: Color, a?: number) => {
    m.__clearColor.copy(c);
    if (typeof a === 'number') m.__clearAlpha = a;
  });
  m.getClearColor.mockImplementation((out: Color) => out.copy(m.__clearColor));
  m.setClearAlpha.mockImplementation((a: number) => {
    m.__clearAlpha = a;
  });
  m.getClearAlpha.mockImplementation(() => m.__clearAlpha);
  return m;
}

type FakeStage = IStage & IRenderable & {renderTo: Mock; resize: Mock; updateFrame: Mock};

function fakeStage(name: string): FakeStage {
  return {name, resize: vi.fn(), updateFrame: vi.fn(), renderTo: vi.fn()};
}

const names = (stages: ReadonlyArray<IStage>) => stages.map((s) => s.name);

describe('StageDirector', () => {
  let renderer: ReturnType<typeof createRendererMock>;
  let director: StageDirector;
  let a: FakeStage;
  let b: FakeStage;
  let c: FakeStage;

  const frame = (deltaTime = 0.25) => director.updateFrame(0, deltaTime, 0);
  const draw = () => director.renderTo(renderer as any);

  beforeEach(() => {
    renderer = createRendererMock();
    director = new StageDirector();
    director.resize(64, 64);
    a = fakeStage('a');
    b = fakeStage('b');
    c = fakeStage('c');
  });

  describe('the stack without transitions', () => {
    it('show() puts stages on top, or at a position', () => {
      director.show(a);
      director.show(b);
      director.show(c, {at: 1});
      expect(names(director.stack)).toEqual(['a', 'c', 'b']);
      expect(director.has(c)).toBe(true);
    });

    it('wraps a stage that is no StageRenderer in a renderer of its own, and takes a StageRenderer as it is', () => {
      const own = new StageRenderer();
      own.name = 'own';
      director.show(a);
      director.show(own);
      expect(director.stages).toHaveLength(2);
      expect(director.stages[0]!.stage).toBeInstanceOf(StageRenderer);
      expect(director.stages[0]!.stage).not.toBe(a);
      expect(director.stages[1]!.stage).toBe(own);
      expect(own.parent).toBe(director);
      // the size of the director reaches the stage through its wrapper
      expect(a.resize).toHaveBeenCalledWith(64, 64, 1);
    });

    it('hide(), replace(), push() and pop() change the stack at once', () => {
      director.setStack([a, b]);
      director.hide(a);
      expect(names(director.stack)).toEqual(['b']);
      director.replace(b, c);
      expect(names(director.stack)).toEqual(['c']);
      director.push(a);
      expect(names(director.stack)).toEqual(['c', 'a']);
      director.pop();
      expect(names(director.stack)).toEqual(['c']);
      expect(director.stages).toHaveLength(1);
    });

    it('answers a finished transition for a change without one', async () => {
      const t = director.show(a);
      expect(t.state).toBe('finished');
      expect(t.progress).toBe(1);
      expect(t.to).toBe(a);
      await expect(t.finished).resolves.toBe(t);
    });

    it('add() shows a stage on top, remove() takes it out', () => {
      const child = new StageRenderer(director);
      child.name = 'child';
      director.add(a);
      expect(names(director.stack)).toEqual(['child', 'a']);
      director.remove(child);
      expect(names(director.stack)).toEqual(['a']);
      expect(child.parent).toBeUndefined();
    });

    it('setStack() makes the stack and lets go of layers it leaves out', () => {
      director.setStack([a, b]);
      director.setStack([c, a]);
      expect(names(director.stack)).toEqual(['c', 'a']);
      expect(director.stages).toHaveLength(2);
    });

    it('a StageRenderer layer that is disposed leaves the stack', () => {
      const own = new StageRenderer();
      own.name = 'own';
      director.setStack([a, own]);
      own.dispose();
      expect(names(director.stack)).toEqual(['a']);
    });
  });

  describe('refusals', () => {
    it('refuses what does not fit the stack, before anything changes', () => {
      director.show(a);
      expect(() => director.show(a)).toThrow(
        'StageDirector#show() cannot take the stage "a": that stage is in the stack already',
      );
      expect(() => director.hide(b)).toThrow('StageDirector#hide() cannot hide the stage "b": that stage is not in the stack');
      expect(() => director.replace(b, c)).toThrow(
        'StageDirector#replace() cannot replace the stage "b": that stage is not in the stack',
      );
      expect(() => director.replace(a, a)).toThrow('that stage is in the stack already');
      expect(() => director.show(b, {at: 5})).toThrow(RangeError);
      expect(() => director.show(b, {duration: -1})).toThrow(
        'StageDirector#show(): duration must be a finite number of 0 or above, got -1',
      );
      expect(() => director.show(b, {easing: 'bounce' as any})).toThrow(/easing must be/);
      expect(() => director.show(new ClearStage())).toThrow(TypeError);
      expect(() => director.show(director)).toThrow('that stage is this director');
      expect(names(director.stack)).toEqual(['a']);
      director.setStack([]);
      expect(() => director.pop()).toThrow('StageDirector#pop() has nothing to pop: the stack is empty');
    });

    it('refuses a stage that holds the director, and a disposed stage', () => {
      const outer = new StageRenderer();
      const inner = new StageDirector(outer);
      expect(() => inner.show(outer)).toThrow('that stage holds this director');
      const gone = new StageRenderer();
      gone.dispose();
      expect(() => director.show(gone)).toThrow('that stage has been disposed');
    });

    it('owns pipeline, buildOutputNode and renderOrder', () => {
      expect(() => {
        director.pipeline = undefined;
      }).toThrow("StageDirector#pipeline is the director's own");
      expect(() => {
        director.buildOutputNode = undefined;
      }).toThrow("StageDirector#buildOutputNode is the director's own");
      expect(() => {
        director.renderOrder = 'a,b';
      }).toThrow("StageDirector#renderOrder is the director's own");
    });
  });

  describe('time', () => {
    it('starts in the first frame after the call, at progress 0, and ends when the duration is reached', async () => {
      director.show(a);
      const t = director.replace(a, b, {duration: 1, easing: 'linear'});
      expect(t.state).toBe('pending');
      expect(names(director.stack)).toEqual(['b']);
      expect(director.transitions).toEqual([t]);

      frame();
      expect(t.state).toBe('running');
      expect(t.progress).toBe(0);
      frame();
      expect(t.progress).toBe(0.25);
      frame();
      frame();
      expect(t.progress).toBe(0.75);
      frame();
      expect(t.state).toBe('finished');
      expect(t.progress).toBe(1);
      expect(director.transitions).toEqual([]);
      expect(director.stages).toHaveLength(1);
      await expect(t.finished).resolves.toBe(t);
    });

    it('waits for the delay before it starts', () => {
      director.show(a);
      const t = director.hide(a, {duration: 1, delay: 0.5});
      frame();
      frame();
      expect(t.state).toBe('pending');
      frame();
      expect(t.state).toBe('running');
      expect(t.elapsed).toBe(0);
    });

    it('eases the progress', () => {
      const t = director.show(a, {duration: 1, easing: (x) => x * x});
      frame();
      frame(0.5);
      expect(t.progress).toBe(0.25);
    });

    it('reverse() runs back and ends as cancelled at the start', async () => {
      director.show(a);
      const t = director.replace(a, b, {duration: 1, easing: 'linear'});
      frame();
      frame(0.5);
      t.reverse();
      frame(0.25);
      expect(t.progress).toBe(0.25);
      frame(0.25);
      expect(t.state).toBe('cancelled');
      expect(names(director.stack)).toEqual(['a']);
      await expect(t.finished).resolves.toBe(t);
    });

    it('reverse() before the first frame cancels', () => {
      director.show(a);
      const t = director.replace(a, b, {duration: 1});
      t.reverse();
      expect(t.state).toBe('cancelled');
      expect(names(director.stack)).toEqual(['a']);
    });

    it('cancel() leaves from, or to with "end"; complete() finishes', () => {
      director.setStack([a]);
      const first = director.replace(a, b, {duration: 1});
      first.cancel();
      expect(first.state).toBe('cancelled');
      expect(names(director.stack)).toEqual(['a']);

      const second = director.replace(a, b, {duration: 1});
      second.cancel('end');
      expect(second.state).toBe('cancelled');
      expect(names(director.stack)).toEqual(['b']);

      const third = director.replace(b, c, {duration: 1});
      third.complete();
      expect(third.state).toBe('finished');
      expect(names(director.stack)).toEqual(['c']);
      expect(director.stages).toHaveLength(1);
    });

    it('a second change of a busy slot finishes the running transition first', () => {
      director.setStack([a]);
      const first = director.replace(a, b, {duration: 1});
      frame();
      const second = director.replace(b, c, {duration: 1});
      expect(first.state).toBe('finished');
      expect(second.from).toBe(b);
      expect(names(director.stack)).toEqual(['c']);
    });

    it('showing a stage that is leaving finishes its transition first', () => {
      director.setStack([a]);
      const leaving = director.hide(a, {duration: 1});
      director.show(a);
      expect(leaving.state).toBe('finished');
      expect(names(director.stack)).toEqual(['a']);
    });

    it('a manual transition follows the progress it is given', () => {
      director.setStack([a]);
      const t = director.replace(a, b, {manual: true});
      frame();
      expect(t.state).toBe('running');
      t.progress = 0.4;
      frame(10);
      expect(t.progress).toBe(0.4);
      t.progress = 3;
      expect(t.progress).toBe(1);
      t.complete();
      expect(t.state).toBe('finished');
    });

    it('a transition that is not manual refuses a write of its progress', () => {
      const t = director.show(a, {duration: 1});
      expect(() => {
        t.progress = 0.5;
      }).toThrow('StageTransition#progress cannot be written');
    });

    it('a removed source ends its transition as cancelled, with the other source in the slot', () => {
      director.setStack([a]);
      const t = director.replace(a, b, {duration: 1});
      director.remove(a);
      expect(t.state).toBe('cancelled');
      expect(names(director.stack)).toEqual(['b']);
    });
  });

  describe('run and freeze', () => {
    it('updates the layers slot by slot, both sources of a transition', () => {
      director.setStack([a, b]);
      director.replace(b, c, {duration: 1});
      frame();
      expect(a.updateFrame).toHaveBeenCalledTimes(1);
      expect(b.updateFrame).toHaveBeenCalledTimes(1);
      expect(c.updateFrame).toHaveBeenCalledTimes(1);
      expect(director.orderedStages.map((item) => item.stage.name)).toEqual(['a', 'b', 'c']);
    });

    it('push() with below "freeze" stops the layer below until pop()', () => {
      director.setStack([a]);
      director.push(b, {below: 'freeze'});
      expect(director.isFrozen(a)).toBe(true);
      frame();
      expect(a.updateFrame).not.toHaveBeenCalled();
      expect(b.updateFrame).toHaveBeenCalledTimes(1);
      director.pop();
      expect(director.isFrozen(a)).toBe(false);
      frame();
      expect(a.updateFrame).toHaveBeenCalledTimes(1);
    });

    it('push() with below "freeze" while the same stage still leaves through a pop() freezes the layer below again', () => {
      const effect = crossfade();
      director.setStack([a]);
      director.push(b, {below: 'freeze', effect, duration: 0.25});
      director.transitions[0]!.complete();
      director.pop({effect, duration: 0.25});
      // b is on its way out, a runs again: pushed back at once, b comes back over a frozen a
      director.push(b, {below: 'freeze', effect, duration: 0.25});
      expect(names(director.stack)).toEqual(['a', 'b']);
      expect(director.isFrozen(a)).toBe(true);
      director.transitions[0]!.complete();
      expect(director.isFrozen(a)).toBe(true);
      director.pop();
      expect(director.isFrozen(a)).toBe(false);
    });

    it('push() with below "freeze" freezes the layer under a slot below that ends with nothing', () => {
      director.setStack([a, b]);
      director.hide(b, {duration: 1});
      director.push(c, {below: 'freeze'});
      expect(names(director.stack)).toEqual(['a', 'c']);
      expect(director.isFrozen(a)).toBe(true);
    });

    it('outgoing "freeze" freezes the layer that goes; incoming "freeze" the one that comes, until the end', () => {
      director.setStack([a]);
      const t = director.replace(a, b, {duration: 1, outgoing: 'freeze', incoming: 'freeze'});
      expect(director.isFrozen(a)).toBe(true);
      expect(director.isFrozen(b)).toBe(true);
      t.complete();
      expect(director.isFrozen(b)).toBe(false);
    });

    it('a frozen layer draws once, then keeps its picture until it is resized', () => {
      director.setStack([a]);
      director.freeze(a);
      draw();
      draw();
      expect(a.renderTo).toHaveBeenCalledTimes(1);
      director.resize(32, 32);
      draw();
      draw();
      expect(a.renderTo).toHaveBeenCalledTimes(2);
      director.run(a);
      draw();
      expect(a.renderTo).toHaveBeenCalledTimes(3);
    });
  });

  describe('the graph', () => {
    it('keeps one pipeline per shape of the stack and comes back to it', () => {
      director.setStack([a]);
      draw();
      const plain = director.pipeline;
      expect(plain).toBeDefined();

      const effect = crossfade();
      director.replace(a, b, {effect, duration: 1});
      draw();
      const fading = director.pipeline;
      expect(fading).not.toBe(plain);
      director.transitions[0]!.complete();
      draw();
      expect(director.pipeline).toBe(plain);

      // the same shape with other layers in it swaps textures, not the pipeline or its node
      plain!.needsUpdate = false;
      director.replace(b, c, {effect, duration: 1});
      draw();
      expect(director.pipeline).toBe(fading);
      const outputNode = fading!.outputNode;
      director.transitions[0]!.complete();
      draw();
      director.replace(c, a, {effect, duration: 1});
      draw();
      expect(fading!.outputNode).toBe(outputNode);
    });

    it('another effect makes another shape', () => {
      director.setStack([a]);
      director.replace(a, b, {effect: crossfade(), duration: 1});
      draw();
      const first = director.pipeline;
      director.transitions[0]!.complete();
      director.replace(b, c, {effect: wipe(), duration: 1});
      draw();
      expect(director.pipeline).not.toBe(first);
    });

    it('draws only its clear while the stack is empty', () => {
      director.setClearColor(new Color('#000'));
      draw();
      expect(renderer.clear).toHaveBeenCalled();
      expect(renderer.render).not.toHaveBeenCalled();
    });
  });

  describe('precompile()', () => {
    it('builds and compiles each shape once, on linear output into the target of the director', async () => {
      const target = new RenderTarget(64, 64);
      director.outputRenderTarget = target;
      const seen: unknown[] = [];
      renderer.compileAsync.mockImplementation(async () => {
        seen.push([renderer.__renderTarget, renderer.toneMapping, renderer.xr.enabled]);
      });
      const effect = crossfade();
      const render = renderer.render;
      await director.precompile(renderer as any, [['layer'], ['layer', effect], ['layer', effect]]);

      expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
      expect(seen).toEqual([
        [target, NoToneMapping, false],
        [target, NoToneMapping, false],
      ]);
      // the renderer is given back as it was
      expect(renderer.__renderTarget).toBe(null);
      expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
      expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
      expect(renderer.render).toBe(render);
      expect(render).not.toHaveBeenCalled();
      target.dispose();
    });

    it('leaves the first frame of a compiled shape nothing to build', async () => {
      const updateContext = vi.spyOn(RenderPipeline.prototype as any, '_updateContext');
      try {
        const effect = crossfade();
        await director.precompile(renderer as any, [['layer'], [effect]]);
        expect(updateContext).toHaveBeenCalledTimes(2);

        director.setStack([a]);
        draw();
        director.replace(a, b, {effect, duration: 1});
        draw();
        expect(updateContext).toHaveBeenCalledTimes(2);
        expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
      } finally {
        updateContext.mockRestore();
      }
    });

    it('skips a shape it has drawn already, and a disposed director compiles nothing', async () => {
      director.setStack([a]);
      draw();
      await director.precompile(renderer as any, [['layer']]);
      expect(renderer.compileAsync).not.toHaveBeenCalled();

      director.dispose();
      await director.precompile(renderer as any, [[crossfade()]]);
      expect(renderer.compileAsync).not.toHaveBeenCalled();
    });

    it('draws the stages of layers once, off screen, as it draws a layer', async () => {
      director.resize(64, 32, 2);
      director.setStack([a]);
      const seen: unknown[] = [];
      for (const stage of [a, b]) {
        stage.renderTo.mockImplementation(() => {
          const target = renderer.__renderTarget as RenderTarget;
          seen.push([stage.name, target.width, target.height, target.texture.type, renderer.toneMapping]);
        });
      }
      a.resize.mockClear();
      await director.precompile(renderer as any, [], {layers: [a, b]});

      expect(seen).toEqual([
        ['a', 128, 64, FloatType, NoToneMapping],
        ['b', 128, 64, FloatType, NoToneMapping],
      ]);
      // a stage that is no layer yet takes the size of the director; a layer has it already
      expect(b.resize).toHaveBeenCalledWith(64, 32, 2);
      expect(a.resize).not.toHaveBeenCalled();
      expect(renderer.__renderTarget).toBe(null);
      expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
      expect(renderer.compileAsync).not.toHaveBeenCalled();
    });

    it('compiles for a pass target on linear output inside a renderer that composes, or when told so', async () => {
      // the tone mapping each pipeline builds its output transform for
      const updateContext = vi.spyOn(RenderPipeline.prototype as any, '_updateContext');
      const targets: unknown[] = [];
      renderer.compileAsync.mockImplementation(async () => {
        targets.push(renderer.__renderTarget);
      });
      try {
        await director.precompile(renderer as any, [['layer']]);
        await director.precompile(renderer as any, [['layer', 'layer']], {nested: true});
        const outer = new StageDirector();
        outer.setStack([director]);
        await director.precompile(renderer as any, [[crossfade()]]);
        await director.precompile(renderer as any, [[crossfade()]], {nested: false});
        outer.dispose();
        expect(updateContext.mock.contexts.map((pipeline) => (pipeline as {_toneMapping: unknown})._toneMapping)).toEqual([
          ACESFilmicToneMapping,
          NoToneMapping,
          NoToneMapping,
          ACESFilmicToneMapping,
        ]);
      } finally {
        updateContext.mockRestore();
      }
      expect(targets[0]).toBe(null);
      expect((targets[1] as RenderTarget).isRenderTarget).toBe(true);
      expect((targets[2] as RenderTarget).texture.type).toBe(FloatType);
      expect(targets[3]).toBe(null);
    });

    it('refuses shapes it cannot take', async () => {
      const subject = 'StageDirector#precompile()';
      await expect(director.precompile(renderer as any, 'layer' as any)).rejects.toThrow(
        `${subject}: shapes must be an array of shapes, got "layer"`,
      );
      await expect(director.precompile(renderer as any, [[]])).rejects.toThrow(
        `${subject}: shapes[0] must be a non-empty array of 'layer' and StageTransitionEffect`,
      );
      await expect(director.precompile(renderer as any, [['layer', 'fade' as any]])).rejects.toThrow(
        `${subject}: shapes[0][1] must be 'layer' or a StageTransitionEffect, got "fade"`,
      );
      await expect(director.precompile(renderer as any, [], 'layers' as any)).rejects.toThrow(
        `${subject}: the options must be an object, got "layers"`,
      );
      await expect(director.precompile(renderer as any, [], {layers: a as any})).rejects.toThrow(
        `${subject}: layers must be an array of stages`,
      );
      await expect(director.precompile(renderer as any, [], {layers: [{} as any]})).rejects.toThrow(
        `${subject}: layers[0] must be a stage with renderTo()`,
      );
      await expect(director.precompile(renderer as any, [], {layers: [director]})).rejects.toThrow(
        `${subject}: layers[0] is this director`,
      );
      await expect(director.precompile(renderer as any, [], {nested: 1 as any})).rejects.toThrow(
        `${subject}: nested must be a boolean, got 1`,
      );
      expect(renderer.compileAsync).not.toHaveBeenCalled();
    });
  });

  describe('events', () => {
    it('emits OnStageTransitionStart in the first frame and OnStageTransitionEnd at the end', () => {
      const log: string[] = [];
      on(director, OnStageTransitionStart, ({transition}: StageTransitionProps) => log.push(`start ${transition.state}`));
      on(director, OnStageTransitionEnd, ({transition, director: d}: StageTransitionProps) => {
        expect(d).toBe(director);
        log.push(`end ${transition.state}`);
      });
      director.show(a, {duration: 0.5});
      expect(log).toEqual([]);
      frame();
      frame();
      frame();
      expect(log).toEqual(['start running', 'end finished']);
    });

    it('a change without a transition emits both at once', () => {
      const log: string[] = [];
      on(director, OnStageTransitionStart, () => log.push('start'));
      on(director, OnStageTransitionEnd, () => log.push('end'));
      director.show(a);
      expect(log).toEqual(['start', 'end']);
    });

    it('a listener that throws keeps neither the layers nor the change of the stack from happening', () => {
      on(director, OnStageTransitionEnd, () => {
        throw new Error('listener');
      });
      director.setStack([a]);
      director.replace(a, b, {duration: 0.25});
      frame();
      expect(() => frame()).toThrow('listener');
      expect(names(director.stack)).toEqual(['b']);
      expect(b.updateFrame).toHaveBeenCalledTimes(2);
    });
  });

  describe('dispose()', () => {
    it('ends every transition as cancelled and lets go of every layer', async () => {
      const own = new StageRenderer();
      director.setStack([a, own]);
      const t = director.replace(a, b, {duration: 1});
      director.dispose();
      expect(t.state).toBe('cancelled');
      await expect(t.finished).resolves.toBe(t);
      expect(director.stages).toHaveLength(0);
      expect(director.stack).toEqual([]);
      expect(own.parent).toBeUndefined();
      expect(own.isDisposed).toBe(false);
    });

    it('answers every change with a cancelled transition afterwards', () => {
      director.dispose();
      expect(director.show(a).state).toBe('cancelled');
      expect(director.stack).toEqual([]);
    });
  });
});

import {emit, eventize, getSubscriptionCount, on, once} from '@spearwolf/eventize';
import {ACESFilmicToneMapping, Color, FloatType, NoToneMapping, RenderPipeline, RenderTarget, SRGBColorSpace} from 'three/webgpu';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  OnAddToParent,
  OnStageAdded,
  OnStageAfterPostProcessChanged,
  OnStageRemoved,
  OnStageTransitionEnd,
  OnStageTransitionStart,
  type StageTransitionProps,
} from '../events.js';
import {createRendererMock, type FakeStage, fakeStage, names} from '../testing/stageFixtures.js';
import {ClearStage} from './ClearStage.js';
import {StageDirector} from './StageDirector.js';
import {StageMask} from './StageMask.js';
import {StageRenderer} from './StageRenderer.js';
import type {StageTransition} from './StageTransition.js';
import {crossfade, wipe} from './transitionEffects.js';

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
        'StageDirector#show(): duration must be a finite number of 0 or more, got -1',
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

    it('refuses a stage argument that is no object, with the call as its subject', () => {
      director.setStack([a]);
      expect(() => director.hide(undefined as any)).toThrow(
        new TypeError('StageDirector#hide(): stage must be a stage, got undefined'),
      );
      expect(() => director.replace(undefined as any, b)).toThrow(
        new TypeError('StageDirector#replace(): from must be a stage, got undefined'),
      );
      expect(() => director.setMask(null as any, undefined)).toThrow(
        new TypeError('StageDirector#setMask(): stage must be a stage, got null'),
      );
      expect(() => director.freeze(undefined as any)).toThrow(
        new TypeError('StageDirector#freeze(): stage must be a stage, got undefined'),
      );
      expect(() => director.run(7 as any)).toThrow(new TypeError('StageDirector#run(): stage must be a stage, got 7'));
      for (const call of [
        () => director.hide(undefined as any),
        () => director.replace(undefined as any, b),
        () => director.setMask(null as any, undefined),
        () => director.freeze(undefined as any),
        () => director.run(7 as any),
      ]) {
        expect(call).toThrow(TypeError);
      }
      expect(names(director.stack)).toEqual(['a']);
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

    it('a freeze() by hand of the stage a transition brings stays past its end', () => {
      director.setStack([a]);
      director.replace(a, b, {duration: 0.2});
      frame();
      director.freeze(b);
      frame();
      expect(director.transitions).toEqual([]);
      expect(director.isFrozen(b)).toBe(true);
    });

    it('a run() by hand of the stage a transition leaves stays when the transition is cancelled', () => {
      director.setStack([a]);
      director.freeze(a);
      const t = director.replace(a, b, {duration: 1});
      frame();
      director.run(a);
      t.cancel();
      expect(names(director.stack)).toEqual(['a']);
      expect(director.isFrozen(a)).toBe(false);
    });

    it('a freeze() by hand of the layer a push() froze below stays through pop()', () => {
      director.setStack([a]);
      director.push(b, {below: 'freeze'});
      director.freeze(a);
      director.pop();
      expect(director.isFrozen(a)).toBe(true);
    });

    it('a freeze() by hand of the layer a push() froze below stays through setStack()', () => {
      director.setStack([a]);
      director.push(b, {below: 'freeze'});
      director.freeze(a);
      director.setStack([a, b]);
      expect(director.isFrozen(a)).toBe(true);
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

    it('a frozen layer draws once more after its stage announced a new post-process, without an update', () => {
      const room = eventize(fakeStage('room'));
      director.setStack([room]);
      director.freeze(room);
      draw();
      draw();
      expect(room.renderTo).toHaveBeenCalledTimes(1);
      room.updateFrame.mockClear();

      emit(room, OnStageAfterPostProcessChanged, room, undefined);
      draw();
      draw();

      expect(room.renderTo).toHaveBeenCalledTimes(2);
      expect(room.updateFrame, 'still frozen').not.toHaveBeenCalled();
      expect(director.isFrozen(room)).toBe(true);
    });

    it('a frozen layer whose draw threw draws again with the next frame', () => {
      const room = eventize(fakeStage('room'));
      director.setStack([room]);
      director.freeze(room);
      draw();
      const boom = new Error('draw');
      room.renderTo.mockImplementationOnce(() => {
        throw boom;
      });
      emit(room, OnStageAfterPostProcessChanged, room, undefined);

      expect(draw).toThrow(boom);
      draw();
      draw();

      expect(room.renderTo, 'the first picture, the draw that threw, and the one after it').toHaveBeenCalledTimes(3);
    });

    it('a layer that left the stack no longer follows the post-process of its stage', () => {
      const room = eventize(fakeStage('room'));
      director.setStack([room]);
      draw();
      director.setStack([a]);

      expect(getSubscriptionCount(room)).toBe(0);
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
        `${subject}: shapes[0] must be a non-empty array of 'layer', StageTransitionEffect and {effect?, mask}`,
      );
      await expect(director.precompile(renderer as any, [['layer', 'fade' as any]])).rejects.toThrow(
        `${subject}: shapes[0][1] must be 'layer', a StageTransitionEffect or {effect?, mask}, got "fade"`,
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

  describe('running transitions under a change of the stack', () => {
    it('setStack() keeps the stage a running transition brings', () => {
      director.setStack([a]);
      director.replace(a, b, {effect: crossfade(), duration: 1});
      frame();
      director.setStack([b]);
      expect(names(director.stack)).toEqual(['b']);
      expect(director.has(b)).toBe(true);
      expect(director.stages).toHaveLength(1);
      expect(director.orderedStages).toHaveLength(1);
      b.updateFrame.mockClear();
      b.renderTo.mockClear();
      frame();
      expect(b.updateFrame).toHaveBeenCalledTimes(1);
      draw();
      expect(b.renderTo).toHaveBeenCalledTimes(1);
    });

    it('setStack() lets the stage a running transition brings frozen run again', () => {
      director.setStack([a]);
      director.replace(a, b, {duration: 1, incoming: 'freeze'});
      expect(director.isFrozen(b)).toBe(true);
      director.setStack([b]);
      expect(director.isFrozen(b)).toBe(false);
    });

    it('show() at a position puts a stage whose hide() runs there', () => {
      director.setStack([a, b]);
      director.hide(a, {effect: crossfade(), duration: 1});
      frame();
      director.show(a, {at: 0});
      expect(names(director.stack)).toEqual(['a', 'b']);
    });

    it('replace() refuses a ClearStage before it ends the running transition of the slot', () => {
      director.setStack([a]);
      const t = director.replace(a, b, {duration: 1});
      frame();
      let ends = 0;
      on(director, OnStageTransitionEnd, () => ends++);
      expect(() => director.replace(b, new ClearStage())).toThrow('a ClearStage clears nothing between layers');
      expect(director.transitions).toHaveLength(1);
      expect(t.state).toBe('running');
      expect(ends).toBe(0);
      expect(names(director.stack)).toEqual(['b']);
    });

    it("push() refuses a disposed stage before it ends the run below with below 'freeze'", () => {
      director.setStack([a]);
      const t = director.replace(a, b, {duration: 1});
      frame();
      const gone = new StageRenderer();
      gone.dispose();
      expect(() => director.push(gone, {below: 'freeze'})).toThrow('has been disposed');
      expect(t.state).toBe('running');
      expect(director.transitions).toEqual([t]);
    });

    it('push() shows the stage and freezes the one below when a listener of an end it causes throws', () => {
      const error = new Error('listener');
      director.setStack([a]);
      on(director, OnStageTransitionEnd, ({transition}: StageTransitionProps) => {
        if (transition.to === b) throw error;
      });
      director.replace(a, b, {duration: 1});
      frame();
      expect(() => director.push(c, {below: 'freeze'})).toThrow(error);
      expect(names(director.stack)).toEqual(['b', 'c']);
      expect(director.isFrozen(b)).toBe(true);
    });
  });

  describe('a listener that changes the stack', () => {
    const removeOnEnd = (stage: FakeStage) => {
      once(director, OnStageTransitionEnd, () => director.remove(stage));
    };

    it('hide() refuses a slot a listener of the end it causes took out', () => {
      director.setStack([a]);
      director.replace(a, b, {duration: 1});
      frame();
      removeOnEnd(b);
      expect(() => director.hide(b, {effect: crossfade(), duration: 0.2})).toThrow(
        'StageDirector#hide() cannot hide the stage "b": a listener of OnStageTransitionEnd changed its slot',
      );
      expect(director.transitions).toEqual([]);
    });

    it('replace() refuses a slot a listener of the end it causes took out, and lets nothing join', () => {
      director.setStack([a]);
      director.replace(a, b, {duration: 1});
      frame();
      removeOnEnd(b);
      expect(() => director.replace(b, c, {effect: crossfade(), duration: 0.2})).toThrow(
        'StageDirector#replace() cannot replace the stage "b": a listener of OnStageTransitionEnd changed its slot',
      );
      expect(director.has(c)).toBe(false);
      expect(director.stages).toHaveLength(0);
      expect(director.transitions).toEqual([]);
    });

    it('dispose() answers a change a listener asks for with a cancelled transition', async () => {
      director.setStack([a]);
      director.replace(a, b, {duration: 1});
      let handle: StageTransition | undefined;
      once(director, OnStageTransitionEnd, () => {
        handle = director.show(c, {effect: crossfade(), duration: 1});
      });
      director.dispose();
      expect(handle?.state).toBe('cancelled');
      await expect(handle!.finished).resolves.toBe(handle);
      expect(director.isDisposed).toBe(true);
    });

    it('push() answers a cancelled transition when a listener of an end it causes disposes the director', async () => {
      director.setStack([a]);
      director.replace(a, b, {duration: 1});
      frame();
      once(director, OnStageTransitionEnd, () => director.dispose());
      const t = director.push(c, {below: 'freeze', effect: crossfade(), duration: 0.2});
      expect(director.isDisposed).toBe(true);
      expect(t.state).toBe('cancelled');
      await expect(t.finished).resolves.toBe(t);
      expect(director.stack).toEqual([]);
      expect(director.transitions).toEqual([]);
      // the disposed director holds the stage as no layer: another one takes it as a mask
      const other = new StageDirector();
      other.setStack([a]);
      expect(() => other.setMask(a, new StageMask(c))).not.toThrow();
      other.dispose();
    });

    it('show() answers a cancelled transition when a listener of an end it causes disposes the director', async () => {
      director.setStack([a]);
      director.hide(a, {duration: 1});
      frame();
      once(director, OnStageTransitionEnd, () => director.dispose());
      const t = director.show(a, {effect: crossfade(), duration: 0.2});
      expect(director.isDisposed).toBe(true);
      expect(t.state).toBe('cancelled');
      await expect(t.finished).resolves.toBe(t);
      expect(director.stack).toEqual([]);
      expect(director.transitions).toEqual([]);
      const other = new StageDirector();
      other.setStack([b]);
      expect(() => other.setMask(b, new StageMask(a))).not.toThrow();
      other.dispose();
    });

    it('hide() and replace() answer a cancelled transition when a listener of an end they cause disposes the director', () => {
      for (const change of [
        () => director.hide(b, {effect: crossfade(), duration: 0.2}),
        () => director.replace(b, c, {effect: crossfade(), duration: 0.2}),
      ]) {
        director = new StageDirector();
        director.setStack([a]);
        director.replace(a, b, {duration: 1});
        frame();
        once(director, OnStageTransitionEnd, () => director.dispose());
        const t = change();
        expect(director.isDisposed).toBe(true);
        expect(t.state).toBe('cancelled');
        expect(director.transitions).toEqual([]);
      }
    });

    it('push() with `at` answers a cancelled transition when a listener of an end it causes disposes the director', async () => {
      // the end of a run with the pushed stage
      const x = fakeStage('x');
      director.setStack([a, x]);
      director.hide(x, {duration: 1});
      frame();
      once(director, OnStageTransitionEnd, () => director.dispose());
      const t = director.push(x, {at: 1, effect: crossfade(), duration: 0.2});
      expect(director.isDisposed).toBe(true);
      expect(t.state).toBe('cancelled');
      await expect(t.finished).resolves.toBe(t);
      expect(director.stack).toEqual([]);
      expect(director.transitions).toEqual([]);

      // the end of the run below, which `below: 'freeze'` ends
      const e = fakeStage('e');
      director = new StageDirector();
      director.setStack([a, b]);
      director.replace(b, c, {duration: 1});
      frame();
      once(director, OnStageTransitionEnd, () => director.dispose());
      const u = director.push(e, {at: 2, below: 'freeze', effect: crossfade(), duration: 0.2});
      expect(director.isDisposed).toBe(true);
      expect(u.state).toBe('cancelled');
      expect(director.stack).toEqual([]);
      expect(director.transitions).toEqual([]);
    });

    it('a listener of OnStageAdded that disposes the director makes every change answer as a disposed director', () => {
      let m = fakeStage('m');
      const changes: [string, () => StageTransition | StageDirector][] = [
        ['show() with a transition', () => director.show(c, {effect: crossfade(), duration: 0.2})],
        ['show() at once', () => director.show(c)],
        ['show() with a mask', () => director.show(c, {mask: new StageMask(m)})],
        ['show() with the masks of an effect', () => director.show(c, {effect: {...crossfade(), masks: [new StageMask(m)]}})],
        ['push()', () => director.push(c, {below: 'freeze', effect: crossfade(), duration: 0.2})],
        ['replace()', () => director.replace(a, c, {effect: crossfade(), duration: 0.2})],
        ['setStack()', () => director.setStack([a, c])],
        ['setMask()', () => director.setMask(a, new StageMask(m))],
        [
          'hide() with the masks of an effect',
          () => director.hide(a, {effect: {...crossfade(), masks: [new StageMask(m)]}, duration: 0.2}),
        ],
        [
          'pop() with the masks of an effect',
          () => director.pop({effect: {...crossfade(), masks: [new StageMask(m)]}, duration: 0.2}),
        ],
      ];
      for (const [name, change] of changes) {
        director = new StageDirector();
        director.resize(64, 64);
        c = fakeStage('c');
        m = fakeStage('m');
        director.setStack([a]);
        once(director, OnStageAdded, () => director.dispose());
        const result = change();
        expect(director.isDisposed, name).toBe(true);
        if (result !== director) expect((result as StageTransition).state, name).toBe('cancelled');
        expect(director.stack, name).toEqual([]);
        expect(director.transitions, name).toEqual([]);
        expect(director.stages, name).toHaveLength(0);
        // the disposed director holds neither stage: another one takes both as masks
        const other = new StageDirector();
        other.setStack([b]);
        expect(() => other.setMask(b, new StageMask(c)), name).not.toThrow();
        expect(() => other.setMask(b, new StageMask(m)), name).not.toThrow();
        other.dispose();
      }
    });

    it('show() with a mask and the masks of an effect answers a cancelled transition when a listener of the join of the mask disposes the director and a mask stage of the effect', () => {
      director.setStack([a]);
      const m = fakeStage('m');
      // a FakeStage has no dispose()
      const n = new StageRenderer();
      n.name = 'n';
      once(director, OnStageAdded, () => {
        director.dispose();
        n.dispose();
      });
      let t: StageTransition | undefined;
      expect(() => {
        t = director.show(c, {mask: new StageMask(m), effect: {...crossfade(), masks: [new StageMask(n)]}, duration: 0.2});
      }).not.toThrow();
      expect(t?.state).toBe('cancelled');
      expect(director.isDisposed).toBe(true);
      expect(director.stack).toEqual([]);
      expect(director.stages).toHaveLength(0);
    });

    it('a listener of OnAddToParent that disposes the director makes setMask() answer the director', () => {
      director.setStack([a]);
      const m = new StageRenderer();
      m.name = 'm';
      once(m, OnAddToParent, () => director.dispose());
      expect(director.setMask(a, new StageMask(m))).toBe(director);
      expect(director.isDisposed).toBe(true);
      expect(director.stack).toEqual([]);
      expect(m.parent).toBeUndefined();
      expect(m.isDisposed).toBe(false);
      const other = new StageDirector();
      other.setStack([b]);
      expect(() => other.setMask(b, new StageMask(m))).not.toThrow();
      other.dispose();
    });

    it('a listener of OnAddToParent that disposes the director makes show() answer a cancelled transition', () => {
      const child = new StageRenderer();
      child.name = 'child';
      director.setStack([a]);
      once(child, OnAddToParent, () => director.dispose());
      const t = director.show(child, {effect: crossfade(), duration: 0.2});
      expect(director.isDisposed).toBe(true);
      expect(t.state).toBe('cancelled');
      expect(director.stack).toEqual([]);
      expect(child.parent).toBeUndefined();
      expect(child.isDisposed).toBe(false);
      const other = new StageDirector();
      other.setStack([b]);
      expect(() => other.setMask(b, new StageMask(child))).not.toThrow();
      other.dispose();
    });

    it('the error of a listener of OnStageAdded that disposes the director comes out after the change', () => {
      director.setStack([a]);
      once(director, OnStageAdded, () => {
        director.dispose();
        throw new Error('added');
      });
      expect(() => director.show(c, {effect: crossfade(), duration: 0.2})).toThrow('added');
      expect(director.isDisposed).toBe(true);
      expect(director.stack).toEqual([]);
      const other = new StageDirector();
      other.setStack([b]);
      expect(() => other.setMask(b, new StageMask(c))).not.toThrow();
      other.dispose();
    });

    it('setStack() answers a change a listener asks for with a cancelled transition', () => {
      director.setStack([a]);
      director.replace(a, b, {duration: 1});
      let handle: StageTransition | undefined;
      once(director, OnStageTransitionEnd, () => {
        handle = director.show(c, {effect: crossfade(), duration: 1});
      });
      director.setStack([a]);
      expect(handle?.state).toBe('cancelled');
      expect(names(director.stack)).toEqual(['a']);
      expect(director.transitions).toEqual([]);
    });

    it('a change a listener asks for under the lock of setStack() refuses its invalid arguments', () => {
      director.setStack([a]);
      director.replace(a, b, {duration: 1});
      let caught: unknown;
      once(director, OnStageTransitionEnd, () => {
        try {
          director.show(c, {duration: -1});
        } catch (error) {
          caught = error;
        }
      });
      director.setStack([a]);
      expect(caught).toBeInstanceOf(RangeError);
      expect((caught as Error).message).toBe('StageDirector#show(): duration must be a finite number of 0 or more, got -1');
      expect(names(director.stack)).toEqual(['a']);
    });

    it('setStack() leaves out a stage a listener removed while it ended the transitions', () => {
      director.setStack([a]);
      director.show(b, {duration: 1});
      removeOnEnd(b);
      director.setStack([a, b]);
      expect(names(director.stack)).toEqual(['a']);
      expect(director.stages).toHaveLength(1);
    });

    it('a transition a listener starts in a later slot during a frame has its first frame with the next one', () => {
      const d = fakeStage('d');
      const e = fakeStage('e');
      director.setStack([a, b]);
      const first = director.replace(a, c, {duration: 0.25});
      director.replace(b, d, {duration: 1});
      let next: StageTransition | undefined;
      on(director, OnStageTransitionEnd, ({transition}: StageTransitionProps) => {
        if (transition === first) next = director.replace(d, e, {effect: crossfade(), duration: 1});
      });
      frame();
      frame();
      expect(first.state).toBe('finished');
      expect(next?.state).toBe('pending');
      frame();
      expect(next?.state).toBe('running');
    });

    it("push() with below 'freeze' freezes nothing when a listener of its change takes the stage out again", () => {
      director.setStack([b]);
      on(director, OnStageTransitionEnd, ({transition}: StageTransitionProps) => {
        if (transition.to === c) director.remove(c);
      });
      director.push(c, {below: 'freeze'});
      expect(names(director.stack)).toEqual(['b']);
      expect(director.isFrozen(b)).toBe(false);
    });

    it('pop() refused by a listener that changed the top slot leaves the layer below frozen', () => {
      director.setStack([a]);
      director.push(b, {below: 'freeze', duration: 1});
      on(director, OnStageTransitionEnd, ({transition}: StageTransitionProps) => {
        if (transition.from === undefined && transition.to === b) director.replace(b, c);
      });
      expect(() => director.pop({duration: 1})).toThrow(
        'StageDirector#pop() cannot hide the stage "b": a listener of OnStageTransitionEnd changed its slot',
      );
      expect(director.isFrozen(a)).toBe(true);
      expect(names(director.stack)).toEqual(['a', 'c']);
    });

    it('a listener of OnStageAdded that throws keeps the stage from neither the stack nor the order', () => {
      const error = new Error('added');
      on(director, OnStageAdded, () => {
        throw error;
      });
      expect(() => director.show(a)).toThrow(error);
      expect(names(director.stack)).toEqual(['a']);
      expect(director.orderedStages).toHaveLength(1);
    });

    it('a listener of OnStageRemoved that throws keeps hide() from neither the change nor its end', () => {
      director.setStack([a]);
      const error = new Error('removed');
      on(director, OnStageRemoved, () => {
        throw error;
      });
      const seen: string[] = [];
      on(director, OnStageTransitionEnd, ({transition}: StageTransitionProps) => seen.push(transition.state));
      expect(() => director.hide(a)).toThrow(error);
      expect(names(director.stack)).toEqual([]);
      expect(seen).toEqual(['finished']);
    });
  });

  describe('listeners and stages that call back into the director', () => {
    it('a listener of the end chains the next transition', async () => {
      const effect = crossfade();
      director.setStack([a]);
      let second: StageTransition | undefined;
      on(director, OnStageTransitionEnd, ({transition}: StageTransitionProps) => {
        if (transition.to === b) second = director.replace(b, c, {effect, duration: 0.25});
      });
      const first = director.replace(a, b, {effect, duration: 0.25});
      frame();
      frame();
      frame();
      frame();
      expect(names(director.stack)).toEqual(['c']);
      await expect(first.finished).resolves.toBe(first);
      await expect(second!.finished).resolves.toBe(second);
      expect(director.transitions).toEqual([]);
    });

    it('a listener of the start shows another stage, and the transition runs on', () => {
      director.setStack([a]);
      const t = director.replace(a, b, {duration: 1});
      on(director, OnStageTransitionStart, ({transition}: StageTransitionProps) => {
        if (transition === t) director.show(c);
      });
      frame();
      expect(names(director.stack)).toEqual(['b', 'c']);
      expect(t.state).toBe('running');
      expect(director.transitions).toEqual([t]);
    });

    it('a listener of the end disposes the director in its frame', () => {
      director.setStack([a]);
      director.replace(a, b, {duration: 0.25});
      on(director, OnStageTransitionEnd, () => director.dispose());
      frame();
      expect(() => frame()).not.toThrow();
      expect(director.isDisposed).toBe(true);
    });

    it('a stage that disposes the director in its updateFrame() ends the frame for the stages behind it', () => {
      const own = new StageRenderer();
      own.name = 'own';
      const ownUpdate = vi.spyOn(own, 'updateFrame');
      a.updateFrame.mockImplementation(() => director.dispose());
      director.setStack([a, b, own]);
      expect(() => frame()).not.toThrow();
      expect(director.isDisposed).toBe(true);
      expect(b.updateFrame).not.toHaveBeenCalled();
      expect(ownUpdate).not.toHaveBeenCalled();
    });

    it('a stage that shows another one in its updateFrame() updates it from the next frame on', () => {
      a.updateFrame.mockImplementationOnce(() => director.show(c));
      director.setStack([a]);
      frame();
      expect(names(director.stack)).toEqual(['a', 'c']);
      expect(c.updateFrame).not.toHaveBeenCalled();
      frame();
      expect(c.updateFrame).toHaveBeenCalledTimes(1);
    });
  });

  describe('precompile() on the way back', () => {
    it('gives the renderer back as it was when a compile fails, and the director draws on', async () => {
      renderer.compileAsync.mockRejectedValueOnce(new Error('compile failed'));
      const render = renderer.render;
      await expect(director.precompile(renderer as any, [['layer', crossfade()]])).rejects.toThrow('compile failed');
      expect(renderer.__renderTarget).toBe(null);
      expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
      expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
      expect(renderer.xr.enabled).toBe(false);
      expect(renderer.render).toBe(render);
      director.setStack([a]);
      expect(() => frame()).not.toThrow();
      expect(() => draw()).not.toThrow();
    });

    const holdCompile = () => {
      const held: {release: () => void; fail: (error: Error) => void} = {release: () => {}, fail: () => {}};
      renderer.compileAsync.mockImplementationOnce(
        () =>
          new Promise<void>((resolve, reject) => {
            held.release = resolve;
            held.fail = reject;
          }),
      );
      return held;
    };

    it('a second precompile() of a shape the first one still compiles resolves once that compile is through', async () => {
      const held = holdCompile();
      const effect = crossfade();
      const first = director.precompile(renderer as any, [['layer', effect]]);
      let through = false;
      const second = director.precompile(renderer as any, [['layer', effect]]).then(() => {
        through = true;
      });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(through).toBe(false);
      held.release();
      await first;
      await second;
      expect(through).toBe(true);
      expect(renderer.compileAsync).toHaveBeenCalledTimes(1);
    });

    it('a shape whose compile failed compiles again with the next precompile()', async () => {
      renderer.compileAsync.mockRejectedValueOnce(new Error('compile failed'));
      const effect = crossfade();
      await expect(director.precompile(renderer as any, [['layer', effect]])).rejects.toThrow('compile failed');
      await expect(director.precompile(renderer as any, [['layer', effect]])).resolves.toBeUndefined();
      expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
    });

    it('a precompile() that waits for a compile that fails rejects with its error', async () => {
      const held = holdCompile();
      const effect = crossfade();
      const first = director.precompile(renderer as any, [['layer', effect]]);
      const second = director.precompile(renderer as any, [['layer', effect]]);
      held.fail(new Error('compile failed'));
      await expect(first).rejects.toThrow('compile failed');
      await expect(second).rejects.toThrow('compile failed');
      await director.precompile(renderer as any, [['layer', effect]]);
      expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
    });

    it('a compile that fails after dispose() resolves the precompile() that started it and the one that waits for it', async () => {
      const held = holdCompile();
      const effect = crossfade();
      const first = director.precompile(renderer as any, [['layer', effect]]);
      const second = director.precompile(renderer as any, [['layer', effect]]);
      director.dispose();
      held.fail(new Error('compile failed'));
      await expect(first).resolves.toBeUndefined();
      await expect(second).resolves.toBeUndefined();
    });

    it('a shape the stack draws while its compile fails stays the shape of the stack', async () => {
      const held = holdCompile();
      const effect = crossfade();
      const done = director.precompile(renderer as any, [['layer', effect]]);
      director.setStack([a]);
      director.show(b, {effect, duration: 1});
      frame();
      draw();
      const pipeline = director.pipeline;
      held.fail(new Error('compile failed'));
      await expect(done).rejects.toThrow('compile failed');
      expect(() => draw()).not.toThrow();
      expect(director.pipeline).toBe(pipeline);
    });

    it('resolves when the director is disposed during a compile, and compiles nothing more', async () => {
      let release!: () => void;
      renderer.compileAsync.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      );
      const render = renderer.render;
      const done = director.precompile(renderer as any, [['layer'], ['layer', crossfade()]]);
      expect(renderer.compileAsync).toHaveBeenCalledTimes(1);
      director.dispose();
      release();
      await expect(done).resolves.toBeUndefined();
      expect(renderer.compileAsync).toHaveBeenCalledTimes(1);
      expect(renderer.__renderTarget).toBe(null);
      expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
      expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
      expect(renderer.xr.enabled).toBe(false);
      expect(renderer.render).toBe(render);
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

    it('refuses invalid arguments after dispose() as before, and answers valid ones as a disposed director', () => {
      director.setStack([a]);
      director.dispose();
      expect(() => director.show(b, {duration: -1})).toThrow(
        'StageDirector#show(): duration must be a finite number of 0 or more, got -1',
      );
      expect(() => director.show(b, {delay: Number.NaN})).toThrow(
        new RangeError('StageDirector#show(): delay must be a finite number of 0 or more, got NaN'),
      );
      expect(() => director.push(b, {below: 'still' as any})).toThrow(
        `StageDirector#push(): below must be 'run' or 'freeze', got "still"`,
      );
      expect(() => director.show(b, {at: -1})).toThrow(
        new RangeError('StageDirector#show(): at must be a whole number of 0 or more, got -1'),
      );
      expect(() => director.show(b, {mask: 'm' as any})).toThrow('StageDirector#show(): mask must be a StageMask, got "m"');
      expect(() => director.show(new ClearStage())).toThrow(TypeError);
      expect(() => director.hide(undefined as any)).toThrow('StageDirector#hide(): stage must be a stage, got undefined');
      expect(() => director.replace(a, b, {easing: 'bounce' as any})).toThrow(/StageDirector#replace\(\): easing must be/);
      expect(() => director.pop({effect: 5 as any})).toThrow(
        'StageDirector#pop(): effect must be a StageTransitionEffect, got 5',
      );
      expect(() => director.setStack('x' as any)).toThrow('StageDirector#setStack(): the stages must be an array, got "x"');
      expect(() => director.setMask(a, 'm' as any)).toThrow('StageDirector#setMask(): mask must be a StageMask, got "m"');
      expect(() => director.freeze(null as any)).toThrow('StageDirector#freeze(): stage must be a stage, got null');

      // an `at` past the empty stack is no refusal
      expect(director.show(b, {at: 3}).state).toBe('cancelled');
      expect(director.hide(a).state).toBe('cancelled');
      expect(director.setStack([a, b])).toBe(director);
      expect(director.freeze(a)).toBe(director);
      expect(director.stack).toEqual([]);
    });

    it('ignores a write to pipeline, buildOutputNode and renderOrder after dispose()', () => {
      director.dispose();
      expect(() => {
        director.pipeline = undefined;
      }).not.toThrow();
      expect(() => {
        director.buildOutputNode = undefined;
      }).not.toThrow();
      expect(() => {
        director.renderOrder = 'a,b';
      }).not.toThrow();
      expect(director.renderOrder).toBe('');
    });
  });
});

import {emit, eventize, on} from '@spearwolf/eventize';
import {mix} from 'three/tsl';
import {
  ACESFilmicToneMapping,
  Color,
  FloatType,
  type Node,
  PerspectiveCamera,
  RenderPipeline,
  type RenderTarget,
  Scene,
  SRGBColorSpace,
  type TextureNode,
} from 'three/webgpu';
import {beforeEach, describe, expect, it, type Mock, vi} from 'vitest';
import {OnStageAdded, OnStageDispose, OnStageRemoved, OnStageTransitionEnd} from '../events.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import {Stage2D} from './Stage2D.js';
import {StageDirector} from './StageDirector.js';
import {StageMask} from './StageMask.js';
import {StageRenderer} from './StageRenderer.js';
import {crossfade, matte, type StageTransitionEffect, type StageTransitionInput} from './transitionEffects.js';

// the parts of a WebGPURenderer the director and its pipelines touch, as StageDirector.spec.ts mocks them
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

/** The texture nodes a graph samples, each counted once: the base of every sample() of it. */
function textureNodesOf(node: Node): Set<TextureNode> {
  const found = new Set<TextureNode>();
  node.traverse((child) => {
    if ((child as Partial<TextureNode>).isTextureNode) found.add((child as TextureNode).getBase());
  });
  return found;
}

describe('StageDirector masks', () => {
  let renderer: ReturnType<typeof createRendererMock>;
  let director: StageDirector;
  let stars: FakeStage;
  let level: FakeStage;
  let nextLevel: FakeStage;
  let fogStage: FakeStage;
  let fog: StageMask;

  const frame = (deltaTime = 0.25) => director.updateFrame(0, deltaTime, 0);
  const draw = () => director.renderTo(renderer as any);
  const ordered = () => director.orderedStages.map((item) => item.stage.name);
  /** The renderer the director draws `stage` with: the stage itself, or the wrapper it made. */
  const rendererOf = (stage: IStage) =>
    director.orderedStages.find((item) => item.stage === stage || (item.stage as StageRenderer).stages?.[0]?.stage === stage)
      ?.stage as StageRenderer | undefined;

  /** What a refusal must leave as it was. */
  const snapshot = () => ({
    stack: names(director.stack),
    masks: director.stack.map((stage) => director.maskOf(stage)),
    ordered: ordered(),
  });

  beforeEach(() => {
    renderer = createRendererMock();
    director = new StageDirector();
    director.resize(64, 64);
    stars = fakeStage('stars');
    level = fakeStage('level');
    nextLevel = fakeStage('nextLevel');
    fogStage = fakeStage('fog');
    fog = new StageMask(fogStage);
  });

  describe('setMask() and maskOf()', () => {
    it('setMask() lands at once and maskOf() answers it', () => {
      director.setStack([stars, level]);
      expect(director.maskOf(level)).toBeUndefined();
      expect(director.setMask(level, fog)).toBe(director);
      expect(director.maskOf(level)).toBe(fog);
      expect(director.maskOf(stars)).toBeUndefined();
      expect(ordered()).toEqual(['stars', 'level', 'fog']);
      frame();
      expect(fogStage.updateFrame).toHaveBeenCalledTimes(1);
      draw();
      expect(fogStage.renderTo).toHaveBeenCalledTimes(1);
      // the size of the director reaches the mask stage through its wrapper
      expect(fogStage.resize).toHaveBeenCalledWith(64, 64, 1);
    });

    it('setMask(stage, undefined) unmasks', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      director.setMask(level, undefined);
      expect(director.maskOf(level)).toBeUndefined();
      expect(ordered()).toEqual(['stars', 'level']);
      expect(director.stages).toHaveLength(2);
      frame();
      expect(fogStage.updateFrame).not.toHaveBeenCalled();
    });

    it('a second setMask() on a slot puts the new mask in place of the old', () => {
      const vignetteStage = fakeStage('vignette');
      const vignette = new StageMask(vignetteStage);
      director.setStack([level]);
      director.setMask(level, fog);
      director.setMask(level, vignette);
      expect(director.maskOf(level)).toBe(vignette);
      expect(ordered()).toEqual(['level', 'vignette']);
      director.setMask(level, vignette);
      expect(ordered()).toEqual(['level', 'vignette']);
    });

    it('the slot keeps its mask through replace()', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      const t = director.replace(level, nextLevel, {duration: 1});
      expect(director.maskOf(nextLevel)).toBe(fog);
      expect(ordered()).toEqual(['stars', 'level', 'nextLevel', 'fog']);
      t.complete();
      expect(director.maskOf(nextLevel)).toBe(fog);
      expect(ordered()).toEqual(['stars', 'nextLevel', 'fog']);
      director.replace(nextLevel, level);
      expect(director.maskOf(level)).toBe(fog);
    });

    it('show() and push() take a mask from the first frame', () => {
      director.show(stars);
      director.show(level, {mask: fog, duration: 1});
      expect(director.maskOf(level)).toBe(fog);
      expect(ordered()).toEqual(['stars', 'level', 'fog']);

      const hudStage = fakeStage('hudMask');
      const hudMask = new StageMask(hudStage);
      director.push(nextLevel, {mask: hudMask, below: 'freeze'});
      expect(director.maskOf(nextLevel)).toBe(hudMask);
      expect(ordered()).toEqual(['stars', 'level', 'nextLevel', 'fog', 'hudMask']);
      frame();
      expect(fogStage.updateFrame).toHaveBeenCalledTimes(1);
      expect(hudStage.updateFrame).toHaveBeenCalledTimes(1);
    });

    it('a StageRenderer as the mask stage joins as it is', () => {
      const own = new StageRenderer();
      own.name = 'own';
      director.setStack([level]);
      director.setMask(level, new StageMask(own));
      expect(own.parent).toBe(director);
      expect(director.stages.map((item) => item.stage)).toContain(own);
      director.setMask(level, undefined);
      expect(own.parent).toBeUndefined();
      expect(own.isDisposed).toBe(false);
    });
  });

  describe('the order', () => {
    it('mask stages stand after the layers in orderedStages', () => {
      const vignetteStage = fakeStage('vignette');
      director.setStack([stars, level, nextLevel]);
      director.setMask(nextLevel, fog);
      director.setMask(stars, new StageMask(vignetteStage));
      director.setMask(level, new StageMask(fogStage, {invert: true}));
      // the slot masks bottom-up, each mask stage by its first appearance
      expect(ordered()).toEqual(['stars', 'level', 'nextLevel', 'vignette', 'fog']);
      const calls: string[] = [];
      for (const stage of [stars, level, nextLevel, fogStage, vignetteStage]) {
        stage.updateFrame.mockImplementation(() => calls.push(stage.name));
      }
      frame();
      expect(calls).toEqual(['stars', 'level', 'nextLevel', 'vignette', 'fog']);
    });

    it('one mask on two slots joins its stage once', () => {
      director.setStack([stars, level]);
      director.setMask(stars, fog);
      director.setMask(level, fog);
      expect(ordered()).toEqual(['stars', 'level', 'fog']);
      expect(director.stages).toHaveLength(3);
      frame();
      draw();
      expect(fogStage.updateFrame).toHaveBeenCalledTimes(1);
      expect(fogStage.renderTo).toHaveBeenCalledTimes(1);
      // the stage stays while one slot still uses it
      director.setMask(stars, undefined);
      expect(ordered()).toEqual(['stars', 'level', 'fog']);
    });

    it('two StageMask objects on one stage are one mask stage', () => {
      director.setStack([stars, level]);
      director.setMask(stars, new StageMask(fogStage, {invert: true}));
      director.setMask(level, fog);
      expect(ordered()).toEqual(['stars', 'level', 'fog']);
      expect(director.stages).toHaveLength(3);
    });
  });

  describe('refusals', () => {
    it('refuses a stage not in the stack', () => {
      director.setStack([stars]);
      const before = snapshot();
      expect(() => director.setMask(level, fog)).toThrow(
        'StageDirector#setMask() cannot mask the stage "level": that stage is not in the stack',
      );
      expect(snapshot()).toEqual(before);
    });

    it('refuses what is no StageMask', () => {
      director.setStack([level]);
      const before = snapshot();
      expect(() => director.setMask(level, fogStage as any)).toThrow(TypeError);
      expect(() => director.setMask(level, null as any)).toThrow('StageDirector#setMask(): mask must be a StageMask, got null');
      expect(() => director.show(stars, {mask: 'fog' as any})).toThrow(
        'StageDirector#show(): mask must be a StageMask, got "fog"',
      );
      expect(snapshot()).toEqual(before);
    });

    it('a stage is a layer or a mask, never both', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      const before = snapshot();

      // a layer as a mask
      expect(() => director.setMask(level, new StageMask(stars))).toThrow(
        'StageDirector#setMask() cannot take the mask on "stars": that stage is a layer of this director',
      );
      expect(() => director.setMask(level, new StageMask(level))).toThrow('that stage is a layer of this director');
      expect(() => director.show(nextLevel, {mask: new StageMask(nextLevel)})).toThrow(
        'StageDirector#show() cannot take the mask on "nextLevel": that stage is a layer of this director',
      );
      expect(() => director.push(nextLevel, {mask: new StageMask(stars)})).toThrow(
        'StageDirector#push() cannot take the mask on "stars": that stage is a layer of this director',
      );

      // a mask stage as a layer
      expect(() => director.show(fogStage)).toThrow(
        'StageDirector#show() cannot take the stage "fog": that stage is a mask of this director',
      );
      expect(() => director.push(fogStage)).toThrow(
        'StageDirector#push() cannot take the stage "fog": that stage is a mask of this director',
      );
      expect(() => director.replace(stars, fogStage)).toThrow(
        'StageDirector#replace() cannot take the stage "fog": that stage is a mask of this director',
      );
      expect(() => director.setStack([stars, fogStage])).toThrow(
        'StageDirector#setStack() cannot take the stage "fog": that stage is a mask of this director',
      );
      expect(() => director.add(fogStage)).toThrow('that stage is a mask of this director');
      expect(snapshot()).toEqual(before);
    });

    it('a mask stage as a layer leaves a running transition running', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      const t = director.replace(stars, nextLevel, {duration: 1});
      expect(() => director.replace(nextLevel, fogStage)).toThrow('that stage is a mask of this director');
      expect(t.state).toBe('pending');
      expect(director.transitions).toEqual([t]);
    });

    it('refuses the director or a stage that holds it as mask stage', () => {
      const outer = new StageRenderer();
      const inner = new StageDirector(outer);
      inner.setStack([level]);
      const before = names(inner.stack);
      expect(() => inner.setMask(level, new StageMask(inner))).toThrow(
        'StageDirector#setMask() cannot take the mask on "StageDirector": that stage is this director',
      );
      expect(() => inner.setMask(level, new StageMask(outer))).toThrow('that stage holds this director');
      expect(names(inner.stack)).toEqual(before);
      expect(inner.maskOf(level)).toBeUndefined();
      expect(inner.stages).toHaveLength(1);
      inner.dispose();
    });

    it('refuses a disposed mask', () => {
      director.setStack([level]);
      const before = snapshot();
      const gone = new StageMask(fakeStage('gone'));
      gone.dispose();
      expect(() => director.setMask(level, gone)).toThrow(
        'StageDirector#setMask() cannot take the mask on "gone": that mask has been disposed',
      );
      const own = new StageRenderer();
      own.name = 'own';
      const ownMask = new StageMask(own);
      own.dispose();
      expect(() => director.setMask(level, ownMask)).toThrow(
        'StageDirector#setMask() cannot take the mask on "own": that stage has been disposed',
      );
      expect(snapshot()).toEqual(before);
    });

    it('a second director refuses a mask stage the first draws', () => {
      const second = new StageDirector();
      second.resize(64, 64);
      director.setStack([level]);
      second.setStack([nextLevel]);
      director.setMask(level, fog);
      const before = {stack: names(second.stack), stages: second.stages.length};

      // a second StageMask object on the same stage
      expect(() => second.setMask(nextLevel, new StageMask(fogStage, {invert: true}))).toThrow(
        'StageDirector#setMask() cannot take the mask on "fog": that stage is a mask of another director',
      );
      expect(() => second.setMask(nextLevel, fog)).toThrow('that stage is a mask of another director');
      expect(() => second.show(stars, {mask: fog})).toThrow(
        'StageDirector#show() cannot take the mask on "fog": that stage is a mask of another director',
      );
      // a mask here is no layer there
      expect(() => second.show(fogStage)).toThrow(
        'StageDirector#show() cannot take the stage "fog": that stage is a mask of another director',
      );
      expect(() => second.setStack([fogStage])).toThrow('that stage is a mask of another director');
      expect({stack: names(second.stack), stages: second.stages.length}).toEqual(before);
      expect(second.maskOf(nextLevel)).toBeUndefined();

      // a layer there is no mask here
      expect(() => director.setMask(level, new StageMask(nextLevel))).toThrow(
        'StageDirector#setMask() cannot take the mask on "nextLevel": that stage is a layer of another director',
      );
      expect(director.maskOf(level)).toBe(fog);

      // once the first director lets go, the second takes it
      director.setMask(level, undefined);
      second.setMask(nextLevel, fog);
      expect(second.maskOf(nextLevel)).toBe(fog);
      second.dispose();
    });

    it('a stage may be a layer of two directors, but a mask stage of one is no layer of another', () => {
      const second = new StageDirector();
      second.resize(64, 64);
      director.setStack([level]);
      second.setStack([level]);
      expect(names(director.stack)).toEqual(['level']);
      expect(names(second.stack)).toEqual(['level']);

      director.setMask(level, fog);
      expect(() => second.show(fogStage)).toThrow(
        'StageDirector#show() cannot take the stage "fog": that stage is a mask of another director',
      );
      expect(names(second.stack)).toEqual(['level']);
      second.dispose();
    });

    it('show() with a mask whose stage refuses to join changes nothing', () => {
      const broken = fakeStage('broken');
      broken.resize.mockImplementation(() => {
        throw new Error('broken: no size');
      });
      director.setStack([stars, level]);
      const t = director.hide(level, {duration: 1});
      expect(() => director.show(level, {mask: new StageMask(broken)})).toThrow('broken: no size');
      // the hide() still runs: the mask stage joins before any run ends
      expect(t.state).toBe('pending');
      expect(director.transitions).toEqual([t]);
      expect(ordered()).toEqual(['stars', 'level']);
    });

    it('show() whose layer refuses to join takes the mask stage off again', () => {
      const broken = fakeStage('broken');
      broken.resize.mockImplementation(() => {
        throw new Error('broken: no size');
      });
      director.setStack([stars]);
      const before = snapshot();
      expect(() => director.show(broken, {mask: fog})).toThrow(new Error('broken: no size'));
      expect(snapshot()).toEqual(before);
      expect(director.stages).toHaveLength(1);
      expect(director.maskOf(broken)).toBeUndefined();
      // the registry let go of the mask stage, and its wrapper is gone
      const second = new StageDirector();
      second.setStack([stars]);
      expect(() => second.setMask(stars, fog)).not.toThrow();
      second.dispose();
    });

    it('show() whose layer refuses to join disposes the wrapper of the mask stage', () => {
      const broken = fakeStage('broken');
      broken.resize.mockImplementation(() => {
        throw new Error('broken: no size');
      });
      let made: StageRenderer | undefined;
      const original = StageRenderer.prototype.add;
      const spy = vi.spyOn(StageRenderer.prototype, 'add').mockImplementation(function (this: StageRenderer, stage) {
        if (stage === fogStage) made = this;
        return original.call(this, stage);
      });
      try {
        expect(() => director.show(broken, {mask: fog})).toThrow('broken: no size');
      } finally {
        spy.mockRestore();
      }
      expect(made).toBeDefined();
      expect(made!.isDisposed).toBe(true);
    });

    it('show() whose layer refuses to join keeps the original error beside a listener that threw on the way back', () => {
      const broken = fakeStage('broken');
      const refusal = new Error('broken: no size');
      const listener = new Error('listener: OnStageRemoved threw');
      broken.resize.mockImplementation(() => {
        throw refusal;
      });
      on(director, OnStageRemoved, () => {
        throw listener;
      });
      let thrown: unknown;
      try {
        director.show(broken, {mask: fog});
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(AggregateError);
      expect((thrown as AggregateError).errors).toEqual([refusal, listener]);
      expect(ordered()).toEqual([]);
    });

    it("a director's dispose() lets go of its mask stages for another director", () => {
      const second = new StageDirector();
      director.setStack([level]);
      director.setMask(level, fog);
      director.dispose();
      second.setStack([nextLevel]);
      second.setMask(nextLevel, fog);
      expect(second.maskOf(nextLevel)).toBe(fog);
      second.dispose();
    });

    it('a disposed director does nothing', () => {
      director.dispose();
      expect(director.setMask(level, fog)).toBe(director);
      expect(director.maskOf(level)).toBeUndefined();
    });
  });

  describe('a mask stage that leaves', () => {
    const wrapperDisposedWith = (leave: () => void) => {
      const wrapper = rendererOf(fogStage)!;
      expect(wrapper).toBeInstanceOf(StageRenderer);
      expect(wrapper.isDisposed).toBe(false);
      leave();
      expect(wrapper.isDisposed).toBe(true);
      expect(ordered()).not.toContain('fog');
      // the registry let go: another director takes the stage
      const second = new StageDirector();
      second.setStack([stars]);
      expect(() => second.setMask(stars, fog)).not.toThrow();
      second.dispose();
    };

    it('a mask stage leaves with the last slot it masks: hide() finished', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      const t = director.hide(level, {duration: 1});
      // the slot goes with its mask, not before
      expect(ordered()).toEqual(['stars', 'level', 'fog']);
      wrapperDisposedWith(() => t.complete());
      expect(names(director.stack)).toEqual(['stars']);
    });

    it('a mask stage leaves with the last slot it masks: pop()', () => {
      director.setStack([stars]);
      director.push(level, {mask: fog});
      wrapperDisposedWith(() => director.pop());
    });

    it('a mask stage leaves with the last slot it masks: setStack()', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      // setStack() drops every mask, of the stages that stay as well
      wrapperDisposedWith(() => director.setStack([stars, level]));
      expect(director.maskOf(level)).toBeUndefined();
      expect(director.stages).toHaveLength(2);
    });

    it('a mask stage leaves with the last slot it masks: remove(layer)', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      wrapperDisposedWith(() => director.remove(level));
      expect(names(director.stack)).toEqual(['stars']);
    });

    it('a mask stage stays while another slot uses it', () => {
      director.setStack([stars, level]);
      director.setMask(stars, fog);
      director.setMask(level, fog);
      director.hide(level);
      expect(ordered()).toEqual(['stars', 'fog']);
      expect(director.maskOf(stars)).toBe(fog);
    });

    it('remove(maskStage) takes the mask off every slot', () => {
      director.setStack([stars, level]);
      director.setMask(stars, fog);
      director.setMask(level, fog);
      wrapperDisposedWith(() => director.remove(fogStage));
      expect(director.maskOf(stars)).toBeUndefined();
      expect(director.maskOf(level)).toBeUndefined();
      expect(names(director.stack)).toEqual(['stars', 'level']);
      expect(fogStage.updateFrame).not.toHaveBeenCalled();
    });

    it('remove() of a stage that is neither layer nor mask changes nothing', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      const before = snapshot();
      director.remove(nextLevel);
      expect(snapshot()).toEqual(before);
    });

    it('a disposed mask stage leaves its slots', () => {
      const own = new StageRenderer();
      own.name = 'own';
      director.setStack([stars, level]);
      director.setMask(stars, new StageMask(own));
      director.setMask(level, new StageMask(own, {invert: true}));
      own.dispose();
      expect(director.maskOf(stars)).toBeUndefined();
      expect(director.maskOf(level)).toBeUndefined();
      expect(ordered()).toEqual(['stars', 'level']);

      // a stage the director wrapped
      const blobs = eventize(fakeStage('blobs'));
      director.setMask(level, new StageMask(blobs));
      const wrapper = rendererOf(blobs)!;
      emit(blobs, OnStageDispose, blobs);
      expect(director.maskOf(level)).toBeUndefined();
      expect(wrapper.isDisposed).toBe(true);
      expect(ordered()).toEqual(['stars', 'level']);
    });
  });

  describe('run and freeze', () => {
    it('freeze(maskStage) keeps its picture and run() lets it go on', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      expect(director.freeze(fogStage)).toBe(director);
      expect(director.isFrozen(fogStage)).toBe(true);
      expect(director.isFrozen(level)).toBe(false);
      frame();
      draw();
      // the first draw gives the frozen mask its picture
      expect(fogStage.updateFrame).not.toHaveBeenCalled();
      expect(fogStage.renderTo).toHaveBeenCalledTimes(1);
      frame();
      draw();
      draw();
      expect(fogStage.updateFrame).not.toHaveBeenCalled();
      expect(fogStage.renderTo).toHaveBeenCalledTimes(1);
      // the layers go on
      expect(level.updateFrame).toHaveBeenCalledTimes(2);
      expect(level.renderTo).toHaveBeenCalledTimes(3);

      expect(director.run(fogStage)).toBe(director);
      expect(director.isFrozen(fogStage)).toBe(false);
      frame();
      draw();
      expect(fogStage.updateFrame).toHaveBeenCalledTimes(1);
      expect(fogStage.renderTo).toHaveBeenCalledTimes(2);
    });

    it('a frozen mask draws once and again after a resize', () => {
      director.setStack([level]);
      director.setMask(level, fog);
      director.freeze(fogStage);
      draw();
      draw();
      expect(fogStage.renderTo).toHaveBeenCalledTimes(1);
      director.resize(128, 96);
      draw();
      draw();
      expect(fogStage.renderTo).toHaveBeenCalledTimes(2);
      expect(fogStage.resize).toHaveBeenLastCalledWith(128, 96, 1);
      // the same size again keeps the picture
      director.resize(128, 96);
      draw();
      expect(fogStage.renderTo).toHaveBeenCalledTimes(2);
    });

    it('freeze() of a mask stage that has not joined is refused', () => {
      director.setStack([stars, level]);
      expect(() => director.freeze(fogStage)).toThrow(
        'StageDirector#freeze() cannot find the stage "fog": that stage is no layer or mask of this director',
      );
      expect(() => director.run(fogStage)).toThrow(
        'StageDirector#run() cannot find the stage "fog": that stage is no layer or mask of this director',
      );
      expect(director.isFrozen(fogStage)).toBe(false);
    });

    it('a freeze does not survive the mask stage leaving', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      director.freeze(fogStage);
      director.setMask(level, undefined);
      expect(director.isFrozen(fogStage)).toBe(false);
      expect(() => director.freeze(fogStage)).toThrow('that stage is no layer or mask of this director');
      director.setMask(level, fog);
      frame();
      expect(fogStage.updateFrame).toHaveBeenCalledTimes(1);
    });
  });

  describe('the shape', () => {
    const outputNode = () => director.pipeline!.outputNode as Node;
    const texturesOf = () => [...textureNodesOf(outputNode())].map((node) => node.value);

    it('two masks with the same options on stages in the same pattern answer the same output node', () => {
      const blobsStage = fakeStage('blobs');
      director.setStack([stars, level]);
      director.setMask(level, fog);
      draw();
      const pipeline = director.pipeline;
      const node = outputNode();
      const before = texturesOf();
      expect(before).toHaveLength(3);

      director.setMask(level, new StageMask(blobsStage));
      draw();
      expect(director.pipeline).toBe(pipeline);
      expect(outputNode()).toBe(node);
      // the texture of the mask stage is swapped, nothing is built
      const after = texturesOf();
      expect(after).toHaveLength(3);
      expect(after.filter((texture) => !before.includes(texture))).toHaveLength(1);
    });

    it('one mask on two slots builds one texture node', () => {
      director.setStack([stars, level]);
      director.setMask(stars, fog);
      director.setMask(level, fog);
      draw();
      expect(textureNodesOf(outputNode()).size).toBe(3);
      const shared = director.pipeline;

      // a second StageMask object with the same options on the same stage is the same mask
      director.setMask(level, new StageMask(fogStage));
      draw();
      expect(director.pipeline).toBe(shared);

      // an inverted mask on the same stage samples the same texture node, in another shape
      director.setMask(level, new StageMask(fogStage, {invert: true}));
      draw();
      expect(director.pipeline).not.toBe(shared);
      expect(textureNodesOf(outputNode()).size).toBe(3);
    });

    it('a red and a green mask on one stage and on two stages are two shapes', () => {
      const otherStage = fakeStage('other');
      director.setStack([stars, level]);
      director.setMask(stars, new StageMask(fogStage, {source: 'red'}));
      director.setMask(level, new StageMask(fogStage, {source: 'green'}));
      draw();
      const oneStage = director.pipeline;
      expect(textureNodesOf(outputNode()).size).toBe(3);

      director.setMask(level, new StageMask(otherStage, {source: 'green'}));
      draw();
      expect(director.pipeline).not.toBe(oneStage);
      expect(textureNodesOf(outputNode()).size).toBe(4);
    });

    it('a masked slot and an unmasked one are two shapes, and a transition runs inside the mask', () => {
      director.setStack([stars, level]);
      draw();
      const plain = director.pipeline;
      director.setMask(level, fog);
      draw();
      const masked = director.pipeline;
      expect(masked).not.toBe(plain);

      const effect = crossfade();
      director.replace(level, nextLevel, {effect, duration: 1});
      draw();
      expect(director.pipeline).not.toBe(masked);
      // stars, from, to and the mask
      expect(textureNodesOf(outputNode()).size).toBe(4);
      director.transitions[0]!.complete();
      draw();
      expect(director.pipeline).toBe(masked);
    });

    it('precompile() takes a masked slot and a mask stage in layers', async () => {
      const updateContext = vi.spyOn(RenderPipeline.prototype as any, '_updateContext');
      try {
        const effect = crossfade();
        await director.precompile(
          renderer as any,
          [
            ['layer', {mask: fog}],
            ['layer', {effect, mask: fog}],
          ],
          {layers: [level, fogStage]},
        );
        expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
        expect(updateContext).toHaveBeenCalledTimes(2);
        expect(fogStage.renderTo).toHaveBeenCalledTimes(1);

        // another StageMask object on another stage, with the same options: the shapes are compiled
        const blobsStage = fakeStage('blobs');
        director.setStack([stars, level]);
        director.setMask(level, new StageMask(blobsStage));
        draw();
        director.replace(level, nextLevel, {effect, duration: 1});
        draw();
        expect(updateContext).toHaveBeenCalledTimes(2);
        expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
      } finally {
        updateContext.mockRestore();
      }
    });

    it('parseShapes refuses {mask: 3}', async () => {
      const subject = 'StageDirector#precompile()';
      await expect(director.precompile(renderer as any, [['layer', {mask: 3} as any]])).rejects.toThrow(
        `${subject}: shapes[0][1].mask must be a StageMask, got 3`,
      );
      await expect(director.precompile(renderer as any, [[{mask: fog, effect: 'fade'} as any]])).rejects.toThrow(
        `${subject}: shapes[0][0].effect must be a StageTransitionEffect, got "fade"`,
      );
      await expect(director.precompile(renderer as any, [['layer', {effect: crossfade()} as any]])).rejects.toThrow(
        `${subject}: shapes[0][1] must be 'layer', a StageTransitionEffect or {effect?, mask}, got {effect: `,
      );
      expect(renderer.compileAsync).not.toHaveBeenCalled();
    });
  });

  describe('masks of a transition effect', () => {
    let inkStage: FakeStage;
    let ink: StageMask;
    let inkIn: StageTransitionEffect;

    /** An effect that names `masks` and samples each of them; `use` builds its node instead. */
    const maskEffect = (
      name: string,
      masks: StageMask[],
      use?: (input: StageTransitionInput) => Node<'vec4'>,
    ): StageTransitionEffect => ({
      name,
      masks,
      build: (input) => {
        if (use) return use(input);
        let share = input.progress;
        for (const mask of masks) share = share.mul(input.mask(mask).coverage(input.uv));
        return mix(input.from.sample(input.uv), input.to.sample(input.uv), share) as Node<'vec4'>;
      },
    });

    beforeEach(() => {
      inkStage = fakeStage('ink');
      ink = new StageMask(inkStage, {source: 'luminance'});
      inkIn = maskEffect('inkIn', [ink]);
    });

    it('the mask stages of an effect join when its transition begins and leave when it ends', () => {
      director.setStack([stars, level]);
      const t = director.replace(level, nextLevel, {effect: inkIn, duration: 1});
      // after every layer, as the mask of a slot
      expect(ordered()).toEqual(['stars', 'level', 'nextLevel', 'ink']);
      frame();
      draw();
      expect(inkStage.updateFrame).toHaveBeenCalledTimes(1);
      expect(inkStage.renderTo).toHaveBeenCalledTimes(1);
      expect(inkStage.resize).toHaveBeenCalledWith(64, 64, 1);

      const wrapper = rendererOf(inkStage)!;
      t.complete();
      expect(ordered()).toEqual(['stars', 'nextLevel']);
      expect(wrapper.isDisposed).toBe(true);
      frame();
      expect(inkStage.updateFrame).toHaveBeenCalledTimes(1);
      // the registry let go: another director takes the stage
      const second = new StageDirector();
      second.setStack([stars]);
      expect(() => second.setMask(stars, ink)).not.toThrow();
      second.dispose();

      // a stage named twice by one effect joins once, and leaves with the transition
      const twice = maskEffect('twice', [ink, new StageMask(inkStage, {invert: true})]);
      const hidden = director.hide(nextLevel, {effect: twice, duration: 1});
      expect(ordered()).toEqual(['stars', 'nextLevel', 'ink']);
      expect(director.stages).toHaveLength(3);
      hidden.cancel();
      expect(ordered()).toEqual(['stars', 'nextLevel']);
      expect(director.stages).toHaveLength(2);

      // a change without a transition draws no mask
      director.replace(nextLevel, level, {effect: inkIn, duration: 0});
      expect(ordered()).toEqual(['stars', 'level']);
    });

    it('a mask stage shared by a slot and an effect stays while either uses it', () => {
      const fogIn = maskEffect('fogIn', [new StageMask(fogStage, {source: 'red'})]);
      director.setStack([stars, level]);
      director.setMask(stars, fog);
      const t = director.replace(level, nextLevel, {effect: fogIn, duration: 1});
      expect(ordered()).toEqual(['stars', 'level', 'nextLevel', 'fog']);
      expect(director.stages).toHaveLength(4);
      // the slot lets go of the mask, the transition still uses its stage
      director.setMask(stars, undefined);
      expect(ordered()).toEqual(['stars', 'level', 'nextLevel', 'fog']);
      t.complete();
      expect(ordered()).toEqual(['stars', 'nextLevel']);
    });

    it('a second transition on a busy mask is refused', () => {
      const other = fakeStage('other');
      director.setStack([stars, level]);
      const t = director.replace(level, nextLevel, {effect: inkIn, duration: 1});
      const before = snapshot();

      expect(() => director.replace(stars, other, {effect: inkIn, duration: 1})).toThrow(
        'StageDirector#replace(): the mask "ink" drives a transition already',
      );
      // another effect that names the same mask
      expect(() => director.hide(stars, {effect: maskEffect('inkOut', [ink]), duration: 1})).toThrow(
        'StageDirector#hide(): the mask "ink" drives a transition already',
      );
      expect(() => director.show(other, {effect: inkIn, duration: 1})).toThrow(
        'StageDirector#show(): the mask "ink" drives a transition already',
      );
      expect(() => director.push(other, {effect: inkIn, manual: true})).toThrow(
        'StageDirector#push(): the mask "ink" drives a transition already',
      );
      expect(snapshot()).toEqual(before);
      expect(t.state).toBe('pending');
      expect(director.transitions).toEqual([t]);

      // a change without a transition drives no mask
      expect(() => director.replace(stars, other, {effect: inkIn, duration: 0})).not.toThrow();

      // once the first transition is over, the mask is free
      t.complete();
      expect(() => director.replace(other, stars, {effect: inkIn, duration: 1})).not.toThrow();
    });

    it('pop() refuses a busy mask under its own name, before the layer below runs again', () => {
      const other = fakeStage('other');
      director.setStack([stars, level]);
      director.push(nextLevel, {below: 'freeze'});
      const t = director.replace(stars, other, {effect: inkIn, duration: 1});
      const before = snapshot();

      expect(() => director.pop({effect: maskEffect('inkOut', [ink]), duration: 1})).toThrow(
        'StageDirector#pop(): the mask "ink" drives a transition already',
      );
      expect(() => director.pop({duration: -1})).toThrow('StageDirector#pop(): duration must be');
      expect(snapshot()).toEqual(before);
      expect(director.isFrozen(level)).toBe(true);
      expect(director.transitions).toEqual([t]);

      // the pop() that goes through lets the layer below run again
      director.pop();
      expect(names(director.stack)).toEqual(['other', 'level']);
      expect(director.isFrozen(level)).toBe(false);
    });

    it('push() gives the uses of its effect masks back when a listener shrinks the stack below its `at`', () => {
      const leaving = fakeStage('leaving');
      director.setStack([stars, level, leaving]);
      director.hide(leaving, {duration: 1});
      on(director, OnStageTransitionEnd, () => director.remove(stars));

      // the run of the hidden stage ends first, and its listener takes a slot out of the stack
      expect(() => director.push(leaving, {at: 2, effect: inkIn, duration: 1})).toThrow(
        'StageDirector#push(): at must be a whole number from 0 to 1, got 2',
      );
      expect(ordered()).not.toContain('ink');
      // the mask stage is no mask of the director any more
      expect(() => director.show(inkStage)).not.toThrow();
    });

    it('replace() in the slot of a running matte reuses its mask', () => {
      const third = fakeStage('third');
      director.setStack([stars, level]);
      const first = director.replace(level, nextLevel, {effect: inkIn, duration: 1});
      frame();
      const wrapper = rendererOf(inkStage)!;

      // the run of its own slot ends first, so the mask is not busy
      const second = director.replace(nextLevel, third, {effect: inkIn, duration: 1});
      expect(first.state).toBe('finished');
      expect(second.state).toBe('pending');
      expect(rendererOf(inkStage)).toBe(wrapper);
      expect(wrapper.isDisposed).toBe(false);
      expect(ordered()).toEqual(['stars', 'nextLevel', 'third', 'ink']);

      // the mask drives the second transition now
      expect(() => director.replace(stars, level, {effect: inkIn, duration: 1})).toThrow(
        'StageDirector#replace(): the mask "ink" drives a transition already',
      );
      second.complete();
      expect(wrapper.isDisposed).toBe(true);
      expect(ordered()).toEqual(['stars', 'third']);
    });

    it("push() with below: 'freeze' refuses a mask driven by a run it does not end, before anything changes", () => {
      const pushed = fakeStage('pushed');
      director.setStack([stars, level]);
      const driving = director.replace(stars, nextLevel, {effect: inkIn, duration: 1});
      const below = director.replace(level, fakeStage('other'), {duration: 1});
      const before = snapshot();
      // push() ends the run directly below it, which ends in a layer: the driving run two slots below stays
      expect(() => director.push(pushed, {below: 'freeze', effect: maskEffect('inkOver', [ink]), duration: 1})).toThrow(
        'StageDirector#push(): the mask "ink" drives a transition already',
      );
      expect(snapshot()).toEqual(before);
      expect(driving.state).toBe('pending');
      expect(below.state).toBe('pending');
      expect(director.transitions).toEqual([driving, below]);
    });

    it("push() with below: 'freeze' reuses the mask of a run it ends further down", () => {
      const pushed = fakeStage('pushed');
      director.setStack([stars, level]);
      const driving = director.replace(stars, nextLevel, {effect: inkIn, duration: 1});
      // a run that ends with nothing takes its slot out, and the run below it ends as well
      const hidden = director.hide(level, {duration: 1});
      const wrapper = rendererOf(inkStage)!;
      const t = director.push(pushed, {below: 'freeze', effect: maskEffect('inkOver', [ink]), duration: 1});
      expect(hidden.state).toBe('finished');
      expect(driving.state).toBe('finished');
      expect(t.state).toBe('pending');
      // the mask stage stayed: not released and joined again
      expect(rendererOf(inkStage)).toBe(wrapper);
      expect(wrapper.isDisposed).toBe(false);
      expect(ordered()).toEqual(['nextLevel', 'pushed', 'ink']);
      expect(director.isFrozen(nextLevel)).toBe(true);
    });

    it('push() whose slot mask refuses to join gives back the uses of the effect masks', () => {
      const broken = fakeStage('broken');
      broken.resize.mockImplementation(() => {
        throw new Error('broken: no size');
      });
      director.setStack([stars, level]);
      const before = snapshot();
      expect(() => director.push(nextLevel, {mask: new StageMask(broken), effect: inkIn, duration: 1})).toThrow(
        'broken: no size',
      );
      expect(snapshot()).toEqual(before);
      expect(director.stages).toHaveLength(2);
      // the mask drives nothing and its stage left the director
      expect(() => director.replace(level, nextLevel, {effect: inkIn, duration: 1})).not.toThrow();
    });

    it('setStack() and dispose() free the masks of the transitions they end', () => {
      director.setStack([stars, level]);
      const t = director.replace(level, nextLevel, {effect: inkIn, duration: 1});
      const wrapper = rendererOf(inkStage)!;
      director.setStack([stars]);
      expect(t.state).toBe('cancelled');
      expect(wrapper.isDisposed).toBe(true);
      expect(ordered()).toEqual(['stars']);
      // the mask drives nothing any more
      const again = director.replace(stars, level, {effect: inkIn, duration: 1});
      expect(ordered()).toEqual(['stars', 'level', 'ink']);

      director.dispose();
      expect(again.state).toBe('cancelled');
      const second = new StageDirector();
      second.resize(64, 64);
      second.setStack([nextLevel]);
      expect(() => second.replace(nextLevel, level, {effect: inkIn, duration: 1})).not.toThrow();
      expect(second.orderedStages).toHaveLength(3);
      second.dispose();
    });

    it('show() of a stage whose run the call ends reuses the mask of that run', () => {
      director.setStack([stars, level]);
      const hidden = director.hide(level, {effect: inkIn, duration: 1});
      // show() finishes the hide() of the stage first
      const shown = director.show(level, {effect: inkIn, duration: 1});
      expect(hidden.state).toBe('finished');
      expect(shown.state).toBe('pending');
      expect(ordered()).toEqual(['stars', 'level', 'ink']);
    });

    it('refuses the masks of an effect it cannot take, before anything changes', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      const before = snapshot();
      const replaceWith = (effect: StageTransitionEffect) => () => director.replace(level, nextLevel, {effect, duration: 1});

      const gone = new StageMask(fakeStage('gone'));
      gone.dispose();
      expect(replaceWith(maskEffect('goneIn', [gone]))).toThrow(
        'StageDirector#replace() cannot take the mask on "gone": that mask has been disposed',
      );
      expect(replaceWith(maskEffect('starsIn', [new StageMask(stars)]))).toThrow(
        'StageDirector#replace() cannot take the mask on "stars": that stage is a layer of this director',
      );
      expect(replaceWith(maskEffect('nextIn', [new StageMask(nextLevel)]))).toThrow(
        'StageDirector#replace() cannot take the mask on "nextLevel": that stage is a layer of this director',
      );
      expect(replaceWith({name: 'odd', masks: [inkStage as any], build: crossfade().build})).toThrow(
        'StageDirector#replace(): the masks of the effect "odd" must be an array of StageMask, got [',
      );
      expect(replaceWith({name: 'odd', masks: 'ink' as any, build: crossfade().build})).toThrow(
        'StageDirector#replace(): the masks of the effect "odd" must be an array of StageMask, got "ink"',
      );

      const second = new StageDirector();
      second.resize(64, 64);
      second.setStack([nextLevel]);
      second.setMask(nextLevel, ink);
      expect(replaceWith(inkIn)).toThrow(
        'StageDirector#replace() cannot take the mask on "ink": that stage is a mask of another director',
      );
      second.dispose();

      expect(snapshot()).toEqual(before);
      expect(director.transitions).toEqual([]);
    });

    it('a disposed mask stage ends the transition that names it as cancelled', () => {
      director.setStack([stars, level]);

      // a stage the director wrapped
      const blobs = eventize(fakeStage('blobs'));
      const t = director.replace(level, nextLevel, {effect: maskEffect('blobsIn', [new StageMask(blobs)]), duration: 1});
      const wrapper = rendererOf(blobs)!;
      emit(blobs, OnStageDispose, blobs);
      expect(t.state).toBe('cancelled');
      expect(names(director.stack)).toEqual(['stars', 'level']);
      expect(wrapper.isDisposed).toBe(true);
      expect(ordered()).toEqual(['stars', 'level']);

      // a StageRenderer as the mask stage
      const own = new StageRenderer();
      own.name = 'own';
      const t2 = director.replace(level, nextLevel, {effect: maskEffect('ownIn', [new StageMask(own)]), duration: 1});
      own.dispose();
      expect(t2.state).toBe('cancelled');
      expect(names(director.stack)).toEqual(['stars', 'level']);
      expect(ordered()).toEqual(['stars', 'level']);

      // remove() of the mask stage, which a slot mask uses as well
      director.setMask(stars, fog);
      const t3 = director.replace(level, nextLevel, {effect: maskEffect('fogIn', [fog]), duration: 1});
      director.remove(fogStage);
      expect(t3.state).toBe('cancelled');
      expect(director.maskOf(stars)).toBeUndefined();
      expect(names(director.stack)).toEqual(['stars', 'level']);
      expect(ordered()).toEqual(['stars', 'level']);
      expect(director.stages).toHaveLength(2);
    });

    describe('the shape', () => {
      const outputNode = () => director.pipeline!.outputNode as Node;
      let pictureOf: Map<IStage, unknown>;
      /** The stages whose pictures the texture nodes of `node` sample, sorted. */
      const sampled = (node: Node) =>
        [...textureNodesOf(node)]
          .map((textureNode) => [...pictureOf].find(([, picture]) => picture === textureNode.value)?.[0].name ?? 'placeholder')
          .sort();

      let effectNode: Node | undefined;
      /** An effect that names `masks`, samples the first of them and keeps the node it built. */
      const capture = (masks: StageMask[]) =>
        maskEffect('capture', masks, (input) => {
          effectNode = mix(
            input.from.sample(input.uv),
            input.to.sample(input.uv),
            input.mask(masks[0]!).coverage(input.uv),
          ) as Node<'vec4'>;
          return effectNode as Node<'vec4'>;
        });

      beforeEach(() => {
        pictureOf = new Map();
        effectNode = undefined;
        for (const stage of [stars, level, nextLevel, fogStage, inkStage]) {
          stage.renderTo.mockImplementation(() => pictureOf.set(stage, (renderer.__renderTarget as RenderTarget).texture));
        }
      });

      it('the masks of an effect count among the distinct masks of the shape', () => {
        // on different stages: a slot mask on the top slot, the mask of an effect in the slot below
        director.setStack([stars, level]);
        director.setMask(level, fog);
        director.replace(stars, nextLevel, {effect: capture([ink]), duration: 1});
        expect(ordered()).toEqual(['stars', 'nextLevel', 'level', 'fog', 'ink']);
        draw();
        expect(sampled(effectNode!)).toEqual(['ink', 'nextLevel', 'stars']);
        expect(sampled(outputNode())).toEqual(['fog', 'ink', 'level', 'nextLevel', 'stars']);
        director.transitions[0]!.complete();

        // on the same stage: one texture node, shared by the slot mask and the mask of the effect
        director.replace(nextLevel, stars, {effect: capture([new StageMask(fogStage, {source: 'red'})]), duration: 1});
        expect(ordered()).toEqual(['nextLevel', 'stars', 'level', 'fog']);
        draw();
        expect(sampled(effectNode!)).toEqual(['fog', 'nextLevel', 'stars']);
        expect(sampled(outputNode())).toEqual(['fog', 'level', 'nextLevel', 'stars']);
      });

      it('the key tells which distinct mask the mask of an effect samples', () => {
        const vignetteStage = fakeStage('vignette');
        vignetteStage.renderTo.mockImplementation(() =>
          pictureOf.set(vignetteStage, (renderer.__renderTarget as RenderTarget).texture),
        );
        const vignette = new StageMask(vignetteStage);
        const third = fakeStage('third');
        const effect = capture([new StageMask(fogStage)]);

        director.setStack([stars, level, nextLevel]);
        director.setMask(stars, fog);
        director.setMask(level, vignette);
        director.replace(nextLevel, third, {effect, duration: 1});
        draw();
        expect(sampled(effectNode!)).toEqual(['fog', 'nextLevel', 'placeholder']);
        const first = director.pipeline;
        director.transitions[0]!.complete();

        // the slot masks swap their stages: the same masks and options in the same places, but the
        // mask of the effect samples the other distinct mask stage
        director.setMask(stars, vignette);
        director.setMask(level, fog);
        effectNode = undefined;
        director.replace(third, nextLevel, {effect, duration: 1});
        draw();
        expect(director.pipeline).not.toBe(first);
        expect(sampled(effectNode!)).toEqual(['fog', 'nextLevel', 'placeholder']);
      });

      it('precompile() compiles a shape with the masks of an effect', async () => {
        const updateContext = vi.spyOn(RenderPipeline.prototype as any, '_updateContext');
        try {
          await director.precompile(
            renderer as any,
            [
              ['layer', inkIn],
              ['layer', {effect: inkIn, mask: fog}],
            ],
            {layers: [level, inkStage]},
          );
          expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
          expect(inkStage.renderTo).toHaveBeenCalledTimes(1);

          director.setStack([stars, level]);
          director.replace(level, nextLevel, {effect: inkIn, duration: 1});
          draw();
          director.transitions[0]!.complete();
          director.setMask(nextLevel, fog);
          director.replace(nextLevel, level, {effect: inkIn, duration: 1});
          draw();
          expect(updateContext).toHaveBeenCalledTimes(2);
          expect(renderer.compileAsync).toHaveBeenCalledTimes(2);
        } finally {
          updateContext.mockRestore();
        }
        await expect(
          director.precompile(renderer as any, [[{name: 'odd', masks: [fogStage], build: crossfade().build} as any]]),
        ).rejects.toThrow('StageDirector#precompile(): the masks of the effect "odd" must be an array of StageMask, got [');
      });
    });

    it('input.mask() throws for a mask the effect did not name', () => {
      director.setStack([stars, level]);
      const sneaky = maskEffect('sneaky', [ink], (input) => input.mask(fog).sample(input.uv));
      director.replace(level, nextLevel, {effect: sneaky, duration: 1});
      expect(() => draw()).toThrow(
        'StageTransitionInput#mask(): the effect "sneaky" did not name the mask on "fog" in its masks',
      );
      director.transitions[0]!.complete();

      // another StageMask object on a named stage is not named
      const twin = maskEffect('twin', [ink], (input) => input.mask(new StageMask(inkStage)).sample(input.uv));
      director.replace(nextLevel, level, {effect: twin, duration: 1});
      expect(() => draw()).toThrow('StageTransitionInput#mask(): the effect "twin" did not name the mask on "ink" in its masks');
      director.transitions[0]!.complete();

      // an effect without masks names none
      const none: StageTransitionEffect = {name: 'none', build: (input) => input.mask(ink).sample(input.uv)};
      director.replace(level, nextLevel, {effect: none, duration: 1});
      expect(() => draw()).toThrow('StageTransitionInput#mask(): the effect "none" did not name the mask on "ink" in its masks');
    });

    describe('the progress of a mask', () => {
      it("progress is written before the mask stage's updateFrame()", () => {
        const seen: [number, number][] = [];
        director.setStack([stars, level]);
        const t = director.replace(level, nextLevel, {effect: inkIn, duration: 1, easing: 'ease-in-out'});
        inkStage.updateFrame.mockImplementation(() => seen.push([ink.progress, t.progress]));
        frame(0.25);
        frame(0.25);
        frame(0.25);
        // the transition advanced first, then the mask carried its progress to the stage
        expect(seen).toHaveLength(3);
        for (const [maskProgress, transitionProgress] of seen) expect(maskProgress).toBe(transitionProgress);
        // the first frame starts the transition at 0; ease-in-out is 4t³ below the middle
        expect(seen.map(([p]) => p)).toEqual([0, 0.0625, 0.5]);
      });

      it('progress is the eased value', () => {
        director.setStack([stars, level]);
        const t = director.replace(level, nextLevel, {effect: inkIn, duration: 1, easing: 'ease-in'});
        frame(0);
        expect(ink.progress).toBe(0);
        frame(0.5);
        // ease-in is t³: the eased progress, not the linear 0.5
        expect(ink.progress).toBe(0.125);
        expect(ink.progress).toBe(t.progress);
      });

      it('progress and progressNode stay in step', () => {
        director.setStack([stars, level]);
        director.replace(level, nextLevel, {effect: inkIn, duration: 1, easing: 'linear'});
        for (const deltaTime of [0, 0.25, 0.25, 0.125]) {
          frame(deltaTime);
          expect(ink.progressNode.value).toBe(ink.progress);
          draw();
          expect(ink.progressNode.value).toBe(ink.progress);
        }
        expect(ink.progress).toBe(0.625);
      });

      it('progress holds the last value between transitions and a new one starts at 0', () => {
        const third = fakeStage('third');
        director.setStack([stars, level]);
        director.replace(level, nextLevel, {effect: inkIn, duration: 1, easing: 'linear'});
        frame(0);
        frame(0.75);
        expect(ink.progress).toBe(0.75);
        // the frame that reaches the end leaves the mask at 1
        frame(0.5);
        expect(director.transitions).toHaveLength(0);
        expect(ink.progress).toBe(1);
        expect(ink.progressNode.value).toBe(1);
        frame();
        draw();
        expect(ink.progress).toBe(1);

        // a new transition starts it at 0, before its first frame
        const manual = director.replace(nextLevel, third, {effect: inkIn, manual: true});
        expect(ink.progress).toBe(0);
        expect(ink.progressNode.value).toBe(0);
        manual.progress = 0.4;
        frame();
        expect(ink.progress).toBe(0.4);
        // cancelled, it holds the value at the cancel
        manual.progress = 0.6;
        manual.cancel();
        expect(ink.progress).toBe(0.6);
        expect(ink.progressNode.value).toBe(0.6);
        frame();
        expect(ink.progress).toBe(0.6);

        // complete() of a running transition leaves it at 1
        const completed = director.replace(nextLevel, third, {effect: inkIn, duration: 1});
        expect(ink.progress).toBe(0);
        frame(0);
        frame(0.25);
        completed.complete();
        expect(ink.progress).toBe(1);
        expect(ink.progressNode.value).toBe(1);
      });

      it('progressNode follows a manual progress set before the draw', () => {
        director.setStack([stars, level]);
        const t = director.replace(level, nextLevel, {effect: inkIn, manual: true});
        t.progress = 0.25;
        frame();
        draw();
        expect(ink.progressNode.value).toBe(0.25);
        // set between updateFrame() and the draw: the GPU draws the set value, the CPU side keeps the frame's
        t.progress = 0.75;
        draw();
        expect(ink.progressNode.value).toBe(0.75);
        expect(ink.progress).toBe(0.25);
        frame();
        expect(ink.progress).toBe(0.75);
      });

      it('two masks on two slots, driving two transitions, each follow their own progress', () => {
        const otherStage = fakeStage('other');
        const other = new StageMask(otherStage);
        const third = fakeStage('third');
        const fourth = fakeStage('fourth');
        director.setStack([stars, level]);
        director.replace(stars, third, {effect: matte({mask: ink}), duration: 1, easing: 'linear'});
        director.replace(level, fourth, {effect: matte({mask: other, mode: 'threshold'}), duration: 2, easing: 'ease-in'});
        frame(0);
        frame(0.5);
        expect(ink.progress).toBe(0.5);
        // ease-in is t³ of a quarter of the duration
        expect(other.progress).toBe(0.015625);
        frame(0.5);
        expect(director.transitions).toHaveLength(1);
        expect(ink.progress).toBe(1);
        expect(other.progress).toBe(0.125);
        expect(ink.progressNode.value).toBe(1);
        expect(other.progressNode.value).toBe(0.125);
      });

      it('a slot mask and a matte on one stage: only the matte follows its transition', () => {
        // the stage of `fog` masks a slot, and a second StageMask on that stage is the mask of the matte
        const matteMask = new StageMask(fogStage, {source: 'luminance'});
        director.setStack([stars, level]);
        director.setMask(stars, fog);
        director.replace(level, nextLevel, {effect: matte({mask: matteMask}), duration: 1, easing: 'linear'});
        frame(0);
        frame(0.5);
        draw();
        expect(matteMask.progress).toBe(0.5);
        expect(matteMask.progressNode.value).toBe(0.5);
        expect(fog.progress).toBe(0);
        expect(fog.progressNode.value).toBe(0);
        // the stage is one mask stage, drawn once
        expect(ordered().filter((name) => name === 'fog')).toHaveLength(1);
      });

      it('a delayed transition keeps the progress of its mask at 0 until it starts', () => {
        director.setStack([stars, level]);
        director.replace(level, nextLevel, {effect: matte({mask: ink}), duration: 1, delay: 1, easing: 'linear'});
        expect(ink.progress).toBe(0);
        frame(0);
        frame(0.5);
        frame(0.25);
        expect(ink.progress).toBe(0);
        expect(ink.progressNode.value).toBe(0);
        frame(0.25);
        frame(0.5);
        expect(ink.progress).toBe(0.5);
        expect(ink.progressNode.value).toBe(0.5);
      });

      it('the mask of a slot carries no progress', () => {
        director.setStack([stars, level]);
        director.setMask(stars, fog);
        director.replace(level, nextLevel, {effect: inkIn, duration: 1, easing: 'linear'});
        frame(0);
        frame(0.5);
        draw();
        expect(ink.progress).toBe(0.5);
        expect(fog.progress).toBe(0);
        expect(fog.progressNode.value).toBe(0);
      });
    });
  });

  describe('a disposed StageMask', () => {
    it('leaves its slot, and its stage stays undisposed and leaves the director when unused', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      const wrapper = rendererOf(fogStage)!;
      expect(ordered()).toEqual(['stars', 'level', 'fog']);
      fog.dispose();
      expect(director.maskOf(level)).toBeUndefined();
      expect(ordered()).toEqual(['stars', 'level']);
      expect(wrapper.isDisposed).toBe(true);
      // the stage is the caller's: the director lets go of it and disposes nothing
      expect((fogStage as {isDisposed?: boolean}).isDisposed).toBeUndefined();
      expect(names(director.stack)).toEqual(['stars', 'level']);
    });

    it('leaves only the slots it lies on: another mask on its stage stays', () => {
      const cut = new StageMask(fogStage, {invert: true});
      director.setStack([stars, level]);
      director.setMask(stars, fog);
      director.setMask(level, cut);
      fog.dispose();
      expect(director.maskOf(stars)).toBeUndefined();
      expect(director.maskOf(level)).toBe(cut);
      expect(ordered()).toEqual(['stars', 'level', 'fog']);
      cut.dispose();
      expect(director.maskOf(level)).toBeUndefined();
      expect(ordered()).toEqual(['stars', 'level']);
    });

    it('ends the matte it drives as cancelled', () => {
      director.setStack([stars, level]);
      const t = director.replace(level, nextLevel, {effect: matte({mask: fog}), duration: 1});
      frame(0);
      frame(0.5);
      fog.dispose();
      expect(t.state).toBe('cancelled');
      expect(names(director.stack)).toEqual(['stars', 'level']);
      expect(director.transitions).toHaveLength(0);
      expect(ordered()).toEqual(['stars', 'level']);
    });

    it('a listener of the end that throws reaches the caller of dispose(), after the teardown', () => {
      director.setStack([stars, level]);
      director.setMask(stars, fog);
      const t = director.replace(level, nextLevel, {effect: matte({mask: fog}), duration: 1});
      const boom = new Error('boom');
      on(director, OnStageTransitionEnd, () => {
        throw boom;
      });
      expect(() => fog.dispose()).toThrow(boom);
      expect(fog.isDisposed).toBe(true);
      expect(t.state).toBe('cancelled');
      expect(director.maskOf(stars)).toBeUndefined();
      expect(ordered()).toEqual(['stars', 'level']);
    });

    it('is refused by setMask(), show(), push() and a transition', () => {
      director.setStack([stars, level]);
      const effect = matte({mask: fog});
      fog.dispose();
      const before = snapshot();
      const refusal = 'cannot take the mask on "fog": that mask has been disposed';
      expect(() => director.setMask(level, fog)).toThrow(`StageDirector#setMask() ${refusal}`);
      expect(() => director.show(nextLevel, {mask: fog})).toThrow(`StageDirector#show() ${refusal}`);
      expect(() => director.push(nextLevel, {mask: fog})).toThrow(`StageDirector#push() ${refusal}`);
      expect(() => director.replace(level, nextLevel, {effect, duration: 1})).toThrow(`StageDirector#replace() ${refusal}`);
      expect(snapshot()).toEqual(before);
    });

    it('disposed while its stage joins, it leaves the slot as soon as the change stands', () => {
      director.setStack([stars, level]);
      // a listener of the join of the mask stage disposes the mask, between the checks and the change
      on(director, OnStageAdded, () => fog.dispose());
      director.setMask(level, fog);
      expect(director.maskOf(level)).toBeUndefined();
      expect(ordered()).toEqual(['stars', 'level']);
    });

    it('disposed while its stage joins for a matte, it ends the matte as cancelled at once', () => {
      director.setStack([stars, level]);
      const effect = matte({mask: fog});
      on(director, OnStageAdded, ({stage}: {stage: IStage}) => {
        if ((stage as StageRenderer).stages?.[0]?.stage === fogStage) fog.dispose();
      });
      const t = director.replace(level, nextLevel, {effect, duration: 1});
      expect(t.state).toBe('cancelled');
      expect(names(director.stack)).toEqual(['stars', 'level']);
      expect(director.transitions).toHaveLength(0);
      expect(ordered()).toEqual(['stars', 'level']);
    });

    it('a director that let go of the mask hears nothing of its dispose()', () => {
      director.setStack([stars, level]);
      director.setMask(level, fog);
      director.setMask(level, undefined);
      director.setMask(stars, fog);
      director.setStack([stars, level]);
      const before = snapshot();
      expect(() => fog.dispose()).not.toThrow();
      expect(snapshot()).toEqual(before);

      const other = new StageMask(fakeStage('other'));
      director.setMask(level, other);
      director.dispose();
      expect(() => other.dispose()).not.toThrow();
    });
  });

  describe('a mask in the world of a stage', () => {
    let world: Stage2D;
    let worldScene: Scene;
    let maskScene: Scene;
    let camera: PerspectiveCamera;
    let flashlight: StageMask;

    /** The draws of the mask scene, with the camera of each. */
    const maskDraws = () => renderer.render.mock.calls.filter(([scene]) => scene === maskScene).map(([, cam]) => cam);

    beforeEach(() => {
      worldScene = new Scene();
      world = new Stage2D(undefined, worldScene);
      world.name = 'world';
      camera = new PerspectiveCamera();
      world.camera = camera;
      maskScene = new Scene();
      flashlight = StageMask.inWorldOf(world, maskScene);
    });

    it('draws its scene through the current camera of the stage', () => {
      director.setStack([world, level]);
      director.setMask(level, flashlight);
      expect(ordered()).toEqual(['world', 'level', 'mask in the world of world']);
      frame();
      draw();
      expect(maskDraws()).toEqual([camera]);
      const next = new PerspectiveCamera();
      world.camera = next;
      frame();
      draw();
      expect(maskDraws()).toEqual([camera, next]);
    });

    it('draws nothing while the stage has no camera', () => {
      director.setStack([world, level]);
      director.setMask(level, flashlight);
      world.camera = undefined;
      frame();
      draw();
      expect(maskDraws()).toEqual([]);
    });

    it('the mask goes into a slot again after it left one, and into a second matte after the first ended', () => {
      director.setStack([world, level]);
      director.setMask(level, flashlight);
      const wrapper = rendererOf(flashlight.stage)!;
      director.setMask(level, undefined);
      expect(wrapper.isDisposed).toBe(true);
      expect((flashlight.stage as {isDisposed?: boolean}).isDisposed).toBe(false);
      expect(ordered()).toEqual(['world', 'level']);

      director.setMask(level, flashlight);
      expect(director.maskOf(level)).toBe(flashlight);
      frame();
      draw();
      expect(maskDraws()).toEqual([camera]);
      director.setMask(level, undefined);

      const effect = matte({mask: flashlight});
      const first = director.replace(level, nextLevel, {effect, duration: 1});
      frame(0);
      frame(1);
      expect(first.state).toBe('finished');
      expect(ordered()).toEqual(['world', 'nextLevel']);
      const second = director.replace(nextLevel, level, {effect: matte({mask: flashlight}), duration: 1});
      expect(ordered()).toEqual(['world', 'nextLevel', 'level', 'mask in the world of world']);
      frame(0);
      frame(1);
      expect(second.state).toBe('finished');
      expect(names(director.stack)).toEqual(['world', 'level']);
      expect(flashlight.isDisposed).toBe(false);
    });

    it('dispose() takes the mask off its slot and disposes its stage, and leaves world and scene', () => {
      const child = new PerspectiveCamera();
      maskScene.add(child);
      director.setStack([world, level]);
      director.setMask(level, flashlight);
      const t = director.replace(world, stars, {effect: matte({mask: flashlight}), duration: 1});
      flashlight.dispose();
      expect(t.state).toBe('cancelled');
      expect(director.maskOf(level)).toBeUndefined();
      expect((flashlight.stage as {isDisposed?: boolean}).isDisposed).toBe(true);
      expect(ordered()).toEqual(['world', 'level']);
      expect(world.isDisposed).toBe(false);
      expect(maskScene.children).toEqual([child]);
      expect(() => director.setMask(level, flashlight)).toThrow(
        'StageDirector#setMask() cannot take the mask on "mask in the world of world": that mask has been disposed',
      );
    });

    it('a disposed world leaves the mask drawing nothing', () => {
      director.setStack([level]);
      director.setMask(level, flashlight);
      world.dispose();
      frame();
      draw();
      expect(maskDraws()).toEqual([]);
      expect(director.maskOf(level)).toBe(flashlight);
    });

    it('a frozen mask in the world keeps its picture when the camera moves', () => {
      director.setStack([world, level]);
      director.setMask(level, flashlight);
      director.freeze(flashlight.stage);
      frame();
      draw();
      expect(maskDraws()).toEqual([camera]);
      // the documented behaviour: a frozen mask is drawn once and sampled ever after, whatever the
      // camera of the world does
      camera.position.set(10, 0, 0);
      world.camera = new PerspectiveCamera();
      frame();
      draw();
      expect(maskDraws()).toEqual([camera]);
      director.run(flashlight.stage);
      frame();
      draw();
      expect(maskDraws()).toEqual([camera, world.camera]);
    });
  });

  describe('a mask target at a share of the resolution', () => {
    /** Width and height of the pass target `stage` is drawn into, in device pixels. */
    const passSize = (stage: StageRenderer) => {
      const image = (stage.asPassNode(renderer as any) as TextureNode).value.image as {width: number; height: number};
      return [image.width, image.height];
    };

    it('scale 0.5 halves the pass target of the mask stage, not the targets of the layers', () => {
      director.setStack([stars, level]);
      director.setMask(level, new StageMask(fogStage, {scale: 0.5}));
      frame();
      draw();
      expect(passSize(rendererOf(fogStage)!)).toEqual([32, 32]);
      expect(passSize(rendererOf(level)!)).toEqual([64, 64]);
      director.resize(128, 96);
      expect(passSize(rendererOf(fogStage)!)).toEqual([64, 48]);
    });

    it('a mask of scale 1 draws at the full size', () => {
      director.setStack([level]);
      director.setMask(level, fog);
      draw();
      expect(passSize(rendererOf(fogStage)!)).toEqual([64, 64]);
    });

    it('the stage keeps its logical size under a scaled target', () => {
      director.setStack([level]);
      director.setMask(level, new StageMask(fogStage, {scale: 0.25}));
      frame();
      draw();
      expect(fogStage.resize).toHaveBeenLastCalledWith(64, 64, 1);
      const wrapper = rendererOf(fogStage)!;
      expect([wrapper.width, wrapper.height]).toEqual([64, 64]);
      expect(passSize(wrapper)).toEqual([16, 16]);
    });

    it("a caller's StageRenderer gets its scale back when the mask leaves", () => {
      const maskRenderer = new StageRenderer();
      maskRenderer.name = 'fog renderer';
      maskRenderer.add(fogStage);
      director.setStack([level]);
      director.setMask(level, new StageMask(maskRenderer, {scale: 0.5}));
      frame();
      draw();
      expect(rendererOf(maskRenderer)).toBe(maskRenderer);
      expect(passSize(maskRenderer)).toEqual([32, 32]);
      // the pass target stays the same object: the texture nodes on it stay valid
      const texture = (maskRenderer.asPassNode(renderer as any) as TextureNode).value;
      director.setMask(level, undefined);
      expect(passSize(maskRenderer)).toEqual([64, 64]);
      expect((maskRenderer.asPassNode(renderer as any) as TextureNode).value).toBe(texture);
      expect(maskRenderer.isDisposed).toBe(false);
    });

    it("a caller's StageRenderer gets its scale back when the mask stage is removed", () => {
      const maskRenderer = new StageRenderer();
      maskRenderer.add(fogStage);
      director.setStack([level]);
      director.setMask(level, new StageMask(maskRenderer, {scale: 0.5}));
      draw();
      director.remove(maskRenderer);
      expect(passSize(maskRenderer)).toEqual([64, 64]);
    });

    it('takes two StageMask objects of one scale on one stage', () => {
      director.setStack([stars, level]);
      director.setMask(level, new StageMask(fogStage, {scale: 0.5}));
      director.setMask(stars, new StageMask(fogStage, {scale: 0.5, invert: true}));
      draw();
      expect(passSize(rendererOf(fogStage)!)).toEqual([32, 32]);
    });

    it('refuses a second scale on a stage drawn as a mask: one stage, one target', () => {
      director.setStack([stars, level]);
      director.setMask(level, new StageMask(fogStage, {scale: 0.5}));
      const before = snapshot();
      const full = new StageMask(fogStage);
      expect(() => director.setMask(stars, full)).toThrow(
        'StageDirector#setMask() cannot take the mask on "fog": that stage is drawn as a mask at a scale of 0.5 already, and a stage has one target',
      );
      expect(() => director.show(nextLevel, {mask: full})).toThrow(
        'StageDirector#show() cannot take the mask on "fog": that stage is drawn as a mask at a scale of 0.5 already',
      );
      expect(() => director.push(nextLevel, {mask: full})).toThrow('StageDirector#push() cannot take the mask on "fog"');
      expect(() => director.replace(level, nextLevel, {effect: matte({mask: full}), duration: 1})).toThrow(
        'StageDirector#replace() cannot take the mask on "fog": that stage is drawn as a mask at a scale of 0.5 already',
      );
      expect(snapshot()).toEqual(before);
      expect(director.transitions).toEqual([]);
    });

    it('refuses two scales on one stage within one call', () => {
      director.setStack([level]);
      const before = snapshot();
      const half = new StageMask(fogStage, {scale: 0.5});
      const full = new StageMask(fogStage);
      expect(() => director.show(nextLevel, {mask: half, effect: matte({mask: full}), duration: 1})).toThrow(
        'StageDirector#show() cannot take the mask on "fog": another mask of this call on that stage has a scale of 0.5, and a stage has one target',
      );
      const twoScales: StageTransitionEffect = {...crossfade(), masks: [half, full]};
      expect(() => director.replace(level, nextLevel, {effect: twoScales, duration: 1})).toThrow(
        'StageDirector#replace() cannot take the mask on "fog": another mask of this call on that stage has a scale of 0.5, and a stage has one target',
      );
      expect(snapshot()).toEqual(before);
      expect(director.transitions).toEqual([]);
    });

    it('takes another scale once the stage has left', () => {
      director.setStack([level]);
      director.setMask(level, new StageMask(fogStage, {scale: 0.5}));
      director.setMask(level, undefined);
      director.setMask(level, new StageMask(fogStage, {scale: 0.25}));
      draw();
      expect(passSize(rendererOf(fogStage)!)).toEqual([16, 16]);
    });
  });
});

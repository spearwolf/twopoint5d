import {emit, eventize} from '@spearwolf/eventize';
import {ACESFilmicToneMapping, Color, FloatType, type Node, RenderPipeline, SRGBColorSpace, type TextureNode} from 'three/webgpu';
import {beforeEach, describe, expect, it, type Mock, vi} from 'vitest';
import {OnStageDispose} from '../events.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import {StageDirector} from './StageDirector.js';
import {StageMask} from './StageMask.js';
import {StageRenderer} from './StageRenderer.js';
import {crossfade} from './transitionEffects.js';

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
});

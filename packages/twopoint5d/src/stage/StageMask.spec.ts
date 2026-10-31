import {on} from '@spearwolf/eventize';
import {Group, Mesh, PerspectiveCamera, Scene} from 'three/webgpu';
import {describe, expect, it, vi} from 'vitest';
import {OnStageDispose} from '../events.js';
import {ClearStage} from './ClearStage.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {Stage2D} from './Stage2D.js';
import {StageRenderer} from './StageRenderer.js';
import type {StageDirectorLayer} from './StageDirector.js';
import {StageMask, type StageMaskCoverageSource} from './StageMask.js';

function layer(extra: object = {}): StageDirectorLayer & {dispose: ReturnType<typeof vi.fn>} {
  return {
    name: 'fog',
    resize: vi.fn(),
    updateFrame: vi.fn(),
    renderTo: vi.fn(),
    dispose: vi.fn(),
    ...extra,
  } as unknown as StageDirectorLayer & {dispose: ReturnType<typeof vi.fn>};
}

describe('StageMask', () => {
  it('defaults to alpha, not inverted', () => {
    const stage = layer();
    const mask = new StageMask(stage);
    expect(mask.stage).toBe(stage);
    expect(mask.source).toBe('alpha');
    expect(mask.invert).toBe(false);
    expect(mask.isDisposed).toBe(false);
  });

  it.each<StageMaskCoverageSource>(['alpha', 'luminance', 'red', 'green', 'blue'])(
    'reads source %s and invert back',
    (source) => {
      const mask = new StageMask(layer(), {source, invert: true});
      expect(mask.source).toBe(source);
      expect(mask.invert).toBe(true);
    },
  );

  it('refuses an unknown source', () => {
    expect(() => new StageMask(layer(), {source: 'lum' as any})).toThrow(
      `new StageMask(): source must be 'alpha', 'luminance', 'red', 'green' or 'blue', got "lum"`,
    );
  });

  it('refuses options that are no object and an invert that is no boolean', () => {
    expect(() => new StageMask(layer(), 'alpha' as any)).toThrow('new StageMask(): the options must be an object');
    expect(() => new StageMask(layer(), {invert: 1 as any})).toThrow('new StageMask(): invert must be a boolean, got 1');
  });

  it('refuses a stage without renderTo()', () => {
    expect(() => new StageMask({name: 'x', resize() {}, updateFrame() {}} as any)).toThrow(
      'new StageMask() cannot take the stage',
    );
    expect(() => new StageMask(undefined as any)).toThrow(TypeError);
  });

  it('refuses a ClearStage', () => {
    expect(() => new StageMask(new ClearStage() as any)).toThrow(
      'new StageMask() cannot take the stage "clear": a ClearStage draws no picture to read a coverage from',
    );
  });

  it('refuses a disposed stage', () => {
    expect(() => new StageMask(layer({isDisposed: true}))).toThrow(
      'new StageMask() cannot take the stage "fog": that stage has been disposed',
    );
  });

  it('starts at progress 0, with a float uniform of the same value', () => {
    const mask = new StageMask(layer());
    expect(mask.progress).toBe(0);
    expect(mask.progressNode.isUniformNode).toBe(true);
    expect(mask.progressNode.value).toBe(0);
    // one uniform per mask, the same at every read
    expect(mask.progressNode).toBe(mask.progressNode);
    expect(new StageMask(layer()).progressNode).not.toBe(mask.progressNode);
  });

  it('progress is read-only for the caller', () => {
    const mask = new StageMask(layer());
    expect(() => {
      (mask as {progress: number}).progress = 0.5;
    }).toThrow(TypeError);
    expect(mask.progress).toBe(0);
  });

  it('dispose() leaves a stage handed in undisposed', () => {
    const stage = layer();
    const mask = new StageMask(stage);
    mask.dispose();
    expect(mask.isDisposed).toBe(true);
    expect(stage.dispose).not.toHaveBeenCalled();
    expect(() => mask.dispose()).not.toThrow();
  });

  describe('inWorldOf()', () => {
    const renderer = () => ({render: vi.fn()}) as unknown as {render: ReturnType<typeof vi.fn>};

    function world(name = 'level'): Stage2D {
      const stage = new Stage2D();
      stage.name = name;
      return stage;
    }

    it('builds a mask stage of its own with the options given', () => {
      const scene = new Scene();
      const mask = StageMask.inWorldOf(world(), scene, {source: 'luminance', invert: true});
      expect(mask).toBeInstanceOf(StageMask);
      expect(mask.source).toBe('luminance');
      expect(mask.invert).toBe(true);
      expect(mask.stage.name).toBe('mask in the world of level');
      expect(typeof mask.stage.renderTo).toBe('function');
      expect(StageMask.inWorldOf(world(), scene).source).toBe('alpha');
    });

    it('inWorldOf refuses a StageRenderer', () => {
      expect(() => StageMask.inWorldOf(new StageRenderer() as any, new Scene())).toThrow(
        'StageMask.inWorldOf(): stage must be a Stage2D, got StageRenderer',
      );
      expect(() => StageMask.inWorldOf(undefined as any, new Scene())).toThrow(
        'StageMask.inWorldOf(): stage must be a Stage2D, got undefined',
      );
      expect(() => StageMask.inWorldOf(layer() as any, new Scene())).toThrow(TypeError);
    });

    it('refuses a disposed stage', () => {
      const stage = world();
      stage.dispose();
      expect(() => StageMask.inWorldOf(stage, new Scene())).toThrow(
        'StageMask.inWorldOf() cannot take the stage "level": that stage has been disposed',
      );
    });

    it('refuses a scene that is no three.js object', () => {
      expect(() => StageMask.inWorldOf(world(), {} as any)).toThrow(
        'StageMask.inWorldOf(): scene must be a three.js Scene or Object3D, got {}',
      );
      expect(() => StageMask.inWorldOf(world(), undefined as any)).toThrow(TypeError);
      // a group is an Object3D, and the renderer draws it as it draws a scene
      expect(() => StageMask.inWorldOf(world(), new Group() as any)).not.toThrow();
    });

    it('refuses its options with its own name', () => {
      expect(() => StageMask.inWorldOf(world(), new Scene(), {source: 'lum' as any})).toThrow(
        `StageMask.inWorldOf(): source must be 'alpha', 'luminance', 'red', 'green' or 'blue', got "lum"`,
      );
    });

    it('reads the camera at the draw', () => {
      const stage = world();
      const scene = new Scene();
      const mask = StageMask.inWorldOf(stage, scene);
      const r = renderer();
      const first = new PerspectiveCamera();
      stage.camera = first;
      mask.stage.renderTo(r as any);
      expect(r.render).toHaveBeenLastCalledWith(scene, first);
      // a new camera of the world is the camera of the next draw
      const second = new PerspectiveCamera();
      stage.camera = second;
      mask.stage.renderTo(r as any);
      expect(r.render).toHaveBeenLastCalledWith(scene, second);
      expect(r.render).toHaveBeenCalledTimes(2);
    });

    it('draws nothing while the stage has no camera', () => {
      // a projection builds its camera on the first resize() with an area
      const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 100, height: 100}));
      const mask = StageMask.inWorldOf(stage, new Scene());
      const r = renderer();
      mask.stage.renderTo(r as any);
      expect(r.render).not.toHaveBeenCalled();
      stage.resize(64, 64);
      expect(stage.camera).toBeDefined();
      mask.stage.renderTo(r as any);
      expect(r.render).toHaveBeenCalledTimes(1);
      // a disposed world keeps answering its last camera, and the mask draws nothing through it
      stage.dispose();
      expect(stage.camera).toBeDefined();
      mask.stage.renderTo(r as any);
      expect(r.render).toHaveBeenCalledTimes(1);
    });

    it('resize() and updateFrame() of the mask stage leave the world as it is', () => {
      const stage = world();
      const camera = new PerspectiveCamera();
      stage.camera = camera;
      const resize = vi.spyOn(stage, 'resize');
      const updateFrame = vi.spyOn(stage, 'updateFrame');
      const mask = StageMask.inWorldOf(stage, new Scene());
      mask.stage.resize(320, 200, 2);
      mask.stage.updateFrame(0, 0.016, 1);
      expect(resize).not.toHaveBeenCalled();
      expect(updateFrame).not.toHaveBeenCalled();
      expect(stage.camera).toBe(camera);
    });

    it('dispose() disposes the stage inWorldOf() built and leaves the scene', () => {
      const stage = world();
      const scene = new Scene();
      const child = new Mesh();
      scene.add(child);
      const mask = StageMask.inWorldOf(stage, scene);
      const built = mask.stage as StageDirectorLayer & {isDisposed: boolean};
      const disposed = vi.fn();
      on(built, OnStageDispose, disposed);
      expect(built.isDisposed).toBe(false);
      mask.dispose();
      expect(mask.isDisposed).toBe(true);
      expect(built.isDisposed).toBe(true);
      expect(disposed).toHaveBeenCalledTimes(1);
      expect(disposed).toHaveBeenCalledWith(built);
      // the world and the scene stay the caller's
      expect(stage.isDisposed).toBe(false);
      expect(scene.children).toEqual([child]);
      // a disposed mask stage draws nothing, and a second dispose() does nothing
      const r = renderer();
      stage.camera = new PerspectiveCamera();
      built.renderTo(r as any);
      expect(r.render).not.toHaveBeenCalled();
      expect(() => mask.dispose()).not.toThrow();
      expect(disposed).toHaveBeenCalledTimes(1);
    });
  });
});

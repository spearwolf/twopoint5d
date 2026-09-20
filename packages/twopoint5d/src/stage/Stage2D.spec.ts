import {emit, on} from '@spearwolf/eventize';
import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {Object3D, OrthographicCamera, type PassNode, PerspectiveCamera, Scene, type WebGPURenderer} from 'three/webgpu';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  OnStageAfterCameraChanged,
  OnStageFirstFrame,
  OnStageResize,
  OnStageUpdateFrame,
  type StageResizeProps,
} from '../events.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D} from './Stage2D.js';

// asPassNode() does not read the renderer it is handed, and no test here has a real one
const noRenderer = {} as WebGPURenderer;

describe('Stage2D', () => {
  it('has a scene by default', () => {
    const stage = new Stage2D(new ParallaxProjection('xz|top-left', {fit: 'contain', width: 600}));
    expect(stage.scene).toBeDefined();
  });

  it('after call to resize() a camera is created (by projection)', () => {
    const stage = new Stage2D(new ParallaxProjection('xz|top-left', {pixelZoom: 2}));
    stage.resize(320, 240);

    expect(stage.camera).toBeDefined();
  });

  it('creates no camera before the first resize() with an area', () => {
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
    expect(stage.camera, 'after construction').toBeUndefined();

    stage.resize(0, 600);
    expect(stage.camera, 'after resize(0, 600)').toBeUndefined();

    stage.resize(800, 600);
    expect(stage.camera, 'after resize(800, 600)').toBeDefined();
  });

  it('creates no camera from specs that give no view', () => {
    for (const projection of [
      new ParallaxProjection('xy|bottom-left', {}),
      new OrthographicProjection('xy|bottom-left', {fit: 'contain'}),
    ]) {
      const stage = new Stage2D(projection);
      const onResize = vi.fn();
      const onCameraChanged = vi.fn();
      on(stage, OnStageResize, onResize);
      on(stage, OnStageAfterCameraChanged, onCameraChanged);

      stage.resize(800, 600);

      expect(stage.camera).toBeUndefined();
      expect([stage.width, stage.height]).toEqual([0, 0]);
      expect(onResize).not.toHaveBeenCalled();
      expect(onCameraChanged).not.toHaveBeenCalled();
    }
  });

  it('fills the container for a pixelZoom of 0', () => {
    const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {pixelZoom: 0}));
    stage.resize(800, 600);

    expect([stage.width, stage.height]).toEqual([800, 600]);
    const camera = stage.camera as OrthographicCamera;
    expect(camera).toBeInstanceOf(OrthographicCamera);
    expect(camera.right - camera.left).toBe(800);
  });

  it('never emits OnStageResize with NaN', () => {
    for (const specs of [{fit: 'contain', width: 640} as const, {pixelZoom: 2}]) {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', specs));
      const sizes: [number, number][] = [];
      on(stage, OnStageResize, ({width, height}: StageResizeProps) => sizes.push([width, height]));

      stage.resize(800, 600);
      stage.resize(0, 0);
      stage.resize(0, 600);
      stage.resize(800, 0);
      stage.resize(640, 480);

      expect(sizes.length, JSON.stringify(specs)).toBeGreaterThan(0);
      for (const [width, height] of sizes) {
        expect(Number.isFinite(width) && Number.isFinite(height), `${JSON.stringify(specs)}: ${width}×${height}`).toBe(true);
      }
    }
  });

  it('keeps its camera and size while the container has no area', () => {
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
    stage.resize(800, 600);
    const camera = stage.camera;
    expect([stage.width, stage.height]).toEqual([640, 480]);

    for (const [w, h] of [
      [0, 600],
      [800, 0],
      [0, 0],
      [-1, 600],
      [800, -1],
      [NaN, 600],
      [800, NaN],
      [Infinity, 600],
    ] as const) {
      stage.resize(w, h);
      expect(stage.camera, `camera after resize(${w}, ${h})`).toBe(camera);
      expect([stage.width, stage.height], `size after resize(${w}, ${h})`).toEqual([640, 480]);
    }
  });

  it('warns once when it runs without a camera', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const withoutProjection = new Stage2D();
      for (let frameNo = 1; frameNo <= 250; frameNo++) withoutProjection.updateFrame(frameNo, 0.016, frameNo);
      expect(warn, 'a stage without a projection').toHaveBeenCalledTimes(1);

      // a projection alone gives no camera: the stage waits for a resize() with an area
      warn.mockClear();
      const neverResized = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      for (let frameNo = 1; frameNo <= 1300; frameNo++) neverResized.updateFrame(frameNo, 0.016, frameNo);
      expect(warn, 'a stage with a projection that was never resized').toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('announces a projection change with the camera it replaced', () => {
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
    stage.resize(800, 600);
    const cam1 = stage.camera;
    expect(cam1).toBeDefined();

    const changed = vi.fn();
    on(stage, OnStageAfterCameraChanged, changed);

    stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320});
    expect(changed.mock.calls[0]![0]).toBe(stage);
    expect(changed.mock.calls[0]![1], 'the first event carries the camera of the previous projection').toBe(cam1);
    const cam2 = stage.camera;
    expect(cam2).toBeDefined();
    expect(cam2).not.toBe(cam1);

    changed.mockClear();
    stage.projection = undefined;
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed.mock.calls[0]![1]).toBe(cam2);
    expect(stage.camera).toBeUndefined();
  });

  it('hands back to the projection camera when the assigned one is cleared', () => {
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
    const custom = new PerspectiveCamera();
    stage.camera = custom;
    stage.resize(800, 600);
    expect(stage.camera).toBe(custom);

    stage.camera = undefined;
    expect(stage.camera).toBeDefined();
    expect(stage.camera).not.toBe(custom);
  });

  describe('size after a change of projection', () => {
    const createResizedStage = () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      stage.resize(800, 600);
      expect([stage.width, stage.height]).toEqual([640, 480]);
      return stage;
    };

    it('drops the size of the previous projection for one whose specs give no view', () => {
      const stage = createResizedStage();

      stage.projection = new OrthographicProjection('xy|bottom-left', {fit: 'contain'});

      expect(stage.camera).toBeUndefined();
      expect([stage.width, stage.height]).toEqual([0, 0]);
    });

    it('drops the size together with the projection', () => {
      const stage = createResizedStage();

      stage.projection = undefined;

      expect(stage.camera).toBeUndefined();
      expect([stage.width, stage.height]).toEqual([0, 0]);
    });

    it('drops the size of the projection while it keeps an assigned camera', () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      const custom = new PerspectiveCamera();
      stage.camera = custom;
      stage.resize(800, 600);
      expect([stage.width, stage.height]).toEqual([640, 480]);

      stage.projection = undefined;

      expect(stage.camera).toBe(custom);
      expect([stage.width, stage.height]).toEqual([0, 0]);
    });

    it('a listener to the camera change reads no size of the projection that went', () => {
      const stage = createResizedStage();
      const sizes: [number, number][] = [];
      on(stage, OnStageAfterCameraChanged, () => sizes.push([stage.width, stage.height]));

      stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320});

      expect(sizes).toEqual([
        [0, 0],
        [320, 240],
      ]);
    });

    it('announces the first view of a new projection, also at the size of the previous one', () => {
      const stage = createResizedStage();
      const onResize = vi.fn();
      on(stage, OnStageResize, onResize);

      stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640});

      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenCalledWith({stage, width: 640, height: 480});
    });

    it('takes the view of a projection assigned while the container has no area on the next resize() with one', () => {
      const stage = createResizedStage();
      stage.resize(0, 600);
      expect([stage.width, stage.height], 'size after resize(0, 600)').toEqual([640, 480]);

      stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320});
      expect(stage.camera, 'camera after the assignment').toBeUndefined();
      expect([stage.width, stage.height], 'size after the assignment').toEqual([0, 0]);

      const onResize = vi.fn();
      on(stage, OnStageResize, onResize);
      stage.resize(800, 600);

      expect(stage.camera, 'camera after resize(800, 600)').toBeDefined();
      expect([stage.width, stage.height], 'size after resize(800, 600)').toEqual([320, 240]);
      expect(onResize).toHaveBeenCalledTimes(1);
      expect(onResize).toHaveBeenCalledWith({stage, width: 320, height: 240});
    });

    it('sends no OnStageResize for the drop to no size', () => {
      const stage = createResizedStage();
      const onResize = vi.fn();
      on(stage, OnStageResize, onResize);

      stage.projection = new OrthographicProjection('xy|bottom-left', {fit: 'contain'});
      stage.projection = undefined;

      expect(onResize).not.toHaveBeenCalled();
    });
  });

  describe('renderTo (IRenderable)', () => {
    it('is a no-op when there is no camera yet', () => {
      const stage = new Stage2D();
      const renderer = {render: vi.fn()};
      stage.renderTo(renderer as any);
      expect(renderer.render).not.toHaveBeenCalled();
    });

    it('calls renderer.render(scene, camera) once camera exists', () => {
      const stage = new Stage2D(new ParallaxProjection('xz|top-left', {pixelZoom: 1}));
      stage.resize(100, 100);
      const renderer = {render: vi.fn()};
      stage.renderTo(renderer as any);
      expect(renderer.render).toHaveBeenCalledTimes(1);
      expect(renderer.render).toHaveBeenCalledWith(stage.scene, stage.camera);
    });
  });

  describe('asPassNode (IPassProvider)', () => {
    const sandbox = createSandbox();

    afterEach(() => {
      sandbox.restore();
    });

    const makeStage = () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      stage.resize(320, 200);
      return stage;
    };

    it('gives the same node back while scene and camera stay', () => {
      const stage = makeStage();

      const first = stage.asPassNode(noRenderer);

      expect(stage.asPassNode(noRenderer)).toBe(first);
    });

    it('builds a new node for a new camera and releases the one before', () => {
      const stage = makeStage();
      const first = stage.asPassNode(noRenderer) as PassNode;
      const firstDispose = sandbox.spy(first, 'dispose');

      stage.camera = new PerspectiveCamera();
      const second = stage.asPassNode(noRenderer);

      expect(second, 'a camera of its own needs a node of its own').not.toBe(first);
      expect(firstDispose.calledOnce, 'the node of the camera before is released').toBe(true);
    });

    it('builds a new node for a new scene and releases the one before', () => {
      const stage = makeStage();
      const first = stage.asPassNode(noRenderer) as PassNode;
      const firstDispose = sandbox.spy(first, 'dispose');

      stage.scene = new Scene();
      const second = stage.asPassNode(noRenderer);

      expect(second, 'another scene needs a node of its own').not.toBe(first);
      expect(firstDispose.calledOnce, 'the node of the scene before is released').toBe(true);
    });
  });

  describe('dispose()', () => {
    const sandbox = createSandbox();

    afterEach(() => {
      sandbox.restore();
    });

    const makeStage = () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      stage.resize(320, 200);
      return stage;
    };

    // (a) a resource the instance built itself is released exactly once
    it('disposes the pass node it built itself', () => {
      const stage = makeStage();
      const passNode = stage.asPassNode(noRenderer) as PassNode;
      const passNodeDispose = sandbox.spy(passNode, 'dispose');

      stage.dispose();

      expect(passNodeDispose.calledOnce).toBe(true);
    });

    // (b) a resource handed in belongs to the caller and is not touched
    it('does NOT touch a scene that was handed in', () => {
      const scene = new Scene();
      const child = new Object3D();
      scene.add(child);
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}), scene);

      stage.dispose();

      expect(stage.scene, 'the scene is still the one that was handed in').toBe(scene);
      expect(scene.children, 'and it still holds what the caller put in it').toEqual([child]);
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    it('behaves as documented after dispose()', () => {
      const projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640});
      const stage = new Stage2D(projection);
      stage.resize(320, 200);
      stage.name = 'the stage';
      const {scene, camera} = stage;

      stage.dispose();

      expect(stage.isDisposed).toBe(true);
      expect(() => stage.asPassNode(noRenderer), 'asPassNode() claims a node it can no longer build').toThrow(
        /has been disposed/,
      );

      const renderer = {render: vi.fn()};
      expect(() => {
        stage.renderTo(renderer as any);
        stage.updateFrame(1, 0.016, 1);
        stage.resize(800, 600);
        stage.updateProjection(true);
        stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320});
        stage.camera = new PerspectiveCamera();
        stage.name = 'renamed';
        stage.needsUpdate = true;
        stage.isFirstFrame = false;
      }).not.toThrow();

      expect(renderer.render, 'a disposed stage draws nothing').not.toHaveBeenCalled();
      expect(stage.scene, 'the scene keeps its value').toBe(scene);
      expect(stage.camera, 'and so does the camera').toBe(camera);
      expect(stage.projection, 'a write to projection finds nothing to drive').toBe(projection);
      expect([stage.width, stage.height], 'the size stays where it was').toEqual([640, 400]);
      expect(stage.name, 'name writes through to scene.name, it just drives nothing').toBe('renamed');
      expect(stage.needsUpdate, 'and so does needsUpdate').toBe(true);
      expect(stage.isFirstFrame, 'and so does isFirstFrame').toBe(false);
      expect([stage.containerWidth, stage.containerHeight], 'the container size stays where it was').toEqual([320, 200]);
    });

    // (d) the second call throws nothing and releases nothing a second time
    it('is safe to call twice', () => {
      const stage = makeStage();
      const passNode = stage.asPassNode(noRenderer) as PassNode;
      const passNodeDispose = sandbox.spy(passNode, 'dispose');

      expect(() => {
        stage.dispose();
        stage.dispose();
      }).not.toThrow();

      expect(passNodeDispose.calledOnce).toBe(true);
    });

    // (e) no signal or effect outlives the instance
    it('does not leak signals or effects', () => {
      const baselineSignals = getSignalsCount();
      const baselineEffects = getEffectsCount();

      const stage = makeStage();

      // this class works without signals: the counters stand still over its whole life, and this
      // line is what says so out loud instead of leaving it to the reader
      expect(getSignalsCount(), 'a live stage creates no signal').toBe(baselineSignals);
      expect(getEffectsCount(), 'and no effect').toBe(baselineEffects);

      stage.dispose();

      expect(getSignalsCount()).toBe(baselineSignals);
      expect(getEffectsCount()).toBe(baselineEffects);
    });

    it('sends a dispose event and stops listening afterwards', () => {
      const stage = makeStage();
      const disposed = vi.fn();
      const updated = vi.fn();
      on(stage, 'dispose', disposed);
      on(stage, OnStageUpdateFrame, updated);

      stage.dispose();

      expect(disposed, 'the event goes out while the listeners are still attached').toHaveBeenCalledTimes(1);
      expect(disposed).toHaveBeenCalledWith(stage);

      // straight into the emitter, past the guard in updateFrame(): the question here is whether
      // anyone is still subscribed, not whether the stage would emit
      emit(stage, OnStageUpdateFrame, {stage, now: 1, deltaTime: 0.016, frameNo: 1});

      expect(updated, 'no event follows the dispose').not.toHaveBeenCalled();
    });

    it('lets go of the retained first-frame props', () => {
      const stage = makeStage();
      stage.updateFrame(1, 0.016, 1);

      const beforeDispose = vi.fn();
      on(stage, OnStageFirstFrame, beforeDispose);
      expect(beforeDispose, 'a late subscriber is told about the first frame that was').toHaveBeenCalledTimes(1);

      stage.dispose();

      // the retained props carry `stage: this`, so a value still held here would keep the stage
      // itself reachable through the emitter
      const afterDispose = vi.fn();
      on(stage, OnStageFirstFrame, afterDispose);

      expect(afterDispose, 'nothing is retained for a subscriber that comes after').not.toHaveBeenCalled();
    });

    // (f) has no subject here: this stage takes no slot from a pool and no tile from a factory.
  });

  it('does not expose the removed clearColor / clearAlpha / autoClear properties', () => {
    const stage = new Stage2D() as any;
    expect(stage.clearColor).toBeUndefined();
    expect(stage.clearAlpha).toBeUndefined();
    expect(stage.autoClear).toBeUndefined();
  });
});

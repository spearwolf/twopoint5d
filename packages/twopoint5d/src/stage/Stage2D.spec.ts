import {on} from '@spearwolf/eventize';
import {OrthographicCamera, PerspectiveCamera} from 'three/webgpu';
import {describe, expect, it, vi} from 'vitest';
import {OnStageAfterCameraChanged, OnStageResize, type StageResizeProps} from '../events.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D} from './Stage2D.js';

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

  it('does not expose the removed clearColor / clearAlpha / autoClear properties', () => {
    const stage = new Stage2D() as any;
    expect(stage.clearColor).toBeUndefined();
    expect(stage.clearAlpha).toBeUndefined();
    expect(stage.autoClear).toBeUndefined();
  });
});

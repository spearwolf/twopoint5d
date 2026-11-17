import {emit, getSubscriptionCount, on, once} from '@spearwolf/eventize';
import {getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {
  type Camera,
  Object3D,
  OrthographicCamera,
  type PassNode,
  PerspectiveCamera,
  Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  type IStageDispose,
  OnStageAfterCameraChanged,
  OnStageAfterSceneChanged,
  OnStageCameraPlaced,
  OnStageDispose,
  OnStageFirstFrame,
  OnStageResize,
  OnStageUpdateFrame,
  type StageCameraPlacedProps,
  type StageResizeProps,
} from '../events.js';
import type {IProjection} from './IProjection.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D, Stage2DInternals} from './Stage2D.js';
import type {StageCameraDriver} from './StageCameraDriver.js';

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

  describe('the pixel ratio', () => {
    // contain zooms by 2.5 CSS pixels in a container of 1000 × 600
    const snapping = () =>
      new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 400, height: 240, pixelSnap: true});

    it('hands the pixel ratio of resize() to the projection', () => {
      const stage = new Stage2D(snapping());
      stage.resize(1000, 600, 1.25);
      expect(stage.containerPixelRatio).toBe(1.25);
      expect(stage.width).toBeCloseTo(1250 / 3);
      expect(stage.height).toBe(250);
    });

    it('takes a pixel ratio of 1 where none is given, and counts one that is no finite number above 0 as 1', () => {
      const stage = new Stage2D(snapping());
      stage.resize(1000, 600);
      expect([stage.containerPixelRatio, stage.width, stage.height]).toEqual([1, 500, 300]);
      stage.resize(1000, 600, Number.NaN);
      expect([stage.containerPixelRatio, stage.width, stage.height]).toEqual([1, 500, 300]);
    });

    it('snaps the view anew on a change of the pixel ratio alone, and announces it', () => {
      const stage = new Stage2D(snapping());
      stage.resize(1000, 600, 1);
      const resized = vi.fn();
      on(stage, OnStageResize, resized);
      stage.resize(1000, 600, 2);
      expect([stage.width, stage.height]).toEqual([400, 240]);
      expect(resized).toHaveBeenCalledTimes(1);
    });

    it('keeps the pixel ratio for updateProjection()', () => {
      const projection = snapping();
      const stage = new Stage2D(projection);
      stage.resize(1000, 600, 2);
      stage.updateProjection(true);
      expect([stage.width, stage.height]).toEqual([400, 240]);
      // a new projection takes the view at the kept ratio as well
      stage.projection = snapping();
      expect([stage.width, stage.height]).toEqual([400, 240]);
    });
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

  it('announces a scene change with the scene it replaced', () => {
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
    const previous = stage.scene;
    const next = new Scene();

    const changed = vi.fn();
    on(stage, OnStageAfterSceneChanged, changed);

    stage.scene = next;
    expect(changed).toHaveBeenCalledTimes(1);
    expect(changed).toHaveBeenCalledWith(stage, previous);
    expect(stage.scene).toBe(next);

    stage.scene = next;
    expect(changed, 'the same scene once more is no change').toHaveBeenCalledTimes(1);
  });

  describe('needsUpdate in updateFrame()', () => {
    it('applies needsUpdate on the next updateFrame()', () => {
      const projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640});
      const stage = new Stage2D(projection);
      stage.resize(320, 200);
      expect([stage.width, stage.height]).toEqual([640, 400]);

      const resized = vi.fn();
      on(stage, OnStageResize, resized);

      projection.viewSpecs = {fit: 'contain', width: 320};
      stage.needsUpdate = true;
      stage.updateFrame(1, 0.016, 1);

      expect([stage.width, stage.height]).toEqual([320, 200]);
      expect(stage.needsUpdate).toBe(false);
      expect(resized).toHaveBeenCalledTimes(1);
      expect(resized.mock.calls[0]![0]).toMatchObject({stage, width: 320, height: 200});
    });

    it('leaves the projection alone in a frame without needsUpdate', () => {
      const projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640});
      const stage = new Stage2D(projection);
      stage.resize(320, 200);

      const updateViewRect = vi.spyOn(projection, 'updateViewRect');
      stage.updateFrame(1, 0.016, 1);

      expect(updateViewRect).not.toHaveBeenCalled();
    });

    it('updateProjection() leaves the projection alone without needsUpdate', () => {
      const projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640});
      const stage = new Stage2D(projection);
      stage.resize(800, 600);

      const updateViewRect = vi.spyOn(projection, 'updateViewRect');
      stage.updateProjection();

      expect(updateViewRect).not.toHaveBeenCalled();
    });

    it('updateProjection() applies needsUpdate and clears it', () => {
      const projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640});
      const stage = new Stage2D(projection);
      stage.resize(800, 600);

      const updateViewRect = vi.spyOn(projection, 'updateViewRect');
      stage.needsUpdate = true;
      stage.updateProjection();

      expect(updateViewRect).toHaveBeenCalledTimes(1);
      expect(updateViewRect).toHaveBeenCalledWith(800, 600, 1);
      expect(stage.needsUpdate).toBe(false);
    });

    it('keeps needsUpdate while the container has no area', () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));

      stage.needsUpdate = true;
      stage.updateProjection();

      expect(stage.needsUpdate).toBe(true);
      expect(stage.camera).toBeUndefined();
    });

    it('keeps needsUpdate and the size when the projection refuses the camera', () => {
      const projection = new OrthographicProjection('xy|bottom-left', {fit: 'fill'});
      const stage = new Stage2D(projection);
      stage.resize(800, 600);
      expect([stage.width, stage.height]).toEqual([800, 600]);

      // the assignment itself places nothing; the next update is where the projection says no
      stage.camera = new PerspectiveCamera();
      projection.viewSpecs = {fit: 'contain', width: 400};
      stage.needsUpdate = true;

      expect(() => stage.updateProjection()).toThrow(TypeError);

      expect(stage.needsUpdate).toBe(true);
      expect([stage.width, stage.height]).toEqual([800, 600]);
    });

    for (const method of ['updateViewRect', 'getViewRect'] as const) {
      const throwingStage = () => {
        const projection = new OrthographicProjection('xy|bottom-left', {fit: 'fill'});
        const stage = new Stage2D(projection);
        stage.resize(800, 600);
        expect(stage.camera).toBeDefined();
        const failure = new Error(`${method} failed`);
        const spy = vi.spyOn(projection, method).mockImplementationOnce(() => {
          throw failure;
        });
        stage.needsUpdate = true;
        return {stage, spy, failure};
      };

      it(`keeps needsUpdate when ${method}() of the projection throws in updateFrame(), and tries again in the next`, () => {
        const {stage, spy, failure} = throwingStage();

        expect(() => stage.updateFrame(1, 0.016, 1)).toThrow(failure);
        expect(stage.needsUpdate).toBe(true);
        expect([stage.width, stage.height]).toEqual([800, 600]);

        stage.updateFrame(2, 0.016, 2);
        expect(spy).toHaveBeenCalledTimes(2);
        expect(stage.needsUpdate).toBe(false);
        expect([stage.width, stage.height]).toEqual([800, 600]);
      });

      it(`keeps needsUpdate when ${method}() of the projection throws in updateProjection()`, () => {
        const {stage, spy, failure} = throwingStage();

        expect(() => stage.updateProjection()).toThrow(failure);
        expect(stage.needsUpdate).toBe(true);
        expect([stage.width, stage.height]).toEqual([800, 600]);

        stage.updateProjection();
        expect(spy).toHaveBeenCalledTimes(2);
        expect(stage.needsUpdate).toBe(false);
        expect([stage.width, stage.height]).toEqual([800, 600]);
      });
    }

    it('creates the camera in the frame that applies needsUpdate', () => {
      const projection = new ParallaxProjection('xy|bottom-left', {});
      const stage = new Stage2D(projection);
      stage.resize(800, 600);
      expect(stage.camera, 'specs without a view give no camera').toBeUndefined();

      projection.viewSpecs = {fit: 'contain', width: 640};
      stage.needsUpdate = true;

      const firstFrame = vi.fn();
      on(stage, OnStageFirstFrame, firstFrame);

      stage.updateFrame(1, 0.016, 1);

      expect(stage.camera).toBeDefined();
      expect(firstFrame).toHaveBeenCalledTimes(1);
      expect(firstFrame.mock.calls[0]![0]).toMatchObject({stage, frameNo: 1});
    });
  });

  describe('frame props', () => {
    const makeStage = () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      stage.resize(320, 200);
      return stage;
    };

    it('hands every OnStageUpdateFrame the same props object, rewritten per frame', () => {
      const stage = makeStage();
      const seen: {props: unknown; frameNo: number}[] = [];
      on(stage, OnStageUpdateFrame, (props: {frameNo: number}) => {
        seen.push({props, frameNo: props.frameNo});
      });

      stage.updateFrame(1, 0.016, 1);
      stage.updateFrame(2, 0.016, 2);

      expect(seen).toHaveLength(2);
      expect(seen[1]!.props, 'one object for every frame').toBe(seen[0]!.props);
      expect(
        seen.map(({frameNo}) => frameNo),
        'each call reads the values of its own frame',
      ).toEqual([1, 2]);
    });

    it('keeps the retained first-frame props apart from the per-frame props', () => {
      const stage = makeStage();
      let updateFrameProps: unknown;
      on(stage, OnStageUpdateFrame, (props: unknown) => {
        updateFrameProps = props;
      });

      stage.updateFrame(1, 0.016, 1);
      stage.updateFrame(2, 0.016, 2);

      const firstFrame = vi.fn();
      on(stage, OnStageFirstFrame, firstFrame);

      expect(firstFrame).toHaveBeenCalledTimes(1);
      expect(firstFrame.mock.calls[0]![0]).toMatchObject({stage, frameNo: 1});
      expect(firstFrame.mock.calls[0]![0], 'a late subscriber reads the first frame, not the current one').not.toBe(
        updateFrameProps,
      );
    });

    it('emits OnStageFirstFrame to a subscriber from the start once, not again in the next frame', () => {
      const stage = makeStage();
      const firstFrame = vi.fn();
      on(stage, OnStageFirstFrame, firstFrame);

      stage.updateFrame(1, 0.016, 1);
      stage.updateFrame(2, 0.016, 2);

      expect(firstFrame).toHaveBeenCalledTimes(1);
      expect(firstFrame.mock.calls[0]![0]).toMatchObject({stage, frameNo: 1});
    });

    it('emits neither frame event while the stage has no camera', () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      const firstFrame = vi.fn();
      const updateFrame = vi.fn();
      on(stage, OnStageFirstFrame, firstFrame);
      on(stage, OnStageUpdateFrame, updateFrame);

      stage.updateFrame(1, 0.016, 1);
      stage.updateFrame(2, 0.016, 2);
      expect(firstFrame).not.toHaveBeenCalled();
      expect(updateFrame).not.toHaveBeenCalled();

      stage.resize(800, 600);
      stage.updateFrame(3, 0.016, 3);
      expect(firstFrame).toHaveBeenCalledTimes(1);
      expect(updateFrame).toHaveBeenCalledTimes(1);
    });
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

  it('lets the projection place a camera it was given', () => {
    const stage = new Stage2D(
      new OrthographicProjection('xy|bottom-left', {
        fit: 'contain',
        width: 640,
        near: 1,
        far: 4000,
        distanceToProjectionPlane: 300,
      }),
    );
    const custom = new OrthographicCamera();
    custom.position.set(11, 22, 33);
    stage.camera = custom;

    stage.resize(800, 600);

    expect(stage.camera, 'the stage renders with the camera it was given').toBe(custom);
    expect([custom.near, custom.far], 'near and far of the specs').toEqual([1, 4000]);
    expect(custom.right - custom.left, 'the frustum of the projection').toBe(640);
    expect(custom.position.z, 'the distance to the projection plane').toBe(300);
  });

  // a stage that was resized once and then handed a camera its projection cannot place: the
  // assignment goes through by itself, the next resize() is where the projection says no
  const createStageWithRefusedCamera = () => {
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
    stage.resize(800, 600);
    expect([stage.width, stage.height]).toEqual([640, 480]);

    stage.camera = new OrthographicCamera();
    return stage;
  };

  it('a resize the projection refuses leaves the stage the size it had', () => {
    const stage = createStageWithRefusedCamera();

    const onResize = vi.fn();
    on(stage, OnStageResize, onResize);

    expect(() => stage.resize(1024, 512)).toThrow(TypeError);

    expect([stage.width, stage.height], 'the view of the refused resize was never reached').toEqual([640, 480]);
    expect([stage.containerWidth, stage.containerHeight], 'the container size of the refused resize').toEqual([800, 600]);
    expect(onResize).not.toHaveBeenCalled();
  });

  it('a resize refused once goes through when the camera fits', () => {
    const stage = createStageWithRefusedCamera();
    expect(() => stage.resize(1024, 512)).toThrow(TypeError);

    const onResize = vi.fn();
    on(stage, OnStageResize, onResize);

    stage.camera = new PerspectiveCamera();
    stage.resize(1024, 512);

    expect(onResize).toHaveBeenCalledTimes(1);
    expect([stage.width, stage.height]).toEqual([640, 320]);
    expect([stage.containerWidth, stage.containerHeight]).toEqual([1024, 512]);
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

  describe('camera', () => {
    const createResizedStage = () => {
      const projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640});
      const stage = new Stage2D(projection);
      stage.resize(800, 600);
      return {projection, stage, projectionCamera: stage.camera as PerspectiveCamera};
    };

    it('answers an assigned camera while the projection has one of its own', () => {
      const {stage, projectionCamera} = createResizedStage();
      expect(projectionCamera).toBeInstanceOf(PerspectiveCamera);

      const assigned = new PerspectiveCamera();
      stage.camera = assigned;

      expect(stage.camera).toBe(assigned);
    });

    it('hands back the very projection camera it had once the assignment is cleared', () => {
      const {projection, stage, projectionCamera} = createResizedStage();
      stage.camera = new PerspectiveCamera();
      const createCamera = vi.spyOn(projection, 'createCamera');

      stage.camera = undefined;

      expect(stage.camera).toBe(projectionCamera);
      expect(createCamera).not.toHaveBeenCalled();
    });

    it('announces the camera the first resize() with an area creates', () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      const changed = vi.fn();
      on(stage, OnStageAfterCameraChanged, changed);

      stage.resize(800, 600);

      expect(changed).toHaveBeenCalledTimes(1);
      expect(changed).toHaveBeenCalledWith(stage, undefined);
    });

    it('announces an assigned camera and a cleared assignment with the camera each replaced', () => {
      const {stage, projectionCamera} = createResizedStage();
      const changed = vi.fn();
      on(stage, OnStageAfterCameraChanged, changed);
      const assigned = new PerspectiveCamera();

      stage.camera = assigned;
      expect(changed).toHaveBeenCalledTimes(1);
      expect(changed).toHaveBeenLastCalledWith(stage, projectionCamera);

      stage.camera = undefined;
      expect(changed).toHaveBeenCalledTimes(2);
      expect(changed).toHaveBeenLastCalledWith(stage, assigned);
    });

    it('does not announce the camera it already has', () => {
      const {stage} = createResizedStage();
      const changed = vi.fn();
      on(stage, OnStageAfterCameraChanged, changed);
      const assigned = new PerspectiveCamera();

      stage.camera = assigned;
      stage.camera = assigned;

      expect(changed).toHaveBeenCalledTimes(1);
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

    it('releasePassNodeMemory() releases the render target of its pass node and keeps the node', () => {
      const stage = makeStage();
      stage.releasePassNodeMemory();
      const passNode = stage.asPassNode(noRenderer) as PassNode;
      const rtDispose = sandbox.spy(passNode.renderTarget, 'dispose');

      stage.releasePassNodeMemory();

      expect(rtDispose.callCount).toBe(1);
      expect(rtDispose.firstCall.thisValue).toBe(passNode.renderTarget);
      expect(stage.asPassNode(noRenderer), 'the same node').toBe(passNode);

      stage.dispose();
      rtDispose.resetHistory();
      stage.releasePassNodeMemory();
      expect(rtDispose.callCount, 'after dispose()').toBe(0);
    });

    it('keeps its node for a new camera and renders through that camera', () => {
      const stage = makeStage();
      const node = stage.asPassNode(noRenderer) as PassNode;
      const nodeDispose = sandbox.spy(node, 'dispose');

      const camera = new PerspectiveCamera();
      stage.camera = camera;

      expect(stage.asPassNode(noRenderer), 'the same node').toBe(node);
      expect(node.camera).toBe(camera);
      expect(nodeDispose.called, 'nothing released').toBe(false);
    });

    it('keeps its node for a new scene and renders that scene', () => {
      const stage = makeStage();
      const node = stage.asPassNode(noRenderer) as PassNode;
      const nodeDispose = sandbox.spy(node, 'dispose');

      const scene = new Scene();
      stage.scene = scene;

      expect(stage.asPassNode(noRenderer), 'the same node').toBe(node);
      expect(node.scene).toBe(scene);
      expect(nodeDispose.called, 'nothing released').toBe(false);
    });

    it('a node handed out before follows a new camera and a new scene without another asPassNode()', () => {
      const stage = makeStage();
      const node = stage.asPassNode(noRenderer) as PassNode;

      const camera = new OrthographicCamera();
      stage.camera = camera;
      expect(node.camera).toBe(camera);

      const scene = new Scene();
      stage.scene = scene;
      expect(node.scene).toBe(scene);

      // back to the camera of the projection
      stage.camera = undefined;
      expect(node.camera).toBe(stage.camera);
      expect(node.camera).not.toBe(camera);
    });

    it('a camera that goes away leaves the node with the camera it had, and the next one goes into it', () => {
      const stage = makeStage();
      const node = stage.asPassNode(noRenderer) as PassNode;
      const before = stage.camera;

      stage.projection = undefined;
      expect(stage.camera).toBeUndefined();
      expect(node.camera, 'the camera it had').toBe(before);

      stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640});
      expect(stage.camera).toBeDefined();
      expect(stage.camera).not.toBe(before);
      expect(node.camera).toBe(stage.camera);
      expect(stage.asPassNode(noRenderer), 'the same node').toBe(node);
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

    it('a dispose listener that throws does not keep the stage from releasing its pass node and its listeners', () => {
      const stage = makeStage();
      const passNode = stage.asPassNode(noRenderer) as PassNode;
      const passNodeDispose = sandbox.spy(passNode, 'dispose');
      const failure = new Error('the listener failed');
      const heard = vi.fn();
      on(stage, OnStageDispose, () => {
        throw failure;
      });
      on(stage, OnStageDispose, heard);

      let caught: unknown;
      try {
        stage.dispose();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBe(failure);
      expect(heard, 'the listener behind the one that throws').toHaveBeenCalledTimes(1);
      expect(passNodeDispose.calledOnce).toBe(true);
      expect(getSubscriptionCount(stage)).toBe(0);
    });

    it('an error from releasing the pass node reaches the caller together with the error of a dispose listener', () => {
      const stage = makeStage();
      const passNode = stage.asPassNode(noRenderer) as PassNode;
      const listenerFailure = new Error('the listener failed');
      const releaseFailure = new Error('the release failed');
      sandbox.stub(passNode, 'dispose').throws(releaseFailure);
      const heard = vi.fn();
      on(stage, OnStageDispose, () => {
        throw listenerFailure;
      });
      on(stage, OnStageDispose, heard);

      let caught: unknown;
      try {
        stage.dispose();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect((caught as AggregateError).errors).toEqual([listenerFailure, releaseFailure]);
      expect((caught as AggregateError).message).toMatch(/^Stage2D#dispose\(\)/);
      expect(heard, 'the listener behind the one that throws').toHaveBeenCalledTimes(1);
      expect(stage.isDisposed).toBe(true);
      expect(getSubscriptionCount(stage)).toBe(0);
    });

    it('two dispose listeners that throw reach the caller as one AggregateError of both errors, after the teardown', () => {
      const stage = makeStage();
      const passNode = stage.asPassNode(noRenderer) as PassNode;
      const passNodeDispose = sandbox.spy(passNode, 'dispose');
      const first = new Error('the first listener failed');
      const second = new Error('the second listener failed');
      on(stage, OnStageDispose, () => {
        throw first;
      });
      on(stage, OnStageDispose, () => {
        throw second;
      });

      let caught: unknown;
      try {
        stage.dispose();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect((caught as AggregateError).errors).toEqual([first, second]);
      expect(passNodeDispose.calledOnce).toBe(true);
      expect(stage.isDisposed).toBe(true);
      expect(getSubscriptionCount(stage)).toBe(0);
    });

    it('two dispose listeners that throw and a failing release of the pass node reach the caller as an AggregateError of the AggregateError of the listeners and the error of the release', () => {
      const stage = makeStage();
      const passNode = stage.asPassNode(noRenderer) as PassNode;
      const first = new Error('the first listener failed');
      const second = new Error('the second listener failed');
      const releaseFailure = new Error('the release failed');
      sandbox.stub(passNode, 'dispose').throws(releaseFailure);
      on(stage, OnStageDispose, () => {
        throw first;
      });
      on(stage, OnStageDispose, () => {
        throw second;
      });

      let caught: unknown;
      try {
        stage.dispose();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect((caught as AggregateError).message).toMatch(/^Stage2D#dispose\(\)/);
      const {errors} = caught as AggregateError;
      expect(errors).toHaveLength(2);
      expect(errors[0]).toBeInstanceOf(AggregateError);
      expect((errors[0] as AggregateError).errors).toEqual([first, second]);
      expect(errors[1]).toBe(releaseFailure);
      expect(stage.isDisposed).toBe(true);
      expect(getSubscriptionCount(stage)).toBe(0);
    });

    it('an error from releasing the pass node reaches the caller unchanged when no listener throws', () => {
      const stage = makeStage();
      const passNode = stage.asPassNode(noRenderer) as PassNode;
      const releaseFailure = new Error('the release failed');
      sandbox.stub(passNode, 'dispose').throws(releaseFailure);

      let caught: unknown;
      try {
        stage.dispose();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBe(releaseFailure);
      expect(stage.isDisposed).toBe(true);
    });

    it('announces its dispose to a listener of IStageDispose with the stage', () => {
      const stage = makeStage();
      const heard = vi.fn();
      const listener: IStageDispose = {[OnStageDispose]: heard};
      on(stage, listener);

      stage.dispose();

      expect(heard).toHaveBeenCalledExactlyOnceWith(stage);
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

    it('takes a scene after dispose() and announces nothing', () => {
      const stage = makeStage();
      stage.dispose();

      const changed = vi.fn();
      on(stage, OnStageAfterSceneChanged, changed);

      const next = new Scene();
      stage.scene = next;

      expect(stage.scene).toBe(next);
      expect(changed).not.toHaveBeenCalled();
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
      on(stage, OnStageDispose, disposed);
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

  describe('a listener of a change of state that throws', () => {
    it('a camera listener that throws as the previous projection lets go of its camera leaves the stage with the camera of the new one', () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      stage.resize(800, 600);
      const previousCamera = stage.camera;
      const failure = new Error('the listener failed');
      // throws once, for the drop of the camera of the previous projection
      const listener = vi.fn().mockImplementationOnce(() => {
        throw failure;
      });
      on(stage, OnStageAfterCameraChanged, listener);

      expect(() => {
        stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320});
      }).toThrow(failure);

      expect(stage.camera).toBeDefined();
      expect(stage.camera).not.toBe(previousCamera);
      expect([stage.width, stage.height]).toEqual([320, 240]);
      expect(listener, 'the drop and the new camera').toHaveBeenCalledTimes(2);
    });

    it('a camera listener that takes the projection away as the previous one lets go of its camera leaves the stage without one', () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      stage.resize(800, 600);
      once(stage, OnStageAfterCameraChanged, () => {
        stage.projection = undefined;
      });

      expect(() => {
        stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320});
      }).not.toThrow();

      expect(stage.projection).toBeUndefined();
      expect(stage.camera).toBeUndefined();
      expect([stage.width, stage.height]).toEqual([0, 0]);
    });

    it('a first-frame listener that throws leaves the first frame behind it', () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      stage.resize(320, 200);
      const failure = new Error('the listener failed');
      on(stage, OnStageFirstFrame, () => {
        throw failure;
      });
      const second = vi.fn();
      on(stage, OnStageFirstFrame, second);
      const frames: number[] = [];
      on(stage, OnStageUpdateFrame, ({frameNo}: {frameNo: number}) => {
        frames.push(frameNo);
      });

      expect(() => stage.updateFrame(1, 0.016, 1)).toThrow(failure);

      expect(second, 'the listener behind the one that throws').toHaveBeenCalledTimes(1);
      expect(stage.isFirstFrame).toBe(false);
      expect(frames, 'frame 1 reaches OnStageUpdateFrame all the same').toEqual([1]);

      expect(() => stage.updateFrame(2, 0.016, 2)).not.toThrow();
      expect(second, 'no second first frame').toHaveBeenCalledTimes(1);
      expect(frames).toEqual([1, 2]);

      const late = vi.fn();
      on(stage, OnStageFirstFrame, late);
      expect(late).toHaveBeenCalledTimes(1);
      expect(late.mock.calls[0]![0]).toMatchObject({stage, frameNo: 1});
    });

    it('a resize listener that throws leaves the stage the new container, and the listener behind it hears the size', () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      stage.resize(800, 600);
      const failure = new Error('the listener failed');
      on(stage, OnStageResize, () => {
        throw failure;
      });
      const second = vi.fn();
      on(stage, OnStageResize, second);

      expect(() => stage.resize(640, 640)).toThrow(failure);

      expect([stage.containerWidth, stage.containerHeight]).toEqual([640, 640]);
      expect([stage.width, stage.height]).toEqual([640, 640]);
      expect(second).toHaveBeenCalledTimes(1);
      expect(second.mock.calls[0]![0]).toMatchObject({stage, width: 640, height: 640});
    });

    it('a camera listener and a resize listener that throw on the first resize() with an area come out as one AggregateError', () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      stage.needsUpdate = true;
      const cameraFailure = new Error('the camera listener failed');
      const resizeFailure = new Error('the resize listener failed');
      on(stage, OnStageAfterCameraChanged, () => {
        throw cameraFailure;
      });
      on(stage, OnStageResize, () => {
        throw resizeFailure;
      });

      let caught: unknown;
      try {
        stage.resize(800, 600);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect((caught as AggregateError).errors).toEqual([cameraFailure, resizeFailure]);
      expect((caught as AggregateError).message).toBe(
        'Stage2D#resize(): more than one listener of OnStageAfterCameraChanged and OnStageResize threw',
      );
      expect(stage.camera).toBeDefined();
      expect([stage.containerWidth, stage.containerHeight]).toEqual([800, 600]);
      expect([stage.width, stage.height]).toEqual([640, 480]);
      expect(stage.needsUpdate).toBe(false);
    });

    it('a scene listener that throws leaves the stage with the new scene and every listener heard it', () => {
      const stage = new Stage2D();
      const next = new Scene();
      const failure = new Error('the listener failed');
      on(stage, OnStageAfterSceneChanged, () => {
        throw failure;
      });
      const second = vi.fn();
      on(stage, OnStageAfterSceneChanged, second);

      expect(() => {
        stage.scene = next;
      }).toThrow(failure);

      expect(stage.scene).toBe(next);
      expect(second).toHaveBeenCalledTimes(1);
    });
  });

  describe('OnStageCameraPlaced', () => {
    it('carries stage.camera after every placement on a stage without a driver', () => {
      const projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640});
      const stage = new Stage2D(projection);
      const placed: Camera[] = [];
      const props: StageCameraPlacedProps[] = [];
      on(stage, OnStageCameraPlaced, (p: StageCameraPlacedProps) => {
        props.push(p);
        placed.push(p.camera);
        expect(p.stage).toBe(stage);
        expect(p.projection).toBe(stage.projection);
        expect(p.camera, 'the camera the stage draws with').toBe(stage.camera);
      });

      stage.resize(800, 600);
      const created = stage.camera;
      expect(placed, 'the camera the first resize() created').toEqual([created]);

      stage.updateProjection(true);
      expect(placed).toHaveLength(2);

      const assigned = new PerspectiveCamera();
      stage.camera = assigned;
      expect(placed, 'an assignment places nothing by itself').toHaveLength(2);
      stage.resize(640, 480);
      expect(placed[2]).toBe(assigned);

      stage.camera = undefined;
      stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320});
      expect(placed).toHaveLength(4);
      expect(placed[3]).toBe(stage.camera);

      expect(new Set(props).size, 'one props object per stage, rewritten').toBe(1);
    });

    it('goes out when an assignment of undefined hands back to a camera the projection creates', () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      stage.camera = new PerspectiveCamera();
      stage.resize(800, 600);
      const placed = vi.fn();
      on(stage, OnStageCameraPlaced, placed);

      stage.camera = undefined;

      expect(placed).toHaveBeenCalledTimes(1);
      expect(placed.mock.calls[0]![0].camera).toBe(stage.camera);
    });

    it('lets a listener change the camera the projection placed', () => {
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      on(stage, OnStageCameraPlaced, ({camera}: StageCameraPlacedProps) => {
        camera.rotateX(0.1);
      });

      stage.resize(800, 600);

      const untilted = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
      untilted.resize(800, 600);
      expect(stage.camera!.quaternion.angleTo(untilted.camera!.quaternion)).toBeCloseTo(0.1);
      expect(stage.camera!.position.equals(untilted.camera!.position)).toBe(true);
    });
  });

  describe('a camera driver', () => {
    // a driver that records its calls into the log the listeners of the stage write into too
    class FakeDriver implements StageCameraDriver {
      camera: Camera;
      base?: Camera;
      // the rotation about x of the base camera, as compose() found it
      composedTilt: number[] = [];

      constructor(
        readonly log: string[],
        camera: Camera = new PerspectiveCamera(),
      ) {
        this.camera = camera;
      }

      placeBase(projection: IProjection): Camera {
        this.log.push('placeBase');
        if (this.base == null || projection instanceof OrthographicProjection !== isOrthographic(this.base)) {
          this.base = projection.createCamera();
        } else {
          projection.updateCamera(this.base);
        }
        return this.base;
      }

      compose(): void {
        this.log.push('compose');
        this.composedTilt.push(this.base!.rotation.x);
      }

      write(): void {
        this.log.push('write');
      }
    }

    const isOrthographic = (camera: Camera) => (camera as OrthographicCamera).isOrthographicCamera === true;

    const createStage = (projection: IProjection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640})) => {
      const stage = new Stage2D(projection);
      stage.resize(800, 600);
      const log: string[] = [];
      on(stage, OnStageCameraPlaced, () => log.push('placed'));
      on(stage, OnStageResize, () => log.push('resize'));
      on(stage, OnStageUpdateFrame, () => log.push('frame'));
      return {stage, log, driver: new FakeDriver(log)};
    };

    it('stage.camera answers the camera of the driver before an assigned one and the projection one', () => {
      const {stage, driver} = createStage();
      const projectionCamera = stage.camera;
      const assigned = new PerspectiveCamera();
      stage.camera = assigned;

      Stage2DInternals.attachDriver(stage, driver);
      expect(stage.camera).toBe(driver.camera);
      expect(Stage2DInternals.driverOf(stage)).toBe(driver);

      // an assignment while the driver is attached is kept for after
      const later = new PerspectiveCamera();
      stage.camera = later;
      expect(stage.camera).toBe(driver.camera);
      stage.camera = undefined;
      expect(stage.camera).toBe(driver.camera);
      stage.camera = later;

      Stage2DInternals.detachDriver(stage);
      expect(Stage2DInternals.driverOf(stage)).toBeUndefined();
      expect(stage.camera).toBe(later);
      stage.camera = undefined;
      expect(stage.camera).toBe(projectionCamera);
    });

    it('places on attach: placeBase(), then the event, then compose()', () => {
      const {stage, log, driver} = createStage();
      const placed = vi.fn();
      on(stage, OnStageCameraPlaced, placed);

      Stage2DInternals.attachDriver(stage, driver);

      expect(log).toEqual(['placeBase', 'placed', 'compose']);
      expect(placed.mock.calls[0]![0]).toMatchObject({stage, camera: driver.base, projection: stage.projection});
    });

    it('hands every placement to placeBase(), then the event, then compose()', () => {
      const {stage, log, driver} = createStage();
      Stage2DInternals.attachDriver(stage, driver);
      const projection = stage.projection!;
      const updateCamera = vi.spyOn(projection, 'updateCamera');
      const placed = vi.fn();
      on(stage, OnStageCameraPlaced, placed);

      log.length = 0;
      stage.resize(640, 640);
      expect(log, 'resize()').toEqual(['placeBase', 'placed', 'compose', 'resize']);

      log.length = 0;
      stage.updateProjection(true);
      expect(log, 'updateProjection(true)').toEqual(['placeBase', 'placed', 'compose']);

      log.length = 0;
      stage.needsUpdate = true;
      stage.updateFrame(1, 0.016, 1);
      expect(log, 'needsUpdate in updateFrame()').toEqual(['placeBase', 'placed', 'compose', 'write', 'frame']);

      log.length = 0;
      const next = new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 320});
      stage.projection = next;
      expect(log, 'a new projection').toEqual(['placeBase', 'placed', 'compose', 'resize']);
      expect(isOrthographic(driver.base!), 'the base of the kind of the new projection').toBe(true);

      for (const [{camera}] of placed.mock.calls as [StageCameraPlacedProps][]) {
        expect(camera, 'the base camera of the driver').toBe(driver.base);
        expect(camera).not.toBe(stage.camera);
      }
      expect(updateCamera).toHaveBeenCalled();
      expect(
        updateCamera.mock.calls.some(([camera]) => camera === driver.camera),
        'the camera the stage draws with is never placed',
      ).toBe(false);
    });

    it('composes over what a listener of OnStageCameraPlaced changed', () => {
      const {stage, driver} = createStage();
      on(stage, OnStageCameraPlaced, ({camera}: StageCameraPlacedProps) => {
        camera.rotateX(0.25);
      });

      Stage2DInternals.attachDriver(stage, driver);
      stage.resize(640, 480);

      expect(driver.composedTilt).toHaveLength(2);
      for (const tilt of driver.composedTilt) expect(tilt).toBeCloseTo(0.25);
    });

    it('writes the camera in every frame, before OnStageUpdateFrame', () => {
      const {stage, log, driver} = createStage();
      Stage2DInternals.attachDriver(stage, driver);
      const first: string[] = [];
      on(stage, OnStageFirstFrame, () => first.push(log.at(-1)!));

      log.length = 0;
      stage.updateFrame(1, 0.016, 1);
      stage.updateFrame(2, 0.016, 2);

      expect(log).toEqual(['write', 'frame', 'write', 'frame']);
      expect(first, 'the first frame comes after the write as well').toEqual(['write']);
    });

    describe('needsPlacement()', () => {
      it('places in updateFrame() without updateViewRect() when it answers true', () => {
        const {stage, log, driver} = createStage();
        Stage2DInternals.attachDriver(stage, driver);
        const projection = stage.projection!;
        const needsPlacement = vi.fn(() => true);
        projection.needsPlacement = needsPlacement;
        const updateViewRect = vi.spyOn(projection, 'updateViewRect');
        const getViewRect = vi.spyOn(projection, 'getViewRect');

        log.length = 0;
        stage.updateFrame(1, 0.016, 1);

        expect(log).toEqual(['placeBase', 'placed', 'compose', 'write', 'frame']);
        expect(needsPlacement).toHaveBeenCalledWith(stage.camera);
        expect(updateViewRect).not.toHaveBeenCalled();
        expect(getViewRect).not.toHaveBeenCalled();
      });

      it('places nothing in updateFrame() when it answers false', () => {
        const {stage, log, driver} = createStage();
        Stage2DInternals.attachDriver(stage, driver);
        stage.projection!.needsPlacement = () => false;

        log.length = 0;
        stage.updateFrame(1, 0.016, 1);

        expect(log).toEqual(['write', 'frame']);
      });

      it('places stage.camera through the projection on a stage without a driver', () => {
        const {stage, log} = createStage();
        const projection = stage.projection!;
        projection.needsPlacement = () => true;
        const updateCamera = vi.spyOn(projection, 'updateCamera');
        const updateViewRect = vi.spyOn(projection, 'updateViewRect');
        const placed = vi.fn();
        on(stage, OnStageCameraPlaced, placed);

        log.length = 0;
        stage.updateFrame(1, 0.016, 1);

        expect(log).toEqual(['placed', 'frame']);
        expect(updateCamera).toHaveBeenCalledWith(stage.camera);
        expect(updateViewRect).not.toHaveBeenCalled();
        expect(placed.mock.calls[0]![0].camera).toBe(stage.camera);
      });

      it('a listener of OnStageCameraPlaced that throws in it ends the frame after compose()', () => {
        const {stage, log, driver} = createStage();
        Stage2DInternals.attachDriver(stage, driver);
        stage.projection!.needsPlacement = () => true;
        const failure = new Error('the listener failed');
        on(stage, OnStageCameraPlaced, () => {
          throw failure;
        });

        log.length = 0;
        expect(() => stage.updateFrame(1, 0.016, 1)).toThrow(failure);

        expect(log).toEqual(['placeBase', 'placed', 'compose']);
      });
    });

    it('announces the camera of the driver on attach, on announceCamera() and on detach', () => {
      const {stage, driver} = createStage();
      const projectionCamera = stage.camera;
      const changed = vi.fn();
      on(stage, OnStageAfterCameraChanged, changed);

      Stage2DInternals.attachDriver(stage, driver);
      expect(changed).toHaveBeenCalledTimes(1);
      expect(changed).toHaveBeenLastCalledWith(stage, projectionCamera);

      const before = driver.camera;
      driver.camera = new OrthographicCamera();
      Stage2DInternals.announceCamera(stage);
      expect(changed).toHaveBeenCalledTimes(2);
      expect(changed).toHaveBeenLastCalledWith(stage, before);
      expect(stage.camera).toBe(driver.camera);

      // nothing swapped, nothing to announce
      Stage2DInternals.announceCamera(stage);
      expect(changed).toHaveBeenCalledTimes(2);

      const last = driver.camera;
      Stage2DInternals.detachDriver(stage);
      expect(changed).toHaveBeenCalledTimes(3);
      expect(changed).toHaveBeenLastCalledWith(stage, last);
      expect(stage.camera).toBe(projectionCamera);
    });

    it('a pass node follows the camera of the driver', () => {
      const {stage, driver} = createStage();
      const node = stage.asPassNode(noRenderer) as PassNode;

      Stage2DInternals.attachDriver(stage, driver);
      expect(node.camera).toBe(driver.camera);

      driver.camera = new PerspectiveCamera();
      Stage2DInternals.announceCamera(stage);
      expect(node.camera).toBe(driver.camera);

      Stage2DInternals.detachDriver(stage);
      expect(node.camera).toBe(stage.camera);
    });

    it('places the camera it takes back on detach', () => {
      const {stage, driver} = createStage();
      const assigned = new PerspectiveCamera();
      stage.camera = assigned;
      Stage2DInternals.attachDriver(stage, driver);
      stage.resize(640, 640);

      Stage2DInternals.detachDriver(stage);

      expect(stage.camera).toBe(assigned);
      expect(assigned.aspect, 'placed for the container of the resize under the driver').toBe(1);
    });

    it('takes back an assigned camera of the kind the projection builds', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const {stage, driver} = createStage(new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 640}));
        const assigned = new OrthographicCamera();
        stage.camera = assigned;
        Stage2DInternals.attachDriver(stage, driver);
        stage.projection = new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 320});

        Stage2DInternals.detachDriver(stage);

        expect(stage.camera).toBe(assigned);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('drops an assigned camera of another kind than the projection builds, with a warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const {stage, driver} = createStage(new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 640}));
        stage.name = 'map';
        const assigned = new OrthographicCamera();
        stage.camera = assigned;
        Stage2DInternals.attachDriver(stage, driver);
        stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640});
        const changed = vi.fn();
        on(stage, OnStageAfterCameraChanged, changed);

        expect(() => Stage2DInternals.detachDriver(stage)).not.toThrow();

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]![0]).toMatch(/^Stage2D "map": /);
        expect(warn.mock.calls[0]![0]).toContain('OrthographicCamera');
        expect(stage.camera).toBeInstanceOf(PerspectiveCamera);
        expect(changed, 'the camera the projection built is announced').toHaveBeenLastCalledWith(stage, undefined);

        // the assignment is gone: a new driver and its detach leave the projection camera in place
        const camera = stage.camera;
        Stage2DInternals.attachDriver(stage, new FakeDriver([]));
        Stage2DInternals.detachDriver(stage);
        expect(stage.camera).toBe(camera);
        expect(warn).toHaveBeenCalledTimes(1);
      } finally {
        warn.mockRestore();
      }
    });

    it('a listener of OnStageCameraPlaced that throws in a resize() leaves the driver composed and every listener heard', () => {
      const {stage, log, driver} = createStage();
      Stage2DInternals.attachDriver(stage, driver);
      const failure = new Error('the listener failed');
      on(stage, OnStageCameraPlaced, () => {
        throw failure;
      });
      const second = vi.fn();
      on(stage, OnStageCameraPlaced, second);

      log.length = 0;
      expect(() => stage.resize(640, 640)).toThrow(failure);

      expect(log, 'the driver composes, the size is announced').toEqual(['placeBase', 'placed', 'compose', 'resize']);
      expect(second, 'the listener behind the one that throws').toHaveBeenCalledTimes(1);
      expect([stage.containerWidth, stage.containerHeight]).toEqual([640, 640]);
      expect([stage.width, stage.height]).toEqual([640, 640]);
      expect(stage.camera).toBe(driver.camera);
    });

    it('a projection that refuses the base leaves the stage the size it had', () => {
      const {stage, log, driver} = createStage();
      Stage2DInternals.attachDriver(stage, driver);
      const refusal = new Error('the projection refused');
      vi.spyOn(driver, 'placeBase').mockImplementation(() => {
        throw refusal;
      });

      log.length = 0;
      expect(() => stage.resize(640, 640)).toThrow(refusal);

      expect(log).toEqual([]);
      expect([stage.containerWidth, stage.containerHeight]).toEqual([800, 600]);
      expect([stage.width, stage.height]).toEqual([640, 480]);
    });
  });

  it('does not expose the removed clearColor / clearAlpha / autoClear properties', () => {
    const stage = new Stage2D() as any;
    expect(stage.clearColor).toBeUndefined();
    expect(stage.clearAlpha).toBeUndefined();
    expect(stage.autoClear).toBeUndefined();
  });
});

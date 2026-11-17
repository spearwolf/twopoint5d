import {on} from '@spearwolf/eventize';
import {
  AnimationClip,
  AnimationMixer,
  Camera,
  Group,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  Vector3,
  VectorKeyframeTrack,
  type WebGPURenderer,
} from 'three/webgpu';
import {describe, expect, it, vi} from 'vitest';
import {FramePacer, type FramePacerSource} from '../display/FramePacer.js';
import type {DisplayEventProps} from '../display/types.js';
import {OnStageAfterCameraChanged, OnStageCameraPlaced, OnStageUpdateFrame} from '../events.js';
import {CameraProjection} from './CameraProjection.js';
import {CameraRig, type CameraTrackKey} from './CameraRig.js';
import type {IProjection} from './IProjection.js';
import type {ProjectionPlaneDescription} from './ProjectionPlane.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D, Stage2DInternals} from './Stage2D.js';

const DEG = Math.PI / 180;

type Kind = 'parallax' | 'orthographic';

const makeProjection = (kind: Kind, plane: ProjectionPlaneDescription = 'xy|bottom-left', specs: object = {}) =>
  kind === 'parallax'
    ? new ParallaxProjection(plane, {fit: 'contain', width: 640, ...specs})
    : new OrthographicProjection(plane, {fit: 'contain', width: 640, ...specs});

const makeStage = (kind: Kind = 'parallax', plane: ProjectionPlaneDescription = 'xy|bottom-left', specs: object = {}) => {
  const stage = new Stage2D(makeProjection(kind, plane, specs));
  stage.resize(800, 600);
  return stage;
};

const makeRig = (kind: Kind = 'parallax', plane: ProjectionPlaneDescription = 'xy|bottom-left', specs: object = {}) => {
  const stage = makeStage(kind, plane, specs);
  return {stage, rig: new CameraRig(stage)};
};

let frameNo = 0;
const frame = (stage: Stage2D) => stage.updateFrame(frameNo, 1 / 60, frameNo++);

/** The direction the camera looks along, in the world. */
const directionOf = (camera: Camera) => camera.getWorldDirection(new Vector3());

/** `tan(fov / 2)` of a perspective camera. */
const lensOf = (camera: PerspectiveCamera) => Math.tan((camera.fov * DEG) / 2);

/** Whether `promise` has settled once the queue of microtasks and one task have run. */
const hasSettled = async (promise: Promise<unknown>) => {
  let settled = false;
  promise.then(
    () => void (settled = true),
    () => void (settled = true),
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  return settled;
};

/** Expects `camera` to carry exactly what `reference` carries, as the projection placed it. */
const expectPlacedAs = (camera: Camera, reference: Camera) => {
  reference.updateMatrixWorld();
  expect(camera.position.toArray()).toEqual(reference.position.toArray());
  expect(camera.quaternion.toArray()).toEqual(reference.quaternion.toArray());
  expect(camera.projectionMatrix.elements).toEqual(reference.projectionMatrix.elements);
  expect(camera.matrixWorld.elements).toEqual(reference.matrixWorld.elements);
  if ((reference as PerspectiveCamera).isPerspectiveCamera) {
    const r = reference as PerspectiveCamera;
    const c = camera as PerspectiveCamera;
    expect([c.fov, c.aspect, c.near, c.far, c.zoom]).toEqual([r.fov, r.aspect, r.near, r.far, r.zoom]);
  } else {
    const r = reference as OrthographicCamera;
    const c = camera as OrthographicCamera;
    expect([c.left, c.right, c.top, c.bottom, c.near, c.far, c.zoom]).toEqual([
      r.left,
      r.right,
      r.top,
      r.bottom,
      r.near,
      r.far,
      r.zoom,
    ]);
  }
};

/**
 * A projection of a class the rig does not know, without a plane: it builds a camera of `kind` that
 * looks down -z from z 300 (perspective) or 100 (orthographic) at a view 640 wide.
 */
const customProjection = (kind: 'perspective' | 'orthographic' = 'perspective') => {
  let width = 0;
  let height = 0;
  const place = (camera: Camera) => {
    if (kind === 'perspective') {
      const c = camera as PerspectiveCamera;
      c.fov = (2 * Math.atan(height / 2 / 300)) / DEG;
      c.aspect = width / height;
      c.near = 0.1;
      c.far = 10000;
      c.position.set(0, 0, 300);
      c.updateProjectionMatrix();
    } else {
      const c = camera as OrthographicCamera;
      c.left = -width / 2;
      c.right = width / 2;
      c.top = height / 2;
      c.bottom = -height / 2;
      c.near = 0.1;
      c.far = 10000;
      c.position.set(0, 0, 100);
      c.updateProjectionMatrix();
    }
    camera.quaternion.identity();
  };
  const isOfKind = (camera: Camera) =>
    kind === 'perspective'
      ? (camera as PerspectiveCamera).isPerspectiveCamera === true
      : (camera as OrthographicCamera).isOrthographicCamera === true;
  const projection = {
    projectionPlane: undefined,
    updateViewRect(containerWidth: number, containerHeight: number) {
      width = 640;
      height = (640 * containerHeight) / containerWidth;
    },
    getViewRect: () => ({width, height, pixelRatioX: 1, pixelRatioY: 1, offsetX: 0, offsetY: 0}),
    getScaleFactor: () => 1,
    createCamera: vi.fn(() => {
      const camera = kind === 'perspective' ? new PerspectiveCamera() : new OrthographicCamera();
      place(camera);
      return camera;
    }),
    updateCamera: vi.fn((camera: Camera) => {
      if (!isOfKind(camera)) throw new TypeError(`customProjection: a ${kind} projection got a ${camera.type}`);
      place(camera);
    }),
  } satisfies IProjection;
  return projection;
};

const planelessProjection = () => customProjection('perspective');

/** Where `point` lands in the container of `stage`, in its units from the middle. */
const toContainer = (camera: Camera, point: Vector3, stage: Stage2D) => {
  camera.updateMatrixWorld();
  const ndc = point.clone().project(camera);
  return [(ndc.x * stage.containerWidth) / 2, (ndc.y * stage.containerHeight) / 2] as const;
};

/**
 * The largest shift, in units of the container, between the pictures two cameras take of the
 * corners of the view, `depth` in front of and behind the plane.
 */
const shiftBetween = (a: Camera, b: Camera, stage: Stage2D, depth: number) => {
  let max = 0;
  for (const x of [-stage.width / 2, stage.width / 2]) {
    for (const y of [-stage.height / 2, stage.height / 2]) {
      for (const z of [-depth, depth]) {
        const [ax, ay] = toContainer(a, new Vector3(x, y, z), stage);
        const [bx, by] = toContainer(b, new Vector3(x, y, z), stage);
        max = Math.max(max, Math.abs(ax - bx), Math.abs(ay - by));
      }
    }
  }
  return max;
};

/** The visible height of a perspective camera at the plane z = 0 it looks straight at. */
const heightAtPlane = (camera: PerspectiveCamera) => 2 * camera.position.z * Math.tan((camera.fov * DEG) / 2);

/**
 * `camera` as the source a glTF asset would bring: under a parent that is moved, turned and scaled,
 * so that its world pose differs from its local one, and turned itself.
 */
const inParent = <C extends PerspectiveCamera | OrthographicCamera>(camera: C) => {
  const parent = new Group();
  parent.position.set(20, 10, 40);
  parent.rotation.set(0, 0.3, 0);
  parent.scale.setScalar(2);
  parent.add(camera);
  camera.position.set(5, 30, 100);
  camera.rotation.set(-0.2, 0.1, 0);
  return {parent, camera};
};

/** The camera a `CameraProjection` of `source` with the default fit places for the container of `stage`. */
const fittedTo = (source: PerspectiveCamera | OrthographicCamera, stage: Stage2D) => {
  const projection = new CameraProjection(source);
  projection.updateViewRect(stage.containerWidth, stage.containerHeight);
  const camera = projection.createCamera();
  camera.updateMatrixWorld();
  return camera;
};

/** Expects `camera` to show what `reference` shows: the same pose and the same projection, to rounding. */
const expectShowsAs = (camera: Camera, reference: Camera) => {
  camera.updateMatrixWorld();
  reference.updateMatrixWorld();
  for (let i = 0; i < 16; i++) {
    expect(camera.matrixWorld.elements[i], `matrixWorld[${i}]`).toBeCloseTo(reference.matrixWorld.elements[i]!, 9);
    expect(camera.projectionMatrix.elements[i], `projectionMatrix[${i}]`).toBeCloseTo(reference.projectionMatrix.elements[i]!, 9);
  }
};

describe('CameraRig', () => {
  describe('on a stage', () => {
    it('attaches to the stage, which draws with the camera of the rig at the rest of its projection', () => {
      const {stage, rig} = makeRig();
      expect(rig.stage).toBe(stage);
      expect(stage.camera).toBe(rig.camera);
      expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
      expectPlacedAs(rig.camera, stage.projection!.createCamera());
    });

    it('draws with an orthographic camera under an OrthographicProjection', () => {
      const {stage, rig} = makeRig('orthographic');
      expect(stage.camera).toBe(rig.camera);
      expect(rig.camera).toBeInstanceOf(OrthographicCamera);
      expectPlacedAs(rig.camera, stage.projection!.createCamera());
    });

    it('swaps its camera for one of the kind a new projection builds, and the stage announces it', () => {
      const {stage, rig} = makeRig();
      const changed = vi.fn();
      on(stage, OnStageAfterCameraChanged, changed);
      const perspective = rig.camera;

      stage.projection = makeProjection('orthographic');

      expect(rig.camera).toBeInstanceOf(OrthographicCamera);
      expect(stage.camera).toBe(rig.camera);
      expect(changed).toHaveBeenCalledWith(stage, perspective);
      expectPlacedAs(rig.camera, stage.projection.createCamera());
    });

    it('starts on a stage without a view and places its camera with the first resize', () => {
      const stage = new Stage2D(makeProjection('parallax'));
      const rig = new CameraRig(stage);
      expect(stage.camera).toBe(rig.camera);
      expect(rig.step(1 / 60)).toBe(false);

      stage.resize(800, 600);
      expectPlacedAs(rig.camera, stage.projection!.createCamera());
    });

    it('takes one rig per stage', () => {
      const {stage, rig} = makeRig();
      expect(() => new CameraRig(stage)).toThrow(
        new Error('new CameraRig(): the stage has a CameraRig already; dispose it first'),
      );
      rig.dispose();
      const next = new CameraRig(stage);
      expect(stage.camera).toBe(next.camera);
    });
  });

  describe('a pose', () => {
    for (const kind of ['parallax', 'orthographic'] as const) {
      for (const plane of ['xy|bottom-left', 'xz|top-left'] as const) {
        for (const pixelSnap of [false, true]) {
          it(`{} is the placement of the ${kind} projection on ${plane}${pixelSnap ? ' under pixelSnap' : ''}, exactly`, () => {
            const stage = new Stage2D(makeProjection(kind, plane, {pixelSnap}));
            // an odd size, so that pixelSnap moves the view off the middle
            stage.resize(801, 601);
            const rig = new CameraRig(stage);
            rig.jump({position: [10, 20], zoom: 2});
            frame(stage);
            rig.jump({});
            frame(stage);
            expectPlacedAs(rig.camera, stage.projection!.createCamera());
          });
        }
      }
    }

    it('takes x and y on the plane and the distance from it under a ParallaxProjection on xy|bottom-left', () => {
      const {stage, rig} = makeRig('parallax', 'xy|bottom-left');
      const rest = stage.projection!.createCamera();

      rig.jump({position: [10, 20]});
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([10, 20, 300]);
      expect(rig.camera.quaternion.toArray()).toEqual(rest.quaternion.toArray());

      rig.jump({position: [10, 20, 150]});
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([10, 20, 150]);

      rig.jump({position: new Vector3(-5, 7, 50)});
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([-5, 7, 50]);
    });

    it('takes x and y on the plane and the distance from it under a ParallaxProjection on xz|top-left', () => {
      const {stage, rig} = makeRig('parallax', 'xz|top-left');
      rig.jump({position: [10, 20]});
      frame(stage);
      expect(rig.camera.position.x).toBeCloseTo(10, 12);
      expect(rig.camera.position.y).toBeCloseTo(300, 12);
      expect(rig.camera.position.z).toBeCloseTo(-20, 12);

      rig.jump({position: [10, 20, 150]});
      frame(stage);
      expect(rig.camera.position.y).toBeCloseTo(150, 12);
      expect(directionOf(rig.camera).y).toBeCloseTo(-1, 12);
    });

    it('divides tan(fov / 2) of the fit by the zoom under a ParallaxProjection', () => {
      const {stage, rig} = makeRig();
      const rest = stage.projection!.createCamera() as PerspectiveCamera;
      rig.jump({zoom: 2});
      frame(stage);
      expect(lensOf(rig.camera as PerspectiveCamera)).toBeCloseTo(lensOf(rest) / 2, 14);
      expect(rig.camera.position.toArray()).toEqual(rest.position.toArray());
    });

    it('takes x, y and the zoom under an OrthographicProjection and ignores the distance', () => {
      for (const [plane, expected] of [
        ['xy|bottom-left', [10, 20, 100]],
        ['xz|top-left', [10, 100, -20]],
      ] as const) {
        const {stage, rig} = makeRig('orthographic', plane);
        const rest = stage.projection!.createCamera() as OrthographicCamera;
        rig.jump({position: [10, 20, 999], zoom: 2});
        frame(stage);
        const camera = rig.camera as OrthographicCamera;
        expect(camera.position.x).toBeCloseTo(expected[0], 12);
        expect(camera.position.y).toBeCloseTo(expected[1], 12);
        expect(camera.position.z).toBeCloseTo(expected[2], 12);
        expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([rest.left, rest.right, rest.top, rest.bottom]);
        expect(camera.zoom).toBe(2);
      }
    });

    it('turns the rest by the look: yaw about the up axis of the plane, then pitch about the right axis of the camera', () => {
      const {stage, rig} = makeRig();
      rig.jump({look: {yaw: 90 * DEG, pitch: 0}});
      frame(stage);
      const yawed = directionOf(rig.camera);
      expect(yawed.x).toBeCloseTo(-1, 12);
      expect(yawed.z).toBeCloseTo(0, 12);

      rig.jump({look: {yaw: 0, pitch: 45 * DEG}});
      frame(stage);
      const pitched = directionOf(rig.camera);
      expect(pitched.y).toBeCloseTo(Math.SQRT1_2, 12);
      expect(pitched.z).toBeCloseTo(-Math.SQRT1_2, 12);

      rig.jump({look: {yaw: 90 * DEG, pitch: 45 * DEG}});
      frame(stage);
      const both = directionOf(rig.camera);
      expect(both.x).toBeCloseTo(-Math.SQRT1_2, 12);
      expect(both.y).toBeCloseTo(Math.SQRT1_2, 12);
    });

    it('composes over a rest a listener of OnStageCameraPlaced tilted', () => {
      const stage = makeStage();
      on(stage, OnStageCameraPlaced, ({camera}: {camera: Camera}) => void camera.rotateX(15 * DEG));
      stage.needsUpdate = true;
      const rig = new CameraRig(stage);
      frame(stage);
      expect(directionOf(rig.camera).y).toBeCloseTo(Math.sin(15 * DEG), 12);

      rig.jump({position: [100, 0]});
      frame(stage);
      expect(rig.camera.position.x).toBeCloseTo(100, 12);
      expect(directionOf(rig.camera).y).toBeCloseTo(Math.sin(15 * DEG), 12);
    });
  });

  describe('look()', () => {
    it('turns the camera at once while it stands, and keeps the position', () => {
      const {stage, rig} = makeRig();
      rig.jump({position: [10, 20]});
      rig.look({yaw: 30 * DEG, pitch: 0});
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([10, 20, 300]);
      const direction = directionOf(rig.camera);
      expect(direction.x).toBeCloseTo(-Math.sin(30 * DEG), 12);
    });

    it('is the new end of a running move, which bends to it', () => {
      const {stage, rig} = makeRig();
      void rig.moveTo({position: [100, 0]}, 1, {easing: 'linear'});
      rig.step(0.5);
      rig.look({yaw: 40 * DEG, pitch: 0});
      frame(stage);
      // halfway between the rest and a yaw of 40°
      expect(-directionOf(rig.camera).x).toBeCloseTo(Math.sin(20 * DEG), 12);
      expect(rig.camera.position.x).toBeCloseTo(50, 12);

      rig.step(0.5);
      frame(stage);
      expect(-directionOf(rig.camera).x).toBeCloseTo(Math.sin(40 * DEG), 12);
      expect(rig.camera.position.x).toBe(100);
    });

    it('clamps the pitch to pitchLimit, 85° by default', () => {
      const {stage, rig} = makeRig();
      rig.look({yaw: 0, pitch: 90 * DEG});
      frame(stage);
      expect(directionOf(rig.camera).y).toBeCloseTo(Math.sin(85 * DEG), 12);
      rig.look({yaw: 0, pitch: -2});
      frame(stage);
      expect(directionOf(rig.camera).y).toBeCloseTo(-Math.sin(85 * DEG), 12);

      const limited = new CameraRig(makeStage(), {pitchLimit: 0.5});
      limited.jump({look: {yaw: 0, pitch: 1}});
      frame(limited.stage);
      expect(directionOf(limited.camera).y).toBeCloseTo(Math.sin(0.5), 12);
    });

    it('holds until the next target, which brings its own look', () => {
      const {stage, rig} = makeRig();
      rig.look({yaw: 0.5, pitch: 0});
      rig.jump({position: [1, 2]});
      frame(stage);
      expect(directionOf(rig.camera).x).toBeCloseTo(0, 12);

      rig.jump({look: {yaw: 0.2, pitch: 0}});
      frame(stage);
      expect(-directionOf(rig.camera).x).toBeCloseTo(Math.sin(0.2), 12);

      rig.look({yaw: 0.5, pitch: 0});
      void rig.moveTo({position: [5, 5]}, 1);
      rig.step(1);
      frame(stage);
      expect(directionOf(rig.camera).x).toBeCloseTo(0, 12);
    });

    it('is refused other than 0 under an OrthographicProjection', () => {
      const {rig} = makeRig('orthographic');
      rig.look({yaw: 0, pitch: 0});
      expect(() => rig.look({yaw: 0.1, pitch: 0})).toThrow(
        new RangeError('CameraRig#look(): an orthographic projection takes no look other than 0, got {yaw: 0.1, pitch: 0}'),
      );
    });
  });

  describe('moveTo()', () => {
    it.each<[string, Parameters<CameraRig['moveTo']>[2], number]>([
      ["'ease-in-out' by default", undefined, 100 * 4 * 0.25 ** 3],
      ["'linear'", {easing: 'linear'}, 25],
      ["'ease-in'", {easing: 'ease-in'}, 100 * 0.25 ** 3],
      ["'ease-out'", {easing: 'ease-out'}, 100 * (1 - 0.75 ** 3)],
      ['a function', {easing: (t: number) => t * t}, 6.25],
    ])('eases the move by %s', (_what, options, expected) => {
      const {stage, rig} = makeRig();
      void rig.moveTo({position: [100, 0]}, 1, options);
      rig.step(0.25);
      frame(stage);
      expect(rig.camera.position.x).toBeCloseTo(expected, 10);
    });

    it('eases by the easing of the rig where the call names none', () => {
      const stage = makeStage();
      const rig = new CameraRig(stage, {easing: 'linear'});
      void rig.moveTo({position: [100, 0]}, 1);
      rig.step(0.25);
      frame(stage);
      expect(rig.camera.position.x).toBeCloseTo(25, 12);
    });

    it('blends position, look and zoom, and arrives on the target exactly', async () => {
      const {stage, rig} = makeRig();
      const rest = stage.projection!.createCamera() as PerspectiveCamera;
      const moved = rig.moveTo({position: [100, 50, 200], zoom: 2}, 2, {easing: 'linear'});
      expect(rig.busy).toBe(true);

      rig.step(1);
      frame(stage);
      expect(rig.camera.position.x).toBeCloseTo(50, 12);
      expect(rig.camera.position.y).toBeCloseTo(25, 12);
      expect(rig.camera.position.z).toBeCloseTo(250, 12);
      expect(lensOf(rig.camera as PerspectiveCamera)).toBeCloseTo(lensOf(rest) * 0.75, 12);
      expect(await hasSettled(moved)).toBe(false);

      rig.step(1);
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([100, 50, 200]);
      expect(rig.busy).toBe(false);
      expect(await hasSettled(moved)).toBe(true);
    });

    it('arrives at once for 0 seconds', async () => {
      const {stage, rig} = makeRig();
      const moved = rig.moveTo({position: [7, 0]}, 0);
      expect(rig.busy).toBe(false);
      frame(stage);
      expect(rig.camera.position.x).toBe(7);
      expect(await hasSettled(moved)).toBe(true);
    });

    it('re-frames both ends on a resize during the move', () => {
      const {stage, rig} = makeRig();
      rig.jump({zoom: 2});
      void rig.moveTo({zoom: 4}, 1, {easing: 'linear'});
      rig.step(0.5);
      frame(stage);
      const before = lensOf(rig.camera as PerspectiveCamera);

      // a contain fit by width: another aspect gives the view another height, the fit another lens
      stage.resize(800, 400);
      const rest = stage.projection!.createCamera() as PerspectiveCamera;
      expect(lensOf(rest)).not.toBeCloseTo(before * (8 / 3), 3);
      expect(lensOf(rig.camera as PerspectiveCamera)).toBeCloseTo(lensOf(rest) * (0.5 / 2 + 0.5 / 4), 12);
      expect((rig.camera as PerspectiveCamera).aspect).toBe(rest.aspect);

      rig.step(0.5);
      frame(stage);
      expect(lensOf(rig.camera as PerspectiveCamera)).toBeCloseTo(lensOf(rest) / 4, 12);
    });

    it('starts an overtaking move where the blend stands', () => {
      const {stage, rig} = makeRig();
      void rig.moveTo({position: [100, 0]}, 1, {easing: 'linear'});
      rig.step(0.5);
      void rig.moveTo({position: [0, 100]}, 1, {easing: 'linear'});
      rig.step(0);
      frame(stage);
      expect(rig.camera.position.x).toBeCloseTo(50, 12);
      expect(rig.camera.position.y).toBeCloseTo(0, 12);
      rig.step(0.5);
      frame(stage);
      expect(rig.camera.position.x).toBeCloseTo(25, 12);
      expect(rig.camera.position.y).toBeCloseTo(50, 12);
    });

    it('ends without a view as a jump once the view comes', () => {
      const stage = new Stage2D(makeProjection('parallax'));
      const rig = new CameraRig(stage);
      void rig.moveTo({position: [100, 0]}, 1);
      rig.step(0.5);
      stage.resize(800, 600);
      frame(stage);
      expect(rig.camera.position.x).toBe(100);
    });
  });

  describe('the end of a move', () => {
    it.each<[string, (rig: CameraRig) => unknown]>([
      ['cancel()', (rig) => rig.cancel()],
      ['jump()', (rig) => rig.jump({})],
      ['an overtaking moveTo()', (rig) => rig.moveTo({}, 1)],
      ['track()', (rig) => rig.track({}, {position: [5, 0]})],
      ['dispose()', (rig) => rig.dispose()],
    ])('%s resolves the promise of the move, which never rejects', async (_what, end) => {
      const {rig} = makeRig();
      const moved = rig.moveTo({position: [100, 0]}, 1);
      rig.step(0.5);
      end(rig);
      await expect(moved).resolves.toBeUndefined();
    });

    it('cancel() holds the camera where the move stood', () => {
      const {stage, rig} = makeRig();
      void rig.moveTo({position: [100, 0], zoom: 2}, 1, {easing: 'linear'});
      rig.step(0.5);
      frame(stage);
      const position = rig.camera.position.clone();
      const fov = (rig.camera as PerspectiveCamera).fov;

      rig.cancel();
      expect(rig.busy).toBe(false);
      rig.step(1);
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual(position.toArray());
      expect((rig.camera as PerspectiveCamera).fov).toBeCloseTo(fov, 12);
      // a look turns the held shot at once
      rig.look({yaw: 0.3, pitch: 0});
      frame(stage);
      expect(-directionOf(rig.camera).x).toBeCloseTo(Math.sin(0.3), 12);
      expect(rig.camera.position.toArray()).toEqual(position.toArray());
    });

    it('cancel() does nothing while the camera stands', () => {
      const {stage, rig} = makeRig();
      rig.jump({position: [3, 4]});
      rig.cancel();
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([3, 4, 300]);
    });
  });

  describe('reframe()', () => {
    it('lifts the picture at once while the camera stands', () => {
      const {stage, rig} = makeRig();
      rig.reframe({lift: 0.25});
      frame(stage);
      // the point the camera looks at lands a quarter of the picture height above the middle
      expect(new Vector3(0, 0, 0).project(rig.camera).y).toBeCloseTo(0.5, 12);
      expect(rig.camera.position.toArray()).toEqual([0, 0, 300]);

      rig.reframe({});
      frame(stage);
      expect(new Vector3(0, 0, 0).project(rig.camera).y).toBeCloseTo(0, 12);
    });

    it('lifts the picture under an OrthographicProjection', () => {
      const {stage, rig} = makeRig('orthographic');
      rig.reframe({lift: 0.25});
      frame(stage);
      expect(new Vector3(0, 0, 0).project(rig.camera).y).toBeCloseTo(0.5, 12);
    });

    it('blends the lift on its own clock with seconds', () => {
      const {stage, rig} = makeRig();
      rig.reframe({lift: 0.5}, 1);
      rig.step(0.5);
      frame(stage);
      // 'ease-in-out' at ½ is ½
      expect(new Vector3(0, 0, 0).project(rig.camera).y).toBeCloseTo(0.5, 12);
      rig.step(0.5);
      frame(stage);
      expect(new Vector3(0, 0, 0).project(rig.camera).y).toBeCloseTo(1, 12);
    });

    it('leaves a running move running', async () => {
      const {stage, rig} = makeRig();
      const moved = rig.moveTo({position: [100, 0]}, 1, {easing: 'linear'});
      rig.step(0.5);
      rig.reframe({lift: 0.25}, 0.25);
      expect(rig.busy).toBe(true);
      rig.step(0.25);
      frame(stage);
      expect(rig.camera.position.x).toBeCloseTo(75, 12);
      expect(await hasSettled(moved)).toBe(false);
      rig.step(0.25);
      expect(await hasSettled(moved)).toBe(true);
    });
  });

  describe('step()', () => {
    it('answers true only when the shot it resolves differs from the one of the step before', () => {
      const {stage, rig} = makeRig();
      expect(rig.step(1 / 60), 'the first step').toBe(true);
      expect(rig.step(1 / 60), 'a camera that stands').toBe(false);

      rig.jump({position: [1, 0]});
      expect(rig.step(1 / 60)).toBe(true);
      expect(rig.step(1 / 60)).toBe(false);

      void rig.moveTo({position: [2, 0]}, 1);
      expect(rig.step(0.5)).toBe(true);
      expect(rig.step(0), 'no time passed').toBe(false);
      expect(rig.step(0.5), 'the arrival').toBe(true);
      expect(rig.step(0.5)).toBe(false);

      rig.reframe({lift: 0.1});
      expect(rig.step(1 / 60)).toBe(true);
      expect(rig.step(1 / 60)).toBe(false);

      rig.look({yaw: 0.1, pitch: 0});
      expect(rig.step(1 / 60)).toBe(true);

      stage.resize(800, 400);
      expect(rig.step(1 / 60), 'a resize').toBe(true);
      expect(rig.step(1 / 60)).toBe(false);
    });

    it('refuses a time that is not a finite number of 0 or more', () => {
      const {rig} = makeRig();
      expect(() => rig.step(Number.NaN)).toThrow(
        new RangeError('CameraRig#step(): deltaSeconds must be a finite number of 0 or more, got NaN'),
      );
      expect(() => rig.step(-1)).toThrow(RangeError);
    });
  });

  describe('the write in the frame of the stage', () => {
    it('reaches no further than the frame of a listener of OnStageUpdateFrame that moves the camera', () => {
      const {stage, rig} = makeRig();
      on(stage, OnStageUpdateFrame, () => void (stage.camera!.position.x += 5));
      rig.jump({position: [10, 0]});
      frame(stage);
      expect(rig.camera.position.x).toBe(15);
      frame(stage);
      expect(rig.camera.position.x).toBe(15);

      void rig.moveTo({position: [20, 0]}, 1, {easing: 'linear'});
      rig.step(0.5);
      frame(stage);
      expect(rig.camera.position.x).toBeCloseTo(20, 12);
    });

    it('follows a pose the caller keeps and hands to jump() in every frame', () => {
      const {stage, rig} = makeRig();
      const pose = {position: [0, 0] as [number, number]};
      for (let i = 0; i < 10; i++) {
        pose.position[0] = i;
        pose.position[1] = 2 * i;
        rig.jump(pose);
        frame(stage);
        expect(rig.camera.position.toArray()).toEqual([i, 2 * i, 300]);
      }
    });
  });

  describe('dispose()', () => {
    it('detaches the rig: the stage takes back the camera of its projection and announces it', () => {
      const stage = makeStage();
      const own = stage.camera!;
      const rig = new CameraRig(stage);
      const changed = vi.fn();
      on(stage, OnStageAfterCameraChanged, changed);

      rig.dispose();
      expect(rig.isDisposed).toBe(true);
      expect(stage.camera).toBe(own);
      expect(changed).toHaveBeenCalledWith(stage, rig.camera);
      expect(Stage2DInternals.driverOf(stage)).toBeUndefined();
      expect(() => rig.dispose()).not.toThrow();
    });

    it('leaves a rig attached after it alone', () => {
      const {stage, rig} = makeRig();
      rig.dispose();
      const next = new CameraRig(stage);
      rig.dispose();
      expect(Stage2DInternals.driverOf(stage)).toBe(next);
      expect(stage.camera).toBe(next.camera);
    });

    it('makes every call but dispose() throw, and keeps stage, camera and busy readable', () => {
      const {stage, rig} = makeRig();
      const camera = rig.camera;
      rig.dispose();
      expect(rig.stage).toBe(stage);
      expect(rig.camera).toBe(camera);
      expect(rig.busy).toBe(false);
      for (const [name, call] of [
        ['jump()', () => rig.jump({})],
        ['moveTo()', () => rig.moveTo({}, 1)],
        ['look()', () => rig.look({yaw: 0, pitch: 0})],
        ['reframe()', () => rig.reframe({lift: 0})],
        ['cancel()', () => rig.cancel()],
        ['step()', () => rig.step(0)],
      ] as const) {
        expect(call, name).toThrow(new Error(`CameraRig#${name}: the rig has been disposed`));
      }
    });
  });

  describe('a stage disposed under the rig', () => {
    it('stops the writes: step() answers false, write() leaves the camera, dispose() still works', async () => {
      const {stage, rig} = makeRig();
      rig.jump({position: [10, 0]});
      frame(stage);
      const moved = rig.moveTo({position: [50, 0]}, 1);

      stage.dispose();
      expect(rig.step(0.5)).toBe(false);
      rig.write();
      rig.compose();
      expect(rig.camera.position.x).toBe(10);

      // the clocks still run: the move arrives, and its promise resolves
      expect(rig.step(0.5)).toBe(false);
      expect(await hasSettled(moved)).toBe(true);

      rig.jump({position: [99, 0]});
      rig.write();
      expect(rig.camera.position.x).toBe(10);

      expect(() => rig.dispose()).not.toThrow();
      expect(rig.isDisposed).toBe(true);
      expect(Stage2DInternals.driverOf(stage)).toBeUndefined();
    });

    it('takes no write of the stage once a listener disposed it in the frame', () => {
      const {stage, rig} = makeRig();
      rig.jump({position: [10, 0]});
      frame(stage);
      on(stage, OnStageCameraPlaced, () => stage.dispose());
      rig.jump({position: [20, 0]});
      stage.needsUpdate = true;
      frame(stage);
      expect(stage.isDisposed).toBe(true);
      rig.write();
      expect(rig.step(1 / 60)).toBe(false);
      expect(() => rig.dispose()).not.toThrow();
    });
  });

  describe('refusals', () => {
    it('new CameraRig() refuses what is not a Stage2D, a stage without a projection and a disposed stage', () => {
      expect(() => new CameraRig({} as Stage2D)).toThrow(new TypeError('new CameraRig(): stage must be a Stage2D, got {}'));
      expect(() => new CameraRig(new Stage2D())).toThrow(
        new Error('new CameraRig(): the stage has no projection to compose the poses of the rig over'),
      );
      const disposed = makeStage();
      disposed.dispose();
      expect(() => new CameraRig(disposed)).toThrow(new Error('new CameraRig(): the stage has been disposed'));
    });

    it.each([0, -1, 2, Number.NaN, '1'])('new CameraRig() refuses a pitchLimit of %s', (pitchLimit) => {
      expect(() => new CameraRig(makeStage(), {pitchLimit: pitchLimit as number})).toThrow(RangeError);
    });

    it('new CameraRig() takes a pitchLimit of π / 2 and names the bounds of one it refuses', () => {
      expect(() => new CameraRig(makeStage(), {pitchLimit: Math.PI / 2})).not.toThrow();
      expect(() => new CameraRig(makeStage(), {pitchLimit: 2})).toThrow(
        new RangeError('new CameraRig(): pitchLimit must be a finite number above 0 and of Math.PI / 2 or less, got 2'),
      );
    });

    it('new CameraRig() refuses an unknown easing and leaves the stage without a rig', () => {
      const stage = makeStage();
      expect(() => new CameraRig(stage, {easing: 'bounce' as 'linear'})).toThrow(TypeError);
      expect(Stage2DInternals.driverOf(stage)).toBeUndefined();
    });

    it('new CameraRig() leaves nothing behind when the placement of its camera throws', () => {
      const stage = makeStage();
      const camera = stage.camera;
      const error = new Error('a listener');
      on(stage, OnStageCameraPlaced, () => {
        throw error;
      });
      expect(() => new CameraRig(stage)).toThrow(error);
      expect(Stage2DInternals.driverOf(stage)).toBeUndefined();
      expect(stage.camera).toBe(camera);
    });

    it('jump() and moveTo() refuse a camera that is neither a PerspectiveCamera nor an OrthographicCamera', () => {
      const {stage, rig} = makeRig();
      rig.jump({position: [5, 0]});
      const target = new Camera() as unknown as PerspectiveCamera;
      expect(() => rig.jump(target)).toThrow(
        new TypeError('CameraRig#jump(): a camera as a target must be a PerspectiveCamera or an OrthographicCamera, got Camera'),
      );
      expect(() => rig.moveTo(target, 1)).toThrow(
        new TypeError(
          'CameraRig#moveTo(): a camera as a target must be a PerspectiveCamera or an OrthographicCamera, got Camera',
        ),
      );
      expect(rig.busy).toBe(false);
      frame(stage);
      expect(rig.camera.position.x).toBe(5);
    });

    it('moveTo() refuses a lens change to a camera of the other kind without a focus', () => {
      const {stage, rig} = makeRig();
      const source = new OrthographicCamera(-160, 160, 90, -90, 0.5, 500);
      expect(() => rig.moveTo(source, 1)).toThrow(
        new Error(
          'CameraRig#moveTo(): a lens change between a perspective and an orthographic camera needs a focus: a camera as the target has no projectionPlane, and the move names no focus',
        ),
      );
      expect(rig.busy).toBe(false);
      frame(stage);
      expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
    });

    it('moveTo() refuses a lens change where the projection has no plane and the move names no focus', () => {
      const stage = new Stage2D(planelessProjection());
      stage.resize(800, 600);
      const rig = new CameraRig(stage);
      const ortho = makeProjection('orthographic');
      expect(() => rig.moveTo(ortho, 1)).toThrow(
        new Error(
          'CameraRig#moveTo(): a lens change between a perspective and an orthographic camera needs a focus: the projection has no projectionPlane, and the move names no focus',
        ),
      );
      expect(rig.busy).toBe(false);
      expect(stage.projection).not.toBe(ortho);

      // with a focus it runs, and a jump needs none
      void rig.moveTo(ortho, 1, {focus: 300});
      expect(rig.busy).toBe(true);
      rig.step(1);
      expect(stage.projection).toBe(ortho);
      rig.jump(planelessProjection());
      expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
    });

    it('moveTo() refuses its numbers and options, and changes nothing then', () => {
      const {stage, rig} = makeRig();
      rig.jump({position: [5, 0]});
      const cases: [unknown, unknown, Error][] = [
        [Number.NaN, undefined, new RangeError('CameraRig#moveTo(): seconds must be a finite number of 0 or more, got NaN')],
        [-1, undefined, new RangeError('CameraRig#moveTo(): seconds must be a finite number of 0 or more, got -1')],
        [
          1,
          {easing: 'bounce'},
          new TypeError(
            "CameraRig#moveTo(): easing must be 'linear', 'ease-in', 'ease-out', 'ease-in-out' or a function, got \"bounce\"",
          ),
        ],
        [1, {offset: [Number.NaN, 0]}, new RangeError('CameraRig#moveTo(): offset[0] must be a finite number, got NaN')],
        [1, {offset: [1]}, new TypeError('CameraRig#moveTo(): offset must be a tuple of 2 or 3 numbers, got [1]')],
        [1, {smooth: -1}, new RangeError('CameraRig#moveTo(): smooth must be a finite number of 0 or more, got -1')],
        [1, {focus: 0}, new RangeError('CameraRig#moveTo(): focus must be a finite number above 0, got 0')],
        [
          1,
          {depth: Number.POSITIVE_INFINITY},
          new RangeError('CameraRig#moveTo(): depth must be a finite number above 0, got Infinity'),
        ],
        [1, 'fast', new TypeError('CameraRig#moveTo(): options must be an object, got "fast"')],
      ];
      for (const [seconds, options, error] of cases) {
        expect(() => rig.moveTo({position: [100, 0]}, seconds as number, options as object)).toThrow(error);
      }
      expect(() => rig.moveTo({zoom: 0}, 1)).toThrow(
        new RangeError('CameraRig#moveTo(): zoom must be a finite number above 0, got 0'),
      );
      expect(rig.busy).toBe(false);
      frame(stage);
      expect(rig.camera.position.x).toBe(5);
    });

    it('jump() refuses a look under an OrthographicProjection', () => {
      const {rig} = makeRig('orthographic');
      expect(() => rig.jump({look: {yaw: 0, pitch: 0.2}})).toThrow(
        new RangeError('CameraRig#jump(): an orthographic projection takes no look other than 0, got {yaw: 0, pitch: 0.2}'),
      );
    });

    it('reframe() refuses what is not a framing, a lift that is not finite and negative seconds', () => {
      const {rig} = makeRig();
      expect(() => rig.reframe(null as unknown as {lift: number})).toThrow(
        new TypeError('CameraRig#reframe(): framing must be an object with an optional lift, got null'),
      );
      expect(() => rig.reframe({lift: Number.NaN})).toThrow(
        new RangeError('CameraRig#reframe(): lift must be a finite number, got NaN'),
      );
      expect(() => rig.reframe({lift: 0.1}, -1)).toThrow(
        new RangeError('CameraRig#reframe(): seconds must be a finite number of 0 or more, got -1'),
      );
    });
  });

  describe('a projection as a target', () => {
    it('lands a move to a projection of the same kind on its rest and assigns stage.projection on arrival, without a jump', async () => {
      const {stage, rig} = makeRig();
      rig.jump({position: [50, 20], zoom: 1.5});
      const target = makeProjection('parallax', 'xy|bottom-left', {distanceToProjectionPlane: 500});
      const moved = rig.moveTo(target, 1, {easing: 'linear'});
      expect(rig.busy).toBe(true);

      rig.step(0.5);
      frame(stage);
      expect(stage.projection).not.toBe(target);
      expect(rig.camera.position.x).toBeCloseTo(25, 10);
      expect(rig.camera.position.y).toBeCloseTo(10, 10);
      expect(rig.camera.position.z).toBeCloseTo(400, 10);

      rig.step(0.5 - 1e-9);
      frame(stage);
      const before = rig.camera.clone();
      before.updateMatrixWorld();

      rig.step(1e-6);
      expect(stage.projection).toBe(target);
      expect(rig.busy).toBe(false);
      expect(await hasSettled(moved)).toBe(true);
      frame(stage);
      expectPlacedAs(rig.camera, target.createCamera());
      // the arrival is the frame before it, moved by a billionth of the move
      for (let i = 0; i < 16; i++) {
        expect(rig.camera.projectionMatrix.elements[i]).toBeCloseTo(before.projectionMatrix.elements[i]!, 6);
        expect(rig.camera.matrixWorld.elements[i]).toBeCloseTo(before.matrixWorld.elements[i]!, 4);
      }
    });

    it('jump() to a projection assigns it at once, and the camera stands on its rest', () => {
      const {stage, rig} = makeRig();
      rig.jump({position: [50, 20]});
      const target = makeProjection('orthographic', 'xz|top-left');
      rig.jump(target);
      expect(stage.projection).toBe(target);
      expect(rig.camera).toBeInstanceOf(OrthographicCamera);
      frame(stage);
      expectPlacedAs(rig.camera, target.createCamera());
    });

    it('moveTo() a projection in 0 seconds assigns it at once', async () => {
      const {stage, rig} = makeRig();
      const target = makeProjection('orthographic');
      const moved = rig.moveTo(target, 0);
      expect(stage.projection).toBe(target);
      expect(await hasSettled(moved)).toBe(true);
      frame(stage);
      expectPlacedAs(rig.camera, target.createCamera());
    });

    it('cancel() ends a move to a projection where it stands and assigns nothing', async () => {
      const {stage, rig} = makeRig();
      const parallax = stage.projection!;
      const target = makeProjection('parallax', 'xy|bottom-left', {distanceToProjectionPlane: 500});
      const moved = rig.moveTo(target, 1, {easing: 'linear'});
      rig.step(0.5);
      rig.cancel();
      expect(await hasSettled(moved)).toBe(true);
      rig.step(1);
      frame(stage);
      expect(stage.projection).toBe(parallax);
      expect(rig.camera.position.z).toBeCloseTo(400, 10);
      expect(lensOf(rig.camera as PerspectiveCamera)).toBeCloseTo(
        (lensOf(parallax.createCamera() as PerspectiveCamera) + lensOf(target.createCamera() as PerspectiveCamera)) / 2,
        12,
      );
    });

    it('ends a move to a projection that started without a view on that projection once the view comes', () => {
      const stage = new Stage2D(makeProjection('parallax'));
      const rig = new CameraRig(stage);
      const target = makeProjection('orthographic');
      void rig.moveTo(target, 1);
      rig.step(0.5);
      stage.resize(800, 600);
      frame(stage);
      rig.step(0.5);
      expect(stage.projection).toBe(target);
      frame(stage);
      expectPlacedAs(rig.camera, target.createCamera());
    });
  });

  describe('a camera as a target', () => {
    it('lands a move on the world pose of the camera and its lens, fitted as a CameraProjection fits it, and assigns no projection', async () => {
      const {stage, rig} = makeRig();
      const parallax = stage.projection!;
      const {camera: source} = inParent(new PerspectiveCamera(40, 16 / 9, 0.5, 500));
      const rest = parallax.createCamera();
      const moved = rig.moveTo(source, 1, {easing: 'linear'});

      rig.step(0.5);
      frame(stage);
      const world = source.getWorldPosition(new Vector3());
      expect(rig.camera.position.x).toBeCloseTo((rest.position.x + world.x) / 2, 9);
      expect(rig.camera.position.z).toBeCloseTo((rest.position.z + world.z) / 2, 9);

      rig.step(0.5);
      expect(await hasSettled(moved)).toBe(true);
      frame(stage);
      expect(stage.projection).toBe(parallax);
      expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
      const fitted = fittedTo(source, stage);
      // a container of 4:3 under a frame of 16:9: contain widens the lens
      expect(lensOf(fitted as PerspectiveCamera)).toBeCloseTo((Math.tan(20 * DEG) * (16 / 9)) / (4 / 3), 12);
      expectShowsAs(rig.camera, fitted);
      // the scale of the parent is left out
      expect(rig.camera.matrixWorld.getMaxScaleOnAxis()).toBeCloseTo(1, 12);
    });

    it('jump() puts the camera on it at once', () => {
      const {stage, rig} = makeRig();
      const {camera: source} = inParent(new PerspectiveCamera(40, 16 / 9, 0.5, 500));
      rig.jump(source);
      frame(stage);
      expectShowsAs(rig.camera, fittedTo(source, stage));
    });

    it('locks on: follows a source moved between frames, and step() answers false for one that stands', () => {
      const {stage, rig} = makeRig();
      const source = new PerspectiveCamera(40, 16 / 9, 0.5, 500);
      source.position.set(0, 0, 500);
      void rig.moveTo(source, 1);
      rig.step(1);
      expect(rig.step(1 / 60), 'a source that stands').toBe(false);
      expect(rig.busy).toBe(false);

      source.position.x = 30;
      expect(rig.step(1 / 60), 'a source that moved').toBe(true);
      expect(rig.busy, 'a lock-on to a camera that moves').toBe(true);
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([30, 0, 500]);
      expect(rig.step(1 / 60)).toBe(false);
      expect(rig.busy).toBe(false);

      // a parent that moves, and a lens an animation changes
      const parent = new Group();
      parent.add(source);
      parent.position.y = 12;
      expect(rig.step(1 / 60)).toBe(true);
      source.fov = 30;
      expect(rig.step(1 / 60)).toBe(true);
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([30, 12, 500]);
      expect(lensOf(rig.camera as PerspectiveCamera)).toBeCloseTo((Math.tan(15 * DEG) * (16 / 9)) / (4 / 3), 12);
      expect(rig.step(1 / 60)).toBe(false);
    });

    it('lays a drag-look on top of a followed camera, until the next target', () => {
      const {stage, rig} = makeRig();
      const {camera: source} = inParent(new PerspectiveCamera(40, 16 / 9, 0.5, 500));
      rig.jump(source);
      rig.look({yaw: 0.4, pitch: 0});
      const up = new Vector3(0, 1, 0);

      for (const turn of [0, 0.25]) {
        source.rotation.y = turn;
        rig.step(1 / 60);
        frame(stage);
        const expected = source.getWorldDirection(new Vector3()).applyAxisAngle(up, 0.4);
        const direction = directionOf(rig.camera);
        expect(direction.x).toBeCloseTo(expected.x, 9);
        expect(direction.y).toBeCloseTo(expected.y, 9);
        expect(direction.z).toBeCloseTo(expected.z, 9);
        expect(rig.camera.position.distanceTo(source.getWorldPosition(new Vector3()))).toBeCloseTo(0, 9);
      }

      // the next camera brings its own look: its orientation
      rig.jump(source);
      frame(stage);
      expectShowsAs(rig.camera, fittedTo(source, stage));
    });

    it('moves to a camera of the other kind as a lens change with a focus, and a jump needs none', () => {
      const {stage, rig} = makeRig();
      const parallax = stage.projection!;
      const source = new OrthographicCamera(-160, 160, 90, -90, 0.5, 500);
      source.position.set(40, 20, 200);
      void rig.moveTo(source, 1, {focus: 200, easing: 'linear'});
      rig.step(0.5);
      frame(stage);
      expect(rig.camera).toBeInstanceOf(PerspectiveCamera);

      rig.step(0.5);
      frame(stage);
      expect(stage.projection).toBe(parallax);
      expect(rig.camera).toBeInstanceOf(OrthographicCamera);
      expectShowsAs(rig.camera, fittedTo(source, stage));
      expect(() => rig.look({yaw: 0.1, pitch: 0})).toThrow(RangeError);

      // a jump to a perspective camera from there needs no focus either
      const perspective = new PerspectiveCamera(40, 16 / 9, 0.5, 500);
      rig.jump(perspective);
      frame(stage);
      expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
      expectShowsAs(rig.camera, fittedTo(perspective, stage));
    });

    it('resolves a CameraProjection whose source moves anew in every frame of a move to it', () => {
      const {stage, rig} = makeRig();
      const source = new PerspectiveCamera(40, 16 / 9, 0.5, 500);
      source.position.set(0, 0, 500);
      const target = new CameraProjection(source);
      void rig.moveTo(target, 1, {easing: 'linear'});
      rig.step(0.5);
      source.position.x = 200;
      frame(stage);
      // halfway between the rest and the source where it stands now
      expect(rig.camera.position.x).toBeCloseTo(100, 9);
      expect(rig.camera.position.z).toBeCloseTo(400, 9);

      source.position.x = 300;
      rig.step(0.5);
      expect(stage.projection).toBe(target);
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([300, 0, 500]);
    });
  });

  describe('an Object3D as a target', () => {
    for (const [plane, foot] of [
      ['xy|bottom-left', (w: Vector3) => [w.x, w.y, 300]],
      ['xz|top-left', (w: Vector3) => [w.x, 300, w.z]],
    ] as const) {
      it(`puts the camera over the foot of the object on the plane ${plane}, its orientation and scale ignored`, () => {
        const {stage, rig} = makeRig('parallax', plane);
        const rest = stage.projection!.createCamera() as PerspectiveCamera;
        const parent = new Group();
        parent.position.set(40, 30, -20);
        parent.rotation.set(0.4, 0.7, 0.2);
        parent.scale.setScalar(3);
        const player = new Object3D();
        player.position.set(10, -5, 25);
        player.rotation.set(0.3, 0.5, 0.2);
        player.scale.set(2, 0.5, 4);
        parent.add(player);

        rig.jump(player);
        frame(stage);
        const expected = foot(player.getWorldPosition(new Vector3()));
        for (let i = 0; i < 3; i++) expect(rig.camera.position.getComponent(i)).toBeCloseTo(expected[i]!, 9);
        expect(rig.camera.quaternion.angleTo(rest.quaternion)).toBeCloseTo(0, 12);
        expect(lensOf(rig.camera as PerspectiveCamera)).toBeCloseTo(lensOf(rest), 12);
      });
    }

    it('puts the camera at the offset from the object: x and y, and a distance where it names one', () => {
      const {stage, rig} = makeRig();
      const player = new Object3D();
      player.position.set(100, 50, 30);

      void rig.moveTo(player, 0, {offset: [0, 40]});
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([100, 90, 300]);

      void rig.moveTo(player, 0, {offset: [-10, 40, 150]});
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([90, 90, 150]);
    });

    it('ignores the distance of the offset under an OrthographicProjection', () => {
      const {stage, rig} = makeRig('orthographic');
      const player = new Object3D();
      player.position.set(100, 50, 30);
      void rig.moveTo(player, 0, {offset: [5, 40, 150]});
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([105, 90, 100]);
    });

    it('keeps the zoom, the look and the distance of the current pose', () => {
      const {stage, rig} = makeRig();
      const rest = stage.projection!.createCamera() as PerspectiveCamera;
      rig.jump({position: [0, 0, 200], zoom: 2, look: {yaw: 0.2, pitch: 0}});
      const player = new Object3D();
      player.position.set(-30, 60, 0);
      void rig.moveTo(player, 0);
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([-30, 60, 200]);
      expect(lensOf(rig.camera as PerspectiveCamera)).toBeCloseTo(lensOf(rest) / 2, 12);
      expect(-directionOf(rig.camera).x).toBeCloseTo(Math.sin(0.2), 12);

      // a drag-look holds while following
      rig.look({yaw: -0.3, pitch: 0.1});
      player.position.x = 10;
      rig.step(1 / 60);
      frame(stage);
      expect(rig.camera.position.x).toBe(10);
      expect(directionOf(rig.camera).y).toBeCloseTo(Math.sin(0.1), 12);
    });

    it('locks on: sticks to an object that moves, and step() answers false for one that stands', () => {
      const {stage, rig} = makeRig();
      const player = new Object3D();
      void rig.moveTo(player, 0.5, {offset: [0, 40]});
      rig.step(0.5);
      expect(rig.step(1 / 60), 'an object that stands').toBe(false);
      expect(rig.busy).toBe(false);

      player.position.x = 7;
      expect(rig.step(1 / 60)).toBe(true);
      expect(rig.busy).toBe(true);
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([7, 40, 300]);
      expect(rig.step(1 / 60)).toBe(false);
      expect(rig.busy).toBe(false);
    });

    it('meets an object that kept moving on a move back to it', () => {
      const {stage, rig} = makeRig();
      const player = new Object3D();
      const chest = new Object3D();
      chest.position.set(300, 100, 0);
      rig.jump(player);

      void rig.moveTo(chest, 1, {easing: 'linear'});
      rig.step(1);
      player.position.set(-50, 20, 0);
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([300, 100, 300]);

      void rig.moveTo(player, 1, {easing: 'linear'});
      rig.step(0.5);
      player.position.x = -100;
      frame(stage);
      expect(rig.camera.position.x).toBeCloseTo((300 - 100) / 2, 9);
      expect(rig.camera.position.y).toBeCloseTo((100 + 20) / 2, 9);

      player.position.x = -150;
      rig.step(0.5);
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([-150, 20, 300]);
      player.position.x = -160;
      rig.step(1 / 60);
      frame(stage);
      expect(rig.camera.position.x).toBe(-160);
    });

    it('trails the object by smooth once locked on, critically damped, and settles', () => {
      const {stage, rig} = makeRig();
      const player = new Object3D();
      void rig.moveTo(player, 0, {smooth: 0.2});
      expect(rig.step(1 / 60), 'the arrival').toBe(true);
      expect(rig.step(1 / 60), 'an object that stands').toBe(false);
      expect(rig.busy).toBe(false);

      player.position.x = 100;
      expect(rig.step(0.2)).toBe(true);
      frame(stage);
      // after one time constant a critically damped spring from rest has closed 1 - 2/e of the gap
      expect(rig.camera.position.x).toBeCloseTo(100 * (1 - 2 / Math.E), 9);
      expect(rig.busy).toBe(true);

      let frames = 0;
      let furthest = 0;
      while (rig.busy && frames < 600) {
        rig.step(1 / 60);
        frame(stage);
        furthest = Math.max(furthest, rig.camera.position.x);
        frames++;
      }
      expect(rig.busy, 'settled').toBe(false);
      expect(frames).toBeGreaterThan(30);
      expect(furthest, 'no overshoot').toBeLessThanOrEqual(100);
      expect(rig.camera.position.x).toBe(100);
      expect(rig.step(1 / 60), 'an object that stands').toBe(false);
    });

    it('sticks to the object during the move and starts to trail on arrival, without a jump', () => {
      const {stage, rig} = makeRig();
      const player = new Object3D();
      player.position.x = 50;
      void rig.moveTo(player, 1, {smooth: 0.5, easing: 'linear'});
      rig.step(0.5);
      player.position.x = 80;
      frame(stage);
      expect(rig.camera.position.x).toBeCloseTo(40, 9);
      rig.step(0.5);
      frame(stage);
      expect(rig.camera.position.x).toBe(80);
      rig.step(1 / 60);
      frame(stage);
      expect(rig.camera.position.x).toBe(80);
    });

    it('takes a camera as a camera, and any other Object3D as an object, before a projection and a pose', () => {
      const {stage, rig} = makeRig();
      const projection = stage.projection!;

      // a camera with the methods of a projection is a camera: the rig locks on, and assigns nothing
      const camera = Object.assign(new PerspectiveCamera(40, 4 / 3, 0.5, 500), {updateViewRect() {}});
      camera.position.set(10, 0, 400);
      rig.jump(camera);
      frame(stage);
      expect(stage.projection).toBe(projection);
      expect(rig.camera.position.toArray()).toEqual([10, 0, 400]);

      // an Object3D with the methods of a projection and the zoom of a pose is an object: its place alone counts
      const object = Object.assign(new Object3D(), {updateViewRect() {}, zoom: 2});
      object.position.set(20, 5, 0);
      rig.jump({});
      rig.jump(object);
      frame(stage);
      expect(stage.projection).toBe(projection);
      expect(rig.camera.position.toArray()).toEqual([20, 5, 300]);
      expect(lensOf(rig.camera as PerspectiveCamera)).toBeCloseTo(lensOf(projection.createCamera() as PerspectiveCamera), 12);

      // a projection with the fields of a pose is a projection
      const next = Object.assign(makeProjection('parallax', 'xy|bottom-left', {distanceToProjectionPlane: 500}), {
        position: [99, 99],
      });
      rig.jump(next);
      expect(stage.projection).toBe(next);
    });

    it('refuses a look under an OrthographicProjection while following', () => {
      const {rig} = makeRig('orthographic');
      rig.jump(new Object3D());
      expect(() => rig.look({yaw: 0.1, pitch: 0})).toThrow(RangeError);
    });
  });

  describe('a lock-on', () => {
    const targets: [string, () => {target: Object3D; move: () => void}][] = [
      [
        'a camera',
        () => {
          const target = new PerspectiveCamera(40, 16 / 9, 0.5, 500);
          target.position.set(0, 0, 500);
          return {target, move: () => void (target.position.x += 50)};
        },
      ],
      [
        'an Object3D',
        () => {
          const target = new Object3D();
          return {target, move: () => void (target.position.x += 50)};
        },
      ],
    ];
    const ends: [string, (rig: CameraRig) => unknown][] = [
      ['a moveTo()', (rig) => rig.moveTo({position: [3, 4]}, 0)],
      ['a jump()', (rig) => rig.jump({position: [3, 4]})],
      ['cancel()', (rig) => rig.cancel()],
      ['a track()', (rig) => rig.track({position: [3, 4]}, {position: [3, 4]})],
      ['dispose()', (rig) => rig.dispose()],
    ];
    for (const [what, make] of targets) {
      for (const [end, call] of ends) {
        it(`to ${what} is released by ${end}`, () => {
          const {stage, rig} = makeRig();
          const {target, move} = make();
          rig.jump(target);
          rig.step(1 / 60);
          frame(stage);
          const before = rig.camera.position.clone();

          call(rig);
          if (!rig.isDisposed) rig.step(1 / 60);
          frame(stage);
          const released = stage.camera!.position.clone();
          if (end === 'cancel()') expect(released.toArray(), 'held where it stood').toEqual(before.toArray());

          move();
          if (!rig.isDisposed) {
            expect(rig.step(1 / 60)).toBe(false);
            expect(rig.busy).toBe(false);
          }
          frame(stage);
          expect(stage.camera!.position.toArray()).toEqual(released.toArray());
        });
      }
    }

    it('keeps the rig on the target with a quaternion of unit length', () => {
      const {stage, rig} = makeRig();
      const {camera: source} = inParent(new PerspectiveCamera(40, 16 / 9, 0.5, 500));
      rig.jump(source);
      frame(stage);
      expect(rig.camera.quaternion.length()).toBeCloseTo(1, 12);
      expect(rig.camera.quaternion.angleTo(source.getWorldQuaternion(new Quaternion()))).toBeCloseTo(0, 9);
    });
  });

  describe('a lens change', () => {
    it('moves from a ParallaxProjection into an OrthographicProjection and back, from the rest of the one onto the rest of the other', async () => {
      const {stage, rig} = makeRig('parallax');
      const parallax = stage.projection!;
      const ortho = makeProjection('orthographic');
      const changed = vi.fn();
      on(stage, OnStageAfterCameraChanged, changed);

      const moved = rig.moveTo(ortho, 1);
      rig.step(0);
      frame(stage);
      expectPlacedAs(rig.camera, parallax.createCamera());

      // a dolly zoom: the camera backs off and narrows its lens, and the plane keeps its height
      rig.step(0.5);
      frame(stage);
      const halfway = rig.camera as PerspectiveCamera;
      expect(halfway).toBeInstanceOf(PerspectiveCamera);
      expect(halfway.position.z).toBeGreaterThan(300);
      expect(heightAtPlane(halfway)).toBeCloseTo(stage.height, 8);
      expect(directionOf(halfway).z).toBeCloseTo(-1, 12);
      expect(changed).not.toHaveBeenCalled();

      rig.step(0.5);
      expect(stage.projection).toBe(ortho);
      expect(rig.camera).toBeInstanceOf(OrthographicCamera);
      expect(stage.camera).toBe(rig.camera);
      expect(changed).toHaveBeenCalledTimes(1);
      expect(changed).toHaveBeenCalledWith(stage, halfway);
      expect(await hasSettled(moved)).toBe(true);
      frame(stage);
      expectPlacedAs(rig.camera, ortho.createCamera());

      // back: the rig swaps first and backs in
      const back = rig.moveTo(parallax, 1);
      rig.step(0);
      frame(stage);
      expectPlacedAs(rig.camera, ortho.createCamera());
      rig.step(1e-3);
      frame(stage);
      expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
      expect(rig.camera.position.z).toBeGreaterThan(1000);
      expect(heightAtPlane(rig.camera as PerspectiveCamera)).toBeCloseTo(stage.height, 8);
      rig.step(1);
      expect(stage.projection).toBe(parallax);
      expect(await hasSettled(back)).toBe(true);
      frame(stage);
      expectPlacedAs(rig.camera, parallax.createCamera());
    });

    it('swaps where the parallax across the depth of the scene stays below half a pixel of the container', () => {
      const {stage, rig} = makeRig('parallax');
      const depth = 40;
      void rig.moveTo(makeProjection('orthographic'), 1, {depth, easing: 'linear'});
      rig.step(1 - 1e-9);
      frame(stage);
      const before = rig.camera.clone() as PerspectiveCamera;
      expect(before).toBeInstanceOf(PerspectiveCamera);

      rig.step(1);
      frame(stage);
      const after = rig.camera;
      expect(after).toBeInstanceOf(OrthographicCamera);

      const step = shiftBetween(before, after, stage, depth);
      expect(step).toBeGreaterThan(0.25);
      expect(step).toBeLessThan(0.5);
      // the plane itself does not move
      expect(shiftBetween(before, after, stage, 0)).toBeLessThan(1e-6);
    });

    it('takes the visible height as the depth by default', () => {
      const {stage, rig} = makeRig('parallax');
      void rig.moveTo(makeProjection('orthographic'), 1, {easing: 'linear'});
      rig.step(1 - 1e-9);
      frame(stage);
      const before = rig.camera.clone();
      rig.step(1);
      frame(stage);
      expect(shiftBetween(before, rig.camera, stage, stage.height)).toBeLessThan(0.5);
    });

    it('caps the distance at 1000 · h, and a deeper scene swaps with a step above half a pixel', () => {
      const {stage, rig} = makeRig('parallax');
      const h = stage.height;
      const depth = 2 * h;
      void rig.moveTo(makeProjection('orthographic'), 1, {depth, easing: 'linear'});
      rig.step(1 - 1e-9);
      frame(stage);
      const before = rig.camera.clone() as PerspectiveCamera;
      expect(before.position.z).toBeLessThanOrEqual(1000 * h);
      expect(before.position.z).toBeGreaterThan(999.99 * h);
      expect(heightAtPlane(before)).toBeCloseTo(h, 6);

      expect(() => {
        rig.step(1);
        frame(stage);
      }).not.toThrow();
      const step = shiftBetween(before, rig.camera, stage, depth);
      expect(step).toBeGreaterThan(0.5);
      expect(step).toBeLessThan(1);
    });

    it('re-frames both ends on a resize in the middle of a lens change, in either direction, and throws no TypeError', () => {
      for (const [from, to] of [
        ['parallax', 'orthographic'],
        ['orthographic', 'parallax'],
      ] as const) {
        const {stage, rig} = makeRig(from);
        void rig.moveTo(makeProjection(to), 1, {easing: 'linear'});
        rig.step(0.5);
        frame(stage);
        expect(rig.camera).toBeInstanceOf(PerspectiveCamera);

        expect(() => stage.resize(800, 400)).not.toThrow();
        expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
        expect(stage.camera).toBe(rig.camera);
        expect(() => frame(stage)).not.toThrow();

        // as if the stage had had the new size from the start of the move
        const reference = new Stage2D(makeProjection(from));
        reference.resize(800, 400);
        const referenceRig = new CameraRig(reference);
        void referenceRig.moveTo(makeProjection(to), 1, {easing: 'linear'});
        referenceRig.step(0.5);
        frame(reference);
        const camera = rig.camera as PerspectiveCamera;
        const expected = referenceRig.camera as PerspectiveCamera;
        expect(camera.position.z).toBeCloseTo(expected.position.z, 6);
        expect(camera.fov).toBeCloseTo(expected.fov, 10);
        expect(camera.aspect).toBe(expected.aspect);
        expect(heightAtPlane(camera)).toBeCloseTo(reference.height, 6);

        rig.step(0.5);
        frame(stage);
        expect(stage.projection).toBeInstanceOf(to === 'parallax' ? ParallaxProjection : OrthographicProjection);
        expectPlacedAs(rig.camera, stage.projection!.createCamera());
      }
    });

    it('starts an overtaking move from the camera of the lens change where it stands', () => {
      const {stage, rig} = makeRig('parallax');
      void rig.moveTo(makeProjection('orthographic'), 1, {easing: 'linear'});
      rig.step(0.5);
      frame(stage);
      const where = rig.camera.position.clone();
      const fov = (rig.camera as PerspectiveCamera).fov;

      void rig.moveTo({}, 1, {easing: 'linear'});
      rig.step(0);
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual(where.toArray());
      expect((rig.camera as PerspectiveCamera).fov).toBeCloseTo(fov, 10);
      rig.step(1);
      frame(stage);
      expectPlacedAs(rig.camera, stage.projection!.createCamera());
    });

    it('refuses a look while the move runs into an orthographic projection', () => {
      const {rig} = makeRig('parallax');
      void rig.moveTo(makeProjection('orthographic'), 1);
      expect(() => rig.look({yaw: 0.2, pitch: 0})).toThrow(
        new RangeError('CameraRig#look(): an orthographic projection takes no look other than 0, got {yaw: 0.2, pitch: 0}'),
      );
    });
  });

  describe('a track', () => {
    /** Steps the rig to the progress `t` without smooth and draws the frame. */
    const lerpTo = (stage: Stage2D, rig: CameraRig, t: number) => {
      rig.lerp(t);
      rig.step(1 / 60);
      frame(stage);
    };

    /** A camera an AnimationMixer moves along x from 0 to 200 at z 500, within two seconds; its action enabled and paused. */
    const animatedCamera = () => {
      const camera = new PerspectiveCamera(40, 4 / 3, 0.5, 2000);
      camera.position.set(0, 0, 500);
      const mixer = new AnimationMixer(camera);
      const action = mixer.clipAction(
        new AnimationClip('fly', 2, [new VectorKeyframeTrack('.position', [0, 2], [0, 0, 500, 200, 0, 500])]),
      );
      action.play().paused = true;
      return {camera, action};
    };

    it('shows the shot of a key inside it, and between two keys the blend at the eased share of the key it arrives at', () => {
      const {stage, rig} = makeRig();
      rig.track([
        {at: 0, until: 0.2, shot: {position: [0, 0]}},
        {at: 0.6, shot: {position: [100, 0]}, ease: 'ease-in'},
        {at: 1, shot: {position: [100, 100]}},
      ]);
      const at = () => rig.camera.position.toArray().map((v) => Math.round(v * 1e9) / 1e9);

      lerpTo(stage, rig, 0.1);
      expect(at(), 'inside the first key').toEqual([0, 0, 300]);
      lerpTo(stage, rig, 0.2);
      expect(at(), 'at its end').toEqual([0, 0, 300]);
      // half the stretch from 0.2 to 0.6, eased in: 0.5³
      lerpTo(stage, rig, 0.4);
      expect(at()).toEqual([12.5, 0, 300]);
      lerpTo(stage, rig, 0.6);
      expect(at(), 'on the second key').toEqual([100, 0, 300]);
      // half the stretch from 0.6 to 1, linear
      lerpTo(stage, rig, 0.8);
      expect(at()).toEqual([100, 50, 300]);
      lerpTo(stage, rig, 1);
      expect(at()).toEqual([100, 100, 300]);
    });

    it('clamps the progress to [0, 1], and holds the first key before it and the last one after it', () => {
      const {stage, rig} = makeRig();
      rig.track([
        {at: 0.25, shot: {position: [10, 0]}},
        {at: 0.75, shot: {position: [20, 0]}},
      ]);
      lerpTo(stage, rig, 0.1);
      expect(rig.camera.position.x).toBe(10);
      lerpTo(stage, rig, -5);
      expect(rig.camera.position.x).toBe(10);
      lerpTo(stage, rig, 0.9);
      expect(rig.camera.position.x).toBe(20);
      lerpTo(stage, rig, 7);
      expect(rig.camera.position.x).toBe(20);
      lerpTo(stage, rig, 0.5);
      expect(rig.camera.position.x).toBeCloseTo(15, 12);
    });

    it('track(from, to) is the track of two keys at 0 and 1, and starts on the first at once', () => {
      const {stage, rig} = makeRig();
      void rig.moveTo({position: [-50, 0]}, 1);
      rig.step(0.5);
      rig.track({position: [0, 0], zoom: 2}, {position: [40, 0, 200]});
      expect(rig.busy).toBe(false);
      frame(stage);
      expect(rig.camera.position.toArray()).toEqual([0, 0, 300]);
      expect(lensOf(rig.camera as PerspectiveCamera)).toBeCloseTo(
        lensOf(stage.projection!.createCamera() as PerspectiveCamera) / 2,
        12,
      );

      lerpTo(stage, rig, 0.5);
      expect(rig.camera.position.x).toBeCloseTo(20, 12);
      expect(rig.camera.position.z).toBeCloseTo(250, 12);
    });

    it('shows a new progress from the next step(), and step() answers true only when the shot changed', () => {
      const {stage, rig} = makeRig();
      rig.track({position: [0, 0]}, {position: [100, 0]});
      // the first lerp() of a track is shown at once
      rig.lerp(0);
      rig.step(1 / 60);
      expect(rig.step(1 / 60), 'a track that stands').toBe(false);

      rig.lerp(0.5);
      frame(stage);
      expect(rig.camera.position.x, 'before the step').toBe(0);
      expect(rig.step(1 / 60)).toBe(true);
      frame(stage);
      expect(rig.camera.position.x).toBeCloseTo(50, 12);
      expect(rig.step(1 / 60)).toBe(false);
      rig.lerp(0.5);
      expect(rig.step(1 / 60), 'the same progress again').toBe(false);
      expect(rig.busy).toBe(false);
    });

    it('resolves the shot of each key anew in every frame: a key on a camera or an object follows it', () => {
      const {stage, rig} = makeRig();
      const source = new PerspectiveCamera(40, 4 / 3, 0.5, 2000);
      source.position.set(0, 0, 500);
      const player = new Object3D();
      rig.track([
        {at: 0, shot: source},
        {at: 1, shot: player},
      ]);
      rig.step(1 / 60);
      frame(stage);
      expectShowsAs(rig.camera, fittedTo(source, stage));

      source.position.x = 30;
      expect(rig.step(1 / 60), 'a key camera that moved').toBe(true);
      expect(rig.busy, 'the camera moved after a key').toBe(true);
      frame(stage);
      expectShowsAs(rig.camera, fittedTo(source, stage));
      expect(rig.step(1 / 60)).toBe(false);
      expect(rig.busy).toBe(false);

      // the object as a position on the plane, at the distance and the zoom of the rest
      lerpTo(stage, rig, 1);
      player.position.set(70, -20, 45);
      expect(rig.step(1 / 60)).toBe(true);
      frame(stage);
      const rest = stage.projection!.createCamera();
      rest.position.set(70, -20, 300);
      expectPlacedAs(rig.camera, rest);
    });

    it('takes the look of each key, and a look() lies on top of the track until the next target', () => {
      const {stage, rig} = makeRig();
      rig.look({yaw: 0.4, pitch: 0});
      rig.track({look: {yaw: 0.2, pitch: 0}}, {look: {yaw: -0.2, pitch: 0}});
      rig.step(1 / 60);
      frame(stage);
      expect(-directionOf(rig.camera).x, 'the track brings its own look').toBeCloseTo(Math.sin(0.2), 12);

      rig.look({yaw: 0.1, pitch: 0.05});
      frame(stage);
      expect(-directionOf(rig.camera).x).toBeCloseTo(Math.sin(0.3) * Math.cos(0.05), 12);
      expect(directionOf(rig.camera).y).toBeCloseTo(Math.sin(0.05), 12);
      lerpTo(stage, rig, 1);
      expect(-directionOf(rig.camera).x).toBeCloseTo(Math.sin(-0.1) * Math.cos(0.05), 12);
    });

    it('a stretch between keys of different lenses runs the lens change, and assigns no projection', () => {
      const {stage, rig} = makeRig();
      const parallax = stage.projection!;
      const ortho = makeProjection('orthographic');
      rig.track({}, ortho);

      lerpTo(stage, rig, 0);
      expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
      expectPlacedAs(rig.camera, parallax.createCamera());

      lerpTo(stage, rig, 0.5);
      expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
      // the dolly zoom backs the camera off while the plane keeps its size
      expect(rig.camera.position.z).toBeGreaterThan(300);
      expect(heightAtPlane(rig.camera as PerspectiveCamera)).toBeCloseTo(stage.height, 6);

      lerpTo(stage, rig, 1);
      expect(rig.camera).toBeInstanceOf(OrthographicCamera);
      ortho.updateViewRect(stage.containerWidth, stage.containerHeight);
      expectPlacedAs(rig.camera, ortho.createCamera());
      expect(stage.projection).toBe(parallax);

      lerpTo(stage, rig, 0);
      expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
      expectPlacedAs(rig.camera, parallax.createCamera());
    });

    it('re-frames the keys on a resize', () => {
      const {stage, rig} = makeRig();
      const ortho = makeProjection('orthographic');
      rig.track({position: [0, 0]}, ortho);
      lerpTo(stage, rig, 1);
      stage.resize(500, 700);
      frame(stage);
      ortho.updateViewRect(500, 700);
      expectPlacedAs(rig.camera, ortho.createCamera());
    });

    describe('a clip', () => {
      it('maps the span of its key onto 0 … the duration of the clip, and the camera stands where the clip puts it', () => {
        const {stage, rig} = makeRig();
        const {camera, action} = animatedCamera();
        rig.track([
          {at: 0, shot: {position: [0, 0]}},
          {at: 0.2, until: 0.6, shot: camera, clip: action},
          {at: 1, shot: {position: [0, 0]}},
        ]);

        lerpTo(stage, rig, 0.4);
        expect(action.time).toBeCloseTo(1, 12);
        expect(camera.position.x).toBeCloseTo(100, 9);
        expectShowsAs(rig.camera, fittedTo(camera, stage));

        lerpTo(stage, rig, 0.25);
        expect(action.time).toBeCloseTo(0.25, 12);
        expectShowsAs(rig.camera, fittedTo(camera, stage));

        lerpTo(stage, rig, 0.6);
        expect(action.time).toBe(2);
        expect(camera.position.x).toBe(200);
        expectShowsAs(rig.camera, fittedTo(camera, stage));

        // before its key the clip stands at its start, after it at its end
        lerpTo(stage, rig, 0.1);
        expect(action.time).toBe(0);
        expect(camera.position.x).toBe(0);
        lerpTo(stage, rig, 0.9);
        expect(action.time).toBe(2);
        expect(camera.position.x).toBe(200);
        expect(action.enabled && action.paused, 'neither played nor stopped').toBe(true);
      });
    });

    describe('smooth', () => {
      it('takes the progress of the first lerp() after track() at once, and glides from the next one on', () => {
        const {stage, rig} = makeRig();
        rig.track({position: [0, 0]}, {position: [100, 0]});
        rig.step(1);
        frame(stage);
        expect(rig.camera.position.x, 'a track without lerp() shows 0').toBe(0);

        rig.lerp(0.5, {smooth: 0.5});
        frame(stage);
        expect(rig.camera.position.x, 'in the frame of the stage before any step').toBeCloseTo(50, 12);
        expect(rig.step(1 / 60)).toBe(true);
        frame(stage);
        expect(rig.camera.position.x, 'no glide from 0').toBeCloseTo(50, 12);
        expect(rig.busy).toBe(false);
        expect(rig.step(1 / 60)).toBe(false);

        // from rest, with no velocity left of the jump: p = q − (q − p₀)(1 + ωt)e^(−ωt)
        rig.lerp(1, {smooth: 0.5});
        rig.step(0.5);
        frame(stage);
        expect(rig.camera.position.x).toBeCloseTo(100 - 50 * 2 * Math.exp(-1), 9);

        // a new track: its first lerp() jumps again
        rig.track({position: [0, 0]}, {position: [100, 0]});
        rig.lerp(0.25, {smooth: 0.5});
        rig.step(0);
        frame(stage);
        expect(rig.camera.position.x).toBeCloseTo(25, 12);
        expect(rig.busy).toBe(false);

        // a second lerp() before the next step glides, from the progress of the first
        rig.track({position: [0, 0]}, {position: [100, 0]});
        rig.lerp(0.5);
        rig.lerp(1, {smooth: 0.5});
        rig.step(0.5);
        frame(stage);
        expect(rig.camera.position.x).toBeCloseTo(100 - 50 * 2 * Math.exp(-1), 9);
      });

      it('lets the shown progress approach the asked one, critically damped, and settles below 1e-4', () => {
        const {stage, rig} = makeRig();
        rig.track({position: [0, 0]}, {position: [100, 0]});
        // the first lerp() of a track jumps
        rig.lerp(0);
        rig.step(1 / 60);

        rig.lerp(1, {smooth: 0.5});
        expect(rig.busy).toBe(true);
        expect(rig.step(0.5)).toBe(true);
        frame(stage);
        // p = q − (q − p₀)(1 + ωt)e^(−ωt), ω = 1 / smooth
        expect(rig.camera.position.x).toBeCloseTo(100 * (1 - 2 * Math.exp(-1)), 9);

        let last = rig.camera.position.x;
        let steps = 0;
        while (rig.busy && steps < 1000) {
          expect(rig.step(1 / 60)).toBe(true);
          frame(stage);
          const x = rig.camera.position.x;
          expect(x, 'no overshoot').toBeGreaterThanOrEqual(last);
          expect(x).toBeLessThanOrEqual(100);
          last = x;
          steps++;
        }
        expect(rig.busy).toBe(false);
        expect(rig.camera.position.x, 'settled on the asked progress').toBe(100);
        expect(rig.step(1 / 60)).toBe(false);
        // (1 + ωt)·e^(−ωt) falls below 1e-4 at ωt ≈ 11.8: at 5.9 s, 5.4 s after the first step
        expect(steps).toBeGreaterThan(310);
        expect(steps).toBeLessThan(335);
      });

      it('keeps its velocity when the asked progress changes on the way, and a lerp() without smooth jumps', () => {
        const {stage, rig} = makeRig();
        rig.track({position: [0, 0]}, {position: [100, 0]});
        rig.lerp(0);
        rig.lerp(1, {smooth: 0.2});
        rig.step(0.1);
        frame(stage);
        const x = rig.camera.position.x;
        // asked back below it: the velocity it has carries it up a little further first
        rig.lerp(0, {smooth: 0.2});
        rig.step(1 / 120);
        frame(stage);
        expect(rig.camera.position.x, 'still on its way up').toBeGreaterThan(x);

        rig.lerp(0.25);
        expect(rig.busy).toBe(true);
        rig.step(0);
        frame(stage);
        expect(rig.camera.position.x).toBeCloseTo(25, 12);
        expect(rig.busy).toBe(false);
      });
    });

    describe('the end of a track', () => {
      it.each<[string, (rig: CameraRig) => unknown]>([
        ['jump()', (rig) => rig.jump({position: [7, 0]})],
        ['moveTo()', (rig) => rig.moveTo({position: [7, 0]}, 0)],
      ])('%s ends it, and lerp() is refused afterwards', (_what, end) => {
        const {stage, rig} = makeRig();
        rig.track({position: [0, 0]}, {position: [100, 0]});
        lerpTo(stage, rig, 0);
        rig.lerp(1, {smooth: 0.5});
        rig.step(0.1);
        expect(rig.busy, 'gliding').toBe(true);
        end(rig);
        expect(rig.busy).toBe(false);
        rig.step(1);
        frame(stage);
        expect(rig.camera.position.x).toBe(7);
        expect(() => rig.lerp(0.5)).toThrow(new Error('CameraRig#lerp(): the rig has no track; set one with track() first'));
      });

      it('a moveTo() starts from the shot the track shows', () => {
        const {stage, rig} = makeRig();
        rig.track({position: [0, 0]}, {position: [100, 0]});
        lerpTo(stage, rig, 0.5);
        void rig.moveTo({position: [50, 80]}, 1, {easing: 'linear'});
        rig.step(0.5);
        frame(stage);
        expect(rig.camera.position.x).toBeCloseTo(50, 12);
        expect(rig.camera.position.y).toBeCloseTo(40, 12);
      });

      it('cancel() leaves a track alone', () => {
        const {stage, rig} = makeRig();
        rig.track({position: [0, 0]}, {position: [100, 0]});
        rig.cancel();
        lerpTo(stage, rig, 0.5);
        expect(rig.camera.position.x).toBeCloseTo(50, 12);
      });
    });

    describe('refusals', () => {
      it('track() refuses keys out of order, an at or until outside [0, 1], an until before its at, and changes nothing then', () => {
        const {stage, rig} = makeRig();
        rig.track({position: [0, 0]}, {position: [100, 0]});
        lerpTo(stage, rig, 0.5);
        const camera = new PerspectiveCamera();
        const cases: [unknown, Error][] = [
          [[], new TypeError('CameraRig#track(): keys must be a non-empty array of CameraTrackKey, got []')],
          ['keys', new TypeError('CameraRig#track(): keys must be a non-empty array of CameraTrackKey, got "keys"')],
          [[null], new TypeError('CameraRig#track(): keys[0] must be an object with at and shot, got null')],
          [[{at: -0.1, shot: {}}], new RangeError('CameraRig#track(): keys[0].at must be a finite number from 0 to 1, got -0.1')],
          [
            [{at: Number.NaN, shot: {}}],
            new RangeError('CameraRig#track(): keys[0].at must be a finite number from 0 to 1, got NaN'),
          ],
          [
            [{at: 0.5, until: 1.5, shot: {}}],
            new RangeError('CameraRig#track(): keys[0].until must be a finite number from 0 to 1, got 1.5'),
          ],
          [
            [{at: 0.5, until: 0.25, shot: {}}],
            new RangeError('CameraRig#track(): keys[0].until must be of its at, 0.5, or more, got 0.25'),
          ],
          [
            [
              {at: 0, until: 0.6, shot: {}},
              {at: 0.4, shot: {}},
            ],
            new RangeError(
              'CameraRig#track(): the keys must go in order: keys[1].at must be of 0.6 or more, where keys[0] ends, got 0.4',
            ),
          ],
          [
            [{at: 0, shot: {position: [0, 0]}, clip: {}}],
            new TypeError('CameraRig#track(): keys[0].clip must be an AnimationAction, got {}'),
          ],
          [
            [{at: 0, shot: {position: [0, 0]}, clip: animatedCamera().action}],
            new TypeError('CameraRig#track(): keys[0].clip needs a camera as the shot of its key, got {position: [0, 0]}'),
          ],
          [
            [{at: 0, shot: {}, ease: 'bounce'}],
            new TypeError(
              "CameraRig#track(): keys[0].ease must be 'linear', 'ease-in', 'ease-out', 'ease-in-out' or a function, got \"bounce\"",
            ),
          ],
          [
            [{at: 0, shot: {zoom: 0}}],
            new RangeError('CameraRig#track(): keys[0].shot.zoom must be a finite number above 0, got 0'),
          ],
          [
            [{at: 0, shot: 5}],
            new TypeError('CameraRig#track(): keys[0].shot must be a CameraPose, a camera, a projection or an Object3D, got 5'),
          ],
          [
            [{at: 0, shot: new Camera()}],
            new TypeError(
              'CameraRig#track(): keys[0].shot must be a PerspectiveCamera or an OrthographicCamera where it is a camera, got Camera',
            ),
          ],
          [
            [
              {at: 0, shot: {}},
              {at: 1, shot: new OrthographicCamera(-160, 160, 90, -90, 0.5, 500)},
            ],
            new Error(
              'CameraRig#track(): the stretch from keys[0] to keys[1] is a lens change between a perspective and an orthographic camera, which needs a focus: a camera as the target has no projectionPlane, and a track names no focus',
            ),
          ],
        ];
        for (const [keys, error] of cases) expect(() => rig.track(keys as CameraTrackKey[])).toThrow(error);
        expect(() => rig.track({position: [0, 0, Number.NaN]}, camera)).toThrow(
          new RangeError('CameraRig#track(): keys[0].shot.position[2] must be a finite number, got NaN'),
        );

        rig.step(1);
        frame(stage);
        expect(rig.camera.position.x, 'the track it had').toBeCloseTo(50, 12);
      });

      it('track() refuses a lens change where the stage has no plane', () => {
        const stage = new Stage2D(planelessProjection());
        stage.resize(800, 600);
        const rig = new CameraRig(stage);
        expect(() => rig.track({}, makeProjection('orthographic'))).toThrow(
          new Error(
            'CameraRig#track(): the stretch from keys[0] to keys[1] is a lens change between a perspective and an orthographic camera, which needs a focus: the projection has no projectionPlane, and a track names no focus',
          ),
        );
        // keys of one kind need none
        expect(() => rig.track({}, {position: [10, 0]})).not.toThrow();
      });

      it('track() refuses a look of a key under an OrthographicProjection', () => {
        const {rig} = makeRig('orthographic');
        expect(() => rig.track({}, {look: {yaw: 0.1, pitch: 0}})).toThrow(
          new RangeError('CameraRig#track(): an orthographic projection takes no look other than 0, got {yaw: 0.1, pitch: 0}'),
        );
      });

      it('lerp() refuses a t or a smooth that is not a finite number, and a rig without a track', () => {
        const {rig} = makeRig();
        expect(() => rig.lerp(0.5)).toThrow(new Error('CameraRig#lerp(): the rig has no track; set one with track() first'));
        rig.track({}, {position: [10, 0]});
        expect(() => rig.lerp(Number.NaN)).toThrow(new RangeError('CameraRig#lerp(): t must be a finite number, got NaN'));
        expect(() => rig.lerp('0.5' as unknown as number)).toThrow(
          new RangeError('CameraRig#lerp(): t must be a finite number, got "0.5"'),
        );
        expect(() => rig.lerp(0.5, {smooth: -1})).toThrow(
          new RangeError('CameraRig#lerp(): smooth must be a finite number of 0 or more, got -1'),
        );
        expect(() => rig.lerp(0.5, {smooth: Number.POSITIVE_INFINITY})).toThrow(
          new RangeError('CameraRig#lerp(): smooth must be a finite number of 0 or more, got Infinity'),
        );
        expect(() => rig.lerp(0.5, null as unknown as {smooth: number})).toThrow(
          new TypeError('CameraRig#lerp(): options must be an object, got null'),
        );
        expect(rig.busy).toBe(false);
      });

      it('track() and lerp() throw on a disposed rig', () => {
        const {rig} = makeRig();
        rig.dispose();
        expect(() => rig.track({}, {})).toThrow(new Error('CameraRig#track(): the rig has been disposed'));
        expect(() => rig.lerp(0)).toThrow(new Error('CameraRig#lerp(): the rig has been disposed'));
      });
    });
  });

  describe('the base camera', () => {
    it('is of the kind a projection of a class of its own builds, found out by one createCamera()', () => {
      const {stage, rig} = makeRig('parallax');
      const custom = customProjection('orthographic');
      stage.projection = custom;
      expect(custom.createCamera).toHaveBeenCalledTimes(1);
      expect(rig.camera).toBeInstanceOf(OrthographicCamera);

      stage.resize(640, 480);
      expect(custom.createCamera).toHaveBeenCalledTimes(1);
      expect(custom.updateCamera).toHaveBeenCalled();
      for (const [camera] of custom.updateCamera.mock.calls) expect(camera).toBeInstanceOf(OrthographicCamera);
      frame(stage);
      expectPlacedAs(rig.camera, custom.createCamera());

      // and on to one of the other kind
      const perspective = customProjection('perspective');
      stage.projection = perspective;
      expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
      for (const [camera] of perspective.updateCamera.mock.calls) expect(camera).toBeInstanceOf(PerspectiveCamera);
      frame(stage);
      expectPlacedAs(rig.camera, perspective.createCamera());
    });
  });

  describe('the kind of a projection of a class of its own', () => {
    it('follows the camera the projection builds now, where the kind found out before is stale', () => {
      const {stage, rig} = makeRig('parallax');
      const perspective = customProjection('perspective');
      const orthographic = customProjection('orthographic');
      let current: IProjection = perspective;
      const switching = {
        projectionPlane: undefined,
        updateViewRect(width: number, height: number) {
          perspective.updateViewRect(width, height);
          orthographic.updateViewRect(width, height);
        },
        getViewRect: () => current.getViewRect(),
        getScaleFactor: () => 1,
        createCamera: () => current.createCamera(),
        updateCamera: (camera: Camera) => current.updateCamera(camera),
      } satisfies IProjection;

      // the rig finds out a perspective kind on the way to it
      void rig.moveTo(switching, 1);
      rig.cancel();

      current = orthographic;
      expect(() => void rig.moveTo(switching, 1, {focus: 300})).not.toThrow();
      expect(() => rig.look({yaw: 0.1, pitch: 0}), 'the move runs into an orthographic lens').toThrow(RangeError);

      rig.step(1);
      expect(stage.projection).toBe(switching);
      frame(stage);
      expect(rig.camera).toBeInstanceOf(OrthographicCamera);
      expectPlacedAs(rig.camera, orthographic.createCamera());
    });
  });

  describe('precompile()', () => {
    /** A renderer as far as precompile() reads it, which records the calls of compileAsync(). */
    const makeRenderer = () => {
      const state = {target: null as unknown, mrt: null as unknown};
      const calls: {scene: unknown; camera: Camera; target: unknown}[] = [];
      const renderer = {
        initialized: true,
        samples: 0,
        contextNode: null,
        getRenderTarget: () => state.target,
        setRenderTarget: (target: unknown) => void (state.target = target),
        getMRT: () => state.mrt,
        setMRT: (mrt: unknown) => void (state.mrt = mrt),
        getDrawingBufferSize: (out: {set: (w: number, h: number) => unknown}) => out.set(800, 600),
        compileAsync: vi.fn(async (scene: unknown, camera: Camera) => {
          calls.push({scene, camera, target: state.target});
        }),
      };
      return {renderer: renderer as unknown as WebGPURenderer, calls};
    };

    for (const [kind, other] of [
      ['parallax', OrthographicCamera],
      ['orthographic', PerspectiveCamera],
    ] as const) {
      it(`compiles the scene of a stage under a ${kind} projection with the camera of the other kind, placed over the view`, async () => {
        const {stage, rig} = makeRig(kind);
        const {renderer, calls} = makeRenderer();
        await rig.precompile(renderer);
        expect(calls).toHaveLength(1);
        expect(calls[0]!.scene).toBe(stage.scene);
        const camera = calls[0]!.camera;
        expect(camera).toBeInstanceOf(other);
        expect(camera).not.toBe(rig.camera);
        expect(stage.camera).toBe(rig.camera);
        // the middle and the corners of the view lie inside the frustum of that camera
        for (const [x, y] of [
          [0, 0],
          [-300, -220],
          [300, 220],
        ] as const) {
          const ndc = new Vector3(x, y, 0).project(camera);
          expect(Math.abs(ndc.x)).toBeLessThan(1);
          expect(Math.abs(ndc.y)).toBeLessThan(1);
          expect(Math.abs(ndc.z)).toBeLessThan(1);
        }
      });
    }

    it('compiles the pass of a post-process with the camera of the other kind, into the target of the pass', async () => {
      const {stage, rig} = makeRig('parallax');
      stage.postProcess = {build: ({pass}) => pass};
      const {renderer, calls} = makeRenderer();
      await rig.precompile(renderer);
      expect(calls).toHaveLength(2);
      const [plain, ofPass] = calls;
      expect(plain!.camera).toBeInstanceOf(OrthographicCamera);
      expect(ofPass!.scene).toBe(stage.scene);
      expect(ofPass!.camera).toBe(plain!.camera);
      const [pass] = Stage2DInternals.scenePassesOf(stage);
      expect(ofPass!.target).toBe(pass!.renderTarget);
      // the pass draws with the camera of the stage again, and the renderer has its target back
      expect(pass!.camera).toBe(rig.camera);
      expect(renderer.getRenderTarget()).toBeNull();
    });

    it('runs the calls on one renderer one after the other, and on another renderer alongside', async () => {
      const map = makeRig('parallax');
      const room = makeRig('orthographic');
      const {renderer} = makeRenderer();
      const compile = vi.mocked(renderer.compileAsync);
      let release!: () => void;
      compile.mockImplementationOnce(() => new Promise<void>((resolve) => void (release = resolve)));

      const first = map.rig.precompile(renderer);
      const second = room.rig.precompile(renderer);
      const other = makeRenderer();
      const alongside = room.rig.precompile(other.renderer);
      expect(await hasSettled(alongside), 'another renderer does not wait').toBe(true);
      expect(other.calls).toHaveLength(1);
      expect(await hasSettled(second)).toBe(false);
      expect(compile, 'the second compile waits for the first').toHaveBeenCalledTimes(1);
      expect(compile.mock.calls[0]![0]).toBe(map.stage.scene);

      release();
      await expect(first).resolves.toBeUndefined();
      await expect(second).resolves.toBeUndefined();
      expect(compile).toHaveBeenCalledTimes(2);
      expect(compile.mock.calls[1]![0]).toBe(room.stage.scene);
      expect(compile.mock.calls[1]![1]).toBeInstanceOf(PerspectiveCamera);
    });

    it('runs the next call on a renderer after one that rejected, each with its own result', async () => {
      const map = makeRig('parallax');
      const room = makeRig('orthographic');
      const {renderer} = makeRenderer();
      const compile = vi.mocked(renderer.compileAsync);
      const failure = new Error('compile failed');
      compile.mockImplementationOnce(async () => {
        throw failure;
      });

      const first = map.rig.precompile(renderer);
      const second = room.rig.precompile(renderer);
      await expect(first).rejects.toBe(failure);
      await expect(second).resolves.toBeUndefined();
      expect(compile).toHaveBeenCalledTimes(2);
      expect(compile.mock.calls[1]![0]).toBe(room.stage.scene);
      // and the queue goes on after both
      await expect(map.rig.precompile(renderer)).resolves.toBeUndefined();
      expect(compile).toHaveBeenCalledTimes(3);
    });

    it('is refused for a WebGLRenderer and on a disposed rig', async () => {
      const {rig} = makeRig();
      await expect(rig.precompile({isWebGLRenderer: true} as unknown as WebGPURenderer)).rejects.toThrow(
        new TypeError('CameraRig#precompile(): a WebGLRenderer is not supported — compile with a WebGPURenderer'),
      );
      rig.dispose();
      await expect(rig.precompile(makeRenderer().renderer)).rejects.toThrow(
        new Error('CameraRig#precompile(): the rig has been disposed'),
      );
    });
  });

  describe('as the frame step of a FramePacer', () => {
    // the pacer subscribes before the handler asks, so a step reports into the frame it ran in, or
    // after it: the handler that asks first draws what a step moved one frame later (§3.3 of the
    // proposal drawing-on-demand.md)
    it.each([
      {asks: 'after the steps', askFirst: false, extraDraws: 0},
      {asks: 'before the steps', askFirst: true, extraDraws: 1},
    ])(
      'draws during a move and after it only for its end pose, and not while the camera stands (asks $asks)',
      ({askFirst, extraDraws}) => {
        const {stage, rig} = makeRig();
        const listeners = new Set<(props: DisplayEventProps) => unknown>();
        const source: FramePacerSource = {
          onRenderFrame: (listener) => {
            listeners.add(listener);
            return () => {
              listeners.delete(listener);
            };
          },
        };
        const pacer = new FramePacer(source);
        pacer.onFrame((props) => rig.step(props.deltaTime), stage);

        const props = {rawDeltaTime: 1 / 60, deltaTime: 1 / 60} as DisplayEventProps;
        // what a frame handler does: update the stage, run the steps, ask the pacer, count the draw
        const run = (frames: number) => {
          const before = pacer.draws;
          for (let i = 0; i < frames; i++) {
            frame(stage);
            if (askFirst) pacer.shouldDraw(props);
            for (const listener of Array.from(listeners)) listener(props);
            if (!askFirst) pacer.shouldDraw(props);
          }
          return pacer.draws - before;
        };

        run(2); // the first frame draws by itself, and the first step answers true
        expect(run(30), 'a camera that stands').toBe(0);

        void rig.moveTo({position: [100, 0]}, 0.24); // arrives in the 15th frame at 60 Hz
        // a step reports into the frame of its own ask, or into the next one: the move starts to show a frame late
        expect(run(15), 'during the move').toBe(15 - extraDraws);
        expect(run(1), 'the frame of the end pose').toBe(extraDraws);
        expect(run(30), 'the camera stands again').toBe(0);
        expect(rig.camera.position.x).toBeCloseTo(100, 5);
      },
    );
  });
});

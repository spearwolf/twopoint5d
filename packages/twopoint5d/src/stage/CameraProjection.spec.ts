import {on} from '@spearwolf/eventize';
import {
  AnimationClip,
  AnimationMixer,
  type Camera,
  Group,
  Matrix4,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Quaternion,
  QuaternionKeyframeTrack,
  Vector3,
  VectorKeyframeTrack,
} from 'three/webgpu';
import {describe, expect, it, vi} from 'vitest';

import {OnStageAfterCameraChanged, OnStageCameraPlaced} from '../events.js';
import {CameraProjection, type CameraProjectionSpecs, fitLens} from './CameraProjection.js';
import {CameraRig} from './CameraRig.js';
import {Stage2D} from './Stage2D.js';

const DEG = Math.PI / 180;

// the authored frame of the perspective source: 60° high, 16:9
const FOV = 60;
const ASPECT = 16 / 9;
const T = Math.tan((FOV / 2) * DEG);

// a container wider than 16:9, and one narrower
const WIDE = [1000, 500] as const;
const NARROW = [800, 600] as const;

const makePerspectiveSource = () => {
  const parent = new Group();
  parent.position.set(10, 20, 30);
  parent.rotation.set(0, 0.3, 0);
  const source = new PerspectiveCamera(FOV, ASPECT, 0.5, 500);
  source.position.set(1, 2, 3);
  source.rotation.set(-0.2, 0, 0.1);
  parent.add(source);
  return {parent, source};
};

// a frustum 8 wide and 6 high (4:3) around (2, 1), zoomed by 2
const makeOrthographicSource = () => {
  const source = new OrthographicCamera(-2, 6, 4, -2, -10, 90);
  source.zoom = 2;
  source.position.set(5, -5, 50);
  source.rotation.set(0, 0, 0.25);
  return source;
};

const makeProjection = (source: PerspectiveCamera | OrthographicCamera, specs?: CameraProjectionSpecs) =>
  new CameraProjection(source, specs);

const placed = <C extends PerspectiveCamera | OrthographicCamera>(
  projection: CameraProjection,
  container: readonly [number, number],
) => {
  projection.updateViewRect(container[0], container[1]);
  return projection.createCamera() as C;
};

/** Where `local`, a point in the space of `source`, lands in the clip space of `camera`. */
const ndcOf = (camera: Camera, source: Camera, local: Vector3) => {
  source.updateWorldMatrix(true, false);
  camera.updateMatrixWorld();
  return local.clone().applyMatrix4(source.matrixWorld).project(camera);
};

/** The corners of the authored frame of `source` in its own space: at depth 50 for a perspective one. */
const authoredCorners = (source: PerspectiveCamera | OrthographicCamera, aspect = ASPECT) => {
  if ((source as PerspectiveCamera).isPerspectiveCamera) {
    const d = 50;
    return [-1, 1].flatMap((sx) => [-1, 1].map((sy) => new Vector3(sx * d * T * aspect, sy * d * T, -d)));
  }
  const o = source as OrthographicCamera;
  const cx = (o.left + o.right) / 2;
  const cy = (o.top + o.bottom) / 2;
  const dx = (o.right - o.left) / (2 * o.zoom);
  const dy = (o.top - o.bottom) / (2 * o.zoom);
  return [-1, 1].flatMap((sx) => [-1, 1].map((sy) => new Vector3(cx + sx * dx, cy + sy * dy, -20)));
};

/** The largest |x| and |y| of the corners of the authored frame in the clip space of `camera`. */
const extentOfFrame = (camera: Camera, source: PerspectiveCamera | OrthographicCamera, aspect?: number) => {
  let x = 0;
  let y = 0;
  for (const corner of authoredCorners(source, aspect)) {
    const ndc = ndcOf(camera, source, corner);
    x = Math.max(x, Math.abs(ndc.x));
    y = Math.max(y, Math.abs(ndc.y));
  }
  return {x, y};
};

/** What a placement may never change of a source: its pose, its lens, its view. */
const stateOf = (source: PerspectiveCamera) => ({
  position: source.position.toArray(),
  quaternion: source.quaternion.toArray(),
  scale: source.scale.toArray(),
  fov: source.fov,
  aspect: source.aspect,
  near: source.near,
  far: source.far,
  zoom: source.zoom,
  view: source.view === null ? null : {...source.view},
});

const expectWorldPoseOf = (camera: Camera, source: Camera) => {
  source.updateWorldMatrix(true, false);
  const position = new Vector3();
  const quaternion = new Quaternion();
  source.matrixWorld.decompose(position, quaternion, new Vector3());
  for (const [i, value] of camera.position.toArray().entries()) expect(value).toBeCloseTo(position.getComponent(i), 9);
  expect(Math.abs(camera.quaternion.dot(quaternion))).toBeCloseTo(1, 9);
};

let frameNo = 0;
const frame = (stage: Stage2D) => stage.updateFrame(frameNo, 1 / 60, frameNo++);

describe('CameraProjection', () => {
  describe('construction', () => {
    it('keeps the source and the specs, the caller’s object', () => {
      const {source} = makePerspectiveSource();
      const specs: CameraProjectionSpecs = {fit: 'cover'};
      const projection = new CameraProjection(source, specs);
      expect(projection.source).toBe(source);
      expect(projection.viewSpecs).toBe(specs);
      expect(new CameraProjection(source).viewSpecs).toEqual({});
    });

    it('has no projection plane', () => {
      expect(makeProjection(makePerspectiveSource().source).projectionPlane).toBeUndefined();
    });

    it.each<[string, unknown, string]>([
      ['an Object3D', new Object3D(), 'Object3D'],
      ['a Group', new Group(), 'Group'],
      ['undefined', undefined, 'undefined'],
      ['a plain object', {isPerspectiveCamera: false}, '{isPerspectiveCamera: false}'],
    ])('refuses %s as the source', (_what, source, described) => {
      expect(() => new CameraProjection(source as PerspectiveCamera)).toThrow(
        new TypeError(`CameraProjection: source must be a PerspectiveCamera or an OrthographicCamera, got ${described}`),
      );
    });

    it('refuses such a source as a new source, and keeps the one it has', () => {
      const {source} = makePerspectiveSource();
      const projection = makeProjection(source);
      expect(() => {
        projection.source = new Object3D() as PerspectiveCamera;
      }).toThrow(new TypeError('CameraProjection: source must be a PerspectiveCamera or an OrthographicCamera, got Object3D'));
      expect(projection.source).toBe(source);
    });

    it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '1'])('refuses an aspect of %s', (aspect) => {
      expect(() => makeProjection(makePerspectiveSource().source, {aspect: aspect as number})).toThrow(RangeError);
      expect(() => makeProjection(makePerspectiveSource().source, {aspect: 0})).toThrow(
        new RangeError('CameraProjection: aspect must be a finite number above 0, got 0'),
      );
    });

    it('refuses an aspect written into the specs later, at the next updateViewRect()', () => {
      const projection = makeProjection(makePerspectiveSource().source);
      projection.viewSpecs.aspect = -2;
      expect(() => projection.updateViewRect(800, 600)).toThrow(
        new RangeError('CameraProjection: aspect must be a finite number above 0, got -2'),
      );
    });

    it('refuses a fit other than contain and cover', () => {
      expect(() => makeProjection(makePerspectiveSource().source, {fit: 'fill' as 'contain'})).toThrow(
        new TypeError(`CameraProjection: fit must be 'contain' or 'cover', got "fill"`),
      );
    });
  });

  describe('the view', () => {
    it('answers the container, one view unit per container unit, with no offset', () => {
      const projection = makeProjection(makePerspectiveSource().source);
      expect(projection.getViewRect()).toEqual({width: 0, height: 0, pixelRatioX: 0, pixelRatioY: 0, offsetX: 0, offsetY: 0});
      projection.updateViewRect(1000, 500, 2);
      expect(projection.getViewRect()).toEqual({
        width: 1000,
        height: 500,
        pixelRatioX: 1,
        pixelRatioY: 1,
        offsetX: 0,
        offsetY: 0,
      });
    });

    it('hands out a new object on every call', () => {
      const projection = makeProjection(makePerspectiveSource().source);
      projection.updateViewRect(800, 600);
      const rect = projection.getViewRect();
      expect(projection.getViewRect()).not.toBe(rect);
      rect.width = 1;
      expect(projection.getViewRect().width).toBe(800);
    });

    it.each([
      [0, 500],
      [800, Number.NaN],
      [-1, 600],
    ])('keeps the view it has for a container of %s × %s', (width, height) => {
      const projection = makeProjection(makePerspectiveSource().source);
      projection.updateViewRect(800, 600);
      projection.updateViewRect(width, height);
      expect(projection.getViewRect()).toMatchObject({width: 800, height: 600});
    });
  });

  describe('a perspective source', () => {
    it('builds a PerspectiveCamera at the world pose of the source, its parents included', () => {
      const {source} = makePerspectiveSource();
      const camera = placed<PerspectiveCamera>(makeProjection(source), WIDE);
      expect(camera).toBeInstanceOf(PerspectiveCamera);
      expectWorldPoseOf(camera, source);
    });

    it('takes the world pose without the scale of the source', () => {
      const {parent, source} = makePerspectiveSource();
      parent.scale.set(2, 2, 2);
      const camera = placed<PerspectiveCamera>(makeProjection(source), WIDE);
      expectWorldPoseOf(camera, source);
      expect(camera.scale.toArray()).toEqual([1, 1, 1]);
    });

    it('contain, in a container wider than the source: the height keeps the authored fov, the sides widen', () => {
      const {source} = makePerspectiveSource();
      const camera = placed<PerspectiveCamera>(makeProjection(source), WIDE);
      expect(camera.fov).toBe(FOV);
      expect(camera.aspect).toBe(2);
      const extent = extentOfFrame(camera, source);
      expect(extent.y).toBeCloseTo(1, 9);
      expect(extent.x).toBeCloseTo(ASPECT / 2, 9);
    });

    it('contain, in a container narrower than the source: the width keeps the authored extent, the height grows', () => {
      const {source} = makePerspectiveSource();
      const camera = placed<PerspectiveCamera>(makeProjection(source), NARROW);
      expect(Math.tan((camera.fov / 2) * DEG)).toBeCloseTo((T * ASPECT) / (4 / 3), 12);
      expect(camera.aspect).toBe(4 / 3);
      const extent = extentOfFrame(camera, source);
      expect(extent.x).toBeCloseTo(1, 9);
      expect(extent.y).toBeCloseTo(4 / 3 / ASPECT, 9);
    });

    it('cover, in a container wider than the source: the width keeps the authored extent, the height is cut', () => {
      const {source} = makePerspectiveSource();
      const camera = placed<PerspectiveCamera>(makeProjection(source, {fit: 'cover'}), WIDE);
      expect(Math.tan((camera.fov / 2) * DEG)).toBeCloseTo((T * ASPECT) / 2, 12);
      const extent = extentOfFrame(camera, source);
      expect(extent.x).toBeCloseTo(1, 9);
      expect(extent.y).toBeCloseTo(2 / ASPECT, 9);
    });

    it('cover, in a container narrower than the source: the height keeps the authored fov, the sides are cut', () => {
      const {source} = makePerspectiveSource();
      const camera = placed<PerspectiveCamera>(makeProjection(source, {fit: 'cover'}), NARROW);
      expect(camera.fov).toBe(FOV);
      const extent = extentOfFrame(camera, source);
      expect(extent.y).toBeCloseTo(1, 9);
      expect(extent.x).toBeCloseTo(ASPECT / (4 / 3), 9);
    });

    it('takes the zoom of the source', () => {
      const {source} = makePerspectiveSource();
      source.zoom = 2;
      const camera = placed<PerspectiveCamera>(makeProjection(source), WIDE);
      expect([camera.fov, camera.zoom]).toEqual([FOV, 2]);
      const extent = extentOfFrame(camera, source);
      expect(extent.y).toBeCloseTo(2, 9);
    });

    it('fits the aspect of the specs instead of the one of the source', () => {
      const {source} = makePerspectiveSource();
      const camera = placed<PerspectiveCamera>(makeProjection(source, {aspect: 2}), NARROW);
      expect(Math.tan((camera.fov / 2) * DEG)).toBeCloseTo((T * 2) / (4 / 3), 12);
      expect(extentOfFrame(camera, source, 2).x).toBeCloseTo(1, 9);
      expect(placed<PerspectiveCamera>(makeProjection(source, {aspect: 2}), WIDE).fov).toBe(FOV);
    });

    it('takes near and far of the source, or of the specs', () => {
      const {source} = makePerspectiveSource();
      const camera = placed<PerspectiveCamera>(makeProjection(source), WIDE);
      expect([camera.near, camera.far]).toEqual([0.5, 500]);
      const fromSpecs = placed<PerspectiveCamera>(makeProjection(source, {near: 2, far: 80}), WIDE);
      expect([fromSpecs.near, fromSpecs.far]).toEqual([2, 80]);
    });

    it('takes near and far of the source for specs no camera can be built from', () => {
      const {source} = makePerspectiveSource();
      for (const specs of [{near: 0}, {near: Number.NaN}, {far: Number.POSITIVE_INFINITY}, {near: 600}]) {
        const camera = placed<PerspectiveCamera>(makeProjection(source, specs), WIDE);
        expect([camera.near, camera.far], JSON.stringify(specs)).toEqual([0.5, 500]);
      }
    });

    it('shows the authored frame of the source before a view', () => {
      const {source} = makePerspectiveSource();
      const camera = makeProjection(source).createCamera() as PerspectiveCamera;
      expect([camera.fov, camera.aspect]).toEqual([FOV, ASPECT]);
    });

    it('getScaleFactor(d) is focus / d, with the focus of the source', () => {
      const {source} = makePerspectiveSource();
      const projection = makeProjection(source);
      expect(projection.getScaleFactor(5)).toBe(2);
      source.focus = 20;
      expect(projection.getScaleFactor(5)).toBe(4);
      expect(projection.getScaleFactor(20)).toBe(1);
    });
  });

  describe('an orthographic source', () => {
    it('builds an OrthographicCamera at the world pose of the source', () => {
      const source = makeOrthographicSource();
      const camera = placed<OrthographicCamera>(makeProjection(source), WIDE);
      expect(camera).toBeInstanceOf(OrthographicCamera);
      expectWorldPoseOf(camera, source);
      expect([camera.zoom, camera.near, camera.far]).toEqual([2, -10, 90]);
    });

    it.each<['contain' | 'cover', readonly [number, number], number, number]>([
      ['contain', WIDE, 4 / 3 / 2, 1],
      ['contain', [600, 800], 1, 0.75 / (4 / 3)],
      ['cover', WIDE, 1, 2 / (4 / 3)],
      ['cover', [600, 800], 4 / 3 / 0.75, 1],
    ])('%s in a container of %j puts the corners of the frame at ±%d, ±%d around its middle', (fit, container, x, y) => {
      const source = makeOrthographicSource();
      const camera = placed<OrthographicCamera>(makeProjection(source, {fit}), container);
      const extent = extentOfFrame(camera, source);
      expect(extent.x).toBeCloseTo(x, 9);
      expect(extent.y).toBeCloseTo(y, 9);
      // the middle of the frame stays where the source has it
      const middle = ndcOf(camera, source, new Vector3(2, 1, -20));
      expect(middle.x).toBeCloseTo(0, 9);
      expect(middle.y).toBeCloseTo(0, 9);
      expect((camera.right - camera.left) / (camera.top - camera.bottom)).toBeCloseTo(container[0] / container[1], 12);
    });

    it('getScaleFactor() is 1', () => {
      const projection = makeProjection(makeOrthographicSource());
      expect(projection.getScaleFactor(5)).toBe(1);
      expect(projection.getScaleFactor(500)).toBe(1);
    });
  });

  describe('fitLens()', () => {
    it.each<['contain' | 'cover', number, number, number]>([
      ['contain', 2, 1, 2],
      ['contain', 2, 4, 1],
      ['cover', 2, 1, 1],
      ['cover', 2, 4, 0.5],
    ])('%s of an authored aspect %d in a container of %d scales the lens by %d', (fit, authored, container, factor) => {
      const target = {lens: 0};
      fitLens(0.75, authored, container, fit, target);
      expect(target.lens).toBe(0.75 * factor);
    });
  });

  describe('updateCamera()', () => {
    it('refuses a camera of the other kind than the source', () => {
      const perspective = makeProjection(makePerspectiveSource().source);
      perspective.updateViewRect(800, 600);
      expect(() => perspective.updateCamera(new OrthographicCamera())).toThrow(
        new TypeError('CameraProjection: updateCamera() needs a PerspectiveCamera for its source, got OrthographicCamera'),
      );
      const ortho = makeProjection(makeOrthographicSource());
      expect(() => ortho.updateCamera(new PerspectiveCamera())).toThrow(
        new TypeError('CameraProjection: updateCamera() needs an OrthographicCamera for its source, got PerspectiveCamera'),
      );
    });

    it('never writes the source', () => {
      const {source} = makePerspectiveSource();
      source.setViewOffset(1600, 900, 100, 50, 800, 450);
      const before = stateOf(source);
      const projection = makeProjection(source, {fit: 'cover', aspect: 1.25, near: 1, far: 50});
      const camera = placed<PerspectiveCamera>(projection, NARROW);
      projection.updateCamera(camera);
      expect(stateOf(source)).toEqual(before);
    });
  });

  describe('needsPlacement()', () => {
    const makePlaced = () => {
      const {parent, source} = makePerspectiveSource();
      const projection = makeProjection(source);
      const camera = placed<PerspectiveCamera>(projection, WIDE);
      return {parent, source, projection, camera};
    };

    it('answers true before the first placement', () => {
      const projection = makeProjection(makePerspectiveSource().source);
      projection.updateViewRect(800, 600);
      expect(projection.needsPlacement(new PerspectiveCamera())).toBe(true);
    });

    it('answers false while the source stands, whatever camera it is asked with', () => {
      const {projection, camera} = makePlaced();
      expect(projection.needsPlacement(camera)).toBe(false);
      expect(projection.needsPlacement(new PerspectiveCamera())).toBe(false);
      expect(projection.needsPlacement(camera)).toBe(false);
    });

    it.each<[string, (setup: ReturnType<typeof makePlaced>) => void]>([
      ['the source moved', ({source}) => void (source.position.x += 0.25)],
      ['the source turned', ({source}) => void source.rotateY(0.1)],
      ['a parent of the source moved', ({parent}) => void (parent.position.y -= 1)],
      ['the fov changed', ({source}) => void (source.fov = 45)],
      ['the zoom changed', ({source}) => void (source.zoom = 1.5)],
      ['the aspect changed', ({source}) => void (source.aspect = 1)],
      ['near changed', ({source}) => void (source.near = 0.25)],
      ['far changed', ({source}) => void (source.far = 1000)],
      ['the source is another camera', ({projection}) => void (projection.source = new PerspectiveCamera(FOV, ASPECT, 0.5, 500))],
    ])('answers true once %s, and false again after the placement', (_what, change) => {
      const setup = makePlaced();
      change(setup);
      expect(setup.projection.needsPlacement(setup.camera)).toBe(true);
      expect(setup.projection.needsPlacement(setup.camera), 'asking places nothing').toBe(true);
      setup.projection.updateCamera(setup.camera);
      expect(setup.projection.needsPlacement(setup.camera)).toBe(false);
    });

    it.each<[string, (source: OrthographicCamera) => void]>([
      ['left', (s) => void (s.left = -3)],
      ['right', (s) => void (s.right = 7)],
      ['top', (s) => void (s.top = 5)],
      ['bottom', (s) => void (s.bottom = -1)],
      ['zoom', (s) => void (s.zoom = 3)],
      ['near', (s) => void (s.near = 0)],
      ['far', (s) => void (s.far = 100)],
    ])('answers true once the %s of an orthographic source changed', (_what, change) => {
      const source = makeOrthographicSource();
      const projection = makeProjection(source);
      const camera = placed<OrthographicCamera>(projection, WIDE);
      expect(projection.needsPlacement(camera)).toBe(false);
      change(source);
      expect(projection.needsPlacement(camera)).toBe(true);
      projection.updateCamera(camera);
      expect(projection.needsPlacement(camera)).toBe(false);
    });

    it('answers what it placed last, not whether the camera it is asked with carries it', () => {
      const {projection, camera} = makePlaced();
      camera.position.set(0, 0, 0);
      camera.fov = 10;
      expect(projection.needsPlacement(camera)).toBe(false);
    });
  });

  describe('on a stage', () => {
    it('builds the camera of the stage of the kind of the source, the container as its view', () => {
      const stage = new Stage2D(makeProjection(makeOrthographicSource()));
      stage.resize(...WIDE);
      expect(stage.camera).toBeInstanceOf(OrthographicCamera);
      expect([stage.width, stage.height]).toEqual([...WIDE]);
    });

    it('places the camera in a frame in which the source moved, and only then', () => {
      const {source} = makePerspectiveSource();
      const stage = new Stage2D(makeProjection(source));
      stage.resize(...WIDE);
      const placements = vi.fn();
      on(stage, OnStageCameraPlaced, placements);

      frame(stage);
      expect(placements).not.toHaveBeenCalled();

      source.position.x += 2;
      frame(stage);
      expect(placements).toHaveBeenCalledTimes(1);
      expectWorldPoseOf(stage.camera!, source);

      frame(stage);
      expect(placements).toHaveBeenCalledTimes(1);
    });

    it('a stage without a rig builds a camera of the new kind when the source changes its kind', () => {
      const {source} = makePerspectiveSource();
      const projection = makeProjection(source);
      const stage = new Stage2D(projection);
      stage.resize(...WIDE);
      const previous = stage.camera;
      const changed = vi.fn();
      on(stage, OnStageAfterCameraChanged, changed);

      const ortho = makeOrthographicSource();
      projection.source = ortho;
      frame(stage);

      expect(stage.camera).toBeInstanceOf(OrthographicCamera);
      expect(changed).toHaveBeenCalledWith(stage, previous);
      expectWorldPoseOf(stage.camera!, ortho);

      // and so does a resize
      projection.source = source;
      stage.resize(...NARROW);
      expect(stage.camera).toBeInstanceOf(PerspectiveCamera);
    });

    it('a rig draws with a camera of the kind of the source, at the rest of the projection', () => {
      const {source} = makePerspectiveSource();
      const projection = makeProjection(source, {fit: 'cover'});
      const stage = new Stage2D(projection);
      stage.resize(...NARROW);
      const rig = new CameraRig(stage);
      frame(stage);
      expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
      const reference = projection.createCamera() as PerspectiveCamera;
      reference.updateMatrixWorld();
      expect([(rig.camera as PerspectiveCamera).fov, (rig.camera as PerspectiveCamera).aspect]).toEqual([
        reference.fov,
        reference.aspect,
      ]);
      expect(rig.camera.projectionMatrix.elements).toEqual(reference.projectionMatrix.elements);
      expect(rig.camera.matrixWorld.elements).toEqual(reference.matrixWorld.elements);

      // the source changes its kind: the rig swaps its camera
      const ortho = makeOrthographicSource();
      projection.source = ortho;
      frame(stage);
      expect(rig.camera).toBeInstanceOf(OrthographicCamera);
      expectWorldPoseOf(rig.camera, ortho);
      rig.dispose();
    });

    it('a rig follows a source that moves', () => {
      const {source} = makePerspectiveSource();
      const stage = new Stage2D(makeProjection(source));
      stage.resize(...WIDE);
      const rig = new CameraRig(stage);
      frame(stage);
      rig.step(0);
      source.position.set(-4, 7, 9);
      expect(rig.step(0), 'the rig sees the source once the stage placed it').toBe(false);
      frame(stage);
      expect(rig.step(0)).toBe(true);
      expectWorldPoseOf(rig.camera, source);
      rig.dispose();
    });

    it('a rig moves from one source to another as a move to its projection, and assigns it on arrival', () => {
      const {source} = makePerspectiveSource();
      const stage = new Stage2D(makeProjection(source, {fit: 'cover'}));
      stage.resize(...WIDE);
      const rig = new CameraRig(stage);
      const next = new PerspectiveCamera(40, ASPECT, 0.5, 500);
      next.position.set(-30, 5, 60);
      next.lookAt(0, 0, 0);
      const target = makeProjection(next, {fit: 'cover'});

      void rig.moveTo(target, 1, {easing: 'linear'});
      rig.step(0.5);
      frame(stage);
      const halfway = rig.camera.position.clone();
      source.updateWorldMatrix(true, false);
      const from = new Vector3().setFromMatrixPosition(source.matrixWorld);
      expect(halfway.distanceTo(from)).toBeCloseTo(halfway.distanceTo(next.position), 9);

      rig.step(0.5);
      expect(stage.projection).toBe(target);
      frame(stage);
      expectWorldPoseOf(rig.camera, next);
      expect((rig.camera as PerspectiveCamera).fov).toBe((target.createCamera() as PerspectiveCamera).fov);
      rig.dispose();
    });

    it('the stage takes back an assigned camera of the kind of the source when the rig lets go', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const {source} = makePerspectiveSource();
        const stage = new Stage2D(makeProjection(source));
        stage.resize(...WIDE);
        const assigned = new PerspectiveCamera();
        stage.camera = assigned;
        new CameraRig(stage).dispose();
        expect(stage.camera).toBe(assigned);
        expect(warn).not.toHaveBeenCalled();
      } finally {
        warn.mockRestore();
      }
    });

    it('the stage drops an assigned camera of another kind than the source has now, with a warning', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        const {source} = makePerspectiveSource();
        const projection = makeProjection(source);
        const stage = new Stage2D(projection);
        stage.name = 'room';
        stage.resize(...WIDE);
        stage.camera = new PerspectiveCamera();
        const rig = new CameraRig(stage);
        projection.source = makeOrthographicSource();
        frame(stage);

        expect(() => rig.dispose()).not.toThrow();

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]![0]).toMatch(/^Stage2D "room": /);
        expect(warn.mock.calls[0]![0]).toContain('PerspectiveCamera');
        expect(stage.camera).toBeInstanceOf(OrthographicCamera);
      } finally {
        warn.mockRestore();
      }
    });
  });

  describe('one source under two stages', () => {
    // an animation of the source in its parent: along x and about y within a second
    const animate = (source: PerspectiveCamera) => {
      const turned = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), 0.5);
      const clip = new AnimationClip('fly', 1, [
        new VectorKeyframeTrack('.position', [0, 1], [1, 2, 3, 9, 2, 3]),
        new QuaternionKeyframeTrack('.quaternion', [0, 1], [...source.quaternion.toArray(), ...turned.toArray()]),
      ]);
      const mixer = new AnimationMixer(source);
      mixer.clipAction(clip).play();
      return mixer;
    };

    it('neither placement writes the source, and both stages follow its animation', () => {
      const {source} = makePerspectiveSource();
      // a view offset of the source's own, which neither projection may touch
      source.setViewOffset(1600, 900, 100, 50, 800, 450);

      const plain = new Stage2D(makeProjection(source));
      const rigged = new Stage2D(makeProjection(source, {fit: 'cover', aspect: 1.5}));
      const rig = new CameraRig(rigged);

      let before = stateOf(source);
      plain.resize(...WIDE);
      rigged.resize(...NARROW);
      frame(plain);
      frame(rigged);
      expect(stateOf(source), 'after the placements of a resize').toEqual(before);

      const mixer = animate(source);
      mixer.update(0.5);
      const worldBefore = new Matrix4().copy(source.matrixWorld);
      before = stateOf(source);
      expect(before.position, 'the animation moved the source').not.toEqual([1, 2, 3]);

      const placed = vi.fn();
      on(plain, OnStageCameraPlaced, placed);
      on(rigged, OnStageCameraPlaced, placed);
      frame(plain);
      rig.step(1 / 60);
      frame(rigged);

      expect(placed, 'each stage placed its camera once').toHaveBeenCalledTimes(2);
      expect(stateOf(source), 'after the placements of an animation step').toEqual(before);
      expect(source.matrixWorld.equals(worldBefore), 'the projections read the source anew').toBe(false);
      expectWorldPoseOf(plain.camera!, source);
      expectWorldPoseOf(rig.camera, source);

      // and neither placed again for a source that stands
      frame(plain);
      frame(rigged);
      expect(placed).toHaveBeenCalledTimes(2);
      rig.dispose();
    });
  });
});

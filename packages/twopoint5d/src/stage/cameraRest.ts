import {type OrthographicCamera, type PerspectiveCamera, Quaternion, Vector3} from 'three/webgpu';
import type {CameraShotKind} from './cameraShot.js';
import type {IProjection} from './IProjection.js';

const RAD_PER_DEG = Math.PI / 180;

/**
 * The rest of a projection, as a base camera it placed gives it to a `CameraRig`: the frame poses
 * are given in — the projection plane, or the world without one —, the placement and the lens.
 * @internal
 */
export interface Rest {
  base: PerspectiveCamera | OrthographicCamera | undefined;
  kind: CameraShotKind;
  hasPlane: boolean;
  readonly origin: Vector3;
  readonly right: Vector3;
  readonly up: Vector3;
  readonly normal: Vector3;
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  /** The distance of the base from the plane, along its normal. */
  distance: number;
  /**
   * The frame an `Object3D` the rig follows is carried into: under a plane the plane's own axes;
   * without one the plane through the world origin that faces the base — its right and up axes those
   * of the base, its normal the base's backward axis —, so that the foot of the object on it lies on
   * the line of sight of the base.
   */
  readonly followRight: Vector3;
  readonly followUp: Vector3;
  readonly followNormal: Vector3;
  /** The distance of the base from the plane of the follow frame, along `followNormal`, from `origin`. */
  followDistance: number;
  /** `tan(fov / 2)` after the zoom, or the height of the view. */
  lens: number;
  near: number;
  far: number;
  aspect: number;
}

/** @internal */
export const createRest = (): Rest => ({
  base: undefined,
  kind: 'perspective',
  hasPlane: false,
  origin: new Vector3(),
  right: new Vector3(1, 0, 0),
  up: new Vector3(0, 1, 0),
  normal: new Vector3(0, 0, 1),
  position: new Vector3(),
  quaternion: new Quaternion(),
  followRight: new Vector3(1, 0, 0),
  followUp: new Vector3(0, 1, 0),
  followNormal: new Vector3(0, 0, 1),
  // fractions from the start, so that V8 keeps the fields as doubles
  distance: 0.5,
  followDistance: 0.5,
  lens: 0.5,
  near: 0.1,
  far: 100000.5,
  aspect: 1.5,
});

/** The frame of `projection` into `rest`: its plane, or the world for a projection without one. @internal */
export const readFrame = (projection: IProjection, rest: Rest): void => {
  const plane = projection.projectionPlane;
  if (plane != null) {
    plane.getOrigin(rest.origin);
    plane.getRight(rest.right).normalize();
    rest.up.copy(plane.up).normalize();
    rest.normal.copy(plane.plane.normal).normalize();
    rest.hasPlane = true;
  } else {
    rest.origin.set(0, 0, 0);
    rest.right.set(1, 0, 0);
    rest.up.set(0, 1, 0);
    rest.normal.set(0, 0, 1);
    rest.hasPlane = false;
  }
};

/**
 * The placement and the lens of the base of `rest` into `rest`, and the frame an `Object3D` is
 * followed in. Allocates nothing.
 * @internal
 */
export const readRest = (rest: Rest): void => {
  const base = rest.base!;
  const p = rest.position.copy(base.position);
  const q = rest.quaternion.copy(base.quaternion);
  const o = rest.origin;
  const n = rest.normal;
  const distance = (p.x - o.x) * n.x + (p.y - o.y) * n.y + (p.z - o.z) * n.z;
  rest.distance = distance;
  if (rest.hasPlane) {
    rest.followRight.copy(rest.right);
    rest.followUp.copy(rest.up);
    rest.followNormal.copy(n);
    rest.followDistance = distance;
  } else {
    rest.followRight.set(1, 0, 0).applyQuaternion(q);
    rest.followUp.set(0, 1, 0).applyQuaternion(q);
    const f = rest.followNormal.set(0, 0, 1).applyQuaternion(q);
    // inline, as the distance above: a call that V8 does not inline boxes the fraction it answers
    rest.followDistance = (p.x - o.x) * f.x + (p.y - o.y) * f.y + (p.z - o.z) * f.z;
  }
  // the lens — tan(fov / 2) after the zoom, or the height of the view —, inline: a call that V8
  // does not inline boxes the fraction it answers
  if (rest.kind === 'perspective') {
    const perspective = base as PerspectiveCamera;
    rest.lens = Math.tan((perspective.fov * RAD_PER_DEG) / 2) / perspective.zoom;
    rest.aspect = perspective.aspect;
  } else {
    const ortho = base as OrthographicCamera;
    rest.lens = (ortho.top - ortho.bottom) / ortho.zoom;
    rest.aspect = (ortho.right - ortho.left) / (ortho.top - ortho.bottom);
  }
  rest.near = base.near;
  rest.far = base.far;
};

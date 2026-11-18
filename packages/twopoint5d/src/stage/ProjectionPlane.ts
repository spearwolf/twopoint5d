import type {Object3D} from 'three/webgpu';
import {Matrix4, Quaternion, Plane as THREE_Plane, Vector3} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';

export type ProjectionPlaneDescription = 'xy|bottom-left' | 'xy|top-left' | 'xz|bottom-left' | 'xz|top-left';

/**
 * A [two dimensional surface](https://threejs.org/docs/index.html?q=plane#api/en/math/Plane) with an additional up vector.
 *
 * The idea behind the up vector is, that it is used for a camera directed to this plane
 * and thus also decisive for the direction of the coordinate system on the projection plane.
 */
export class ProjectionPlane {
  /** The plane itself; its normal points to the side the camera stands on. Held by this object alone. */
  plane: THREE_Plane;
  /** The up vector on the plane: the y axis of the coordinate system on it. Held by this object alone. */
  up: Vector3;

  /**
   * Builds the plane and its up vector from a description, or copies a `THREE.Plane` and `up` of
   * the caller's, which stay as they are.
   *
   * @param planeDescription - One of the four descriptions, or a `THREE.Plane` of your own.
   * @param up - The up vector on the plane; mandatory for a `THREE.Plane`.
   * @throws {TypeError} for a description that is neither one of the four nor a `THREE.Plane`.
   */
  constructor(planeDescription: ProjectionPlaneDescription | THREE_Plane, up?: Vector3) {
    if (planeDescription === 'xy|bottom-left') {
      this.plane = new THREE_Plane(new Vector3(0, 0, 1));
      this.up = up?.clone() ?? new Vector3(0, 1, 0);
    } else if (planeDescription === 'xy|top-left') {
      this.plane = new THREE_Plane(new Vector3(0, 0, -1));
      this.up = up?.clone() ?? new Vector3(0, -1, 0);
    } else if (planeDescription === 'xz|top-left') {
      this.plane = new THREE_Plane(new Vector3(0, 1, 0));
      this.up = up?.clone() ?? new Vector3(0, 0, -1);
    } else if (planeDescription === 'xz|bottom-left') {
      this.plane = new THREE_Plane(new Vector3(0, -1, 0));
      this.up = up?.clone() ?? new Vector3(0, 0, 1);
    } else if ((planeDescription as Partial<THREE_Plane> | null | undefined)?.isPlane === true) {
      // custom projection plane
      this.plane = planeDescription.clone();
      if (up == null) {
        throw new Error('ProjectionPlane: up is mandatory for a custom projection plane');
      }
      this.up = up.clone();
    } else {
      throw new TypeError(
        `ProjectionPlane: unknown plane description ${describeValue(planeDescription)}, expected "xy|bottom-left", "xy|top-left", "xz|bottom-left", "xz|top-left" or a THREE.Plane`,
      );
    }
  }

  /**
   * `plane` itself when it is a `ProjectionPlane`, not a copy; a new one built from it when it is
   * a description.
   *
   * @throws {TypeError} for a description that is none of the four.
   */
  static get(plane: ProjectionPlane | ProjectionPlaneDescription): ProjectionPlane {
    return plane instanceof ProjectionPlane ? plane : new ProjectionPlane(plane);
  }

  /** A new projection plane with copies of the plane and the up vector of this one. */
  clone(): ProjectionPlane {
    return new ProjectionPlane(this.plane.clone(), this.up.clone());
  }

  /**
   * Whether `projectionPlane` is this one, or has the same plane — normal and constant — and the
   * same up vector, each compared component by component with `===`. `null` and `undefined` from
   * JavaScript answer `false`.
   */
  equals(projectionPlane: ProjectionPlane): boolean {
    if (projectionPlane === this) return true;
    if (projectionPlane == null) return false;
    return this.plane.equals(projectionPlane.plane) && this.up.equals(projectionPlane.up);
  }

  /**
   * Turns `obj3d` to face the plane: the rotation that makes an object look along the negated
   * normal, with `up` as its up, is multiplied onto the orientation the object has already —
   * `applyQuaternion()` —, so it gives the facing only to an object without a rotation of its own,
   * and two calls turn it twice. A projection resets the rotation of a camera before it calls it.
   */
  applyRotation(obj3d: Object3D): void {
    obj3d.applyQuaternion(
      new Quaternion().setFromRotationMatrix(
        new Matrix4().lookAt(this.getPointByDistance(1), this.getPointByDistance(0), this.up),
      ),
    );
  }

  /**
   * The point `distanceToPlane` away from the origin of the plane along its normal — on the side
   * the camera stands on for a value above 0 —, written into `target` and answered, or a new
   * vector without one.
   */
  getPointByDistance(distanceToPlane: number, target?: Vector3): Vector3 {
    return this.getOrigin(target).add(this.plane.normal.clone().multiplyScalar(distanceToPlane));
  }

  /**
   * The origin of the coordinate system on the plane: the point of the plane nearest to the origin
   * of the world (`THREE.Plane#coplanarPoint()`), written into `target` and answered, or a new
   * vector without one.
   */
  getOrigin(target?: Vector3): Vector3 {
    return this.plane.coplanarPoint(target ?? new Vector3());
  }

  /**
   * The direction in which a camera in front of the plane looks at it: the negated
   * plane normal, as long as the normal is.
   */
  getForward(target?: Vector3): Vector3 {
    return (target ?? new Vector3()).copy(this.plane.normal).negate();
  }

  /**
   * `getForward()` × `up`: the x axis on the plane.
   */
  getRight(target?: Vector3): Vector3 {
    return this.getForward(target).cross(this.up);
  }

  /**
   * The point `x` along {@link getRight} and `y` along `up` from the origin of the plane, written
   * into `target` and answered, or a new vector without one.
   */
  getPoint(x: number, y: number, target?: Vector3): Vector3 {
    target = this.getOrigin(target);
    target.add(this.getRight().setLength(x));
    target.add(this.up.clone().setLength(y));
    return target;
  }
}

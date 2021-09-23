import {Plane as THREE_Plane, Quaternion, Vector3, Matrix4, Object3D} from 'three';

/**
 * @category Projection
 */
export type ProjectionPlaneDescription =
  | 'xy|bottom-left'
  | 'xy|top-left'
  | 'xz|bottom-left'
  | 'xz|top-left';

/**
 * A [two dimensional surface](https://threejs.org/docs/index.html?q=plane#api/en/math/Plane) with an additional up vector.
 *
 * The idea behind the up vector is, that it is used for a camera directed to this plane
 * and thus also decisive for the direction of the coordinate system on the projection plane.
 *
 * @category Projection
 */
export class ProjectionPlane {
  plane: THREE_Plane;
  up: Vector3;

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
    } else {
      // custom projection plane
      this.plane = planeDescription.clone();
      if (up == null) {
        throw new Error('up is mandatory for a custom projection plane');
      }
      this.up = up.clone();
    }
  }

  static get(plane: ProjectionPlane | ProjectionPlaneDescription): ProjectionPlane {
    return plane instanceof ProjectionPlane ? plane : new ProjectionPlane(plane);
  }

  clone(): ProjectionPlane {
    return new ProjectionPlane(this.plane.clone(), this.up.clone());
  }

  applyRotation(obj3d: Object3D): void {
    obj3d.applyQuaternion(
      new Quaternion().setFromRotationMatrix(
        new Matrix4().lookAt(this.getPointByDistance(1), this.getPointByDistance(0), this.up),
      ),
    );
  }

  getPointByDistance(distanceToPlane: number, target?: Vector3): Vector3 {
    return this.getOrigin(target).add(this.plane.normal.clone().multiplyScalar(distanceToPlane));
  }

  getOrigin(target?: Vector3): Vector3 {
    const {normal, constant} = this.plane;
    target = target ? target.copy(normal) : normal.clone();
    return target.multiplyScalar(constant);
  }

  getForward(target?: Vector3): Vector3 {
    return this.getPointByDistance(1, target).negate();
  }

  getRight(target?: Vector3): Vector3 {
    return this.getForward(target).cross(this.up);
  }

  getPoint(x: number, y: number, target?: Vector3): Vector3 {
    target = this.getOrigin(target);
    target.add(this.getRight().setLength(x));
    target.add(this.up.clone().setLength(y));
    return target;
  }
}

import {
  Plane as THREE_Plane,
  Quaternion,
  Vector3,
  Matrix4,
  Object3D,
} from 'three';

export type PlaneDescription = 'xy' | 'xz';

/**
 * Holds a reference to a `THREE.Plane` and an additional _up_ vector.
 *
 * The idea behind the _up_ vector is, that it is used for a camera directed to this plane
 * and thus also decisive for the direction of the coordinate system on the projection plane.
 */
export class Plane {
  static XY = 'xy';
  static XZ = 'xz';

  plane: THREE_Plane;
  upVector: Vector3;

  constructor(
    planeDescription: PlaneDescription | THREE_Plane,
    upVector?: Vector3,
  ) {
    if (planeDescription === 'xy') {
      this.plane = new THREE_Plane(new Vector3(0, 0, 1));
      this.upVector = upVector?.clone() ?? new Vector3(0, 1, 0);
    } else if (planeDescription === 'xz') {
      // xz
      this.plane = new THREE_Plane(new Vector3(0, 1, 0));
      this.upVector = upVector?.clone() ?? new Vector3(0, 0, -1);
    } else {
      // custom projection plane
      this.plane = planeDescription.clone();
      if (upVector == null) {
        throw new Error('upVector is mandatory for a custom projection plane');
      }
      this.upVector = upVector.clone();
    }
  }

  static get(plane: Plane | PlaneDescription): Plane {
    return plane instanceof Plane ? plane : new Plane(plane);
  }

  clone(): Plane {
    return new Plane(this.plane.clone(), this.upVector.clone());
  }

  applyRotation(obj3d: Object3D): void {
    obj3d.applyQuaternion(
      new Quaternion().setFromRotationMatrix(
        new Matrix4().lookAt(
          this.getPointByDistance(1),
          this.getPointByDistance(0),
          this.upVector,
        ),
      ),
    );
  }

  getPointByDistance(distanceToPlane: number): Vector3 {
    const {normal, constant} = this.plane;
    const camPos = normal.clone().multiplyScalar(constant);
    return camPos.add(normal.clone().multiplyScalar(distanceToPlane));
  }
}

import type {Camera} from 'three/webgpu';
import {PerspectiveCamera, Vector2} from 'three/webgpu';

import {expectDefined} from '../utils/expectDefined.js';
import {isFiniteNumber} from '../utils/isFiniteNumber.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import type {IProjection} from './IProjection.js';
import {ProjectionPlane, type ProjectionPlaneDescription} from './ProjectionPlane.js';
import {fitIntoRectangle, type FitIntoRectangleSpecs} from './fitIntoRectangle.js';

// the camera values for specs that leave one out or give one no camera can be built from
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 100000;
const DEFAULT_DISTANCE_TO_PROJECTION_PLANE = 300;

export type ParallaxProjectionSpecs = FitIntoRectangleSpecs & {
  /**
   * How far the camera sits from the projection plane. The field of view follows from it, so that
   * the plane shows the height of the view. Defaults to `300`; a value that is not a finite number
   * above 0 counts as not given.
   */
  distanceToProjectionPlane?: number;
  /**
   * The near plane of the camera. Defaults to `0.1`; a value that is not a finite number above 0
   * counts as not given.
   */
  near?: number;
  /**
   * The far plane of the camera. Defaults to `100000`; a value that is not a finite number counts
   * as not given. A `far` that is not above the `near` in effect sends both back to their defaults.
   */
  far?: number;
};

export class ParallaxProjection implements IProjection {
  viewSpecs: Partial<ParallaxProjectionSpecs>;
  projectionPlane: ProjectionPlane | undefined;

  #viewRect = new Vector2();
  #pixelRatio = new Vector2();

  // The fields below are assigned by the first `updateViewRect()` that gives a view with an area;
  // a camera built before that carries `NaN`.
  #halfHeight!: number;

  #near!: number;
  #far!: number;

  #distanceToProjectionPlane!: number;

  #aspect!: number;
  #fovy!: number;

  /**
   * @param projectionPlane - The plane the camera looks at.
   * @param specs - How the view fits into the container. Defaults to `{fit: 'fill'}`: one view
   * unit per container pixel.
   */
  constructor(projectionPlane?: ProjectionPlane | ProjectionPlaneDescription, specs?: Partial<ParallaxProjectionSpecs>) {
    this.projectionPlane = projectionPlane != null ? ProjectionPlane.get(projectionPlane) : undefined;
    // without specs the view is the container itself; specs handed in stay the caller's object,
    // so a later write to them reaches the next updateViewRect()
    this.viewSpecs = specs ?? {fit: 'fill'};
  }

  /**
   * Fits the view into a container of `width` × `height`. A width or a height that is not a finite
   * number above 0 leaves the projection as it is. Specs that give no view with an area keep the
   * last view, while the pixel ratio follows the new container; a projection that has no view yet
   * stays as it is. Until the first call that gives a view with an area, `getViewRect()` reports
   * `[0, 0, 0, 0]`. A call that gives a view with an area also takes `near`, `far` and
   * `distanceToProjectionPlane` from the specs; a value no camera can be built from counts as not
   * given, as `ParallaxProjectionSpecs` describes.
   */
  updateViewRect(width: number, height: number): void {
    // a container without area has no aspect ratio to fit a view into, and a view without area
    // none to build a camera from: the projection keeps the view, the pixel ratio and the camera
    // values it has, the same rule Stage2D follows for its container
    if (!isPositiveFinite(width) || !isPositiveFinite(height)) return;

    // specs that match no shape leave the target as it is, so it starts out as the current view
    const viewRect = fitIntoRectangle(new Vector2(width, height), this.viewSpecs, this.#viewRect.clone());
    if (!isPositiveFinite(viewRect.width) || !isPositiveFinite(viewRect.height)) return;

    this.#viewRect.copy(viewRect);

    this.#halfHeight = this.#viewRect.height / 2;

    this.#pixelRatio.set(width, height).divide(this.#viewRect);

    // a perspective camera divides by its near, by the depth from near to far and, for the field of
    // view below, by the distance: each needs a finite number above 0
    const {near, far, distanceToProjectionPlane} = this.viewSpecs;

    this.#near = isPositiveFinite(near) ? near : DEFAULT_NEAR;
    this.#far = isFiniteNumber(far) ? far : DEFAULT_FAR;
    if (this.#far <= this.#near) {
      this.#near = DEFAULT_NEAR;
      this.#far = DEFAULT_FAR;
    }

    this.#distanceToProjectionPlane = isPositiveFinite(distanceToProjectionPlane)
      ? distanceToProjectionPlane
      : DEFAULT_DISTANCE_TO_PROJECTION_PLANE;

    this.#aspect = this.#viewRect.width / this.#viewRect.height;

    this.#fovy = (2 * Math.atan(this.#halfHeight / this.#distanceToProjectionPlane) * 180) / Math.PI;
  }

  getViewRect(): [width: number, height: number, pixelRatioHorizontal: number, pixelRatioVertical: number] {
    return [this.#viewRect.width, this.#viewRect.height, this.#pixelRatio.x, this.#pixelRatio.y];
  }

  createCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera();
    this.#applyToCamera(camera);
    return camera;
  }

  /**
   * Gives `camera` the setup {@link createCamera} gives a new one: the field of view, aspect, near
   * and far of the last {@link updateViewRect}, the direction of the projection plane and the
   * position at its distance. Whatever the camera carried in these is replaced.
   *
   * @throws {TypeError} if `camera` is not a `PerspectiveCamera`.
   */
  updateCamera(camera: Camera): void {
    if ((camera as PerspectiveCamera)?.isPerspectiveCamera !== true) {
      throw new TypeError(`ParallaxProjection: updateCamera() needs a PerspectiveCamera, got ${camera?.type ?? String(camera)}`);
    }
    this.#applyToCamera(camera as PerspectiveCamera);
  }

  #applyToCamera(camera: PerspectiveCamera): void {
    const projectionPlane = expectDefined(this.projectionPlane, 'the projection plane of this projection');

    camera.fov = this.#fovy;
    camera.aspect = this.#aspect;
    camera.near = this.#near;
    camera.far = this.#far;

    // applyRotation() multiplies onto the orientation the camera already carries: without this
    // reset a camera updated a second time would turn a second time
    camera.quaternion.identity();
    projectionPlane.applyRotation(camera);

    camera.position.copy(projectionPlane.getPointByDistance(this.#distanceToProjectionPlane));

    camera.updateProjectionMatrix();
  }

  // TODO add jsdoc
  getZoom(distanceToProjectionPlane: number): number {
    if (distanceToProjectionPlane === 0) return 1;

    const d = this.#distanceToProjectionPlane - distanceToProjectionPlane;
    return (Math.tan(((this.#fovy / 2) * Math.PI) / 180) * d) / this.#halfHeight;
  }
}

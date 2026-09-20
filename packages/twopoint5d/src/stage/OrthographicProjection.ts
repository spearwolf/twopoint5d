import type {Camera} from 'three/webgpu';
import {OrthographicCamera, Vector2} from 'three/webgpu';

import {expectDefined} from '../utils/expectDefined.js';
import {isFiniteNumber} from '../utils/isFiniteNumber.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import type {IProjection} from './IProjection.js';
import {ProjectionPlane, type ProjectionPlaneDescription} from './ProjectionPlane.js';
import {fitIntoRectangle, type FitIntoRectangleSpecs} from './fitIntoRectangle.js';

// the camera values for specs that leave one out or give one no camera can be built from
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 100000;
const DEFAULT_DISTANCE_TO_PROJECTION_PLANE = 100;

export type OrthographicProjectionSpecs = FitIntoRectangleSpecs & {
  /**
   * How far the camera sits from the projection plane. Defaults to `100`; a value that is not a
   * finite number counts as not given. 0 and negative values are kept.
   */
  distanceToProjectionPlane?: number;
  /**
   * The near plane of the camera. Defaults to `0.1`; a value that is not a finite number counts as
   * not given. 0 and negative values are kept: an orthographic camera also shows what lies behind
   * its position.
   */
  near?: number;
  /**
   * The far plane of the camera. Defaults to `100000`; a value that is not a finite number counts
   * as not given. A `far` that is not above the `near` in effect sends both back to their defaults.
   */
  far?: number;
};

export class OrthographicProjection implements IProjection {
  viewSpecs: Partial<OrthographicProjectionSpecs>;
  projectionPlane: ProjectionPlane | undefined;

  #viewRect = new Vector2();
  #pixelRatio = new Vector2();

  // The fields below are assigned by the first `updateViewRect()` that gives a view with an area;
  // a camera built before that carries `NaN`.
  #halfWidth!: number;
  #halfHeight!: number;

  #near!: number;
  #far!: number;

  #distanceToProjectionPlane!: number;

  /**
   * @param projectionPlane - The plane the camera looks at.
   * @param specs - How the view fits into the container. Defaults to `{fit: 'fill'}`: one view
   * unit per container pixel.
   */
  constructor(projectionPlane?: ProjectionPlane | ProjectionPlaneDescription, specs?: Partial<OrthographicProjectionSpecs>) {
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
   * given, as `OrthographicProjectionSpecs` describes.
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

    this.#halfWidth = this.#viewRect.width / 2;
    this.#halfHeight = this.#viewRect.height / 2;

    this.#pixelRatio.set(width, height).divide(this.#viewRect);

    // an orthographic camera divides by the depth from near to far; its near and the distance may be
    // 0 or below, but none of the three may be infinite or NaN
    const {near, far, distanceToProjectionPlane} = this.viewSpecs;

    this.#near = isFiniteNumber(near) ? near : DEFAULT_NEAR;
    this.#far = isFiniteNumber(far) ? far : DEFAULT_FAR;
    if (this.#far <= this.#near) {
      this.#near = DEFAULT_NEAR;
      this.#far = DEFAULT_FAR;
    }

    this.#distanceToProjectionPlane = isFiniteNumber(distanceToProjectionPlane)
      ? distanceToProjectionPlane
      : DEFAULT_DISTANCE_TO_PROJECTION_PLANE;
  }

  getViewRect(): [width: number, height: number, pixelRatioHorizontal: number, pixelRatioVertical: number] {
    return [this.#viewRect.width, this.#viewRect.height, this.#pixelRatio.x, this.#pixelRatio.y];
  }

  createCamera(): OrthographicCamera {
    const camera = new OrthographicCamera();
    this.#applyToCamera(camera);
    return camera;
  }

  /**
   * Gives `camera` the setup {@link createCamera} gives a new one: the frustum, near and far of the
   * last {@link updateViewRect}, the direction of the projection plane and the position at its
   * distance. Whatever the camera carried in these is replaced.
   *
   * @throws {TypeError} if `camera` is not an `OrthographicCamera`.
   */
  updateCamera(camera: Camera): void {
    if ((camera as OrthographicCamera)?.isOrthographicCamera !== true) {
      throw new TypeError(
        `OrthographicProjection: updateCamera() needs an OrthographicCamera, got ${camera?.type ?? String(camera)}`,
      );
    }
    this.#applyToCamera(camera as OrthographicCamera);
  }

  #applyToCamera(camera: OrthographicCamera): void {
    const projectionPlane = expectDefined(this.projectionPlane, 'the projection plane of this projection');

    camera.left = -this.#halfWidth;
    camera.right = this.#halfWidth;
    camera.top = this.#halfHeight;
    camera.bottom = -this.#halfHeight;
    camera.near = this.#near;
    camera.far = this.#far;

    // applyRotation() multiplies onto the orientation the camera already carries: without this
    // reset a camera updated a second time would turn a second time
    camera.quaternion.identity();
    projectionPlane.applyRotation(camera);

    camera.position.copy(projectionPlane.getPointByDistance(this.#distanceToProjectionPlane));

    camera.updateProjectionMatrix();
  }

  getZoom(_distanceToProjectionPlane: number): number {
    // since this is an orthographic view, the zoom factor is always the same
    return 1;
  }
}

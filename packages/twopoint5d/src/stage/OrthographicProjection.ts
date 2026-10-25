import type {Camera} from 'three/webgpu';
import {OrthographicCamera, Vector2} from 'three/webgpu';

import {describeThreeValue} from '../utils/describeThreeValue.js';
import {isFiniteNumber} from '../utils/isFiniteNumber.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import type {IProjection, ProjectionViewRect} from './IProjection.js';
import {ProjectionPlane, type ProjectionPlaneDescription} from './ProjectionPlane.js';
import {fitIntoRectangle, type ProjectionFitSpecs} from './fitIntoRectangle.js';
import {wholeUnitOffset} from './wholeUnitOffset.js';

// the camera values for specs that leave one out or give one no camera can be built from
const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 100000;
const DEFAULT_DISTANCE_TO_PROJECTION_PLANE = 100;

/**
 * How an `OrthographicProjection` fits its view into the container, and where its camera sits.
 * The view stands in the middle of the projection plane; the specs take no `anchorPosition`.
 *
 * With `pixelSnap`, the zoom is a whole number of pixels of the drawing buffer per unit (see
 * `fitIntoRectangle()`), and the left and the bottom edge of the frustum lie on a whole unit of the
 * projection plane: `left = -Math.floor(width / 2)`, `right = left + width`, and the same for
 * `bottom` and `top`. The middle of the view then lies up to a unit right of and above the point the
 * camera looks at, as `getViewRect()` reports it in `offsetX` and `offsetY`.
 */
export type OrthographicProjectionSpecs = ProjectionFitSpecs & {
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
  #offset = new Vector2();

  // The fields below are assigned by the first `updateViewRect()` that gives a view with an area;
  // a camera built before that carries `NaN`.
  #left!: number;
  #right!: number;
  #top!: number;
  #bottom!: number;

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
   * `{width: 0, height: 0, pixelRatioX: 0, pixelRatioY: 0, offsetX: 0, offsetY: 0}`. A call that
   * gives a view with an area also takes `near`, `far` and `distanceToProjectionPlane` from the
   * specs; a value no camera can be built from counts as not given, as
   * `OrthographicProjectionSpecs` describes.
   *
   * @param pixelRatio - The pixels of the drawing buffer per unit of the container, read by
   * `pixelSnap` alone; `1` where it is left out.
   */
  updateViewRect(width: number, height: number, pixelRatio = 1): void {
    // a container without area has no aspect ratio to fit a view into, and a view without area
    // none to build a camera from: the projection keeps the view, the pixel ratio and the camera
    // values it has, the same rule Stage2D follows for its container
    if (!isPositiveFinite(width) || !isPositiveFinite(height)) return;

    // specs that match no shape leave the target as it is, so it starts out as the current view
    const viewRect = fitIntoRectangle(new Vector2(width, height), this.viewSpecs, this.#viewRect.clone(), pixelRatio);
    if (!isPositiveFinite(viewRect.width) || !isPositiveFinite(viewRect.height)) return;

    this.#viewRect.copy(viewRect);

    // under pixelSnap the left and the bottom edge lie on a whole unit, so that a texel edge at a
    // whole unit falls on a pixel edge of the buffer; otherwise the view stands in the middle
    const {width: viewWidth, height: viewHeight} = this.#viewRect;
    if ('pixelSnap' in this.viewSpecs && this.viewSpecs.pixelSnap === true) {
      this.#left = -Math.floor(viewWidth / 2);
      this.#bottom = -Math.floor(viewHeight / 2);
      this.#offset.set(wholeUnitOffset(viewWidth), wholeUnitOffset(viewHeight));
    } else {
      this.#left = -viewWidth / 2;
      this.#bottom = -viewHeight / 2;
      this.#offset.set(0, 0);
    }
    this.#right = this.#left + viewWidth;
    this.#top = this.#bottom + viewHeight;

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

  getViewRect(): ProjectionViewRect {
    return {
      width: this.#viewRect.width,
      height: this.#viewRect.height,
      pixelRatioX: this.#pixelRatio.x,
      pixelRatioY: this.#pixelRatio.y,
      offsetX: this.#offset.x,
      offsetY: this.#offset.y,
    };
  }

  /**
   * Builds a camera with the setup of the last {@link updateViewRect}, aimed at the projection plane
   * and placed at its distance.
   *
   * @throws {Error} if the projection has no {@link projectionPlane}.
   */
  createCamera(): OrthographicCamera {
    const projectionPlane = this.#requireProjectionPlane('createCamera()');
    const camera = new OrthographicCamera();
    this.#applyToCamera(camera, projectionPlane);
    return camera;
  }

  /**
   * Gives `camera` the setup {@link createCamera} gives a new one: the frustum, near and far of the
   * last {@link updateViewRect}, the direction of the projection plane and the position at its
   * distance. Whatever the camera carried in these is replaced.
   *
   * @throws {TypeError} if `camera` is not an `OrthographicCamera`.
   * @throws {Error} if the projection has no {@link projectionPlane}.
   */
  updateCamera(camera: Camera): void {
    if ((camera as OrthographicCamera)?.isOrthographicCamera !== true) {
      throw new TypeError(
        `OrthographicProjection: updateCamera() needs an OrthographicCamera, got ${describeThreeValue(camera, 'isObject3D')}`,
      );
    }
    const projectionPlane = this.#requireProjectionPlane('updateCamera()');
    this.#applyToCamera(camera as OrthographicCamera, projectionPlane);
  }

  #requireProjectionPlane(method: 'createCamera()' | 'updateCamera()'): ProjectionPlane {
    if (this.projectionPlane == null) {
      throw new Error(
        `OrthographicProjection#${method} has no projectionPlane to aim the camera at: ` +
          'set OrthographicProjection#projectionPlane or hand one to the constructor',
      );
    }
    return this.projectionPlane;
  }

  #applyToCamera(camera: OrthographicCamera, projectionPlane: ProjectionPlane): void {
    camera.left = this.#left;
    camera.right = this.#right;
    camera.top = this.#top;
    camera.bottom = this.#bottom;
    camera.near = this.#near;
    camera.far = this.#far;

    // applyRotation() multiplies onto the orientation the camera already carries: without this
    // reset a camera updated a second time would turn a second time
    camera.quaternion.identity();
    projectionPlane.applyRotation(camera);

    camera.position.copy(projectionPlane.getPointByDistance(this.#distanceToProjectionPlane));

    camera.updateProjectionMatrix();
  }

  /**
   * Always `1`: an orthographic projection shows everything at the size it has on the projection
   * plane, whatever its distance to the camera.
   */
  getScaleFactor(_distanceToCamera: number): number {
    return 1;
  }
}

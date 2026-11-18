import type {Box3, Camera} from 'three/webgpu';
import {OrthographicCamera} from 'three/webgpu';

import {isFiniteNumber} from '../utils/isFiniteNumber.js';
import type {IProjection, ProjectionViewRect} from './IProjection.js';
import {ProjectionPlane, type ProjectionPlaneDescription} from './ProjectionPlane.js';
import type {ProjectionFitSpecs} from './fitIntoRectangle.js';
import {type FramingOptions, framingSetup} from './framing.js';
import {DEFAULT_NEAR, PlaneProjectionView, assertCameraKind, requireProjectionPlane} from './planeProjection.js';

// the distance of the camera for specs that leave it out or give one no camera can be placed at
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

/**
 * A projection with one scale at every depth: it fits a view of its `OrthographicProjectionSpecs`
 * into the container and places an `OrthographicCamera` in front of the projection plane, looking
 * at its origin. It holds the specs and the plane it is handed; the camera `createCamera()` builds
 * belongs to the caller — on a `Stage2D`, to the stage.
 */
export class OrthographicProjection implements IProjection {
  /**
   * How the view fits into the container, and where the camera sits. The object handed to the
   * constructor is held, not copied: a write to it, or a new object here, applies at the next
   * `updateViewRect()` — on a `Stage2D`, once `needsUpdate` is set or `updateProjection(true)` is
   * called, or with the next `resize()` that brings a new container size. How a value no view can
   * be fitted with is read, `ProjectionFitSpecs` says.
   */
  viewSpecs: Partial<OrthographicProjectionSpecs>;

  /**
   * The plane the camera looks at, held as it is handed: a `ProjectionPlane` stays the caller's
   * object, a description builds one of its own. A change to it applies when the camera is placed
   * next. `undefined` leaves the projection without a camera: `createCamera()` and `updateCamera()`
   * throw then.
   */
  projectionPlane: ProjectionPlane | undefined;

  readonly #view = new PlaneProjectionView();

  // The fields below are assigned by the first `updateViewRect()` that gives a view with an area;
  // a camera built before that carries `NaN`.
  #left!: number;
  #right!: number;
  #top!: number;
  #bottom!: number;

  #distanceToProjectionPlane!: number;

  /**
   * A projection that frames `box` from one of its sides: the projection plane lies in the face of
   * the box toward the camera, with its origin in the middle of that face, and the view is that
   * face grown by `margin` on every edge, fitted `'contain'` into the container. Everything behind
   * the face keeps its size, so the box lies in the view. The other specs —
   * `pixelSnap`, `distanceToProjectionPlane`, `near`, `far` — pass through; the result is an ordinary
   * projection, pixel-exact on the face.
   *
   * @param box - The box to frame; not empty, with an area on the face toward `options.side`.
   * @param options - The `side` the camera looks from, the `margin` (a share, default `0`) and the specs.
   * @throws {TypeError} for a `box` that is no `THREE.Box3` or a `side` that is none of the six.
   * @throws {RangeError} for an empty box, a face without area or a `margin` that is not a finite number of 0 or more.
   */
  static framing(box: Box3, options: FramingOptions<OrthographicProjectionSpecs>): OrthographicProjection {
    const {projectionPlane, specs} = framingSetup<OrthographicProjectionSpecs>('OrthographicProjection.framing()', box, options);
    return new OrthographicProjection(projectionPlane, specs);
  }

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
    if (!this.#view.fit(width, height, pixelRatio, this.viewSpecs)) return;

    // under pixelSnap the left and the bottom edge lie on a whole unit, so that a texel edge at a
    // whole unit falls on a pixel edge of the buffer; otherwise the view stands in the middle
    const {width: viewWidth, height: viewHeight} = this.#view;
    if (this.#view.pixelSnap) {
      this.#left = -Math.floor(viewWidth / 2);
      this.#bottom = -Math.floor(viewHeight / 2);
    } else {
      this.#left = -viewWidth / 2;
      this.#bottom = -viewHeight / 2;
    }
    this.#right = this.#left + viewWidth;
    this.#top = this.#bottom + viewHeight;

    // an orthographic camera divides by the depth from near to far; its near and the distance may be
    // 0 or below, but none of the three may be infinite or NaN
    const {near, far, distanceToProjectionPlane} = this.viewSpecs;

    this.#view.takeNearAndFar(isFiniteNumber(near) ? near : DEFAULT_NEAR, far);

    this.#distanceToProjectionPlane = isFiniteNumber(distanceToProjectionPlane)
      ? distanceToProjectionPlane
      : DEFAULT_DISTANCE_TO_PROJECTION_PLANE;
  }

  getViewRect(): ProjectionViewRect {
    return this.#view.getViewRect();
  }

  /**
   * Builds a camera with the setup of the last {@link updateViewRect}, aimed at the projection plane
   * and placed at its distance.
   *
   * @throws {Error} if the projection has no {@link projectionPlane}.
   */
  createCamera(): OrthographicCamera {
    const projectionPlane = requireProjectionPlane('OrthographicProjection', 'createCamera()', this.projectionPlane);
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
    assertCameraKind('OrthographicProjection', camera, 'isOrthographicCamera');
    const projectionPlane = requireProjectionPlane('OrthographicProjection', 'updateCamera()', this.projectionPlane);
    this.#applyToCamera(camera, projectionPlane);
  }

  #applyToCamera(camera: OrthographicCamera, projectionPlane: ProjectionPlane): void {
    camera.left = this.#left;
    camera.right = this.#right;
    camera.top = this.#top;
    camera.bottom = this.#bottom;
    camera.near = this.#view.near;
    camera.far = this.#view.far;

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

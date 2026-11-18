// What `OrthographicProjection` and `ParallaxProjection` do alike: fit the view into the
// container, take the near and the far plane of their camera, and refuse a missing projection
// plane and a camera of the wrong kind. This module is not in `public-api.ts`: only the two
// projections reach it.

import type {Camera, OrthographicCamera, PerspectiveCamera} from 'three/webgpu';
import {Vector2} from 'three/webgpu';

import {describeThreeValue} from '../utils/describeThreeValue.js';
import {isFiniteNumber} from '../utils/isFiniteNumber.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import type {ProjectionViewRect} from './IProjection.js';
import type {ProjectionPlane} from './ProjectionPlane.js';
import {type ProjectionFitSpecs, fitIntoRectangle} from './fitIntoRectangle.js';
import {wholeUnitOffset} from './wholeUnitOffset.js';

/**
 * The near plane of the camera where the specs leave it out, or where their near and far plane
 * leave no depth a camera can be built from; `DEFAULT_FAR` below is the far plane of both cases.
 * @internal
 */
export const DEFAULT_NEAR = 0.1;
const DEFAULT_FAR = 100000;

/**
 * The classes this module serves, as the subject of their messages.
 *
 * @internal
 */
export type PlaneProjectionSubject = 'OrthographicProjection' | 'ParallaxProjection';

type CameraKinds = {isOrthographicCamera: OrthographicCamera; isPerspectiveCamera: PerspectiveCamera};

const CAMERA_NAMES: Readonly<Record<keyof CameraKinds, string>> = {
  isOrthographicCamera: 'an OrthographicCamera',
  isPerspectiveCamera: 'a PerspectiveCamera',
};

/**
 * Throws a `TypeError` unless `camera` carries the flag `kind` set to `true`.
 *
 * @internal
 */
export function assertCameraKind<K extends keyof CameraKinds>(
  subject: PlaneProjectionSubject,
  camera: Camera,
  kind: K,
): asserts camera is CameraKinds[K] {
  if ((camera as Camera & Partial<Record<K, unknown>>)?.[kind] !== true) {
    throw new TypeError(
      `${subject}: updateCamera() needs ${CAMERA_NAMES[kind]}, got ${describeThreeValue(camera, 'isObject3D')}`,
    );
  }
}

/**
 * Answers `projectionPlane`, or throws an `Error` that names the projection and the call when it is missing.
 *
 * @internal
 */
export function requireProjectionPlane(
  subject: PlaneProjectionSubject,
  method: 'createCamera()' | 'updateCamera()',
  projectionPlane: ProjectionPlane | undefined,
): ProjectionPlane {
  if (projectionPlane == null) {
    throw new Error(
      `${subject}#${method} has no projectionPlane to aim the camera at: ` +
        `set ${subject}#projectionPlane or hand one to the constructor`,
    );
  }
  return projectionPlane;
}

/**
 * The view the last `fit()` with an area gave, with its pixel ratio, the offset under `pixelSnap`
 * and the near and the far plane of the camera.
 *
 * @internal
 */
export class PlaneProjectionView {
  #viewRect = new Vector2();
  #pixelRatio = new Vector2();
  #offset = new Vector2();
  #pixelSnap = false;

  // assigned by the first fit() that gives a view with an area, through takeNearAndFar(); a
  // camera built before that carries none
  #near!: number;
  #far!: number;

  /** The width of the view; `0` until the first `fit()` that gives a view with an area. */
  get width(): number {
    return this.#viewRect.width;
  }

  /** The height of the view; `0` until the first `fit()` that gives a view with an area. */
  get height(): number {
    return this.#viewRect.height;
  }

  /** How far the middle of the view lies right of the point the camera looks at; `0` without `pixelSnap`. */
  get offsetX(): number {
    return this.#offset.x;
  }

  /** How far the middle of the view lies above the point the camera looks at; `0` without `pixelSnap`. */
  get offsetY(): number {
    return this.#offset.y;
  }

  /** Whether the specs of the last `fit()` that gave a view with an area asked for `pixelSnap`. */
  get pixelSnap(): boolean {
    return this.#pixelSnap;
  }

  get near(): number {
    return this.#near;
  }

  get far(): number {
    return this.#far;
  }

  /**
   * Fits the view into a container of `width` × `height`. Answers whether the specs gave a view
   * with an area; if not, everything stays as it was.
   */
  fit(width: number, height: number, pixelRatio: number, specs: Partial<ProjectionFitSpecs>): boolean {
    // a container without area has no aspect ratio to fit a view into, and a view without area
    // none to build a camera from: the projection keeps the view, the pixel ratio and the camera
    // values it has, the same rule Stage2D follows for its container
    if (!isPositiveFinite(width) || !isPositiveFinite(height)) return false;

    // specs that match no shape leave the target as it is, so it starts out as the current view
    const viewRect = fitIntoRectangle(new Vector2(width, height), specs, this.#viewRect.clone(), pixelRatio);
    if (!isPositiveFinite(viewRect.width) || !isPositiveFinite(viewRect.height)) return false;

    this.#viewRect.copy(viewRect);

    this.#pixelSnap = 'pixelSnap' in specs && specs.pixelSnap === true;
    if (this.#pixelSnap) {
      this.#offset.set(wholeUnitOffset(this.#viewRect.width), wholeUnitOffset(this.#viewRect.height));
    } else {
      this.#offset.set(0, 0);
    }

    this.#pixelRatio.set(width, height).divide(this.#viewRect);

    return true;
  }

  /**
   * Takes `near` as the projection read it from its specs. A `far` that is not a finite number
   * counts as not given, and a `far` not above `near` sends both back to their defaults.
   */
  takeNearAndFar(near: number, far: number | undefined): void {
    this.#near = near;
    this.#far = isFiniteNumber(far) ? far : DEFAULT_FAR;
    if (this.#far <= this.#near) {
      this.#near = DEFAULT_NEAR;
      this.#far = DEFAULT_FAR;
    }
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
}

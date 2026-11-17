import {type Camera, Matrix4, OrthographicCamera, PerspectiveCamera, Vector3} from 'three/webgpu';

import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeThreeValue} from '../utils/describeThreeValue.js';
import {describeValue} from '../utils/describeValue.js';
import {isFiniteNumber} from '../utils/isFiniteNumber.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import type {IProjection, ProjectionViewRect} from './IProjection.js';

const RAD_PER_DEG = Math.PI / 180;

/** How the frame of a source camera fits into the container: all of it shown, or the container filled. */
export type CameraProjectionFit = 'contain' | 'cover';

/** How a `CameraProjection` fits the frame of its source into the container. */
export interface CameraProjectionSpecs {
  /**
   * How the frame of the source fits into the container: `'contain'` (default) shows all of it —
   * the side of the container that is narrower than the frame keeps the authored extent, the other
   * one shows more —, `'cover'` fills the container with it, and the frame is cut at the sides
   * that stick out.
   */
  fit?: CameraProjectionFit;
  /**
   * The aspect the source was authored for, a finite number above 0. Default: `aspect` of a
   * perspective source — glTF's `aspectRatio` —, the frustum of an orthographic one.
   */
  aspect?: number;
  /**
   * The near plane of the camera. Default: the near of the source; a value no camera of the kind of
   * the source can be built from counts as not given.
   */
  near?: number;
  /**
   * The far plane of the camera. Default: the far of the source; a value that is not a finite number
   * counts as not given, and a `far` that is not above the `near` in effect takes both from the
   * source.
   */
  far?: number;
}

/** A lens as {@link fitLens} writes it: `tan(fov / 2)` of a perspective camera, the height of the view of an orthographic one. @internal */
export interface FittedLens {
  lens: number;
}

/**
 * The lens a frame authored with the lens `sourceLens` at the aspect `authoredAspect` takes in a
 * container of the aspect `containerAspect`, under `fit`, into `target.lens`. A lens is
 * `tan(fov / 2)` of a perspective camera, or the height of the view of an orthographic one: both
 * scale with the visible extent. Under `'contain'` a container narrower than the frame widens the
 * lens until the authored width fits; under `'cover'` a container wider than the frame narrows it
 * until the authored width fills it. Otherwise the lens stays `sourceLens`, exactly.
 *
 * The answer goes into an object, not out of the call: V8 boxes a fraction a call answers where it
 * does not inline the call. Allocates nothing.
 * @internal
 */
export function fitLens(
  sourceLens: number,
  authoredAspect: number,
  containerAspect: number,
  fit: CameraProjectionFit,
  target: FittedLens,
): void {
  const widen = fit === 'contain' ? authoredAspect > containerAspect : authoredAspect < containerAspect;
  target.lens = widen ? (sourceLens * authoredAspect) / containerAspect : sourceLens;
}

const refuseSource = (source: unknown): never => {
  throw new TypeError(
    `CameraProjection: source must be a PerspectiveCamera or an OrthographicCamera, got ${describeThreeValue(source, 'isObject3D')}`,
  );
};

const isPerspective = (camera: unknown): camera is PerspectiveCamera =>
  (camera as Partial<PerspectiveCamera> | null)?.isPerspectiveCamera === true;

const isOrthographic = (camera: unknown): camera is OrthographicCamera =>
  (camera as Partial<OrthographicCamera> | null)?.isOrthographicCamera === true;

// the scale of the source, which the camera does not take
const ignoredScale = new Vector3();

// the lens values of a source as a placement took them, in one row: a perspective source fills
// fov, zoom, aspect, near and far, an orthographic one left, right, top, bottom, zoom, near and far
const LENS_VALUES = 7;

/**
 * A projection that looks through a camera of your own — of a loaded `.glb`, or one you animate —
 * and fits its frame into the container. It builds and places a camera of the kind of its
 * {@link source}: at the world pose of the source, with its lens, fitted as {@link viewSpecs} says.
 * The source is read, never written, so several stages may look through one camera.
 *
 * It has no projection plane: the frame of a `CameraRig` on such a stage is the world, and its rest
 * is the shot of the source. {@link getViewRect} answers the container, one view unit per unit of
 * it. A source that moves, or whose lens changes, moves the camera of the stage in the next frame
 * through {@link needsPlacement}.
 *
 * One projection serves one stage: it remembers what it placed last, and a second stage would find
 * the placement of the first. Two stages that look through one camera take a projection each.
 *
 * See "Projections" and "A 3D scene through the cameras of a `.glb`" in `docs/stages.md`.
 */
export class CameraProjection implements IProjection {
  /**
   * How the frame of the source fits into the container. The caller's object: a later write
   * reaches the next `updateViewRect()`, as for the other projections — set `stage.needsUpdate`.
   */
  viewSpecs: CameraProjectionSpecs;

  #source: PerspectiveCamera | OrthographicCamera;

  #width = 0;
  #height = 0;

  // what the last updateViewRect() with an area read from the specs; NaN for a value the source gives
  #fit: CameraProjectionFit = 'contain';
  #aspect = Number.NaN;
  #near = Number.NaN;
  #far = Number.NaN;

  readonly #fitted: FittedLens = {lens: 0.5};

  // what the last placement read from its source, compared in place by needsPlacement()
  #placedSource?: PerspectiveCamera | OrthographicCamera;
  readonly #placedMatrix = new Matrix4();
  readonly #placedLens = new Float64Array(LENS_VALUES).fill(Number.NaN);

  /**
   * @param source - The camera to look through: a `PerspectiveCamera` or an `OrthographicCamera`. It
   * stays yours.
   * @param specs - How its frame fits into the container. Defaults to `{}`: `'contain'`, with the
   * aspect, near and far of the source.
   * @throws {TypeError} for a source of another kind, and a `fit` other than `'contain'` and `'cover'`.
   * @throws {RangeError} for an `aspect` that is not a finite number above 0.
   */
  constructor(source: PerspectiveCamera | OrthographicCamera, specs?: CameraProjectionSpecs) {
    if (!isPerspective(source) && !isOrthographic(source)) refuseSource(source);
    this.#source = source;
    this.viewSpecs = specs ?? {};
    this.#readSpecs();
  }

  /**
   * The camera this projection looks through. Another source takes effect at the next frame of the
   * stage; one of the other kind gives the stage a camera of that kind — its own, or the one of its
   * `CameraRig`. Read with `updateWorldMatrix(true, false)`, and never written.
   *
   * @throws {TypeError} for a camera that is neither a `PerspectiveCamera` nor an `OrthographicCamera`.
   */
  get source(): PerspectiveCamera | OrthographicCamera {
    return this.#source;
  }

  set source(source: PerspectiveCamera | OrthographicCamera) {
    if (!isPerspective(source) && !isOrthographic(source)) refuseSource(source);
    this.#source = source;
  }

  /** Always `undefined`: the camera stands where its source stands. */
  get projectionPlane(): undefined {
    return undefined;
  }

  /**
   * Takes the container of `width` × `height` as the view, and reads the specs anew. A width or a
   * height that is not a finite number above 0 leaves the projection as it is. `pixelRatio` is
   * ignored: there is no plane whose units a `pixelSnap` could count.
   *
   * @throws {TypeError} for a `fit` the specs have been given since, other than `'contain'` and `'cover'`.
   * @throws {RangeError} for such an `aspect` that is not a finite number above 0.
   */
  updateViewRect(width: number, height: number, _pixelRatio?: number): void {
    if (!isPositiveFinite(width) || !isPositiveFinite(height)) return;
    this.#readSpecs();
    this.#width = width;
    this.#height = height;
  }

  /**
   * The container of the last `updateViewRect()` that had an area, as a new object: one view unit
   * per container unit, no offset. All `0` until then.
   */
  getViewRect(): ProjectionViewRect {
    const hasView = this.#width > 0;
    return {
      width: this.#width,
      height: this.#height,
      pixelRatioX: hasView ? 1 : 0,
      pixelRatioY: hasView ? 1 : 0,
      offsetX: 0,
      offsetY: 0,
    };
  }

  /**
   * `focus / distanceToCamera`, with the `focus` of a perspective source — three's default `10`,
   * since glTF carries none —: `1` at the distance of the focus. Always `1` for an orthographic
   * source.
   */
  getScaleFactor(distanceToCamera: number): number {
    const source = this.#source;
    return isPerspective(source) ? source.focus / distanceToCamera : 1;
  }

  /**
   * Builds a camera of the kind of the source and places it as {@link updateCamera} does. Before a
   * view, it shows the authored frame of the source.
   */
  createCamera(): PerspectiveCamera | OrthographicCamera {
    const camera = isPerspective(this.#source) ? new PerspectiveCamera() : new OrthographicCamera();
    this.updateCamera(camera);
    return camera;
  }

  /**
   * Gives `camera` the world pose of the source — position and orientation of its `matrixWorld`,
   * its parents included, without the scale — and its lens, fitted into the container: the field of
   * view, the aspect of the container and the zoom of a perspective source; the frustum around the
   * middle of the source's, of the aspect of the container, and the zoom of an orthographic one;
   * near and far of the source or of the specs. The view offset and the film offset of the source
   * are not carried over, and the one of `camera` is left as it is. Allocates nothing.
   *
   * @throws {TypeError} if `camera` is not of the kind of the source.
   */
  updateCamera(camera: Camera): void {
    const source = this.#source;
    if (isPerspective(source)) {
      if (!isPerspective(camera)) {
        throw new TypeError(
          `CameraProjection: updateCamera() needs a PerspectiveCamera for its source, got ${describeThreeValue(camera, 'isObject3D')}`,
        );
      }
    } else if (!isOrthographic(camera)) {
      throw new TypeError(
        `CameraProjection: updateCamera() needs an OrthographicCamera for its source, got ${describeThreeValue(camera, 'isObject3D')}`,
      );
    }

    source.updateWorldMatrix(true, false);
    source.matrixWorld.decompose(camera.position, camera.quaternion, ignoredScale);

    const lens = this.#placedLens;
    const fitted = this.#fitted;
    // before a view the container takes the aspect of the frame, which shows it as authored
    const hasView = this.#width > 0;
    if (isPerspective(source)) {
      const target = camera as PerspectiveCamera;
      const authoredAspect = this.#aspect > 0 ? this.#aspect : source.aspect;
      const containerAspect = hasView ? this.#width / this.#height : authoredAspect;
      const sourceLens = Math.tan(source.fov * RAD_PER_DEG * 0.5);
      fitLens(sourceLens, authoredAspect, containerAspect, this.#fit, fitted);
      // the fov of the source as it is where the fit keeps the lens
      target.fov = fitted.lens === sourceLens ? source.fov : (2 * Math.atan(fitted.lens)) / RAD_PER_DEG;
      target.aspect = containerAspect;
      target.zoom = source.zoom;
      this.#writeNearFar(target, source, true);

      lens[0] = source.fov;
      lens[1] = source.zoom;
      lens[2] = source.aspect;
      lens[3] = source.near;
      lens[4] = source.far;
    } else {
      const target = camera as OrthographicCamera;
      const height = source.top - source.bottom;
      const authoredAspect = this.#aspect > 0 ? this.#aspect : (source.right - source.left) / height;
      const containerAspect = hasView ? this.#width / this.#height : authoredAspect;
      fitLens(height, authoredAspect, containerAspect, this.#fit, fitted);
      // around the middle of the frustum of the source, which three does not zoom either
      const halfHeight = fitted.lens * 0.5;
      const halfWidth = halfHeight * containerAspect;
      const middleX = (source.left + source.right) * 0.5;
      const middleY = (source.top + source.bottom) * 0.5;
      target.left = middleX - halfWidth;
      target.right = middleX + halfWidth;
      target.top = middleY + halfHeight;
      target.bottom = middleY - halfHeight;
      target.zoom = source.zoom;
      this.#writeNearFar(target, source, false);

      lens[0] = source.left;
      lens[1] = source.right;
      lens[2] = source.top;
      lens[3] = source.bottom;
      lens[4] = source.zoom;
      lens[5] = source.near;
      lens[6] = source.far;
    }

    (camera as PerspectiveCamera | OrthographicCamera).updateProjectionMatrix();
    camera.updateMatrixWorld();

    this.#placedSource = source;
    this.#placedMatrix.copy(source.matrixWorld);
  }

  /**
   * `true` when the source has moved or turned — itself or a parent —, or its lens has changed, since
   * the last placement, or when it is another camera; compared in place against what that placement
   * read. It decides from the source alone: `camera`, the camera the stage draws with, is not read —
   * under a `CameraRig` it is the camera of the rig. Brings the world matrix of the source up to
   * date. Allocates nothing.
   */
  needsPlacement(_camera: Camera): boolean {
    const source = this.#source;
    if (source !== this.#placedSource) return true;
    source.updateWorldMatrix(true, false);
    if (!source.matrixWorld.equals(this.#placedMatrix)) return true;
    const lens = this.#placedLens;
    if (isPerspective(source)) {
      return (
        source.fov !== lens[0] ||
        source.zoom !== lens[1] ||
        source.aspect !== lens[2] ||
        source.near !== lens[3] ||
        source.far !== lens[4]
      );
    }
    return (
      source.left !== lens[0] ||
      source.right !== lens[1] ||
      source.top !== lens[2] ||
      source.bottom !== lens[3] ||
      source.zoom !== lens[4] ||
      source.near !== lens[5] ||
      source.far !== lens[6]
    );
  }

  // near and far of the specs where a camera can be built from them, otherwise the source's: a
  // perspective camera divides by its near, and by the depth from near to far. The numbers stay in
  // this call: V8 boxes a fraction handed to a call it does not inline
  #writeNearFar(
    camera: PerspectiveCamera | OrthographicCamera,
    source: PerspectiveCamera | OrthographicCamera,
    perspective: boolean,
  ): void {
    const specNear = this.#near;
    const specFar = this.#far;
    let near = (perspective ? specNear > 0 : !Number.isNaN(specNear)) ? specNear : source.near;
    let far = Number.isNaN(specFar) ? source.far : specFar;
    if (!(far > near)) {
      near = source.near;
      far = source.far;
    }
    camera.near = near;
    camera.far = far;
  }

  #readSpecs(): void {
    const specs = this.viewSpecs;
    const {fit, aspect, near, far} = specs;
    if (fit !== undefined && fit !== 'contain' && fit !== 'cover') {
      throw new TypeError(`CameraProjection: fit must be 'contain' or 'cover', got ${describeValue(fit)}`);
    }
    this.#aspect = aspect === undefined ? Number.NaN : assertPositiveFinite(aspect, 'CameraProjection', 'aspect');
    this.#fit = fit ?? 'contain';
    this.#near = isFiniteNumber(near) ? near : Number.NaN;
    this.#far = isFiniteNumber(far) ? far : Number.NaN;
  }
}

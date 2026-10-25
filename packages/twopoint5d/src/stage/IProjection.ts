import type {Camera} from 'three/webgpu';
import type {ProjectionPlane} from './ProjectionPlane.js';

/** The view a projection fits into its container, as {@link IProjection.getViewRect} answers it. */
export interface ProjectionViewRect {
  /** The width of the view, in view units. */
  width: number;
  /** The height of the view, in view units. */
  height: number;
  /** Container pixels per view unit, horizontally: the container width divided by {@link width}. */
  pixelRatioX: number;
  /** Container pixels per view unit, vertically: the container height divided by {@link height}. */
  pixelRatioY: number;
  /**
   * How far the middle of the view lies right of the point the camera looks at, in units of the
   * projection plane: `0`, or in `[0, 1)` where `pixelSnap` has moved the left edge of the frustum
   * onto a whole unit. A canvas position maps into the view as
   * `(x - canvasWidth / 2) / pixelRatioX + offsetX`.
   */
  offsetX: number;
  /**
   * How far the middle of the view lies above the point the camera looks at, in units of the
   * projection plane: `0`, or in `[0, 1)` where `pixelSnap` has moved the bottom edge of the
   * frustum onto a whole unit.
   */
  offsetY: number;
}

export interface IProjection {
  /**
   * Fits the view into a container of `width` × `height`. {@link getViewRect}, {@link createCamera}
   * and {@link updateCamera} work from the last call that gave a view with an area. A width or a
   * height that is not a finite number above 0 leaves the projection as it is; specs that give no
   * view with an area keep the last view, while the pixel ratio follows the new container.
   *
   * `pixelRatio` is the pixels of the drawing buffer per unit of the container —
   * `Display#pixelRatio`, as `Stage2D#resize()` hands it on —, `1` where it is left out. The
   * projections of the library read it for `pixelSnap` alone, see `fitIntoRectangle()`.
   */
  updateViewRect(width: number, height: number, pixelRatio?: number): void;
  /**
   * The view of the last `updateViewRect()` that gave one with an area, as a new object on every
   * call — a write to it leaves the projection as it is. `{width: 0, height: 0, pixelRatioX: 0,
   * pixelRatioY: 0, offsetX: 0, offsetY: 0}` until then.
   */
  getViewRect(): ProjectionViewRect;

  /**
   * The plane the camera looks at. {@link createCamera} and {@link updateCamera} need it: without
   * one, both throw.
   */
  get projectionPlane(): ProjectionPlane | undefined;
  /**
   * How many times larger something sitting `distanceToCamera` in front of the camera appears than
   * the same thing on the projection plane: `1` on the projection plane, above `1` in front of it,
   * below `1` behind it. An orthographic projection answers `1` for every distance.
   *
   * @param distanceToCamera - How far the thing sits from the camera, along the direction the camera
   * looks.
   */
  getScaleFactor(distanceToCamera: number): number;

  /**
   * Builds a new camera with the setup of the last {@link updateViewRect} that gave a view with an
   * area, aimed at the projection plane and placed at its distance. `Stage2D` asks for one once it
   * has a view and no camera.
   *
   * @throws {Error} if the projection has no {@link projectionPlane}, with a message that names the
   * class, the method and the field to set.
   */
  createCamera(): Camera;

  /**
   * Gives `camera` the setup {@link createCamera} gives a new one; what the camera carried there is
   * replaced. `Stage2D` calls it for the camera it has — the projection's or one assigned to
   * `stage.camera` — whenever it computes its view anew.
   *
   * @throws {TypeError} if `camera` is not of the kind {@link createCamera} builds, checked before
   * the projection plane.
   * @throws {Error} if the projection has no {@link projectionPlane}, with a message that names the
   * class, the method and the field to set.
   */
  updateCamera(camera: Camera): void;
}

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
}

export interface IProjection {
  updateViewRect(width: number, height: number): void;
  /**
   * The view of the last `updateViewRect()` that gave one with an area, as a new object on every
   * call — a write to it leaves the projection as it is. `{width: 0, height: 0, pixelRatioX: 0,
   * pixelRatioY: 0}` until then.
   */
  getViewRect(): ProjectionViewRect;

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

  createCamera(): Camera;
  updateCamera(camera: Camera): void;
}

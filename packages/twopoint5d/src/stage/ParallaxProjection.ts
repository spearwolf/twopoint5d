import {PerspectiveCamera, Vector2} from 'three/webgpu';

import {expectDefined} from '../utils/expectDefined.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import type {IProjection} from './IProjection.js';
import {ProjectionPlane, type ProjectionPlaneDescription} from './ProjectionPlane.js';
import {fitIntoRectangle, type FitIntoRectangleSpecs} from './fitIntoRectangle.js';

export type ParallaxProjectionSpecs = FitIntoRectangleSpecs & {
  distanceToProjectionPlane?: number;
  near?: number;
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
   * `[0, 0, 0, 0]`.
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

    this.#near = this.viewSpecs.near ?? 0.1;
    this.#far = this.viewSpecs.far ?? 100000;

    this.#distanceToProjectionPlane = this.viewSpecs.distanceToProjectionPlane ?? 300;

    this.#aspect = this.#viewRect.width / this.#viewRect.height;

    this.#fovy = (2 * Math.atan(this.#halfHeight / this.#distanceToProjectionPlane) * 180) / Math.PI;
  }

  getViewRect(): [width: number, height: number, pixelRatioHorizontal: number, pixelRatioVertical: number] {
    return [this.#viewRect.width, this.#viewRect.height, this.#pixelRatio.x, this.#pixelRatio.y];
  }

  createCamera(): PerspectiveCamera {
    const camera = new PerspectiveCamera(this.#fovy, this.#aspect, this.#near, this.#far);

    const projectionPlane = expectDefined(this.projectionPlane, 'the projection plane of this projection');

    projectionPlane.applyRotation(camera);

    camera.position.copy(projectionPlane.getPointByDistance(this.#distanceToProjectionPlane));

    camera.updateProjectionMatrix();
    return camera;
  }

  updateCamera(camera: PerspectiveCamera): void {
    camera.fov = this.#fovy;
    camera.aspect = this.#aspect;
    camera.updateProjectionMatrix();
  }

  // TODO add jsdoc
  getZoom(distanceToProjectionPlane: number): number {
    if (distanceToProjectionPlane === 0) return 1;

    const d = this.#distanceToProjectionPlane - distanceToProjectionPlane;
    return (Math.tan(((this.#fovy / 2) * Math.PI) / 180) * d) / this.#halfHeight;
  }
}

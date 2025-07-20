import {OrthographicCamera, Vector2} from 'three/webgpu';

import type {IProjection} from './IProjection.js';
import {ProjectionPlane, type ProjectionPlaneDescription} from './ProjectionPlane.js';
import {fitIntoRectangle, type FitIntoRectangleSpecs} from './fitIntoRectangle.js';

export type OrthographicProjectionSpecs = FitIntoRectangleSpecs & {
  distanceToProjectionPlane?: number;
  near?: number;
  far?: number;
};

export class OrthographicProjection implements IProjection {
  viewSpecs: OrthographicProjectionSpecs;
  projectionPlane: ProjectionPlane;

  #viewRect = new Vector2();
  #pixelRatio = new Vector2();

  #halfWidth: number;
  #halfHeight: number;

  #near: number;
  #far: number;

  #distanceToProjectionPlane: number;

  constructor(projectionPlane?: ProjectionPlane | ProjectionPlaneDescription, specs?: OrthographicProjectionSpecs) {
    // @ts-ignore
    this.projectionPlane = typeof projectionPlane === 'string' ? ProjectionPlane.get(projectionPlane) : projectionPlane;
    // @ts-ignore
    this.viewSpecs = specs;
  }

  updateViewRect(width: number, height: number): void {
    fitIntoRectangle(new Vector2(width, height), this.viewSpecs, this.#viewRect);

    this.#halfWidth = this.#viewRect.width / 2;
    this.#halfHeight = this.#viewRect.height / 2;

    this.#pixelRatio.set(width, height).divide(this.#viewRect);

    this.#near = this.viewSpecs.near ?? 0.1;
    this.#far = this.viewSpecs.far ?? 100000;

    this.#distanceToProjectionPlane = this.viewSpecs.distanceToProjectionPlane ?? 100;
  }

  getViewRect(): [width: number, height: number, pixelRatioHorizontal: number, pixelRatioVertical: number] {
    return [this.#viewRect.width, this.#viewRect.height, this.#pixelRatio.x, this.#pixelRatio.y];
  }

  createCamera(): OrthographicCamera {
    const camera = new OrthographicCamera(
      -this.#halfWidth,
      this.#halfWidth,
      this.#halfHeight,
      -this.#halfHeight,
      this.#near,
      this.#far,
    );

    this.projectionPlane.applyRotation(camera);

    camera.position.copy(this.projectionPlane.getPointByDistance(this.#distanceToProjectionPlane));

    camera.updateProjectionMatrix();
    return camera;
  }

  updateCamera(camera: OrthographicCamera): void {
    camera.left = -this.#halfWidth;
    camera.right = this.#halfWidth;
    camera.top = this.#halfHeight;
    camera.bottom = -this.#halfHeight;
    camera.near = this.#near;
    camera.far = this.#far;
    camera.updateProjectionMatrix();
  }

  getZoom(_distanceToProjectionPlane: number): number {
    // since this is an orthographic view, the zoom factor is always the same
    return 1;
  }
}

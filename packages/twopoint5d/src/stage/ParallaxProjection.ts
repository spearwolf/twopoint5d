import {PerspectiveCamera, Vector2} from 'three';

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
  projectionPlane: ProjectionPlane;

  #viewRect = new Vector2();
  #pixelRatio = new Vector2();

  #halfHeight: number;

  #near: number;
  #far: number;

  #distanceToProjectionPlane: number;

  #aspect: number;
  #fovy: number;

  constructor(projectionPlane?: ProjectionPlane | ProjectionPlaneDescription, specs?: ParallaxProjectionSpecs) {
    // @ts-ignore
    this.projectionPlane = typeof projectionPlane === 'string' ? ProjectionPlane.get(projectionPlane) : projectionPlane;
    this.viewSpecs = specs ?? {};
  }

  updateViewRect(width: number, height: number): void {
    fitIntoRectangle(new Vector2(width, height), this.viewSpecs as any, this.#viewRect);

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

    this.projectionPlane.applyRotation(camera);

    camera.position.copy(this.projectionPlane.getPointByDistance(this.#distanceToProjectionPlane));

    camera.updateProjectionMatrix();
    return camera;
  }

  updateCamera(camera: PerspectiveCamera): void {
    camera.fov = this.#fovy;
    camera.aspect = this.#aspect;
    camera.updateProjectionMatrix();
  }

  // TODO explanation
  getZoom(distanceToProjectionPlane: number): number {
    if (distanceToProjectionPlane === 0) return 1;

    const d = this.#distanceToProjectionPlane - distanceToProjectionPlane;
    return (Math.tan(((this.#fovy / 2) * Math.PI) / 180) * d) / this.#halfHeight;
  }
}

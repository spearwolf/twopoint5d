import {Camera} from 'three';

import {Plane} from './Plane';

export interface IProjection {
  updateViewRect(width: number, height: number): void;
  getViewRect(): [
    width: number,
    height: number,
    pixelRatioHorizontal: number,
    pixelRatioVertical: number,
  ];

  get projectionPlane(): Plane;
  getZoom(distanceToProjectionPlane: number): number;

  createCamera(): Camera;
  updateCamera(camera: Camera): void;
}

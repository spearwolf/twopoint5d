import type {Camera} from 'three/webgpu';
import type {ProjectionPlane} from './ProjectionPlane.js';

export interface IProjection {
  updateViewRect(width: number, height: number): void;
  getViewRect(): [width: number, height: number, pixelRatioHorizontal: number, pixelRatioVertical: number];

  get projectionPlane(): ProjectionPlane;
  getZoom(distanceToProjectionPlane: number): number;

  createCamera(): Camera;
  updateCamera(camera: Camera): void;
}

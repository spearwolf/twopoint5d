import {Object3D, Vector2, Vector3} from 'three';
import {Map2DTile} from './Map2DTile';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil';

export type Map2DVisibleTiles = {
  tiles: Map2DTile[];

  offset?: Vector2;
  translate?: Vector3;

  removeTiles?: Map2DTile[];
  reuseTiles?: Map2DTile[];
  createTiles?: Map2DTile[];
};

/**
 * The Map2DVisibilitor decides which tiles are visible in a Map2DLayer.
 */
export interface IMap2DVisibilitor {
  needsUpdate: boolean;

  computeVisibleTiles(
    previousTiles: Map2DTile[],
    centerPoint: [number, number],
    tileCoords: Map2DTileCoordsUtil,
    node: Object3D,
  ): Map2DVisibleTiles | undefined;

  addToScene(scene: Object3D): void;
  removeFromScene(scene: Object3D): void;
}

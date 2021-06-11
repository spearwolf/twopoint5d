import {IMap2dLayerTilesRenderer} from './IMap2dLayerTilesRenderer';
import {Map2dAreaTile} from './Map2dAreaTile';
import {Map2dTileCoordsUtil} from './Map2dTileCoordsUtil';

export class Map2dLayer {
  #tileCoords: Map2dTileCoordsUtil;

  get tileWidth() {
    return this.#tileCoords.tileWidth;
  }

  set tileWidth(width: number) {
    this.#tileCoords.tileWidth = width;
  }

  get tileHeight() {
    return this.#tileCoords.tileHeight;
  }

  set tileHeight(width: number) {
    this.#tileCoords.tileHeight = width;
  }

  get xOffset() {
    return this.#tileCoords.xOffset;
  }

  set xOffset(offset: number) {
    this.#tileCoords.xOffset = offset;
  }

  get yOffset() {
    return this.#tileCoords.yOffset;
  }

  set yOffset(offset: number) {
    this.#tileCoords.yOffset = offset;
  }

  tiles: Map2dAreaTile[] = [];
  tilesRenderer: IMap2dLayerTilesRenderer;

  constructor(tileWidth: number, tileHeight: number, xOffset = 0, yOffset = 0) {
    this.#tileCoords = new Map2dTileCoordsUtil(tileWidth, tileHeight, xOffset, yOffset);
  }

  renderViewArea(_left: number, _top: number, _width: number, _height: number) {
    throw new Error('TODO implement renderViewArea()');
  }
}

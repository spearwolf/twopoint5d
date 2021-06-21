import {AABB2} from './AABB2';
import {IMap2dLayerTilesRenderer} from './IMap2dLayerTilesRenderer';
import {Map2dAreaTile} from './Map2dAreaTile';
import {Map2dTileCoordsUtil} from './Map2dTileCoordsUtil';

export class Map2dLayer {
  #tileCoords: Map2dTileCoordsUtil;
  #needsUpdate = true;

  get tileWidth() {
    return this.#tileCoords.tileWidth;
  }

  set tileWidth(width: number) {
    if (this.#tileCoords.tileWidth !== width) {
      this.#tileCoords.tileWidth = width;
      this.#needsUpdate = true;
    }
  }

  get tileHeight() {
    return this.#tileCoords.tileHeight;
  }

  set tileHeight(height: number) {
    if (this.#tileCoords.tileHeight !== height) {
      this.#tileCoords.tileHeight = height;
      this.#needsUpdate = true;
    }
  }

  get xOffset() {
    return this.#tileCoords.xOffset;
  }

  set xOffset(offset: number) {
    if (this.#tileCoords.xOffset !== offset) {
      this.#tileCoords.xOffset = offset;
      this.#needsUpdate = true;
    }
  }

  get yOffset() {
    return this.#tileCoords.yOffset;
  }

  set yOffset(offset: number) {
    if (this.#tileCoords.yOffset !== offset) {
      this.#tileCoords.yOffset = offset;
      this.#needsUpdate = true;
    }
  }

  tiles: Map2dAreaTile[] = [];
  tilesRenderer: IMap2dLayerTilesRenderer;

  #lastViewArea = new AABB2();

  constructor(tileWidth: number, tileHeight: number, xOffset = 0, yOffset = 0) {
    this.#tileCoords = new Map2dTileCoordsUtil(tileWidth, tileHeight, xOffset, yOffset);
  }

  renderViewArea(left: number, top: number, width: number, height: number) {
    if (!this.tilesRenderer) return;
    if (this.#needsUpdate || !this.#lastViewArea.is(left, top, width, height)) {
      this.#needsUpdate = false;
      this.#lastViewArea.set(left, top, width, height);

      const tileCoords = this.#tileCoords.computeTilesWithinCoords(left, top, width, height);
      const fullViewArea = AABB2.from(tileCoords);
      fullViewArea.top -= this.yOffset;
      fullViewArea.left -= this.xOffset;

      const removeTiles: Map2dAreaTile[] = [];
      const reuseTiles: Map2dAreaTile[] = [];
      const createTilesState = new Uint8Array(tileCoords.rows * tileCoords.columns);

      this.tiles.forEach((tile) => {
        if (fullViewArea.isIntersecting(tile.view)) {
          reuseTiles.push(tile);
          const tx = tile.x - tileCoords.tileLeft;
          const ty = tile.y - tileCoords.tileTop;
          createTilesState[ty * tileCoords.columns + tx] = 1;
        } else {
          removeTiles.push(tile);
        }
      });

      const createTiles: Map2dAreaTile[] = [];

      for (let ty = 0; ty < tileCoords.rows; ty++) {
        for (let tx = 0; tx < tileCoords.columns; tx++) {
          if (createTilesState[ty * tileCoords.columns + tx] === 0) {
            const tileX = tx + tileCoords.tileLeft;
            const tileY = ty + tileCoords.tileTop;
            const tile = new Map2dAreaTile(
              tileX,
              tileY,
              new AABB2(
                tileX * tileCoords.tileWidth,
                tileY * tileCoords.tileHeight,
                tileCoords.tileWidth,
                tileCoords.tileHeight,
              ),
            );
            createTiles.push(tile);
          }
        }
      }

      this.tiles = reuseTiles.concat(createTiles);

      this.tilesRenderer.beginRender(this, fullViewArea);
      removeTiles.forEach((tile) => this.tilesRenderer.removeTile(tile));
      createTiles.forEach((tile) => this.tilesRenderer.addTile(tile));
      reuseTiles.forEach((tile) => this.tilesRenderer.reuseTile(tile));
      this.tilesRenderer.endRender();
    }
  }
}

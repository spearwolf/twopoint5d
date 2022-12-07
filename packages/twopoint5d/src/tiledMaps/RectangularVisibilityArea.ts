import {Box3, Box3Helper, Color, Event, MathUtils, Object3D, Vector3} from 'three';
import {AABB2} from './AABB2';
import {IMap2DVisibilitor, Map2DVisibleTiles} from './IMap2DVisibilitor';
import {Map2DTile} from './Map2DTile';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil';

export class RectangularVisibilityArea implements IMap2DVisibilitor {
  readonly uuid = MathUtils.generateUUID();

  #width = 0;
  #height = 0;

  needsUpdate = true;

  viewRectHelperHeight = 20;
  viewRectHelperColor = new Color(0xfff066);

  #viewRect?: Box3 = undefined;

  #tileCreated?: Uint8Array;

  #showHelpers = false;

  #scene?: Object3D;

  constructor(width = 320, height = 240) {
    this.width = width;
    this.height = height;
  }

  get width(): number {
    return this.#width;
  }

  set width(width: number) {
    if (this.#width !== width) {
      this.#width = width;
      this.needsUpdate = true;
    }
  }

  get height(): number {
    return this.#height;
  }

  set height(height: number) {
    if (this.#height !== height) {
      this.#height = height;
      this.needsUpdate = true;
    }
  }

  computeVisibleTiles(
    previousTiles: Map2DTile[],
    [centerX, centerY]: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
  ): Map2DVisibleTiles | undefined {
    if (this.width === 0 || this.height === 0) {
      return undefined;
    }

    const {width, height} = this;

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    const left = centerX - halfWidth;
    const top = centerY - halfHeight;

    const viewRectHelperHalfHeight = this.viewRectHelperHeight / 2;

    this.#viewRect = new Box3(
      new Vector3(-halfWidth, -viewRectHelperHalfHeight, -halfHeight),
      new Vector3(halfWidth, viewRectHelperHalfHeight, halfHeight),
    );

    const tileCoords = map2dTileCoords.computeTilesWithinCoords(left, top, width, height);
    const fullViewArea = AABB2.from(tileCoords);

    const removeTiles: Map2DTile[] = [];
    const reuseTiles: Map2DTile[] = [];

    const tilesLength = tileCoords.rows * tileCoords.columns;

    let tileCreated = this.#tileCreated;
    if (tileCreated == null || tileCreated.length < tilesLength) {
      this.#tileCreated = new Uint8Array(tilesLength);
      tileCreated = this.#tileCreated;
    } else {
      tileCreated.fill(0);
    }

    previousTiles.forEach((tile) => {
      if (fullViewArea.isIntersecting(tile.view)) {
        reuseTiles.push(tile);
        const tx = tile.x - tileCoords.tileLeft;
        const ty = tile.y - tileCoords.tileTop;
        tileCreated[ty * tileCoords.columns + tx] = 1;
      } else {
        removeTiles.push(tile);
      }
    });

    const createTiles: Map2DTile[] = [];

    for (let ty = 0; ty < tileCoords.rows; ty++) {
      for (let tx = 0; tx < tileCoords.columns; tx++) {
        if (tileCreated[ty * tileCoords.columns + tx] === 0) {
          const tileX = tx + tileCoords.tileLeft;
          const tileY = ty + tileCoords.tileTop;
          const tile = new Map2DTile(
            tileX,
            tileY,
            new AABB2(tileX * tileCoords.tileWidth, tileY * tileCoords.tileHeight, tileCoords.tileWidth, tileCoords.tileHeight),
          );
          createTiles.push(tile);
        }
      }
    }

    if (this.showHelpers) {
      this.updateHelpers();
    }

    return {
      tiles: reuseTiles.concat(createTiles),
      xOffset: map2dTileCoords.xOffset - centerX,
      yOffset: map2dTileCoords.yOffset - centerY,
      removeTiles,
      createTiles,
      reuseTiles,
    };
  }

  get showHelpers() {
    return this.#showHelpers;
  }

  set showHelpers(showHelpers: boolean) {
    if (this.#showHelpers && !showHelpers) {
      this.removeHelpers();
    } else if (!this.#showHelpers && showHelpers) {
      this.updateHelpers();
    }
    this.#showHelpers = showHelpers;
  }

  addToScene(scene: Object3D<Event>): void {
    this.#scene = scene;
  }

  removeFromScene(scene: Object3D<Event>): void {
    const removeChilds: Object3D[] = [];
    for (const childNode of scene.children) {
      if (childNode.userData.createdBy === this.uuid) {
        removeChilds.push(childNode);
      }
    }
    for (const childNode of removeChilds) {
      childNode.removeFromParent();
      (childNode as any).dispose?.();
    }
  }

  removeHelpers() {
    if (this.#scene) {
      this.removeFromScene(this.#scene);
    }
  }

  updateHelpers() {
    this.removeHelpers();
    if (this.#scene && this.#viewRect) {
      const helper = new Box3Helper(this.#viewRect, this.viewRectHelperColor);
      helper.userData.createdBy = this.uuid;
      this.#scene.add(helper);
    }
  }
}

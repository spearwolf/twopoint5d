import {Line3, PerspectiveCamera, Plane, Vector3} from 'three';
import {AABB2} from './AABB2';
import {IMap2DVisibilitor, Map2DVisibleTiles} from './IMap2DVisibilitor';
import {Map2DTile} from './Map2DTile';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil';

/**
 * This visibilitor assumes that the map2D layer is rendered in the 3d space on the xy plane.
 * So, the camera should point to the xy plane, if there should be visible tiles.
 *
 * If a plane other than the xy plane is needed, you can simply define your own plane.
 *
 * The view frustum of the camera is used to calculate the visible tiles.
 *
 * The _far_ value of the camera may be used to limit the visibility of the tiles.
 * The _near_ value is not used.
 */
export class CameraBasedVisibility implements IMap2DVisibilitor {
  static readonly DEFAULT_PLANE = new Plane(new Vector3(0, 0, 1), 0);

  #camera?: PerspectiveCamera;
  #plane: Plane = CameraBasedVisibility.DEFAULT_PLANE;

  // TODO remove
  #width = 0;
  #height = 0;

  needsUpdate = true;

  #tileCreated?: Uint8Array;

  get camera(): PerspectiveCamera {
    return this.#camera;
  }

  set camera(camera: PerspectiveCamera) {
    if (this.#camera !== camera) {
      this.#camera = camera;
      this.needsUpdate = true;

      // TODO remove
      // eslint-disable-next-line no-console
      console.log('camera switched to', camera);
    }
  }

  get plane(): Plane {
    return this.#plane;
  }

  set plane(plane: Plane) {
    const nextPlane = plane ?? CameraBasedVisibility.DEFAULT_PLANE;

    if (this.#plane !== nextPlane) {
      this.#plane = nextPlane;
      this.needsUpdate = true;

      // TODO remove
      // eslint-disable-next-line no-console
      console.log('plane changed to', nextPlane);
    }
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

  constructor(camera?: PerspectiveCamera, plane?: Plane) {
    this.camera = camera;
    this.plane = plane;

    // TODO remove
    this.width = 640;
    this.height = 480;
  }

  computeVisibleTiles(
    previousTiles: Map2DTile[],
    [centerX, centerY]: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
  ): Map2DVisibleTiles | undefined {
    if (this.camera != null) {
      this.computeVisibleTilesNEXT(previousTiles, [centerX, centerY], map2dTileCoords);
    }
    return this.computeVisibleTilesLEGACY(previousTiles, [centerX, centerY], map2dTileCoords);
  }

  #lastPlaneIntersect: Vector3 | undefined;

  private equalsLastPlaneIntersect(intersect: Vector3): boolean {
    return this.#lastPlaneIntersect != null && this.#lastPlaneIntersect.equals(intersect);
  }

  private rememberPlaneIntersect(planeIntersect: Vector3) {
    if (this.#lastPlaneIntersect == null) {
      this.#lastPlaneIntersect = planeIntersect.clone();
    } else {
      this.#lastPlaneIntersect.copy(planeIntersect);
    }
  }

  private computeVisibleTilesNEXT(
    previousTiles: Map2DTile[],
    [centerX, centerY]: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
  ): Map2DVisibleTiles | undefined {
    if (this.camera == null) {
      return undefined;
    }

    const planeIntersect = this.findPointOnPlaneThatIsInViewFrustum();

    if (planeIntersect == null) {
      return undefined;
    }

    planeIntersect.x += centerX;
    planeIntersect.y += centerY;

    if (!this.equalsLastPlaneIntersect(planeIntersect)) {
      this.rememberPlaneIntersect(planeIntersect);

      const tileCoords = map2dTileCoords.computeTilesWithinCoords(planeIntersect.x, planeIntersect.y, 1, 1);

      // eslint-disable-next-line no-console
      console.log('new plane intersect', {tileCoords, planeIntersect});

      return undefined;
    }

    // nothing changed, so we just return the previous tiles
    return Array.isArray(previousTiles) && previousTiles.length > 0
      ? {tiles: previousTiles, reuseTiles: previousTiles}
      : undefined;
  }

  private findPointOnPlaneThatIsInViewFrustum(): Vector3 | undefined {
    const camWorldPos = this.camera.getWorldPosition(new Vector3());
    const camWorldDir = this.camera.getWorldDirection(new Vector3()).setLength(this.camera.far);

    const lineOfSightEnd = camWorldDir.clone().add(camWorldPos);
    const lineOfSight = new Line3(camWorldPos, lineOfSightEnd);

    // TODO check all frame corners of the view frustum instead of the view frustum center

    // console.log('lineOfSight', {
    //   lineOfSight,
    //   plane: this.plane,
    //   camWorldPos: camWorldPos.toArray(),
    //   camWorldDir: camWorldDir.toArray(),
    // });

    return this.plane.intersectLine(lineOfSight, new Vector3());
  }

  private computeVisibleTilesLEGACY(
    previousTiles: Map2DTile[],
    [centerX, centerY]: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
  ): Map2DVisibleTiles | undefined {
    if (this.width === 0 || this.height === 0) {
      return undefined;
    }

    const {width, height} = this;

    const left = centerX - width / 2;
    const top = centerY - height / 2;

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

    return {tiles: reuseTiles.concat(createTiles), removeTiles, createTiles, reuseTiles};
  }
}

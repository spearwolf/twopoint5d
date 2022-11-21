import {
  Box3,
  Box3Helper,
  Color,
  Event,
  Frustum,
  Line3,
  MathUtils,
  Object3D,
  PerspectiveCamera,
  Plane,
  Vector2,
  Vector3,
} from 'three';
import {AABB2} from './AABB2';
import {IMap2DVisibilitor, Map2DVisibleTiles} from './IMap2DVisibilitor';
import {Map2DTile} from './Map2DTile';
import {Map2DTileCoordsUtil, TilesWithinCoords} from './Map2DTileCoordsUtil';

interface PlaneTileBox {
  id: string;
  x: number;
  y: number;
  planeCoords?: TilesWithinCoords;
  planeBox?: Box3;
}

const makePlaneTileBoxId = (x: number, y: number) => `${x},${y}`;

const makeTileBox = (x: number, y: number): PlaneTileBox => ({
  id: makePlaneTileBoxId(x, y),
  x,
  y,
});

/**
 * This visibilitor assumes that the map2D layer is rendered in the 3d space on the xz plane.
 * So, the camera should point to the xz plane, if there should be visible tiles.
 *
 * The view frustum of the camera is used to calculate the visible tiles.
 *
 * The _far_ value of the camera may be used to limit the visibility of the tiles.
 * The _near_ value is not used.
 */
export class CameraBasedVisibility implements IMap2DVisibilitor {
  static readonly Plane = new Plane(new Vector3(0, 1, 0), 0);

  readonly uuid = MathUtils.generateUUID();

  #camera?: PerspectiveCamera;

  #scene?: Object3D;

  depth = 100;

  get ground(): number {
    return Math.abs(this.depth) / -2;
  }

  get ceiling(): number {
    return Math.abs(this.depth) / 2;
  }

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

  constructor(camera?: PerspectiveCamera) {
    this.camera = camera;

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

  private computeVisibleTilesNEXT(
    previousTiles: Map2DTile[],
    [_centerX, _centerY]: [number, number],
    map2dTileCoords: Map2DTileCoordsUtil,
  ): Map2DVisibleTiles | undefined {
    if (this.camera == null) {
      return undefined;
    }

    const planeIntersect = this.findPointOnPlaneThatIsInViewFrustum();

    if (planeIntersect == null) {
      return undefined;
    }

    const planeIntersectCoords = this.toPlaneCoords(planeIntersect);
    const planeCoords = map2dTileCoords.computeTilesWithinCoords(planeIntersectCoords.x, planeIntersectCoords.y, 1, 1);

    this.findAllVisibleTiles(planeCoords, map2dTileCoords);

    // nothing changed, so we just return the previous tiles
    return Array.isArray(previousTiles) && previousTiles.length > 0
      ? {tiles: previousTiles, reuseTiles: previousTiles}
      : undefined;
  }

  private findAllVisibleTiles(planeCoords: TilesWithinCoords, map2dTileCoords: Map2DTileCoordsUtil): void {
    const cameraFrustum = this.makeCameraFrustum();

    const visibleBoxes: PlaneTileBox[] = [];
    const visitedBoxIds = new Set<string>();

    const nextBox: PlaneTileBox[] = [makeTileBox(planeCoords.tileLeft, planeCoords.tileTop)];

    while (nextBox.length > 0) {
      const current = nextBox.pop();
      if (current != null) {
        if (!visitedBoxIds.has(current.id)) {
          visitedBoxIds.add(current.id);

          current.planeCoords = map2dTileCoords.computeTilesWithinCoords(
            current.x * planeCoords.tileWidth,
            current.y * planeCoords.tileHeight,
            1,
            1,
          );

          current.planeBox = this.getBoxFromTileCoords(current.planeCoords);

          if (cameraFrustum.intersectsBox(current.planeBox)) {
            visibleBoxes.push(current);
            [
              [-1, 1],
              [-1, 0],
              [-1, -1],

              [0, 1],
              [0, -1],

              [1, 1],
              [1, 0],
              [1, -1],
            ].forEach(([dx, dy]) => {
              const ptb = makeTileBox(current.planeCoords.tileLeft + dx, current.planeCoords.tileTop + dy);
              if (!visitedBoxIds.has(ptb.id)) {
                nextBox.push(ptb);
              }
            });
          }
        }
      }
    }

    // TODO

    // console.log('new plane coords', {visibleBoxes, nextBox, visitedBoxIds, planeCoords, cameraFrustum});

    if (this.#scene) {
      this.removeFromScene(this.#scene);
      for (const [i, {planeBox}] of visibleBoxes.entries()) {
        if (planeBox != null) {
          const box = planeBox.clone();
          const boxSize = box.getSize(new Vector3());
          box.expandByVector(boxSize.multiplyScalar(-0.01));
          const helper = new Box3Helper(box, new Color(i === 0 ? 0xff0066 : 0xf0f0f0));
          helper.userData.createdBy = this.uuid;
          this.#scene.add(helper);
        }
      }
    }
  }

  private makeCameraFrustum(): Frustum {
    this.camera.updateMatrixWorld();
    return new Frustum().setFromProjectionMatrix(
      this.camera.projectionMatrix.clone().multiply(this.camera.matrixWorld.clone().invert()),
    );
  }

  private getBoxFromTileCoords({top, left, width, height}: TilesWithinCoords): Box3 {
    return new Box3(new Vector3(left, this.ground, top), new Vector3(left + width, this.ceiling, top + height));
  }

  private toPlaneCoords(planeIntersect: Vector3): Vector2 {
    return new Vector2(planeIntersect.x, planeIntersect.z);
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

    return CameraBasedVisibility.Plane.intersectLine(lineOfSight, new Vector3());
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
}

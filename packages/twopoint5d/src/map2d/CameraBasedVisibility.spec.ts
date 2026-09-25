import type {Box3, CoordinateSystem} from 'three/webgpu';
import {
  Euler,
  Frustum,
  Matrix4,
  OrthographicCamera,
  PerspectiveCamera,
  Vector3,
  WebGLCoordinateSystem,
  WebGPUCoordinateSystem,
} from 'three/webgpu';
import type {MockInstance} from 'vitest';
import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';
import type {TileBox} from './CameraBasedVisibility.js';
import {CameraBasedVisibility} from './CameraBasedVisibility.js';
import {Map2DTileCoordsUtil} from './Map2DTileCoordsUtil.js';
import type {IMap2DVisibleTiles} from './types.js';

function makeTopDownCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(90, 1, 0.1, 500);
  camera.position.set(0, 100, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function makeOrthoCameraLookingHorizontally(): OrthographicCamera {
  // Above the XZ-plane and looking along +X — direction is parallel to the plane
  // and does not lie on it, so there is no intersection.
  const camera = new OrthographicCamera(-100, 100, 100, -100, 0.1, 500);
  camera.position.set(0, 50, 0);
  camera.lookAt(1, 50, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function makeCameraLookingOverThePlane(): PerspectiveCamera {
  // Above the XZ-plane and tilted upwards by 26.5°: the center of the view frustum points into
  // the sky and never meets the plane, while its lower half still reaches the ground.
  const camera = new PerspectiveCamera(90, 1, 0.1, 500);
  camera.position.set(0, 100, 0);
  camera.lookAt(0, 150, 100);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function makeCameraTouchingThePlaneWithOneCorner(): PerspectiveCamera {
  // Tilted up steeply and rolled by 45°, so that of the nine probe rays only the one through
  // the lowest corner of the view frustum still reaches the plane.
  const camera = new PerspectiveCamera(90, 1, 0.1, 500);
  camera.position.set(0, 100, 0);
  camera.rotation.copy(new Euler((48 * Math.PI) / 180, 0, Math.PI / 4, 'YXZ'));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function makeTiltedCamera(): PerspectiveCamera {
  // Looks down at the plane from behind and above, the way a map is usually watched: the lower
  // half of the frustum lands on the ground in front of the camera, the upper half runs out to
  // the horizon.
  const camera = new PerspectiveCamera(75, 1.6, 0.1, 4000);
  camera.position.set(0, 350, 500);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function makeCameraWithTheFarPlaneOnTheGround(): PerspectiveCamera {
  // Looks down at 45°; the upper edge of the view stays below the horizon, so the ground it covers
  // is bounded even without a far plane, and the far plane at 200 cuts it short of where the upper
  // edge meets the ground (≈ 386).
  const camera = new PerspectiveCamera(60, 1, 0.1, 200);
  camera.position.set(0, 100, 100);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function makeOrthoCameraLookingDown(): OrthographicCamera {
  const camera = new OrthographicCamera(-100, 100, 100, -100, 0.1, 500);
  camera.position.set(0, 100, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

function makeCameraCloserToThePlaneThanItsNearPlane(): PerspectiveCamera {
  const camera = new PerspectiveCamera(90, 1, 10, 500);
  camera.position.set(0, 7, 0);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

/**
 * Puts the camera into a coordinate system and a depth direction the way the renderer does on its
 * first frame: both fields set, the projection built again from them. three exposes
 * `reversedDepth` as a getter only; the renderer writes `_reversedDepth`, and so does this helper.
 */
function inCoordinateSystem<C extends PerspectiveCamera | OrthographicCamera>(
  camera: C,
  coordinateSystem: CoordinateSystem,
  reversedDepth: boolean,
): C {
  camera.coordinateSystem = coordinateSystem;
  (camera as unknown as {_reversedDepth: boolean})._reversedDepth = reversedDepth;
  camera.updateProjectionMatrix();
  return camera;
}

/** The camera frustum of the visibility, built the second time and from the outside. */
function makeFrustum(camera: PerspectiveCamera | OrthographicCamera): Frustum {
  return new Frustum().setFromProjectionMatrix(
    new Matrix4().copy(camera.projectionMatrix).multiply(camera.matrixWorldInverse),
    camera.coordinateSystem,
    camera.reversedDepth,
  );
}

/**
 * The tiles the probe rays met, as `x,y`. With an identity `matrixWorld` a point on the plane is
 * at its own x/z, and the center point moves the tile grid under it — which is the whole of what
 * the visibility does with it, so the grid can be asked directly.
 */
function probeTileIds(
  visibility: CameraBasedVisibility,
  tileCoords: Map2DTileCoordsUtil,
  [centerX, centerY]: [number, number] = [0, 0],
): string[] {
  return visibility.pointsOnPlane.map((point) => {
    const [tileLeft, tileTop] = tileCoords.getTileCoords(point.x + centerX, point.z + centerY, 0, 0);
    return `${tileLeft},${tileTop}`;
  });
}

/**
 * Whether a tile can carry the primary mark: the seed rectangle of one tile size around a probe
 * point reaches the tile the point falls into and up to three of its neighbours.
 */
function isNextToAProbe(tile: {x: number; y: number}, probes: readonly string[]): boolean {
  return probes.some((id) => {
    const [x, y] = id.split(',').map(Number) as [number, number];
    return Math.abs(tile.x - x) <= 1 && Math.abs(tile.y - y) <= 1;
  });
}

function ids(tiles: {id: string}[] | undefined): string[] {
  return (tiles ?? []).map((t) => t.id).sort();
}

describe('CameraBasedVisibility', () => {
  describe('computeVisibleTiles()', () => {
    let visibility: CameraBasedVisibility;
    let tileCoords: Map2DTileCoordsUtil;
    let matrixWorld: Matrix4;

    beforeEach(() => {
      tileCoords = new Map2DTileCoordsUtil(100, 100);
      matrixWorld = new Matrix4();
    });

    test('returns undefined when no camera is assigned', () => {
      visibility = new CameraBasedVisibility();
      expect(visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)).toBeUndefined();
    });

    test('returns a visible-tiles result with non-empty tiles when the camera looks at the plane', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      const result = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld);

      expect(result).toBeDefined();
      expect(result!.tiles.length).toBeGreaterThan(0);
      expect(result!.createTiles).toBeDefined();
      expect(result!.createTiles!.length).toEqual(result!.tiles.length);
      expect(result!.reuseTiles ?? []).toHaveLength(0);
      expect(result!.removeTiles ?? []).toHaveLength(0);
    });

    test('contains the tile at the camera ground point as a visible tile', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      const result = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld);

      // tile (0,0) covers world XZ-area [0..100] × [0..100]; with camera at (0,100,0)
      // looking at the origin, the ground-projection tile at (0,0) (or its neighbours)
      // must be in the result.
      const tileIds = ids(result!.tiles);
      expect(tileIds).toContain('0,0');
    });

    test('leaves the projection matrix of the camera as the caller set it', () => {
      const camera = makeTopDownCamera();
      const custom = camera.projectionMatrix.clone().multiply(new Matrix4().makeScale(1.25, 1, 1));
      camera.projectionMatrix.copy(custom);
      camera.projectionMatrixInverse.copy(custom).invert();

      visibility = new CameraBasedVisibility(camera);
      visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld);

      expect(camera.projectionMatrix.elements).toEqual(custom.elements);
    });

    test('a recomputation handed the tiles of its own last result classifies against what they were', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const before = ids(first.tiles);
      const second = visibility.computeVisibleTiles(first.tiles, [400, 0], tileCoords, matrixWorld)!;

      expect(ids([...(second.reuseTiles ?? []), ...(second.removeTiles ?? [])])).toEqual(before);
      expect(new Set(second.tiles).size, 'no tile twice').toBe(second.tiles.length);
    });

    test('a camera that turns away from the plane hands every tile of its own last result back for removal', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const before = ids(first.tiles);
      expect(before.length).toBeGreaterThan(0);

      visibility.camera = makeOrthoCameraLookingHorizontally();
      const second = visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(second.tiles).toHaveLength(0);
      expect(ids(second.removeTiles)).toEqual(before);
    });

    test('hands back the same result object and lists on every recomputation', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const firstTiles = first.tiles;
      const second = visibility.computeVisibleTiles(first.tiles, [100, 0], tileCoords, matrixWorld)!;

      expect(second).toBe(first);
      expect(second.tiles).toBe(firstTiles);
    });

    test('map2dTileCoords is a copy of the grid of the last call, and read-only', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());
      visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld);

      expect(visibility.map2dTileCoords).not.toBe(tileCoords);
      expect(visibility.map2dTileCoords.equals(tileCoords)).toBe(true);

      tileCoords.tileWidth = 50;
      expect(visibility.map2dTileCoords.tileWidth, 'a write on the grid of the caller').toBe(100);

      expect(() => {
        // @ts-expect-error — a getter without a setter
        visibility.map2dTileCoords = new Map2DTileCoordsUtil();
      }).toThrow(TypeError);
    });

    test('returns undefined on a fresh instance when the camera direction is parallel to the plane and there are no previousTiles', () => {
      visibility = new CameraBasedVisibility(makeOrthoCameraLookingHorizontally());
      const result = visibility.computeVisibleTiles([], [0, 0], tileCoords, new Matrix4());
      expect(result).toBeUndefined();
    });

    test('returns tiles=[] and removeTiles with the tiles of previousTiles when the camera direction is parallel to the plane and previousTiles is populated', () => {
      // Seed a previousTiles list with a separate visibility instance that does see the plane.
      const seeder = new CameraBasedVisibility(makeTopDownCamera());
      const seed = seeder.computeVisibleTiles([], [0, 0], new Map2DTileCoordsUtil(100, 100), new Matrix4())!;
      const previous = seed.tiles;
      expect(previous.length).toBeGreaterThan(0);

      visibility = new CameraBasedVisibility(makeOrthoCameraLookingHorizontally());
      const result = visibility.computeVisibleTiles(previous, [0, 0], tileCoords, new Matrix4());
      expect(result).toBeDefined();
      expect(result!.tiles).toEqual([]);
      expect(result!.removeTiles).toEqual(previous);
    });

    test('empties visibles when the camera turns away from the plane', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      expect(visibility.visibles.length, 'the camera saw the plane').toBeGreaterThan(0);

      visibility.camera = makeOrthoCameraLookingHorizontally();
      visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld);

      expect(visibility.visibles, 'nothing is left to draw').toHaveLength(0);
    });

    test('caches the previous result when dependencies have not changed', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const tilesRef = first.tiles;

      const second = visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(second).toBe(first);
      expect(second.tiles).toBe(tilesRef);
      expect(second.createTiles).toBeUndefined();
      expect(second.removeTiles).toBeUndefined();
      expect(second.reuseTiles).toBe(tilesRef);
    });

    test('classifies tiles into create / reuse / remove across frames with different center points', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const firstIds = new Set(first.tiles.map((t) => t.id));

      // Shift the center point by one whole tile so a different tile band becomes primary.
      const second = visibility.computeVisibleTiles(first.tiles, [400, 0], tileCoords, matrixWorld)!;

      const secondIds = new Set(second.tiles.map((t) => t.id));
      const reuseIds = new Set(second.reuseTiles!.map((t) => t.id));
      const createIds = new Set(second.createTiles!.map((t) => t.id));
      const removeIds = new Set(second.removeTiles!.map((t) => t.id));

      // Every visible tile is either reused or freshly created.
      expect(reuseIds.size + createIds.size).toEqual(secondIds.size);
      for (const id of secondIds) {
        expect(reuseIds.has(id) || createIds.has(id)).toBe(true);
      }
      // reuseTiles ⊆ first frame’s tiles.
      for (const id of reuseIds) {
        expect(firstIds.has(id)).toBe(true);
      }
      // removeTiles = first frame's tiles that are no longer visible.
      for (const id of removeIds) {
        expect(firstIds.has(id)).toBe(true);
        expect(secondIds.has(id)).toBe(false);
      }
      // first frame's tiles partition cleanly into reuse ∪ remove.
      expect(reuseIds.size + removeIds.size).toEqual(firstIds.size);
      // The shift moved the view → there must actually be churn.
      expect(removeIds.size).toBeGreaterThan(0);
      expect(createIds.size).toBeGreaterThan(0);
    });

    test('lists visibles sorted by distance to the camera (ascending)', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());
      visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld);

      const distances = visibility.visibles.map((v) => v.distanceToCamera!);
      const sorted = [...distances].sort((a, b) => a - b);
      expect(distances).toEqual(sorted);
    });

    test('every visible TileBox carries a frustum/tile box and a Map2DTileCoords (helpers contract)', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());
      const result = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;

      expect(visibility.visibles.length).toEqual(result.tiles.length);
      for (const v of visibility.visibles) {
        expect(v.frustumBox, `frustumBox set on ${v.x},${v.y}`).toBeDefined();
        expect(v.box, `box set on ${v.x},${v.y}`).toBeDefined();
        expect(v.centerWorld, `centerWorld set on ${v.x},${v.y}`).toBeInstanceOf(Vector3);
        expect(v.map2dTile, `map2dTile set on ${v.x},${v.y}`).toBeDefined();
        expect(typeof v.distanceToCamera).toBe('number');
      }
      const primaries = visibility.visibles.filter((v) => v.primary === true);
      expect(primaries.length).toBeGreaterThan(0);
    });

    test('builds tile.view from the underlying tile coords (origin-aligned)', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());
      const result = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;

      const tile00 = result.tiles.find((t) => t.id === '0,0');
      expect(tile00).toBeDefined();
      expect(tile00!.view.left).toBe(0);
      expect(tile00!.view.top).toBe(0);
      expect(tile00!.view.width).toBe(100);
      expect(tile00!.view.height).toBe(100);
    });

    test('returns offset and translate vectors that reflect the map/center configuration', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());
      const offsetCoords = new Map2DTileCoordsUtil(100, 100, -50, -25);
      const result = visibility.computeVisibleTiles([], [10, 20], offsetCoords, matrixWorld)!;

      expect(result.offset).toBeDefined();
      expect(result.offset!.x).toBeCloseTo(-50 - 10);
      expect(result.offset!.y).toBeCloseTo(-25 - 20);

      expect(result.translate).toBeDefined();
      expect(result.translate!.x).toBeCloseTo(0);
      expect(result.translate!.z).toBeCloseTo(0);
    });

    test('respects matrixWorld translation in the returned translate vector', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());
      const translatedWorld = new Matrix4().makeTranslation(7, 0, 11);
      const result = visibility.computeVisibleTiles([], [0, 0], tileCoords, translatedWorld)!;
      expect(result.translate!.x).toBeCloseTo(7);
      expect(result.translate!.z).toBeCloseTo(11);
    });

    test('low-GC: subsequent non-cached calls reuse the same TileBox objects when the same tiles stay visible', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      // Warm-up frame.
      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const warmIds = first.tiles.map((t) => t.id).sort();
      const warmTileBoxes = new Map(visibility.visibles.map((v) => [v.id, v]));
      const warmFrustumBoxes = new Map<number, Box3>();
      const warmCenterWorlds = new Map<number, Vector3>();
      for (const v of visibility.visibles) {
        warmFrustumBoxes.set(v.id, v.frustumBox!);
        warmCenterWorlds.set(v.id, v.centerWorld!);
      }

      // Force a re-compute by changing matrixWorld — the gate compares by value, so it is the
      // translation of 0.0001 that breaks it, not the fresh instance — then change it back to
      // recover the same tile set.
      visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, new Matrix4().makeTranslation(0, 0, 0.0001));
      const refreshed = visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, new Matrix4())!;
      const refreshedIds = refreshed.tiles.map((t) => t.id).sort();
      expect(refreshedIds).toEqual(warmIds);

      // Same tile set ⇒ same pooled TileBox objects, same Box3 / Vector3 instances.
      for (const v of visibility.visibles) {
        expect(warmTileBoxes.get(v.id), `tile box for ${v.x},${v.y} is the pooled instance`).toBe(v);
        expect(warmFrustumBoxes.get(v.id), `frustumBox for ${v.x},${v.y} is reused`).toBe(v.frustumBox);
        expect(warmCenterWorlds.get(v.id), `centerWorld for ${v.x},${v.y} is reused`).toBe(v.centerWorld);
      }
    });

    test('drops the pooled TileBox of a tile that is no longer visited', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      // Warm-up frame around the origin.
      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const warmBoxes = new Map(visibility.visibles.map((v) => [v.id, v]));
      expect(warmBoxes.size).toBeGreaterThan(0);

      // Drive the center point tens of tile widths away, so none of the warm-up tiles is
      // visited any more — not even as a neighbour of a visible one.
      const second = visibility.computeVisibleTiles(first.tiles, [4000, 0], tileCoords, matrixWorld)!;
      const third = visibility.computeVisibleTiles(second.tiles, [8000, 0], tileCoords, matrixWorld)!;

      for (const v of visibility.visibles) {
        expect(warmBoxes.has(v.id), `tile ${v.x},${v.y} of the far frame is none of the warm-up tiles`).toBe(false);
      }

      // Back to where the warm-up frame was: the slots it used are gone, so the same tile
      // coordinates come back on fresh TileBox objects.
      visibility.computeVisibleTiles(third.tiles, [0, 0], tileCoords, matrixWorld);

      expect(
        visibility.visibles.some((v) => warmBoxes.has(v.id)),
        'the warm-up tiles are visible again',
      ).toBe(true);

      for (const v of visibility.visibles) {
        expect(v, `tile box for ${v.x},${v.y} is a fresh slot`).not.toBe(warmBoxes.get(v.id));
      }
    });

    test('says changed on the first result and on a new grid, not for a moved view', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      expect(first.changed, 'first frame').toBe(true);
      const firstViews = new Map(first.tiles.map(({id, view}) => [id, [view.left, view.top, view.width, view.height]]));

      const second = visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;
      expect(second.changed, 'second frame, nothing moved').toBe(false);

      // one tile width, so a part of the tiles stays in the view and comes back for reuse
      const third = visibility.computeVisibleTiles(second.tiles, [100, 0], tileCoords, matrixWorld)!;
      expect(third.changed, 'third frame, center moved').toBe(false);
      expect(third.reuseTiles!.length, 'tiles that stay in the view').toBeGreaterThan(0);
      for (const {id, view} of third.reuseTiles!) {
        expect([view.left, view.top, view.width, view.height], `view of the reused tile ${id}`).toEqual(firstViews.get(id));
      }

      const fourth = visibility.computeVisibleTiles(third.tiles, [100, 0], new Map2DTileCoordsUtil(50, 50), matrixWorld)!;
      expect(fourth.changed, 'fourth frame, another grid').toBe(true);
    });

    test('a changed depth invalidates the cached tile set', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const serialAfterFirst = visibility.serial;
      visibility.depth = 200;
      const second = visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(visibility.serial, 'the camera was evaluated again').toBe(serialAfterFirst + 1);
      expect(second.changed, 'the tile grid stands').toBe(false);
    });

    test('a changed lookAtCenter invalidates the cached tile set', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const serialAfterFirst = visibility.serial;
      visibility.lookAtCenter = true;
      const second = visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(visibility.serial, 'the camera was evaluated again').toBe(serialAfterFirst + 1);
      expect(second.changed, 'the tile grid stands').toBe(false);
    });

    test('a tile of another grid is removed instead of reused', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());

      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      expect(first.tiles.length).toBeGreaterThan(0);
      // the result is written again by the next call
      const firstTiles = [...first.tiles];

      // half the tile size, so the ids of the two grids overlap: `0,0` names a tile in both,
      // and it is a different piece of the map in each
      const otherGrid = new Map2DTileCoordsUtil(50, 50);
      const second = visibility.computeVisibleTiles(first.tiles, [0, 0], otherGrid, matrixWorld)!;

      expect(second.reuseTiles ?? [], 'nothing of the old grid is kept').toHaveLength(0);
      expect(ids(second.removeTiles), 'every tile of the old grid goes').toEqual(ids(firstTiles));

      const ofTheOldGrid = new Set<unknown>(firstTiles);
      for (const tile of second.tiles) {
        expect(ofTheOldGrid.has(tile), `tile ${tile.id} of the new grid is an object of its own`).toBe(false);
      }
    });
  });

  describe('the probe rays through the view frustum', () => {
    let tileCoords: Map2DTileCoordsUtil;
    let matrixWorld: Matrix4;

    beforeEach(() => {
      tileCoords = new Map2DTileCoordsUtil(100, 100);
      matrixWorld = new Matrix4();
    });

    test('reports one point per ray that met the plane, the first of them as pointOnPlane', () => {
      const visibility = new CameraBasedVisibility(makeTopDownCamera());
      visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld);

      // a camera looking straight down meets the plane with all nine of them
      expect(visibility.pointsOnPlane).toHaveLength(9);

      for (const point of visibility.pointsOnPlane) {
        expect(point.y, `${point.toArray()} lies on the plane`).toBeCloseTo(0);
      }

      // the center ray comes first, and that is the point the plane coordinates are taken from.
      // `lookAt()` nudges a camera whose up vector runs along its view direction, so the point
      // lands next to the origin instead of on it
      expect(visibility.pointsOnPlane[0]!.x).toBeCloseTo(0, 1);
      expect(visibility.pointsOnPlane[0]!.z).toBeCloseTo(0, 1);
      expect(visibility.pointOnPlane!.equals(visibility.pointsOnPlane[0]!)).toBe(true);

      // and the rays through the edges and corners reach further out than the center one
      const reach = Math.max(...visibility.pointsOnPlane.map((point) => Math.abs(point.x)));
      expect(reach).toBeGreaterThan(50);
    });

    test('finds the plane along the lower half of the frustum when the center of the view points past it', () => {
      const camera = makeCameraLookingOverThePlane();

      // the ray the visibility used to rely on runs upwards and never meets the plane
      const centerRay = new Vector3(0, 0, -1).unproject(camera).sub(camera.position);
      expect(centerRay.y, 'the center of the view points into the sky').toBeGreaterThan(0);

      const visibility = new CameraBasedVisibility(camera);
      const result = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld);

      expect(result, 'the plane is in the view, so there are tiles').toBeDefined();
      expect(result!.tiles.length).toBeGreaterThan(0);
      expect(visibility.pointsOnPlane.length).toBeGreaterThan(0);
      expect(visibility.pointOnPlane, 'and a point on the plane to go with them').not.toBeNull();

      // the rays that found it are the ones through the lower half of the frustum, in front of
      // the camera
      for (const point of visibility.pointsOnPlane) {
        expect(point.z, `${point.toArray()} lies in front of the camera`).toBeGreaterThan(0);
      }
    });

    test('finds the plane when a single corner of the frustum reaches it', () => {
      const visibility = new CameraBasedVisibility(makeCameraTouchingThePlaneWithOneCorner());
      const result = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld);

      expect(visibility.pointsOnPlane.length, 'too few rays to span an area').toBeLessThan(3);
      expect(visibility.pointsOnPlane.length).toBeGreaterThan(0);

      // fewer than three rays fill nothing in — the search runs from the tiles they met, and
      // finds the sliver of the plane that hangs into the view
      expect(result).toBeDefined();
      expect(result!.tiles.length).toBeGreaterThan(0);
      expect(ids(result!.tiles)).toEqual(expect.arrayContaining(probeTileIds(visibility, tileCoords)));
    });

    test('takes every tile a ray met into the visible set and marks it as primary', () => {
      const visibility = new CameraBasedVisibility(makeTiltedCamera());
      const mapCoords = new Map2DTileCoordsUtil(256, 256, -128, -128);
      const result = visibility.computeVisibleTiles([], [0, 0], mapCoords, matrixWorld)!;

      const probes = probeTileIds(visibility, mapCoords);
      expect(probes.length).toBeGreaterThan(2);

      const primaries = new Set(visibility.visibles.filter((tile) => tile.primary).map((tile) => `${tile.x},${tile.y}`));

      for (const id of probes) {
        expect(ids(result.tiles), `tile ${id} is visible`).toContain(id);
        expect(primaries.has(id), `tile ${id} is a primary one`).toBe(true);
      }
    });

    test('takes the primary mark off a pooled tile that no ray of the next recomputation met', () => {
      const visibility = new CameraBasedVisibility(makeTiltedCamera());
      const mapCoords = new Map2DTileCoordsUtil(256, 256, -128, -128);

      const first = visibility.computeVisibleTiles([], [0, 0], mapCoords, matrixWorld)!;
      const wasPrimary = new Set(visibility.visibles.filter((tile) => tile.primary).map((tile) => `${tile.x},${tile.y}`));
      expect(wasPrimary.size).toBeGreaterThan(0);

      // move the map by three tiles: far enough for the rays to land somewhere else entirely, and
      // near enough for the tiles they met before to stay visible on their pooled `TileBox`
      const center: [number, number] = [3 * 256, 0];
      visibility.computeVisibleTiles(first.tiles, center, mapCoords, matrixWorld);

      const probes = probeTileIds(visibility, mapCoords, center);
      const carriedOver = visibility.visibles.filter(
        (tile) => wasPrimary.has(`${tile.x},${tile.y}`) && !isNextToAProbe(tile, probes),
      );

      expect(carriedOver.length, 'tiles that were primary before and are still visible').toBeGreaterThan(0);
      for (const tile of carriedOver) {
        expect(tile.primary, `tile ${tile.x},${tile.y} no longer carries the mark`).toBe(false);
      }
    });

    test('leaves no tile marked as primary that no ray met', () => {
      const visibility = new CameraBasedVisibility(makeTiltedCamera());
      const mapCoords = new Map2DTileCoordsUtil(256, 256, -128, -128);
      visibility.computeVisibleTiles([], [0, 0], mapCoords, matrixWorld);

      const probes = probeTileIds(visibility, mapCoords);
      for (const tile of visibility.visibles) {
        if (!tile.primary) continue;
        expect(isNextToAProbe(tile, probes), `tile ${tile.x},${tile.y} is marked primary`).toBe(true);
      }
    });
  });

  describe('the tiles between three or more probe rays', () => {
    let matrixWorld: Matrix4;
    let mapCoords: Map2DTileCoordsUtil;
    let camera: PerspectiveCamera;
    let visibility: CameraBasedVisibility;
    let intersectsBox: MockInstance<Frustum['intersectsBox']>;

    /** The tiles that went into the visible set without being held against the frustum. */
    function untestedVisibles(): TileBox[] {
      const tested = new Set<Box3>(intersectsBox.mock.calls.map(([box]) => box));
      return visibility.visibles.filter((tile) => !tested.has(tile.frustumBox!));
    }

    beforeEach(() => {
      matrixWorld = new Matrix4();
      mapCoords = new Map2DTileCoordsUtil(256, 256, -128, -128);
      camera = makeTiltedCamera();
      visibility = new CameraBasedVisibility(camera);
      intersectsBox = vi.spyOn(Frustum.prototype, 'intersectsBox');
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    test('go into the visible set without being tested against the frustum', () => {
      const result = visibility.computeVisibleTiles([], [0, 0], mapCoords, matrixWorld)!;

      const untested = untestedVisibles();

      expect(untested.length, 'the rays span an area, and its tiles are taken as they are').toBeGreaterThan(0);
      expect(untested.length, 'the tiles beyond it are still tested one by one').toBeLessThan(result.tiles.length);
    });

    test('would every one of them have passed the test', () => {
      visibility.computeVisibleTiles([], [0, 0], mapCoords, matrixWorld);

      const frustum = makeFrustum(camera);

      for (const tile of untestedVisibles()) {
        expect(frustum.intersectsBox(tile.frustumBox!), `tile ${tile.x},${tile.y} is in the view frustum`).toBe(true);
      }
    });

    test('lie within the tiles the rays met', () => {
      visibility.computeVisibleTiles([], [0, 0], mapCoords, matrixWorld);

      const probes = probeTileIds(visibility, mapCoords).map((id) => id.split(',').map(Number) as [number, number]);
      const left = Math.min(...probes.map(([x]) => x));
      const right = Math.max(...probes.map(([x]) => x));
      const top = Math.min(...probes.map(([, y]) => y));
      const bottom = Math.max(...probes.map(([, y]) => y));

      for (const tile of untestedVisibles()) {
        expect(tile.x, `x of ${tile.x},${tile.y}`).toBeGreaterThanOrEqual(left);
        expect(tile.x, `x of ${tile.x},${tile.y}`).toBeLessThanOrEqual(right);
        expect(tile.y, `y of ${tile.x},${tile.y}`).toBeGreaterThanOrEqual(top);
        expect(tile.y, `y of ${tile.x},${tile.y}`).toBeLessThanOrEqual(bottom);
      }
    });
  });

  describe('the coordinate system and the depth direction of the camera', () => {
    const combinations = [
      ['WebGL', WebGLCoordinateSystem, false],
      ['WebGPU', WebGPUCoordinateSystem, false],
      ['WebGL with reversed depth', WebGLCoordinateSystem, true],
      ['WebGPU with reversed depth', WebGPUCoordinateSystem, true],
    ] as const;

    const cameras = [
      ['perspective', makeCameraWithTheFarPlaneOnTheGround],
      ['orthographic', makeOrthoCameraLookingDown],
    ] as const;

    const tileCoords = new Map2DTileCoordsUtil(100, 100);

    test.each(combinations)(
      'finds the tiles the camera sees in the WebGL coordinate system: %s',
      (_name, coordinateSystem, reversedDepth) => {
        for (const [cameraName, makeCamera] of cameras) {
          const reference = new CameraBasedVisibility(makeCamera()).computeVisibleTiles([], [0, 0], tileCoords, new Matrix4());
          const result = new CameraBasedVisibility(
            inCoordinateSystem(makeCamera(), coordinateSystem, reversedDepth),
          ).computeVisibleTiles([], [0, 0], tileCoords, new Matrix4());

          expect(ids(reference?.tiles).length, cameraName).toBeGreaterThan(0);
          expect(ids(result?.tiles), cameraName).toEqual(ids(reference?.tiles));
        }
      },
    );

    test.each(combinations)(
      'sees nothing of a plane that lies before its near plane: %s',
      (_name, coordinateSystem, reversedDepth) => {
        const visibility = new CameraBasedVisibility(
          inCoordinateSystem(makeCameraCloserToThePlaneThanItsNearPlane(), coordinateSystem, reversedDepth),
        );

        expect(visibility.computeVisibleTiles([], [0, 0], tileCoords, new Matrix4())).toBeUndefined();
        expect(visibility.pointsOnPlane).toHaveLength(0);
      },
    );
  });

  describe('frustumBoxScale', () => {
    test('defaults to 1.1', () => {
      expect(new CameraBasedVisibility().frustumBoxScale).toBeCloseTo(1.1);
    });

    test('a new value recomputes without the camera having moved', () => {
      const visibility = new CameraBasedVisibility(makeTopDownCamera());
      const tileCoords = new Map2DTileCoordsUtil(100, 100);
      const matrixWorld = new Matrix4();

      const first = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;
      const serialAfterFirst = visibility.serial;

      visibility.frustumBoxScale = 3;
      const second = visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, matrixWorld)!;

      expect(second.changed, 'the tile grid stands').toBe(false);
      expect(visibility.serial, 'the camera was evaluated again').toBe(serialAfterFirst + 1);
    });

    test('the frustum box of a tile is frustumBoxScale times the tile, around the tile', () => {
      const visibility = new CameraBasedVisibility(makeTopDownCamera());
      visibility.frustumBoxScale = 2;

      visibility.computeVisibleTiles([], [0, 0], new Map2DTileCoordsUtil(100, 100), new Matrix4());

      expect(visibility.visibles.length).toBeGreaterThan(0);
      const size = new Vector3();
      const center = new Vector3();
      const tileCenter = new Vector3();
      for (const tile of visibility.visibles) {
        const where = `tile ${tile.x},${tile.y}`;
        // tile width times two, depth (100) times two, tile height times two
        expect(tile.frustumBox!.getSize(size).toArray(), where).toEqual([200, 200, 200]);
        tile.frustumBox!.getCenter(center);
        tile.box!.getCenter(tileCenter);
        expect(Math.abs(center.x - tileCenter.x), `${where}, x`).toBeLessThan(1e-6);
        expect(Math.abs(center.z - tileCenter.z), `${where}, z`).toBeLessThan(1e-6);
      }
    });
  });

  describe('lookAtCenter', () => {
    test('defaults to false', () => {
      expect(new CameraBasedVisibility().lookAtCenter).toBe(false);
    });
  });

  describe('a map away from the origin', () => {
    // the tilted camera of `makeTiltedCamera()`, moved and turned along with the map by `matrix`
    const makeCameraFor = (matrix: Matrix4): PerspectiveCamera => {
      const camera = new PerspectiveCamera(75, 1.6, 0.1, 4000);
      camera.position.copy(new Vector3(0, 350, 500).applyMatrix4(matrix));
      camera.lookAt(new Vector3(0, 0, 0).applyMatrix4(matrix));
      camera.updateMatrixWorld();
      camera.updateProjectionMatrix();
      return camera;
    };

    const sortedTileIds = (matrix: Matrix4): string[] => {
      const visibility = new CameraBasedVisibility(makeCameraFor(matrix));
      const result = visibility.computeVisibleTiles([], [0, 0], new Map2DTileCoordsUtil(256, 256, -128, -128), matrix);
      return result!.tiles.map((tile) => tile.id).sort();
    };

    test('puts every visible tile where the map draws it', () => {
      const matrix = new Matrix4().makeTranslation(5000, 0, 0);
      const visibility = new CameraBasedVisibility(makeCameraFor(matrix));

      visibility.computeVisibleTiles([], [100, 50], new Map2DTileCoordsUtil(256, 256, -128, -128), matrix);

      expect(visibility.visibles.length).toBeGreaterThan(0);
      const center = new Vector3();
      for (const tile of visibility.visibles) {
        const local = new Vector3(tile.x * 256 + 128 - 128 - 100, 0, tile.y * 256 + 128 - 128 - 50);
        const where = `tile ${tile.x},${tile.y}`;
        expect(tile.centerWorld!.distanceTo(local.clone().applyMatrix4(matrix)), where).toBeLessThan(1e-6);
        expect(tile.box!.getCenter(center).distanceTo(local), where).toBeLessThan(1e-6);
        expect(tile.frustumBox!.containsPoint(tile.centerWorld!), where).toBe(true);
      }
    });

    test('finds the same tiles for a map and a camera moved together', () => {
      expect(sortedTileIds(new Matrix4().makeTranslation(5000, 0, 0))).toEqual(sortedTileIds(new Matrix4()));
    });

    test('finds the same tiles for a map and a camera moved and turned together', () => {
      // a quarter turn about Y, because the world AABB of a box turned that way is exact — at
      // any other angle it grows, and the frustum test lets more tiles through at the edge
      const matrix = new Matrix4().makeTranslation(5000, 0, 300).multiply(new Matrix4().makeRotationY(Math.PI / 2));
      expect(sortedTileIds(matrix)).toEqual(sortedTileIds(new Matrix4()));
    });
  });

  describe('IMap2DVisibilitor interface', () => {
    test('is implemented (computeVisibleTiles function exposed)', () => {
      const visibility = new CameraBasedVisibility();
      const fn: (...args: Parameters<CameraBasedVisibility['computeVisibleTiles']>) => IMap2DVisibleTiles | undefined =
        visibility.computeVisibleTiles.bind(visibility);
      expect(typeof fn).toBe('function');
    });
  });
});

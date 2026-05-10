import type {Box3} from 'three/webgpu';
import {Matrix4, OrthographicCamera, PerspectiveCamera, Vector3} from 'three/webgpu';
import {beforeEach, describe, expect, test} from 'vitest';
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
      expect(tileIds).toContain('y0x0');
    });

    test('returns undefined on a fresh instance when the camera direction is parallel to the plane and there are no previousTiles', () => {
      visibility = new CameraBasedVisibility(makeOrthoCameraLookingHorizontally());
      const result = visibility.computeVisibleTiles([], [0, 0], tileCoords, new Matrix4());
      expect(result).toBeUndefined();
    });

    test('returns tiles=[] and removeTiles=previousTiles when the camera direction is parallel to the plane and previousTiles is populated', () => {
      // Seed a previousTiles list with a separate visibility instance that does see the plane.
      const seeder = new CameraBasedVisibility(makeTopDownCamera());
      const seed = seeder.computeVisibleTiles([], [0, 0], new Map2DTileCoordsUtil(100, 100), new Matrix4())!;
      const previous = seed.tiles;
      expect(previous.length).toBeGreaterThan(0);

      visibility = new CameraBasedVisibility(makeOrthoCameraLookingHorizontally());
      const result = visibility.computeVisibleTiles(previous, [0, 0], tileCoords, new Matrix4());
      expect(result).toBeDefined();
      expect(result!.tiles).toEqual([]);
      expect(result!.removeTiles).toBe(previous);
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
        expect(v.frustumBox, `frustumBox set on ${v.id}`).toBeDefined();
        expect(v.box, `box set on ${v.id}`).toBeDefined();
        expect(v.centerWorld, `centerWorld set on ${v.id}`).toBeInstanceOf(Vector3);
        expect(v.map2dTile, `map2dTile set on ${v.id}`).toBeDefined();
        expect(typeof v.distanceToCamera).toBe('number');
      }
      const primaries = visibility.visibles.filter((v) => v.primary === true);
      expect(primaries.length).toBeGreaterThan(0);
    });

    test('builds tile.view from the underlying tile coords (origin-aligned)', () => {
      visibility = new CameraBasedVisibility(makeTopDownCamera());
      const result = visibility.computeVisibleTiles([], [0, 0], tileCoords, matrixWorld)!;

      const tile00 = result.tiles.find((t) => t.id === 'y0x0');
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
      const warmFrustumBoxes = new Map<string, Box3>();
      const warmCenterWorlds = new Map<string, Vector3>();
      for (const v of visibility.visibles) {
        warmFrustumBoxes.set(v.id, v.frustumBox!);
        warmCenterWorlds.set(v.id, v.centerWorld!);
      }

      // Force a re-compute by changing matrixWorld (translate by 0 still bumps the equality
      // gate via a fresh Matrix4 instance), then change it back to recover the same tile set.
      visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, new Matrix4().makeTranslation(0, 0, 0.0001));
      const refreshed = visibility.computeVisibleTiles(first.tiles, [0, 0], tileCoords, new Matrix4())!;
      const refreshedIds = refreshed.tiles.map((t) => t.id).sort();
      expect(refreshedIds).toEqual(warmIds);

      // Same tile set ⇒ same pooled TileBox objects, same Box3 / Vector3 instances.
      for (const v of visibility.visibles) {
        expect(warmTileBoxes.get(v.id), `tile box for ${v.id} is the pooled instance`).toBe(v);
        expect(warmFrustumBoxes.get(v.id), `frustumBox for ${v.id} is reused`).toBe(v.frustumBox);
        expect(warmCenterWorlds.get(v.id), `centerWorld for ${v.id} is reused`).toBe(v.centerWorld);
      }
    });
  });

  describe('frustumBoxScale', () => {
    test('defaults to 1.1', () => {
      expect(new CameraBasedVisibility().frustumBoxScale).toBeCloseTo(1.1);
    });
  });

  describe('IMap2DVisibilitor interface', () => {
    test('is implemented (computeVisibleTiles function exposed)', () => {
      const visibility = new CameraBasedVisibility();
      const fn: (
        ...args: Parameters<CameraBasedVisibility['computeVisibleTiles']>
      ) => IMap2DVisibleTiles | undefined = visibility.computeVisibleTiles.bind(visibility);
      expect(typeof fn).toBe('function');
    });
  });
});

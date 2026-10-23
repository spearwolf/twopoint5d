import {Matrix4, Object3D, PerspectiveCamera, Scene, Vector3} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import {AABB2} from './AABB2.js';
import {CameraBasedVisibility} from './CameraBasedVisibility.js';
import {CameraBasedVisibilityHelpers} from './CameraBasedVisibilityHelpers.js';
import {Map2D} from './Map2D.js';
import {Map2DTileCoords} from './Map2DTileCoords.js';
import {Map2DSpatialHashGrid} from './Map2DSpatialHashGrid.js';
import {Map2DTileCoordsUtil, type TilesWithinCoords} from './Map2DTileCoordsUtil.js';
import {Map2DTileRenderer} from './Map2DTileRenderer.js';
import {Map2DTileStreamer} from './Map2DTileStreamer.js';
import {RectangularVisibilityArea} from './RectangularVisibilityArea.js';
import type {IMap2DTileCoords, IMap2DVisibilitor, IMapTileFactory} from './types.js';

// a call that allocates anything costs 16 B at least; for rounds of a thousand calls. When this
// limit was set, a call that finds nothing changed measured 0.01 B and the grid queries with a
// target 0.01 B, and an `update()` of `Map2D` under a standing camera 0.01 B
const BYTES_PER_CALL_LIMIT = 1;

// half the smallest heap object (16 B): a single allocation per recomputation shows, while the
// noise of a round spreads over its forty recomputations. When this limit was set, a recomputation
// over the same tiles measured 0.31 to 0.51 B in `CameraBasedVisibility` and 0.31 B under a tilted
// camera, 0.31 B in `RectangularVisibilityArea`, and an `update()` of `Map2D` under a moving camera
// 0.31 B
const BYTES_PER_RECOMPUTATION_LIMIT = 8;

// what a tile that enters the view may cost beyond its Map2DTileCoords. When this margin was set,
// such a tile measured 230.10 B beside 230.11 to 230.17 B for the Map2DTileCoords alone in
// `CameraBasedVisibility`, and 226.78 B beside 226.78 B in `RectangularVisibilityArea`
const BYTES_PER_TILE_MARGIN = 8;

// Forty recomputations a round keep a test short. The allocation specs run without coverage, in
// the Vitest project `allocations`: under V8 coverage a test here took up to six seconds on a CI
// runner.
const CALLS_PER_ROUND = 1000;
const RECOMPUTATIONS_PER_ROUND = 40;

// fractional throughout, so that doubles run through every signature on the way
const makeGrid = () => new Map2DTileCoordsUtil(100, 100, 0.25, -0.5);
const makeCenter = (): [number, number] => [3.25, -1.5];
const makeMatrixWorld = () => new Matrix4().makeTranslation(0.25, 0, 0.75);
// the second position: a change the gate sees, and the same tiles
const makeOtherMatrixWorld = () => new Matrix4().makeTranslation(0.25, 0, 0.7501);

// turned through `rotation`: `lookAt()` along the up vector of the camera tips it by about 1e-4 rad
function makeTopDownCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(90, 1, 0.1, 500);
  camera.position.set(0, 100, 0);
  camera.rotation.set(-Math.PI / 2, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

// the camera of `hot-path-allocations.tilted-view.spec.ts`: the probe rays span a hull with
// slanted edges, where a top-down view spans a rectangle
function makeTiltedCamera(): PerspectiveCamera {
  const camera = new PerspectiveCamera(75, 1.6, 0.1, 4000);
  camera.position.set(0, 350, 500);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return camera;
}

// 304 tiles under the tilted camera, and a hull of the probe rays over three rows, the middle one
// crossed by its slanted edges between two tile coordinates. On tiles of 400 the hull spans two
// rows, each through two of its corners, and every crossing is a whole number
const makeTiltedViewGrid = () => new Map2DTileCoordsUtil(300, 300, 0.25, -0.5);

const sortedIds = (tiles: readonly IMap2DTileCoords[]): string[] => tiles.map((tile) => tile.id).sort();

/**
 * Pans the view by one tile width per recomputation and answers the bytes one tile that enters
 * the view costs, beside the bytes of a `Map2DTileCoords` built on its own the way a visibility
 * builds one — one new column per step, over the rows the pan brings in, the column running
 * through the same numbers as the pan so the ids are the same length.
 */
async function measurePan(
  visibility: IMap2DVisibilitor,
  grid: Map2DTileCoordsUtil,
  matrixWorld: Matrix4,
): Promise<{bytesPerTile: number; bytesPerShell: number; createdPerRecomputation: number}> {
  const center = makeCenter();
  let previous = visibility.computeVisibleTiles([], center, grid, matrixWorld)!.tiles;

  center[0] += grid.tileWidth;
  const first = visibility.computeVisibleTiles(previous, center, grid, matrixWorld)!;
  previous = first.tiles;
  const rows = first.createTiles!.map((tile) => tile.y);
  const firstColumn = first.createTiles![0]!.x;

  // Smis only, so that keeping track allocates nothing inside the round
  let fewestCreated = Infinity;
  let mostCreated = 0;
  const bytesPerRound = await measureSettledBytes(() => {
    for (let i = 0; i < RECOMPUTATIONS_PER_ROUND; i++) {
      center[0] += grid.tileWidth;
      const result = visibility.computeVisibleTiles(previous, center, grid, matrixWorld)!;
      previous = result.tiles;
      const created = result.createTiles!.length;
      if (created < fewestCreated) fewestCreated = created;
      if (created > mostCreated) mostCreated = created;
    }
  });

  expect(fewestCreated, 'the same number of tiles enters the view on every step').toBe(mostCreated);
  expect(mostCreated, 'tiles enter the view').toBeGreaterThan(0);

  // kept in a list, so that the compiler cannot prove the shell dead and leave it out
  const shells: IMap2DTileCoords[] = rows.map((y) => new Map2DTileCoords(firstColumn, y, new AABB2()));
  let column = firstColumn;
  const shellBytesPerRound = await measureSettledBytes(() => {
    for (let i = 0; i < RECOMPUTATIONS_PER_ROUND; i++) {
      column += 1;
      for (let r = 0; r < rows.length; r++) {
        shells[r] = new Map2DTileCoords(column, rows[r]!, new AABB2());
      }
    }
  });

  const tilesPerRound = RECOMPUTATIONS_PER_ROUND * mostCreated;
  return {
    bytesPerTile: bytesPerRound / tilesPerRound,
    bytesPerShell: shellBytesPerRound / (RECOMPUTATIONS_PER_ROUND * rows.length),
    createdPerRecomputation: mostCreated,
  };
}

describe('CameraBasedVisibility on the hot path', () => {
  test('a call that finds nothing changed allocates nothing', async () => {
    const visibility = new CameraBasedVisibility(makeTopDownCamera());
    const grid = makeGrid();
    const center = makeCenter();
    const matrixWorld = makeMatrixWorld();
    let previous = visibility.computeVisibleTiles([], center, grid, matrixWorld)!.tiles;

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS_PER_ROUND; i++) {
        previous = visibility.computeVisibleTiles(previous, center, grid, matrixWorld)!.tiles;
      }
    });
    const bytesPerCall = bytesPerRound / CALLS_PER_ROUND;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('a recomputation over the same tiles allocates nothing', async () => {
    const visibility = new CameraBasedVisibility(makeTopDownCamera());
    const grid = makeGrid();
    const center = makeCenter();
    const matrixWorlds = [makeMatrixWorld(), makeOtherMatrixWorld()] as const;

    let previous = visibility.computeVisibleTiles([], center, grid, matrixWorlds[0])!.tiles;
    const idsAtFirst = sortedIds(previous);
    previous = visibility.computeVisibleTiles(previous, center, grid, matrixWorlds[1])!.tiles;
    expect(sortedIds(previous), 'both positions see the same tiles').toEqual(idsAtFirst);

    const serialBefore = visibility.serial;
    let flip = 0;
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < RECOMPUTATIONS_PER_ROUND; i++) {
        flip ^= 1;
        previous = visibility.computeVisibleTiles(previous, center, grid, matrixWorlds[flip]!)!.tiles;
      }
    });
    const bytesPerRecomputation = bytesPerRound / RECOMPUTATIONS_PER_ROUND;

    expect(visibility.serial - serialBefore, 'every call recomputed').toBeGreaterThan(RECOMPUTATIONS_PER_ROUND);
    expect(bytesPerRecomputation, `${bytesPerRecomputation.toFixed(2)} bytes per recomputation`).toBeLessThan(
      BYTES_PER_RECOMPUTATION_LIMIT,
    );
  });

  // Six probe rays meet the plane under this camera — the middle, the middle of the bottom, left and
  // right edge, and the two lower corners —, the three upper ones aim above the horizon. The points
  // left and right of the middle lie further out and further apart than the lower corners, so the
  // hull is a trapezoid with slanted edges.
  test('a recomputation over the same tiles under a tilted camera allocates nothing', async () => {
    const visibility = new CameraBasedVisibility(makeTiltedCamera());
    const grid = makeTiltedViewGrid();
    const center = makeCenter();
    const matrixWorlds = [makeMatrixWorld(), makeOtherMatrixWorld()] as const;

    let previous = visibility.computeVisibleTiles([], center, grid, matrixWorlds[0])!.tiles;
    const idsAtFirst = sortedIds(previous);
    previous = visibility.computeVisibleTiles(previous, center, grid, matrixWorlds[1])!.tiles;
    expect(sortedIds(previous), 'both positions see the same tiles').toEqual(idsAtFirst);
    expect(visibility.visibles.length, 'a view of some hundred tiles').toBeGreaterThan(150);
    expect(visibility.pointsOnPlane.length, 'the probe rays span a hull').toBeGreaterThanOrEqual(3);

    const serialBefore = visibility.serial;
    let flip = 0;
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < RECOMPUTATIONS_PER_ROUND; i++) {
        flip ^= 1;
        previous = visibility.computeVisibleTiles(previous, center, grid, matrixWorlds[flip]!)!.tiles;
      }
    });
    const bytesPerRecomputation = bytesPerRound / RECOMPUTATIONS_PER_ROUND;

    expect(visibility.serial - serialBefore, 'every call recomputed').toBeGreaterThan(RECOMPUTATIONS_PER_ROUND);
    expect(
      bytesPerRecomputation,
      `${bytesPerRecomputation.toFixed(2)} bytes per recomputation of ${visibility.visibles.length} tiles`,
    ).toBeLessThan(BYTES_PER_RECOMPUTATION_LIMIT);
  });

  test('a tile that enters the view costs its Map2DTileCoords and nothing else', async () => {
    const visibility = new CameraBasedVisibility(makeTopDownCamera());

    const {bytesPerTile, bytesPerShell, createdPerRecomputation} = await measurePan(visibility, makeGrid(), makeMatrixWorld());

    expect(
      bytesPerTile - bytesPerShell,
      `${bytesPerTile.toFixed(2)} bytes per tile entering the view (${createdPerRecomputation} per recomputation), ${bytesPerShell.toFixed(2)} per Map2DTileCoords`,
    ).toBeLessThan(BYTES_PER_TILE_MARGIN);
  });
});

describe('Map2D on the hot path', () => {
  // a factory that allocates nothing of its own: a tile is a Smi
  const makeTileFactory = (): IMapTileFactory<number> => {
    let next = 0;
    return {
      addToNode() {},
      removeFromNode() {},
      createTile: () => next++,
      updateTile() {},
      destroyTile() {},
      update() {},
    };
  };

  const makeMap = () => {
    const camera = makeTiltedCamera();
    const visibility = new CameraBasedVisibility(camera);
    const factory = makeTileFactory();
    const map2d = new Map2D(new Map2DTileStreamer(400, 400, 0.25, -0.5));
    map2d.visibilitor = visibility;
    map2d.addTileRenderer(new Map2DTileRenderer(factory));
    // lays the tiles out
    map2d.update();
    return {camera, visibility, factory, map2d};
  };

  // after the measurement, so that the spies cost the measured rounds nothing
  const expectFactoryLeftAlone = (factory: IMapTileFactory<number>, round: () => void): void => {
    const spies = [vi.spyOn(factory, 'createTile'), vi.spyOn(factory, 'updateTile'), vi.spyOn(factory, 'update')];
    round();
    for (const spy of spies) expect(spy, 'the factory in a round').not.toHaveBeenCalled();
  };

  test('an update() under a standing camera allocates nothing', async () => {
    const {visibility, factory, map2d} = makeMap();
    const serialBefore = visibility.serial;

    const round = () => {
      for (let i = 0; i < CALLS_PER_ROUND; i++) map2d.update();
    };
    const bytesPerRound = await measureSettledBytes(round);
    const bytesPerCall = bytesPerRound / CALLS_PER_ROUND;

    expect(visibility.serial, 'every call took the cached result').toBe(serialBefore);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    expectFactoryLeftAlone(factory, round);
  });

  test('an update() over the same tiles under a moving camera allocates nothing', async () => {
    const {camera, visibility, factory, map2d} = makeMap();
    // a step the gate sees, built before the round: the round hands over objects, no double it works out
    const positions = [new Vector3(0, 350, 500), new Vector3(0, 350, 501)] as const;

    const idsAtFirst = sortedIds(map2d.tileStreamer.tiles);
    camera.position.copy(positions[1]);
    map2d.update();
    expect(sortedIds(map2d.tileStreamer.tiles), 'both positions see the same tiles').toEqual(idsAtFirst);

    const serialBefore = visibility.serial;
    let flip = 1;
    const round = () => {
      for (let i = 0; i < RECOMPUTATIONS_PER_ROUND; i++) {
        flip ^= 1;
        camera.position.copy(positions[flip]!);
        map2d.update();
      }
    };
    const bytesPerRound = await measureSettledBytes(round);
    const bytesPerRecomputation = bytesPerRound / RECOMPUTATIONS_PER_ROUND;

    expect(visibility.serial - serialBefore, 'every call recomputed').toBeGreaterThan(RECOMPUTATIONS_PER_ROUND);
    expect(
      bytesPerRecomputation,
      `${bytesPerRecomputation.toFixed(2)} bytes per update() of ${map2d.tileStreamer.tiles.length} tiles`,
    ).toBeLessThan(BYTES_PER_RECOMPUTATION_LIMIT);
    expectFactoryLeftAlone(factory, round);
  });

  test('writing the view center of a map allocates nothing', async () => {
    const {map2d} = makeMap();

    // whole numbers from the counter: the round hands the setters no fractional value it works out
    // itself (see the rule on allocation rounds in AGENTS.md)
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS_PER_ROUND; i++) {
        map2d.centerX = i & 1023;
        map2d.centerY = i & 511;
      }
    });
    const bytesPerCall = bytesPerRound / (2 * CALLS_PER_ROUND);

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });
});

describe('RectangularVisibilityArea on the hot path', () => {
  const makeArea = () => new RectangularVisibilityArea(1000.5, 800.25);

  test('a call that finds nothing changed allocates nothing', async () => {
    const area = makeArea();
    const grid = makeGrid();
    const center = makeCenter();
    const matrixWorld = makeMatrixWorld();
    let previous = area.computeVisibleTiles([], center, grid, matrixWorld)!.tiles;

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS_PER_ROUND; i++) {
        previous = area.computeVisibleTiles(previous, center, grid, matrixWorld)!.tiles;
      }
    });
    const bytesPerCall = bytesPerRound / CALLS_PER_ROUND;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('a recomputation over the same tiles allocates nothing', async () => {
    const area = makeArea();
    const grid = makeGrid();
    const center = makeCenter();
    const matrixWorld = makeMatrixWorld();
    let previous = area.computeVisibleTiles([], center, grid, matrixWorld)!.tiles;

    let created = 0;
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < RECOMPUTATIONS_PER_ROUND; i++) {
        area.needsUpdate = true;
        const result = area.computeVisibleTiles(previous, center, grid, matrixWorld)!;
        previous = result.tiles;
        created += result.createTiles!.length;
      }
    });
    const bytesPerRecomputation = bytesPerRound / RECOMPUTATIONS_PER_ROUND;

    expect(created, 'the same tiles stay in the view').toBe(0);
    expect(bytesPerRecomputation, `${bytesPerRecomputation.toFixed(2)} bytes per recomputation`).toBeLessThan(
      BYTES_PER_RECOMPUTATION_LIMIT,
    );
  });

  test('a tile that enters the view costs its Map2DTileCoords and nothing else', async () => {
    const {bytesPerTile, bytesPerShell, createdPerRecomputation} = await measurePan(makeArea(), makeGrid(), makeMatrixWorld());

    expect(
      bytesPerTile - bytesPerShell,
      `${bytesPerTile.toFixed(2)} bytes per tile entering the view (${createdPerRecomputation} per recomputation), ${bytesPerShell.toFixed(2)} per Map2DTileCoords`,
    ).toBeLessThan(BYTES_PER_TILE_MARGIN);
  });
});

describe('Map2DTileCoordsUtil on the hot path', () => {
  test('getTileCoords() and computeTilesWithinCoords() with a target allocate nothing', async () => {
    const grid = makeGrid();
    const tileCoords: [number, number, number, number] = [0, 0, 0, 0];
    const tilesWithin: TilesWithinCoords = grid.computeTilesWithinCoords(0, 0, 1, 1);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS_PER_ROUND; i++) {
        grid.getTileCoords(12.25, -7.5, 100.5, 50.25, tileCoords);
        grid.computeTilesWithinCoords(-37.75, 12.5, 250.5, 80.25, tilesWithin);
      }
    });
    const bytesPerCall = bytesPerRound / (2 * CALLS_PER_ROUND);

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });
});

describe('Map2DSpatialHashGrid on the hot path', () => {
  test('getTile() allocates nothing', async () => {
    const grid = new Map2DSpatialHashGrid<{aabb: AABB2}>(16, 16);
    // 200 boxes of 20 × 20 spread over 512 × 512, at fractional places
    for (let i = 0; i < 200; i++) {
      grid.add({aabb: new AABB2((i * 97.25) % 492, (i * 53.5) % 492, 20, 20)});
    }

    // a Smi, so that keeping count allocates nothing inside the round
    let hits = 0;
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS_PER_ROUND; i++) {
        // runs through the 32 × 32 cells of the area
        if (grid.getTile(i & 31, (i >> 5) & 31) !== undefined) hits++;
      }
    });
    const bytesPerCall = bytesPerRound / CALLS_PER_ROUND;

    expect(hits, 'cells that hold a box').toBeGreaterThan(0);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('findWithin() with an out array allocates nothing', async () => {
    const grid = new Map2DSpatialHashGrid<{aabb: AABB2}>(16, 16);
    // 200 boxes of 20 × 20 spread over 512 × 512, at fractional places
    for (let i = 0; i < 200; i++) {
      grid.add({aabb: new AABB2((i * 97.25) % 492, (i * 53.5) % 492, 20, 20)});
    }
    const query = new AABB2();
    const out: {aabb: AABB2}[] = [];

    // a Smi, so that keeping count allocates nothing inside the round
    let hits = 0;
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS_PER_ROUND; i++) {
        // 64 × 64 queries on an 8 × 8 raster over the area, whole numbers only
        query.set((i & 7) * 48, ((i >> 3) & 7) * 48, 64, 64);
        hits += grid.findWithin(query, out).length;
      }
    });
    const bytesPerCall = bytesPerRound / CALLS_PER_ROUND;

    expect(hits, 'renderables found').toBeGreaterThan(0);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('findWithin() with an out array over more cells than the grid holds allocates nothing', async () => {
    const grid = new Map2DSpatialHashGrid<{aabb: AABB2}>(16, 16);
    // 200 boxes of 20 × 20 spread over 512 × 512, at fractional places
    for (let i = 0; i < 200; i++) {
      grid.add({aabb: new AABB2((i * 97.25) % 492, (i * 53.5) % 492, 20, 20)});
    }
    // 512 × 512 cells, more than the boxes lie in
    const query = new AABB2().set(-4096, -4096, 8192, 8192);
    const out: {aabb: AABB2}[] = [];

    // a Smi, so that keeping count allocates nothing inside the round
    let hits = 0;
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS_PER_ROUND; i++) {
        hits += grid.findWithin(query, out).length;
      }
    });
    const bytesPerCall = bytesPerRound / CALLS_PER_ROUND;

    expect(hits, 'renderables found').toBeGreaterThan(0);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });
});

describe('CameraBasedVisibilityHelpers on the hot path', () => {
  // the helpers of a top-down view, shown in a scene and built once
  const makeHelpers = (): {helpers: CameraBasedVisibilityHelpers; visibility: CameraBasedVisibility} => {
    const visibility = new CameraBasedVisibility(makeTopDownCamera());
    visibility.computeVisibleTiles([], makeCenter(), makeGrid(), makeMatrixWorld());

    const scene = new Scene();
    const node = new Object3D();
    scene.add(node);
    const helpers = new CameraBasedVisibilityHelpers(visibility);
    helpers.add(node);
    helpers.show = true;
    helpers.update();
    return {helpers, visibility};
  };

  test('an update() that finds nothing to rebuild allocates nothing', async () => {
    const {helpers} = makeHelpers();

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS_PER_ROUND; i++) helpers.update();
    });
    const bytesPerCall = bytesPerRound / CALLS_PER_ROUND;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('a rebuild allocates nothing once its nodes are built', async () => {
    const {helpers, visibility} = makeHelpers();

    // a new maxDebugHelpers rebuilds the set without a recomputation of the visibility; 8 and 9
    // both stay within the nodes the first build left in the pools
    let flip = 0;
    const round = () => {
      for (let i = 0; i < RECOMPUTATIONS_PER_ROUND; i++) {
        flip ^= 1;
        helpers.maxDebugHelpers = 8 + flip;
        helpers.update();
      }
    };
    const bytesPerRound = await measureSettledBytes(round);
    const bytesPerRebuild = bytesPerRound / RECOMPUTATIONS_PER_ROUND;

    expect(
      bytesPerRebuild,
      `${bytesPerRebuild.toFixed(2)} bytes per rebuild of ${visibility.visibles.length} tiles`,
    ).toBeLessThan(BYTES_PER_RECOMPUTATION_LIMIT);

    // after the measurement, so that the spy costs the measured rounds nothing: every update() of
    // a round rebuilds, and the bytes above are the bytes of a rebuild. A rebuild reads the
    // visible tiles of the visibility once, and an update() reads them nowhere else
    const readVisibles = vi.spyOn(visibility, 'visibles', 'get');
    round();
    expect(readVisibles, 'rebuilds in a round').toHaveBeenCalledTimes(RECOMPUTATIONS_PER_ROUND);
  });
});

import {describe, expect, test} from 'vitest';
import {convexTileHull, forEachTileWithinConvexHull, type TilePoint} from './convexTileHull.js';

/** The tiles the hull takes in, as `x,y`, sorted — the order of the walk is none of our business. */
function tilesWithin(points: readonly TilePoint[]): string[] {
  const found: string[] = [];
  forEachTileWithinConvexHull(convexTileHull(points), (x, y) => found.push(`${x},${y}`));
  return found.sort();
}

/** The hull as `x,y`, sorted: the outline is one cycle and may start anywhere on it. */
function hullOf(points: readonly TilePoint[]): string[] {
  return convexTileHull(points)
    .map(([x, y]) => `${x},${y}`)
    .sort();
}

describe('convexTileHull()', () => {
  test('an empty input has an empty hull', () => {
    expect(convexTileHull([])).toEqual([]);
  });

  test('a single point is its own hull', () => {
    expect(convexTileHull([[3, 4]])).toEqual([[3, 4]]);
  });

  test('points that are all the same tile fall together into one', () => {
    expect(
      convexTileHull([
        [3, 4],
        [3, 4],
        [3, 4],
      ]),
    ).toEqual([[3, 4]]);
  });

  test('points on one line come back as the two ends of it', () => {
    expect(
      hullOf([
        [0, 0],
        [1, 1],
        [2, 2],
        [4, 4],
      ]),
    ).toEqual(['0,0', '4,4']);
  });

  test('a triangle keeps its three corners', () => {
    expect(
      hullOf([
        [0, 0],
        [4, 0],
        [0, 4],
      ]),
    ).toEqual(['0,0', '0,4', '4,0']);
  });

  test('a point inside the hull is dropped', () => {
    expect(
      hullOf([
        [0, 0],
        [4, 0],
        [4, 4],
        [0, 4],
        [2, 2],
        [1, 3],
      ]),
    ).toEqual(['0,0', '0,4', '4,0', '4,4']);
  });

  test('a point on the straight run between two corners is dropped', () => {
    expect(
      hullOf([
        [0, 0],
        [2, 0],
        [4, 0],
        [0, 4],
      ]),
    ).toEqual(['0,0', '0,4', '4,0']);
  });

  test('negative tile coordinates are hull points like any other', () => {
    expect(
      hullOf([
        [-4, -4],
        [4, -4],
        [4, 4],
        [-4, 4],
        [0, 0],
      ]),
    ).toEqual(['-4,-4', '-4,4', '4,-4', '4,4']);
  });
});

describe('forEachTileWithinConvexHull()', () => {
  test('an empty hull takes in nothing', () => {
    expect(tilesWithin([])).toEqual([]);
  });

  test('a single point takes in itself', () => {
    expect(tilesWithin([[2, -3]])).toEqual(['2,-3']);
  });

  test('a line takes in the tiles along it', () => {
    expect(
      tilesWithin([
        [0, 0],
        [0, 3],
      ]),
    ).toEqual(['0,0', '0,1', '0,2', '0,3']);
  });

  test('a diagonal line takes in the tiles it passes through', () => {
    expect(
      tilesWithin([
        [0, 0],
        [3, 3],
      ]),
    ).toEqual(['0,0', '1,1', '2,2', '3,3']);
  });

  test('a rectangle takes in every tile it covers, corners and edges included', () => {
    const within = tilesWithin([
      [0, 0],
      [2, 0],
      [2, 2],
      [0, 2],
    ]);

    expect(within).toHaveLength(9);
    expect(within).toEqual(['0,0', '0,1', '0,2', '1,0', '1,1', '1,2', '2,0', '2,1', '2,2']);
  });

  test('a right triangle takes in the tiles below its hypotenuse', () => {
    // (0,0) (3,0) (0,3): row y takes in x = 0 … 3 - y
    expect(
      tilesWithin([
        [0, 0],
        [3, 0],
        [0, 3],
      ]),
    ).toEqual(['0,0', '0,1', '0,2', '0,3', '1,0', '1,1', '1,2', '2,0', '2,1', '3,0'].sort());
  });

  test('a hull whose edges do not meet the grid takes in the whole tiles only', () => {
    // the row y = 1 is cut between x = 0.5 and x = 2.5, which is the tiles 1 and 2
    expect(
      tilesWithin([
        [0, 0],
        [3, 0],
        [1, 2],
      ]),
    ).toEqual(['0,0', '1,0', '1,1', '1,2', '2,0', '2,1', '3,0'].sort());
  });

  test('every tile it takes in lies within the hull', () => {
    const points: TilePoint[] = [
      [-3, -2],
      [5, -4],
      [7, 6],
      [-1, 8],
      [2, 2],
    ];

    const hull = convexTileHull(points);
    const within = new Set(tilesWithin(points));

    // the points that carry the hull are in
    for (const [x, y] of hull) {
      expect(within.has(`${x},${y}`), `hull point ${x},${y}`).toBe(true);
    }

    // and nothing outside the bounding box of the hull is
    for (const key of within) {
      const [x, y] = key.split(',').map(Number) as [number, number];
      expect(x, `x of ${key}`).toBeGreaterThanOrEqual(-3);
      expect(x, `x of ${key}`).toBeLessThanOrEqual(7);
      expect(y, `y of ${key}`).toBeGreaterThanOrEqual(-4);
      expect(y, `y of ${key}`).toBeLessThanOrEqual(8);
    }

    // a tile the hull cannot reach stays out
    expect(within.has('7,-4'), 'the corner of the bounding box the hull cuts off').toBe(false);
  });

  test('takes each tile in exactly once', () => {
    const found: string[] = [];
    forEachTileWithinConvexHull(
      convexTileHull([
        [0, 0],
        [6, 1],
        [3, 5],
        [-2, 3],
      ]),
      (x, y) => found.push(`${x},${y}`),
    );

    expect(new Set(found).size).toEqual(found.length);
  });
});

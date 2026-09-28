import {truncateArray} from '../utils/truncateArray.js';

/**
 * A point on the tile grid: `[x, y]` in _tile space_, therefore integers.
 */
export type TilePoint = readonly [x: number, y: number];

const cross = (o: TilePoint, a: TilePoint, b: TilePoint): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

const isBefore = (a: TilePoint, b: TilePoint): boolean => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

// the working list of `convexTileHull()`: the input points by x, then y, without duplicates —
// emptied again before the call returns, so the module holds no point of a caller
const sorted: TilePoint[] = [];

/**
 * The convex hull of a set of tile coordinates, as the points that carry it, in order along
 * the outline. Andrew's monotone chain, meant for a handful of points: the sort it starts with
 * is an insertion sort, which on a handful of points costs less than `Array#sort()` and
 * allocates nothing.
 *
 * Duplicates and points that lie on the straight run between two others are dropped, so the
 * result carries corners only. That leaves three degenerate shapes, and each comes back as
 * what it is rather than as an error: no point at all gives an empty hull, points that are all
 * the same tile give that one point, and points that all lie on one line give the two ends of
 * that line.
 *
 * @param target - emptied, filled with the hull and returned; it must not be `points`. Without
 * one, the hull is a new list.
 */
export function convexTileHull(points: readonly TilePoint[], target: TilePoint[] = []): TilePoint[] {
  truncateArray(target);

  for (let i = 0; i < points.length; ++i) {
    // The loop bound is `points.length`.
    const point = points[i]!;
    sorted.push(point);
    let j = sorted.length - 1;
    // an equal point stays behind the one before it, so the sort is stable
    while (j > 0 && isBefore(point, sorted[j - 1]!)) {
      sorted[j] = sorted[j - 1]!;
      --j;
    }
    sorted[j] = point;
  }

  let unique = 0;
  for (let i = 0; i < sorted.length; ++i) {
    // The loop bound is `sorted.length`, and `unique` never runs ahead of `i`.
    const point = sorted[i]!;
    const last = unique > 0 ? sorted[unique - 1]! : undefined;
    if (last === undefined || last[0] !== point[0] || last[1] !== point[1]) {
      sorted[unique++] = point;
    }
  }
  truncateArray(sorted, unique);

  if (unique < 3) {
    for (let i = 0; i < unique; ++i) target.push(sorted[i]!);
    truncateArray(sorted);
    return target;
  }

  // both chains go into `target`, one after the other: the lower one from the leftmost point to
  // the rightmost, then the upper one back, starting on the last point of the lower chain and
  // never popping below it
  let k = 0;
  for (let i = 0; i < unique; ++i) {
    // The loop bound is `unique`; `target` holds `k` entries, and `k >= 2` guards both reads.
    const point = sorted[i]!;
    while (k >= 2 && cross(target[k - 2]!, target[k - 1]!, point) <= 0) --k;
    target[k++] = point;
  }
  const lowerEnd = k + 1;
  for (let i = unique - 2; i >= 0; --i) {
    // The loop runs down from `unique - 2`; `k >= lowerEnd` guards both reads.
    const point = sorted[i]!;
    while (k >= lowerEnd && cross(target[k - 2]!, target[k - 1]!, point) <= 0) --k;
    target[k++] = point;
  }

  // the upper chain ends on the point the lower one starts with; points that all lie on one line
  // leave the two ends of it
  truncateArray(target, k - 1);
  truncateArray(sorted);

  return target;
}

/**
 * Calls `visit` once for every tile coordinate that lies inside `hull` or on its outline. The
 * hull is expected in the shape {@link convexTileHull} returns it: a convex outline, without
 * the points in between, and possibly degenerated to a line or to a single point.
 *
 * A scanline per row, and per row the span between the two places the outline crosses it —
 * which is one interval and not several, because the outline is convex.
 */
export function forEachTileWithinConvexHull(hull: readonly TilePoint[], visit: (x: number, y: number) => void): void {
  if (hull.length === 0) return;

  if (hull.length === 1) {
    const [x, y] = hull[0]!;
    visit(x, y);
    return;
  }

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < hull.length; ++i) {
    // The loop bound is `hull.length`.
    const y = hull[i]![1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  for (let y = minY; y <= maxY; ++y) {
    let left = Infinity;
    let right = -Infinity;

    for (let i = 0; i < hull.length; ++i) {
      // The loop bound is `hull.length`; the outline closes, so the last edge leads back to
      // the first point.
      const [ax, ay] = hull[i]!;
      const [bx, by] = hull[(i + 1) % hull.length]!;

      if (ay === by) {
        // a horizontal edge crosses no row but the one it lies in, and there it is the span
        if (ay !== y) continue;
        if (ax < left) left = ax;
        if (bx < left) left = bx;
        if (ax > right) right = ax;
        if (bx > right) right = bx;
        continue;
      }

      if (y < Math.min(ay, by) || y > Math.max(ay, by)) continue;

      const x = ax + ((y - ay) * (bx - ax)) / (by - ay);
      if (x < left) left = x;
      if (x > right) right = x;
    }

    if (left > right) continue;

    // the outline runs between tile coordinates, the tiles it takes in are the whole ones
    const from = Math.ceil(left);
    const to = Math.floor(right);
    for (let x = from; x <= to; ++x) {
      visit(x, y);
    }
  }
}

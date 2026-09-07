/**
 * A point on the tile grid: `[x, y]` in _tile space_, therefore integers.
 */
export type TilePoint = readonly [x: number, y: number];

const cross = (o: TilePoint, a: TilePoint, b: TilePoint): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

const byXThenY = (a: TilePoint, b: TilePoint): number => a[0] - b[0] || a[1] - b[1];

/**
 * The convex hull of a set of tile coordinates, as the points that carry it, in order along
 * the outline. Andrew's monotone chain — the input is a handful of points, and the sort it
 * starts with is what dominates the run.
 *
 * Duplicates and points that lie on the straight run between two others are dropped, so the
 * result carries corners only. That leaves three degenerate shapes, and each comes back as
 * what it is rather than as an error: no point at all gives an empty hull, points that are all
 * the same tile give that one point, and points that all lie on one line give the two ends of
 * that line.
 */
export function convexTileHull(points: readonly TilePoint[]): TilePoint[] {
  const sorted = [...points].sort(byXThenY);

  const unique: TilePoint[] = [];
  for (let i = 0; i < sorted.length; ++i) {
    // The loop bound is `sorted.length`.
    const point = sorted[i]!;
    const last = unique[unique.length - 1];
    if (last === undefined || last[0] !== point[0] || last[1] !== point[1]) {
      unique.push(point);
    }
  }

  if (unique.length < 3) return unique;

  const lower: TilePoint[] = [];
  for (let i = 0; i < unique.length; ++i) {
    // The loop bound is `unique.length`.
    const point = unique[i]!;
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, point) <= 0) {
      lower.pop();
    }
    lower.push(point);
  }

  const upper: TilePoint[] = [];
  for (let i = unique.length - 1; i >= 0; --i) {
    // The loop runs down from `unique.length - 1`.
    const point = unique[i]!;
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, point) <= 0) {
      upper.pop();
    }
    upper.push(point);
  }

  // both chains end on the point the other one starts with; points that all lie on one line
  // leave one end per chain, which is the line itself
  lower.pop();
  upper.pop();

  return lower.concat(upper);
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

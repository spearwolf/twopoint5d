/**
 * How far the middle of a view of `size` units lies past the point the camera looks at once the
 * near edge of the view is moved onto a whole unit — `-Math.floor(size / 2)` — and the far edge
 * follows it at `size` units: in `[0, 1)`, `0` for a size whose half is a whole number. The
 * frustum alignment of `pixelSnap` in `OrthographicProjection` and `ParallaxProjection`.
 */
export function wholeUnitOffset(size: number): number {
  return size / 2 - Math.floor(size / 2);
}

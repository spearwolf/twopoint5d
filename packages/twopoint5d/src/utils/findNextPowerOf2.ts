/**
 * The smallest power of two that is at least `x`, counting from `1`: every `x` up to `1` — `0`
 * and negative numbers among them — answers `1`. A number above the largest power of two a
 * double holds (`2 ** 1023`) answers `Infinity`, and `NaN` answers `NaN`.
 */
export const findNextPowerOf2 = (x: number): number => {
  if (Number.isNaN(x)) return NaN;
  let p = 1;
  // doubling is exact for every power of two a double holds, and it ends: after 1024 steps p
  // is Infinity, which no x exceeds
  while (p < x) p *= 2;
  return p;
};

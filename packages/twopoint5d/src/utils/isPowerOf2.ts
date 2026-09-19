/**
 * Whether `n` is a power of two with an exponent of 0 or more: `1`, `2`, `4`, … up to
 * `2 ** 1023`. A fraction — `0.5` among them —, `0`, a negative number, `Infinity` and `NaN`
 * are not.
 */
export const isPowerOf2 = (n: number): boolean => {
  if (!Number.isInteger(n) || n < 1) return false;
  // halving a double of 1 or more is exact, so the test holds beyond 2 ** 53 as well, where
  // Math.log2() already rounds a neighbour of a power of two onto its exponent
  let m = n;
  while (m > 1) {
    if (m % 2 !== 0) return false;
    m /= 2;
  }
  return true;
};

/**
 * Whether `value` is a finite number — neither `NaN` nor infinite, of any sign.
 */
export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

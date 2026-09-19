/**
 * Whether `value` is a finite number above 0 — a size or a zoom factor that can be divided by.
 */
export function isPositiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

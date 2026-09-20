import {isPositiveFinite} from './isPositiveFinite.js';

/**
 * Throws a `RangeError` naming subject, property and value unless `value` is a finite
 * number above 0 — for a size that something else is going to divide by.
 */
export function assertPositiveFinite(value: unknown, subject: string, name: string): void {
  if (!isPositiveFinite(value)) {
    throw new RangeError(`[${subject}] ${name} must be a finite number above 0, got ${String(value)}`);
  }
}

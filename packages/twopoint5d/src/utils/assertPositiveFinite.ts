import {describeValue} from './describeValue.js';
import {isPositiveFinite} from './isPositiveFinite.js';

/**
 * Answers `value` if it is a finite number above 0, and throws a `RangeError` naming subject,
 * property and value otherwise — for a size that something else is going to divide by.
 */
export function assertPositiveFinite(value: unknown, subject: string, name: string): number {
  if (!isPositiveFinite(value)) {
    throw new RangeError(`${subject}: ${name} must be a finite number above 0, got ${describeValue(value)}`);
  }
  return value;
}

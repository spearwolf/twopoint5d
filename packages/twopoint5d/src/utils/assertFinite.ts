import {describeValue} from './describeValue.js';
import {isFiniteNumber} from './isFiniteNumber.js';

/**
 * Answers `value` if it is a finite number, and throws a `RangeError` naming subject, property
 * and value otherwise — for a value that is calculated with: a position, an offset, a spacing.
 */
export function assertFinite(value: unknown, subject: string, name: string): number {
  if (!isFiniteNumber(value)) {
    throw new RangeError(`${subject}: ${name} must be a finite number, got ${describeValue(value)}`);
  }
  return value;
}

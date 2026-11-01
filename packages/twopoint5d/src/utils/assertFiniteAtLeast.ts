import {describeValue} from './describeValue.js';

/**
 * Answers `value` if it is a finite number of `min` or more, and throws a `RangeError` naming
 * subject, property and value otherwise — for a size, a scale or a depth that has a floor.
 */
export function assertFiniteAtLeast(value: unknown, subject: string, name: string, min: number): number {
  if (typeof value !== 'number' || !(Number.isFinite(value) && value >= min)) {
    throw new RangeError(`${subject}: ${name} must be a finite number of ${min} or more, got ${describeValue(value)}`);
  }
  return value;
}

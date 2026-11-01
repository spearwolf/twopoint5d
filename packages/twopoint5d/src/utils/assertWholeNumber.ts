import {describeValue} from './describeValue.js';

/**
 * Answers `value` if it is a whole number — of `min` or more, when `min` is given —, and throws a
 * `RangeError` naming subject, property and value otherwise — for a count, an index or a size in
 * whole pixels.
 */
export function assertWholeNumber(value: unknown, subject: string, name: string, min?: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || (min !== undefined && !(value >= min))) {
    const bound = min === undefined ? '' : ` of ${min} or more`;
    throw new RangeError(`${subject}: ${name} must be a whole number${bound}, got ${describeValue(value)}`);
  }
  return value;
}

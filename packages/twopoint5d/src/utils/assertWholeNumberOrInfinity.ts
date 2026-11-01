import {describeValue} from './describeValue.js';

/**
 * Answers `value` if it is a whole number of `min` or more or `Infinity` — a limit that `Infinity`
 * turns off —, and throws a `RangeError` naming subject, property and value otherwise.
 */
export function assertWholeNumberOrInfinity(value: unknown, subject: string, name: string, min: number): number {
  if (typeof value !== 'number' || !((Number.isInteger(value) && value >= min) || value === Infinity)) {
    throw new RangeError(
      `${subject}: ${name} must be a whole number of ${min} or more, or Infinity, got ${describeValue(value)}`,
    );
  }
  return value;
}

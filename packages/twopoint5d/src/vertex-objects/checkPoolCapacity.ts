import {describeValue} from '../utils/describeValue.js';
import type {VOBufferPool} from './VOBufferPool.js';

/**
 * Throws a `RangeError` when a geometry is handed `pool` together with a capacity other than the
 * pool's own: the geometry takes its size from the pool, so a capacity it would not read stands
 * for a size the caller expects and does not get.
 *
 * @internal
 */
export function checkPoolCapacity(
  subject: string,
  capacityName: string,
  poolName: string,
  pool: VOBufferPool,
  capacity: unknown,
): void {
  if (capacity !== pool.capacity) {
    throw new RangeError(
      `${subject}: ${capacityName} must be the capacity of ${poolName} handed in, ${pool.capacity}, got ${describeValue(capacity)}`,
    );
  }
}

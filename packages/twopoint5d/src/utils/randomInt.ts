/**
 * A whole number from 0 up to, but not including, `max`, drawn by `Math.random()`; 0 for a `max`
 * of 0. `Math.floor()` and not `| 0`, which cuts a draw of 2^31 or more down to a negative number.
 */
export const randomInt = (max: number): number => Math.floor(Math.random() * max);

import type {FitIntoRectangleSpecs} from './fitIntoRectangle.js';

/**
 * `FitIntoRectangleSpecs` spells out the complete shapes a fit can be described with;
 * `viewSpecs` holds an empty object until the first assignment, a shape the union has
 * no member for. `fitIntoRectangle()` reads its fields through `in` checks
 * (`fitIntoRectangle.ts:184-207`) and leaves the target rectangle untouched when no
 * shape matches — the empty case is a defined answer, not a missing one.
 */
export const asFitIntoRectangleSpecs = (specs: Partial<FitIntoRectangleSpecs>): FitIntoRectangleSpecs =>
  specs as FitIntoRectangleSpecs;

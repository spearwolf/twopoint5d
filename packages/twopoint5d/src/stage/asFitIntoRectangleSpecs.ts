import type {FitIntoRectangleSpecs} from './fitIntoRectangle.js';

/**
 * Every member of the `FitIntoRectangleSpecs` union requires at least one field — `pixelZoom`,
 * `fit`, a `width` or a `height` — so a spec that is empty or only partly filled matches none
 * of them. `fitIntoRectangle()` reads every field it needs through an `in` check or a
 * comparison on `fit` (`fitIntoRectangle.ts:184-225`), so a partial spec is a shape it handles,
 * and this cast widens the parameter to what the function accepts in fact.
 *
 * What it does not say is which rectangle comes back: where no shape matches,
 * `fitIntoRectangle()` hands back the target vector it was given, untouched.
 */
export const asFitIntoRectangleSpecs = (specs: Partial<FitIntoRectangleSpecs>): FitIntoRectangleSpecs =>
  specs as FitIntoRectangleSpecs;

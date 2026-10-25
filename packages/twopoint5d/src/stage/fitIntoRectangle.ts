import {Vector2} from 'three/webgpu';

import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import {ceilWholePixels, floorWholePixels} from '../utils/wholePixels.js';

/**
 * Represents the horizontal alignment of the view within the container.
 * - `'left'`: Align to the left edge
 * - `'center'`: Center horizontally (default)
 * - `'right'`: Align to the right edge
 */
export type AnchorPositionX = 'left' | 'center' | 'right';

/**
 * Represents the vertical alignment of the view within the container.
 * - `'top'`: Align to the top edge
 * - `'center'`: Center vertically (default)
 * - `'bottom'`: Align to the bottom edge
 */
export type AnchorPositionY = 'top' | 'center' | 'bottom';

/**
 * Represents the anchor position of the view within the container.
 * The format is `'vertical horizontal'` where:
 * - vertical: `'top'`, `'center'`, or `'bottom'`
 * - horizontal: `'left'`, `'center'`, or `'right'`
 *
 * Examples: `'top left'`, `'top center'`, `'center center'`, `'bottom right'`
 */
export type AnchorPosition =
  | 'top left'
  | 'top center'
  | 'top right'
  | 'center left'
  | 'center'
  | 'center center'
  | 'center right'
  | 'bottom left'
  | 'bottom center'
  | 'bottom right';

/**
 * How a view fits into a container. `anchorPosition` is read by `calculateAnchorOffset()` alone:
 * `fitIntoRectangle()` works out the size of the view and leaves its place to the caller. The
 * projections take {@link ProjectionFitSpecs}, which has no `anchorPosition`.
 *
 * `pixelSnap` rounds the zoom of the `pixelZoom`, `contain` and `cover` arms to a whole number of
 * pixels of the drawing buffer per unit of the view, as `fitIntoRectangle()` describes; `fill` has
 * no zoom to round.
 */
export type FitIntoRectangleSpecs =
  | {
      fit?: 'fill';
      pixelZoom: number;
      pixelSnap?: boolean;
      anchorPosition?: AnchorPosition;
    }
  | {
      fit: 'fill';
      anchorPosition?: AnchorPosition;
    }
  | {
      fit: 'contain';
      width: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
      pixelSnap?: boolean;
      anchorPosition?: AnchorPosition;
    }
  | {
      fit: 'contain';
      height: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
      pixelSnap?: boolean;
      anchorPosition?: AnchorPosition;
    }
  | {
      fit: 'contain';
      height: number;
      width: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
      pixelSnap?: boolean;
      anchorPosition?: AnchorPosition;
    }
  | {
      fit: 'cover';
      width: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
      pixelSnap?: boolean;
      anchorPosition?: AnchorPosition;
    }
  | {
      fit: 'cover';
      height: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
      pixelSnap?: boolean;
      anchorPosition?: AnchorPosition;
    }
  | {
      fit: 'cover';
      height: number;
      width: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
      pixelSnap?: boolean;
      anchorPosition?: AnchorPosition;
    };

/**
 * The arms of {@link FitIntoRectangleSpecs} without `anchorPosition`: how `OrthographicProjection`
 * and `ParallaxProjection` fit their view into the container. A projection centers its view on the
 * projection plane and places no anchor.
 */
export type ProjectionFitSpecs = FitIntoRectangleSpecs extends infer Specs
  ? Specs extends unknown
    ? Omit<Specs, 'anchorPosition'>
    : never
  : never;

/**
 * Parses an anchor position string into separate X and Y components.
 * @param anchorPosition - The anchor position string (e.g., 'top center')
 * @returns A tuple of [anchorY, anchorX]
 */
export function parseAnchorPosition(anchorPosition: AnchorPosition | undefined): [AnchorPositionY, AnchorPositionX] {
  if (!anchorPosition || anchorPosition === 'center') {
    return ['center', 'center'];
  }

  const parts = anchorPosition.split(' ') as [AnchorPositionY, AnchorPositionX];
  return [parts[0], parts[1]];
}

/**
 * Calculates the anchor offset based on the difference between the container and view dimensions.
 * The offset represents how much the view should be shifted from the top-left corner.
 *
 * @param rect - The container dimensions
 * @param view - The calculated view dimensions
 * @param anchorPosition - The anchor position (defaults to 'center')
 * @param target - Optional target Vector2 to store the result
 * @returns The offset as a Vector2 (x, y)
 */
export function calculateAnchorOffset(
  rect: Vector2,
  view: Vector2,
  anchorPosition?: AnchorPosition,
  target: Vector2 = new Vector2(),
): Vector2 {
  const [anchorY, anchorX] = parseAnchorPosition(anchorPosition);

  const diffX = rect.width - view.width;
  const diffY = rect.height - view.height;

  // Calculate horizontal offset
  switch (anchorX) {
    case 'left':
      target.x = 0;
      break;
    case 'center':
      target.x = diffX / 2;
      break;
    case 'right':
      target.x = diffX;
      break;
  }

  // Calculate vertical offset
  switch (anchorY) {
    case 'top':
      target.y = 0;
      break;
    case 'center':
      target.y = diffY / 2;
      break;
    case 'bottom':
      target.y = diffY;
      break;
  }

  return target;
}

/**
 * Calculates the view dimensions that fit into a container rectangle based on the given specifications.
 *
 * The function supports several fit modes:
 * - `pixelZoom`: Scales the container by a fixed factor
 * - `fill`: Uses the container dimensions as-is
 * - `contain`: Fits the view inside the container, preserving aspect ratio
 * - `cover`: Covers the container with the view, preserving aspect ratio
 *
 * To position the calculated view within the container using the `anchorPosition` property,
 * use the `calculateAnchorOffset` function with the result:
 *
 * @example
 * ```ts
 * const rect = new Vector2(800, 600);
 * const specs = {fit: 'contain', width: 640, height: 480, anchorPosition: 'top center'} as const;
 * const view = fitIntoRectangle(rect, specs);
 * const offset = calculateAnchorOffset(rect, view, specs.anchorPosition);
 * ```
 *
 * The spec is a partial spec: every field may be missing. For `contain` and `cover`, a side
 * that is missing, or not a finite number above 0, means the caller does not constrain that side;
 * the other side then drives the aspect ratio. Where no shape matches — no `pixelZoom`, no `fit`, or
 * `contain`/`cover` without either dimension — the dimensions in `target` are left as they are,
 * and `fitIntoRectangle()` hands back the target vector it was given, untouched. `minPixelZoom`
 * and `maxPixelZoom` still apply afterwards and can override that: on a fresh `Vector2` the
 * width is `0`, so the ratio is `Infinity` and a `maxPixelZoom` always kicks in. For `contain`
 * and `cover`, a `rect` with a width or a height of 0 gives a 0×0 view, and `minPixelZoom` and
 * `maxPixelZoom` do not apply to it. A `pixelZoom` that is not a finite number above 0 zooms by
 * 1 — the view is the container, as with a `Display#pixelZoom` of 0 —, and a `minPixelZoom` or
 * `maxPixelZoom` that is not a finite number above 0 does not apply.
 *
 * With `pixelSnap`, the zoom — container units per unit of the view, after `minPixelZoom` and
 * `maxPixelZoom` — is multiplied by `pixelRatio` and rounded to whole pixels of the drawing buffer:
 * down for `pixelZoom` and `contain`, so that at least the asked-for view stays visible, up for
 * `cover`, so that the view still covers the container; at least 1. The view is then the drawing
 * buffer divided by that whole zoom, the buffer rounded down as `WebGPURenderer#setSize()` rounds
 * it: `Math.floor(rect.width × pixelRatio) / zoom`. The zoom in container units is in general not a
 * whole number then — 3 buffer pixels at a `pixelRatio` of 1.25 are 2.4 —, and it can lie beyond
 * `minPixelZoom` or `maxPixelZoom` by less than one pixel of the buffer. Where no shape matches, or
 * the container has no area, there is nothing to round. Without `pixelSnap`, `pixelRatio` is not
 * read.
 *
 * @param rect - The container dimensions as a Vector2
 * @param specs - The fit specifications
 * @param target - Optional target Vector2 to store the result
 * @param pixelRatio - The pixels of the drawing buffer per unit of `rect`, read by `pixelSnap`
 * alone: `Display#pixelRatio`, which is `1` under a `Display#pixelZoom`, where `rect` counts pixels
 * of the buffer already. A value that is not a finite number above 0 counts as `1`.
 * @returns The calculated view dimensions as a Vector2
 */
export function fitIntoRectangle(
  rect: Vector2,
  specs: Partial<FitIntoRectangleSpecs>,
  target: Vector2 = new Vector2(),
  pixelRatio = 1,
): Vector2 {
  const pixelZoom = 'pixelZoom' in specs && specs.pixelZoom != null ? specs.pixelZoom : undefined;

  // the zoom a shape gave, in container units per unit of the view; 0 where no shape matched
  let zoom = 0;
  let roundUp = false;

  if (pixelZoom != null) {
    // ---------------------------------------------------------------
    // pixelZoom
    // ---------------------------------------------------------------
    // a pixelZoom that is not a finite number above 0 zooms by 1, as a Display#pixelZoom of 0 does
    zoom = isPositiveFinite(pixelZoom) ? pixelZoom : 1;
    target.copy(rect).divideScalar(zoom);
  } else if (specs.fit === 'fill') {
    // ---------------------------------------------------------------
    // fill
    // ---------------------------------------------------------------
    target.copy(rect);
  } else if (specs.fit === 'contain' || specs.fit === 'cover') {
    // ---------------------------------------------------------------
    // contain & cover
    // ---------------------------------------------------------------
    if (rect.width === 0 || rect.height === 0) {
      // a container without area has no aspect ratio to keep, so the view has no area either
      target.set(0, 0);
      return target;
    }

    // a side that is missing, or not a finite number above 0, is a side the caller does not constrain
    const width = 'width' in specs && isPositiveFinite(specs.width) ? specs.width : 0;
    const height = 'height' in specs && isPositiveFinite(specs.height) ? specs.height : 0;

    let fitted = true;

    if (width !== 0 && height === 0) {
      // --- we have a width and no height
      target.width = width;
      target.height = rect.height * (width / rect.width);
    } else if (width === 0 && height !== 0) {
      // --- we have no width but a height
      target.width = rect.width * (height / rect.height);
      target.height = height;
    } else if (width !== 0 && height !== 0) {
      // --- we have a width and a height
      const rectRatio = rect.width / rect.height;
      const specsRatio = width / height;
      const isContain = specs.fit === 'contain';
      if ((isContain && rectRatio > specsRatio) || (!isContain && rectRatio < specsRatio)) {
        target.width = rect.width * (height / rect.height);
        target.height = height;
      } else if ((isContain && rectRatio < specsRatio) || (!isContain && rectRatio > specsRatio)) {
        target.width = width;
        target.height = rect.height * (width / rect.width);
      } else {
        target.set(width, height);
      }
    } else {
      fitted = false;
    }

    if (isPositiveFinite(specs.minPixelZoom) && rect.width / target.width < specs.minPixelZoom) {
      target.copy(rect).divideScalar(specs.minPixelZoom);
      fitted = true;
    } else if (isPositiveFinite(specs.maxPixelZoom) && rect.width / target.width > specs.maxPixelZoom) {
      target.copy(rect).divideScalar(specs.maxPixelZoom);
      fitted = true;
    }

    if (fitted) {
      zoom = rect.width / target.width;
      roundUp = specs.fit === 'cover';
    }
  }

  // `fill` has no pixelSnap, so the union is narrowed to the arms that do
  if ('pixelSnap' in specs && specs.pixelSnap === true && isPositiveFinite(zoom)) {
    const ratio = isPositiveFinite(pixelRatio) ? pixelRatio : 1;
    const wholeZoom = Math.max(1, roundUp ? ceilWholePixels(zoom * ratio) : floorWholePixels(zoom * ratio));
    // the buffer the renderer really draws into: a view worked out from the fraction before its
    // rounding would spread its pixels over one pixel more or less, and a seam would wander
    target.set(Math.floor(rect.width * ratio) / wholeZoom, Math.floor(rect.height * ratio) / wholeZoom);
  }

  return target;
}

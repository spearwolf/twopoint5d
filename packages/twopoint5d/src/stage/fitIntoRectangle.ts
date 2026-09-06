import {Vector2} from 'three/webgpu';

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

export type FitIntoRectangleSpecs =
  | {
      fit?: 'fill';
      pixelZoom: number;
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
      anchorPosition?: AnchorPosition;
    }
  | {
      fit: 'contain';
      height: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
      anchorPosition?: AnchorPosition;
    }
  | {
      fit: 'contain';
      height: number;
      width: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
      anchorPosition?: AnchorPosition;
    }
  | {
      fit: 'cover';
      width: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
      anchorPosition?: AnchorPosition;
    }
  | {
      fit: 'cover';
      height: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
      anchorPosition?: AnchorPosition;
    }
  | {
      fit: 'cover';
      height: number;
      width: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
      anchorPosition?: AnchorPosition;
    };

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
 * that is missing or set to `0` means the caller does not constrain that side; the other side
 * then drives the aspect ratio. Where no shape matches — no `pixelZoom`, no `fit`, or
 * `contain`/`cover` without either dimension — the dimensions in `target` are left as they are,
 * and `fitIntoRectangle()` hands back the target vector it was given, untouched. `minPixelZoom`
 * and `maxPixelZoom` still apply afterwards and can override that: on a fresh `Vector2` the
 * width is `0`, so the ratio is `Infinity` and a `maxPixelZoom` always kicks in.
 *
 * @param rect - The container dimensions as a Vector2
 * @param specs - The fit specifications
 * @param target - Optional target Vector2 to store the result
 * @returns The calculated view dimensions as a Vector2
 */
export function fitIntoRectangle(rect: Vector2, specs: Partial<FitIntoRectangleSpecs>, target: Vector2 = new Vector2()): Vector2 {
  const pixelZoom = 'pixelZoom' in specs && specs.pixelZoom != null ? specs.pixelZoom : undefined;

  if (pixelZoom != null) {
    // ---------------------------------------------------------------
    // pixelZoom
    // ---------------------------------------------------------------
    target.copy(rect).divideScalar(pixelZoom);
  } else if (specs.fit === 'fill') {
    // ---------------------------------------------------------------
    // fill
    // ---------------------------------------------------------------
    target.copy(rect);
  } else if (specs.fit === 'contain' || specs.fit === 'cover') {
    // ---------------------------------------------------------------
    // contain & cover
    // ---------------------------------------------------------------
    // a side that is missing, undefined or 0 is a side the caller does not constrain
    const width = 'width' in specs && specs.width != null ? specs.width : 0;
    const height = 'height' in specs && specs.height != null ? specs.height : 0;

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
    }

    if (specs.minPixelZoom != null && rect.width / target.width < specs.minPixelZoom) {
      target.copy(rect).divideScalar(specs.minPixelZoom);
    } else if (specs.maxPixelZoom != null && rect.width / target.width > specs.maxPixelZoom) {
      target.copy(rect).divideScalar(specs.maxPixelZoom);
    }
  }
  return target;
}

import {Vector2} from 'three';

// TODO add anchorPosition: 'top center' ...

/**
 * @category Projection
 */
export type FitIntoRectangleSpecs =
  | {
      fit?: 'fill';
      pixelZoom: number;
    }
  | {
      fit: 'fill';
    }
  | {
      fit: 'contain';
      width: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
    }
  | {
      fit: 'contain';
      height: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
    }
  | {
      fit: 'contain';
      height: number;
      width: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
    }
  | {
      fit: 'cover';
      width: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
    }
  | {
      fit: 'cover';
      height: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
    }
  | {
      fit: 'cover';
      height: number;
      width: number;
      minPixelZoom?: number;
      maxPixelZoom?: number;
    };

/**
 * @category Projection
 */
export function fitIntoRectangle(rect: Vector2, specs: FitIntoRectangleSpecs, target: Vector2 = new Vector2()): Vector2 {
  if ('pixelZoom' in specs) {
    // ---------------------------------------------------------------
    // pixelZoom
    // ---------------------------------------------------------------
    target.copy(rect).divideScalar(specs.pixelZoom);
  } else if (specs.fit === 'fill') {
    // ---------------------------------------------------------------
    // fix
    // ---------------------------------------------------------------
    target.copy(rect);
  } else if (specs.fit === 'contain' || specs.fit === 'cover') {
    // ---------------------------------------------------------------
    // contain & cover
    // ---------------------------------------------------------------
    if ('width' in specs && specs.width !== 0 && (!('height' in specs) || specs.height === 0)) {
      // --- we have a width and no height
      target.width = specs.width as number;
      target.height = rect.height * (specs.width / rect.width);
    } else if ((!('width' in specs) || specs.width === 0) && 'height' in specs && specs.height !== 0) {
      // --- we have no width but a height
      target.width = rect.width * (specs.height / rect.height);
      target.height = specs.height;
    } else if ('width' in specs && specs.width !== 0 && 'height' in specs && specs.height !== 0) {
      // --- we have a width and a height
      const rectRatio = rect.width / rect.height;
      const specsRatio = specs.width / specs.height;
      const isContain = specs.fit === 'contain';
      if ((isContain && rectRatio > specsRatio) || (!isContain && rectRatio < specsRatio)) {
        target.width = rect.width * (specs.height / rect.height);
        target.height = specs.height;
      } else if ((isContain && rectRatio < specsRatio) || (!isContain && rectRatio > specsRatio)) {
        target.width = specs.width;
        target.height = rect.height * (specs.width / rect.width);
      } else {
        target.set(specs.width, specs.height);
      }
    }
    if ('minPixelZoom' in specs && rect.width / target.width < specs.minPixelZoom) {
      target.copy(rect).divideScalar(specs.minPixelZoom);
    } else if ('maxPixelZoom' in specs && rect.width / target.width > specs.maxPixelZoom) {
      target.copy(rect).divideScalar(specs.maxPixelZoom);
    }
  }
  return target;
}

import {Vector2} from 'three';

// TODO add anchorPosition: 'top center' ...
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
    };

export function fitIntoRectangle(
  rect: Vector2,
  specs: FitIntoRectangleSpecs,
  target: Vector2 = new Vector2(),
): Vector2 {
  if ('pixelZoom' in specs) {
    target.copy(rect).divideScalar(specs.pixelZoom);
  } else if (specs.fit === 'fill') {
    target.copy(rect);
  } else if (specs.fit === 'contain') {
    if ('width' in specs && !('height' in specs)) {
      target.width = specs.width;
      target.height = rect.height * (specs.width / rect.width);
    } else if (!('width' in specs) && 'height' in specs) {
      target.width = rect.width * (specs.height / rect.height);
      target.height = specs.height;
    } else {
      const rectRatio = rect.width / rect.height;
      const specsRatio = specs.width / specs.height;
      if (rectRatio > specsRatio) {
        target.width = rect.width * (specs.height / rect.height);
        target.height = specs.height;
      } else if (rectRatio < specsRatio) {
        target.width = specs.width;
        target.height = rect.height * (specs.width / rect.width);
      } else {
        target.set(specs.width, specs.height);
      }
    }
    if (
      'minPixelZoom' in specs &&
      rect.width / target.width < specs.minPixelZoom
    ) {
      target.copy(rect).divideScalar(specs.minPixelZoom);
    } else if (
      'maxPixelZoom' in specs &&
      rect.width / target.width > specs.maxPixelZoom
    ) {
      target.copy(rect).divideScalar(specs.maxPixelZoom);
    }
  }
  return target;
}

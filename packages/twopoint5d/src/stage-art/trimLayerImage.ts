import type {LayerBox} from './artLayout.js';

/** The pixels of an image as `getImageData()` answers them: four bytes a pixel, row by row from the top. */
export interface LayerPixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

type PixelCanvas = OffscreenCanvas | HTMLCanvasElement;

const pixelCanvas = (width: number, height: number): PixelCanvas => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(width, height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

// the pixels of a decoded bitmap, drawn into a canvas of its size and read back; the canvas lets go of
// them at once — a full-canvas file of 1920 × 1080 holds 8 MiB
function pixelsOfBitmap(bitmap: ImageBitmap): Uint8ClampedArray {
  const {width, height} = bitmap;
  const canvas = pixelCanvas(width, height);
  try {
    // the union of both canvas types has no getContext() that TypeScript can call with '2d'
    const context = (canvas as HTMLCanvasElement).getContext('2d', {willReadFrequently: true});
    if (context === null) throw new Error('trimLayerImage: a canvas gave no 2D context to read the pixels of a file');
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, width, height).data;
  } finally {
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * The box of the pixels of `image` whose alpha is above 0, in pixels of the image — the place of the
 * picture of a full-canvas layer file on its canvas —, `undefined` for an image without one. A
 * decoded bitmap is drawn into a canvas and read back there, and stays the caller's; the plain form is
 * read as it is.
 */
export function trimLayerImage(image: ImageBitmap | LayerPixels): LayerBox | undefined {
  const {width, height} = image;
  const data = 'data' in image ? image.data : pixelsOfBitmap(image);
  const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3]!;
  const rowIsClear = (y: number) => {
    for (let x = 0; x < width; x++) if (alphaAt(x, y) > 0) return false;
    return true;
  };

  let top = 0;
  while (top < height && rowIsClear(top)) top++;
  if (top === height) return undefined;
  let bottom = height - 1;
  while (rowIsClear(bottom)) bottom--;

  // the columns between the rows found: a row with a pixel lies there, so each scan stops
  const columnIsClear = (x: number) => {
    for (let y = top; y <= bottom; y++) if (alphaAt(x, y) > 0) return false;
    return true;
  };
  let left = 0;
  while (columnIsClear(left)) left++;
  let right = width - 1;
  while (columnIsClear(right)) right--;

  return {x: left, y: top, w: right - left + 1, h: bottom - top + 1};
}

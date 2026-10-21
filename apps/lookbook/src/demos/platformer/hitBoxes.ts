import type {AsepriteFrameData, FrameBasedAnimationInfo, TextureAtlasFrame} from '@spearwolf/twopoint5d';

/** A box in pixels, y up. Relative to a figure's feet, or placed in the world. */
export interface Box {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/**
 * The box a trimmed Aseprite frame covers, relative to the pixel its `pivot` slice marks — the
 * feet — with y up, for the figure facing right as the sheet draws it. `spriteSourceSize` is where
 * the trimmed pixels lie in the untrimmed canvas, so the box is exactly what the frame shows.
 */
export function frameBox(frame: TextureAtlasFrame): Box {
  const data = frame.data as AsepriteFrameData;
  const {x, y, w, h} = data.spriteSourceSize!;
  const {bounds, pivot} = data.slices['pivot']!;
  // the bottom left corner of the pivot pixel, as Anchor#setAnchorFromPivot() reads it
  const footX = bounds.x + pivot!.x;
  const footY = bounds.y + pivot!.y + 1;
  return {left: x - footX, right: x + w - footX, bottom: footY - (y + h), top: footY - y};
}

/** The part of a box in front of the feet: what a kick or a club reaches. */
export const frontOf = (box: Box): Box => ({...box, left: Math.max(0, box.left)});

/** Places a box relative to the feet at `(x, y)`, mirrored for a figure facing left. */
export function placeBox(box: Box, x: number, y: number, dir: number, out: Box): Box {
  out.left = dir < 0 ? x - box.right : x + box.left;
  out.right = dir < 0 ? x - box.left : x + box.right;
  out.bottom = y + box.bottom;
  out.top = y + box.top;
  return out;
}

export const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.bottom < b.top && b.bottom < a.top;

export const emptyBox = (): Box => ({left: 0, right: 0, bottom: 0, top: 0});

/**
 * When the held key frame of a one-shot is on screen, in seconds after its start: the frame with
 * the longest of the per-frame durations Aseprite exported — the extended kick, the swing of the
 * club. A strike lands only in that window.
 */
export function heldFrameWindow(info: FrameBasedAnimationInfo): [start: number, end: number] {
  const durations = info.durations ?? new Array<number>(info.frameCount).fill(info.duration / info.frameCount);
  let key = 0;
  for (let i = 1; i < durations.length; i++) if (durations[i]! > durations[key]!) key = i;
  const start = durations.slice(0, key).reduce((sum, d) => sum + d, 0);
  return [start, start + durations[key]!];
}

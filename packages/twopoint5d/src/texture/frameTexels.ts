// The texels of a frame, as both frame tables and the animsMap read them: `[s, t, u, v]` as
// `TextureCoords#getTexCoords()` answers them, `[width, height, flipDiagonal, endTime]`, and
// `[left, top, right, bottom]`, the trim margins. The public description of the layout stays in the
// TSDoc of the three bakes; this module is the one place that writes it.

import {type FrameTrimMargins, frameTrimMargins} from './frameTrimMargins.js';
import type {TextureAtlasFrame} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';

// the tex coords and the trim margins pass through these, so a call allocates nothing
const texCoordsScratch = new Float64Array(4);
const trimScratch: FrameTrimMargins = [0, 0, 0, 0];

/**
 * Writes the texels of a frame into `target` from `offset` on, counted in floats: the first texel,
 * with `texels` of 2 or more the second — `endTime` its fourth component —, with `texels` of 3 the
 * third. Allocates nothing.
 */
export function writeFrameTexels(
  target: Float32Array | Float64Array,
  offset: number,
  coords: TextureCoords,
  texels: 1 | 2 | 3,
  margins: Readonly<FrameTrimMargins>,
  endTime: number,
): void {
  coords.getTexCoords(texCoordsScratch);
  target[offset] = texCoordsScratch[0]!;
  target[offset + 1] = texCoordsScratch[1]!;
  target[offset + 2] = texCoordsScratch[2]!;
  target[offset + 3] = texCoordsScratch[3]!;
  if (texels >= 2) {
    target[offset + 4] = coords.width;
    target[offset + 5] = coords.height;
    target[offset + 6] = coords.flipD ? 1 : 0;
    target[offset + 7] = endTime;
  }
  if (texels === 3) {
    target[offset + 8] = margins[0];
    target[offset + 9] = margins[1];
    target[offset + 10] = margins[2];
    target[offset + 11] = margins[3];
  }
}

/**
 * Writes the three texels of an entry of a frame table into `target` from `offset` on: a frame of an
 * atlas with the trim margins of its data, bare `TextureCoords` untrimmed; the end time is 0.
 * Allocates nothing.
 */
export function writeTableEntryTexels(
  target: Float32Array | Float64Array,
  offset: number,
  entry: TextureAtlasFrame<unknown> | TextureCoords,
): void {
  const isCoords = entry instanceof TextureCoords;
  const coords = isCoords ? entry : entry.coords;
  frameTrimMargins(isCoords ? undefined : entry.data, trimScratch);
  writeFrameTexels(target, offset, coords, 3, trimScratch, 0);
}

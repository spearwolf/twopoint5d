import type {BitmapFontData} from '../text/BitmapFont.js';

/**
 * A small font for the specs of the text module, in the JSON layout: a line of 6 pixels with its
 * baseline at 5, on a page of 16 × 8.
 *
 * | char | box | xoffset, yoffset | xadvance |
 * | --- | --- | --- | --- |
 * | space | 0 × 0 | 0, 0 | 3 |
 * | `A` | 3 × 4 at (1, 1) | 0, 1 | 4 |
 * | `V` | 3 × 4 at (5, 1) | −1, 1 | 4 |
 * | `-` | 2 × 1 at (9, 1) | 1, 3 | 4 |
 * | 😀 (U+1F600) | 2 × 2 at (12, 1) | 0, 0 | 3 |
 *
 * One kerning pair: `A` followed by `V` moves `V` one pixel closer.
 */
export const tinyFontData = (): BitmapFontData => ({
  pages: ['tiny.png'],
  info: {face: 'tiny', size: 4},
  common: {lineHeight: 6, base: 5, scaleW: 16, scaleH: 8, pages: 1},
  chars: [
    {id: 32, x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 3, page: 0, chnl: 15},
    {id: 65, x: 1, y: 1, width: 3, height: 4, xoffset: 0, yoffset: 1, xadvance: 4, page: 0, chnl: 15},
    {id: 86, x: 5, y: 1, width: 3, height: 4, xoffset: -1, yoffset: 1, xadvance: 4, page: 0, chnl: 15},
    {id: 45, x: 9, y: 1, width: 2, height: 1, xoffset: 1, yoffset: 3, xadvance: 4, page: 0, chnl: 15},
    {id: 0x1f600, x: 12, y: 1, width: 2, height: 2, xoffset: 0, yoffset: 0, xadvance: 3, page: 0, chnl: 15},
  ],
  kernings: [{first: 65, second: 86, amount: -1}],
});

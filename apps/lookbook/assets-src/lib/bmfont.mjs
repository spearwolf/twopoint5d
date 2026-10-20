// Builds an AngelCode BMFont from a pixel font: every glyph rasterized at the font's native size,
// scaled up by an integer factor, painted by a style function, given an outline, trimmed and
// packed into one page.
import {Img} from './image.mjs';
import {bmfontJson, bmfontText} from './formats.mjs';
import {pack} from './pack.mjs';

/** @typedef {import('./image.mjs').RGBA} RGBA */
/** @typedef {import('./ttf.mjs').TrueTypeFont} TrueTypeFont */

/**
 * @typedef {object} FontStyle
 * @property {(x: number, y: number) => RGBA} fill the colour of a glyph pixel at (x, y) in the
 *   scaled cell, y = 0 at the top of the line
 * @property {RGBA} [outline] the colour of the outline
 * @property {number} [outlineWidth] in output pixels, 0 by default
 */

/**
 * @param {object} opts
 * @param {TrueTypeFont} opts.font
 * @param {number} opts.pixelsPerEm the native size of the pixel font
 * @param {number} opts.scale integer upscale
 * @param {string} opts.face the face name written into the font (not the source font's reserved name)
 * @param {string} opts.page the file name of the page image
 * @param {number[]} opts.codePoints
 * @param {FontStyle} opts.style
 * @param {number} opts.lineHeight
 * @param {number} opts.base distance from the top of the line to the baseline
 * @param {number} [opts.spacing] pixels between glyphs on the page
 */
export function buildBitmapFont(opts) {
  const {font, pixelsPerEm, scale, style, spacing = 2} = opts;
  const ow = style.outlineWidth ?? 0;
  /** @type {{name: string, img: Img, trim: boolean}[]} */
  const inputs = [];
  /** @type {Map<number, number>} */
  const advances = new Map();
  for (const cp of opts.codePoints) {
    const r = font.rasterize(cp, pixelsPerEm);
    if (!r) throw new Error(`font has no glyph for U+${cp.toString(16).padStart(4, '0')}`);
    advances.set(cp, r.advance * scale);
    const img = new Img(r.width * scale + 2 * ow, r.height * scale + 2 * ow);
    for (let y = 0; y < r.height * scale; y++) {
      for (let x = 0; x < r.width * scale; x++) {
        if (r.mask[Math.floor(y / scale) * r.width + Math.floor(x / scale)]) img.set(x + ow, y + ow, style.fill(x, y));
      }
    }
    if (style.outline) for (let i = 0; i < ow; i++) img.outline(style.outline, {diagonal: true});
    inputs.push({name: String(cp), img, trim: true});
  }
  const {sheet, frames} = pack(
    inputs.filter((input) => input.img.opaqueBounds()),
    {padding: spacing},
  );
  const placed = new Map(frames.map((f) => [Number(f.name), f]));
  const chars = opts.codePoints.map((cp) => {
    const f = placed.get(cp);
    const xadvance = /** @type {number} */ (advances.get(cp));
    if (!f) return {id: cp, x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance};
    return {
      id: cp,
      x: f.x,
      y: f.y,
      width: f.w,
      height: f.h,
      xoffset: f.spriteSourceSize.x - ow,
      yoffset: f.spriteSourceSize.y - ow,
      xadvance,
    };
  });
  /** @type {import('./formats.mjs').BMFontDoc} */
  const doc = {
    face: opts.face,
    size: pixelsPerEm * scale,
    lineHeight: opts.lineHeight,
    base: opts.base,
    scaleW: sheet.width,
    scaleH: sheet.height,
    page: opts.page,
    padding: [0, 0, 0, 0],
    spacing: [spacing, spacing],
    chars,
    kernings: [],
  };
  return {sheet, doc, text: bmfontText(doc), json: bmfontJson(doc)};
}

/** The printable ASCII range, 32–126. */
export const ASCII = Array.from({length: 95}, (_, i) => 32 + i);

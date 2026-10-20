// Reads the outlines of a TrueType font and rasterizes glyphs without anti-aliasing: a pixel is set
// when its centre lies inside the outline (nonzero winding). Made for pixel fonts drawn on a grid,
// which come out exactly as designed at their native size. Reads `head`, `hhea`, `maxp`, `hmtx`,
// `cmap` (format 4), `loca` and `glyf` — simple and composite glyphs, no hinting.
import fs from 'node:fs';

/**
 * @typedef {object} Glyph
 * @property {number} advance in font units
 * @property {[number, number][][]} contours flattened outlines in font units, y up
 */

export class TrueTypeFont {
  /** @param {string} file */
  constructor(file) {
    const buf = fs.readFileSync(file);
    this.view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    /** @type {Map<string, number>} */
    this.tables = new Map();
    const numTables = this.view.getUint16(4);
    for (let i = 0; i < numTables; i++) {
      const rec = 12 + i * 16;
      const tag = String.fromCharCode(...buf.subarray(rec, rec + 4));
      this.tables.set(tag, this.view.getUint32(rec + 8));
    }
    const head = this.table('head');
    this.unitsPerEm = this.view.getUint16(head + 18);
    this.longLoca = this.view.getInt16(head + 50) === 1;
    const hhea = this.table('hhea');
    this.ascender = this.view.getInt16(hhea + 4);
    this.descender = this.view.getInt16(hhea + 6);
    this.numberOfHMetrics = this.view.getUint16(hhea + 34);
    this.numGlyphs = this.view.getUint16(this.table('maxp') + 4);
    this.cmap = this.readCmap();
  }

  /** @param {string} tag */
  table(tag) {
    const offset = this.tables.get(tag);
    if (offset === undefined) throw new Error(`font has no '${tag}' table`);
    return offset;
  }

  /** @returns {Map<number, number>} code point → glyph index, from the first format 4 subtable */
  readCmap() {
    const v = this.view;
    const cmap = this.table('cmap');
    const count = v.getUint16(cmap + 2);
    for (let i = 0; i < count; i++) {
      const rec = cmap + 4 + i * 8;
      const platform = v.getUint16(rec);
      const encoding = v.getUint16(rec + 2);
      const sub = cmap + v.getUint32(rec + 4);
      if (v.getUint16(sub) !== 4 || !((platform === 3 && encoding === 1) || platform === 0)) continue;
      const segX2 = v.getUint16(sub + 6);
      const ends = sub + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const rangeOffsets = deltas + segX2;
      const map = new Map();
      for (let s = 0; s < segX2 / 2; s++) {
        const end = v.getUint16(ends + s * 2);
        const start = v.getUint16(starts + s * 2);
        const delta = v.getInt16(deltas + s * 2);
        const ro = v.getUint16(rangeOffsets + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let g;
          if (ro === 0) g = (c + delta) & 0xffff;
          else {
            const at = rangeOffsets + s * 2 + ro + (c - start) * 2;
            g = v.getUint16(at);
            if (g !== 0) g = (g + delta) & 0xffff;
          }
          if (g !== 0) map.set(c, g);
        }
      }
      return map;
    }
    throw new Error('font has no format 4 cmap subtable');
  }

  /** @param {number} index */
  advanceOf(index) {
    const hmtx = this.table('hmtx');
    const i = Math.min(index, this.numberOfHMetrics - 1);
    return this.view.getUint16(hmtx + i * 4);
  }

  /**
   * @param {number} codePoint
   * @returns {Glyph | undefined}
   */
  glyph(codePoint) {
    const index = this.cmap.get(codePoint);
    if (index === undefined) return undefined;
    return {advance: this.advanceOf(index), contours: this.outline(index, 0)};
  }

  /**
   * @param {number} index
   * @param {number} depth
   * @returns {[number, number][][]}
   */
  outline(index, depth) {
    const v = this.view;
    const loca = this.table('loca');
    const glyf = this.table('glyf');
    const start = this.longLoca ? v.getUint32(loca + index * 4) : v.getUint16(loca + index * 2) * 2;
    const end = this.longLoca ? v.getUint32(loca + index * 4 + 4) : v.getUint16(loca + index * 2 + 2) * 2;
    if (end === start) return [];
    let p = glyf + start;
    const numContours = v.getInt16(p);
    p += 10;
    if (numContours < 0) {
      if (depth > 8) throw new Error('composite glyph nests too deep');
      /** @type {[number, number][][]} */
      const contours = [];
      let flags;
      do {
        flags = v.getUint16(p);
        const component = v.getUint16(p + 2);
        p += 4;
        let dx;
        let dy;
        if (flags & 1) {
          dx = v.getInt16(p);
          dy = v.getInt16(p + 2);
          p += 4;
        } else {
          dx = v.getInt8(p);
          dy = v.getInt8(p + 1);
          p += 2;
        }
        if (!(flags & 2)) throw new Error('composite glyphs with point-matched offsets are not supported');
        let a = 1;
        let b = 0;
        let c = 0;
        let d = 1;
        const f2dot14 = (/** @type {number} */ at) => v.getInt16(at) / 16384;
        if (flags & 0x8) {
          a = d = f2dot14(p);
          p += 2;
        } else if (flags & 0x40) {
          a = f2dot14(p);
          d = f2dot14(p + 2);
          p += 4;
        } else if (flags & 0x80) {
          a = f2dot14(p);
          b = f2dot14(p + 2);
          c = f2dot14(p + 4);
          d = f2dot14(p + 6);
          p += 8;
        }
        for (const contour of this.outline(component, depth + 1)) {
          contours.push(contour.map(([x, y]) => [a * x + c * y + dx, b * x + d * y + dy]));
        }
      } while (flags & 0x20);
      return contours;
    }
    const endPts = [];
    for (let i = 0; i < numContours; i++) endPts.push(v.getUint16(p + i * 2));
    p += numContours * 2;
    p += 2 + v.getUint16(p); // instructions
    const numPoints = numContours ? endPts[numContours - 1] + 1 : 0;
    const flags = [];
    while (flags.length < numPoints) {
      const f = v.getUint8(p++);
      flags.push(f);
      if (f & 8) {
        const repeat = v.getUint8(p++);
        for (let r = 0; r < repeat; r++) flags.push(f);
      }
    }
    const xs = [];
    let x = 0;
    for (const f of flags) {
      if (f & 2) {
        const d = v.getUint8(p++);
        x += f & 16 ? d : -d;
      } else if (!(f & 16)) {
        x += v.getInt16(p);
        p += 2;
      }
      xs.push(x);
    }
    const ys = [];
    let y = 0;
    for (const f of flags) {
      if (f & 4) {
        const d = v.getUint8(p++);
        y += f & 32 ? d : -d;
      } else if (!(f & 32)) {
        y += v.getInt16(p);
        p += 2;
      }
      ys.push(y);
    }
    /** @type {[number, number][][]} */
    const contours = [];
    let first = 0;
    for (const last of endPts) {
      contours.push(flatten(xs.slice(first, last + 1), ys.slice(first, last + 1), flags.slice(first, last + 1)));
      first = last + 1;
    }
    return contours;
  }

  /**
   * Rasterizes a glyph at `pixelsPerEm`. The bitmap spans the advance horizontally and the line
   * from ascender to descender vertically, so all glyphs share one baseline: row `baseline` is the
   * first row below it.
   * @param {number} codePoint
   * @param {number} pixelsPerEm
   * @returns {{width: number, height: number, baseline: number, advance: number, mask: Uint8Array} | undefined}
   */
  rasterize(codePoint, pixelsPerEm) {
    const g = this.glyph(codePoint);
    if (!g) return undefined;
    const scale = pixelsPerEm / this.unitsPerEm;
    const advance = Math.round(g.advance * scale);
    const top = Math.round(this.ascender * scale);
    const bottom = Math.round(-this.descender * scale);
    const width = advance;
    const height = top + bottom;
    const mask = new Uint8Array(width * height);
    const edges = g.contours.flatMap((c) => c.map((pt, i) => [pt, c[(i + 1) % c.length]]));
    for (let py = 0; py < height; py++) {
      const fy = (top - py - 0.5) / scale;
      for (let px = 0; px < width; px++) {
        const fx = (px + 0.5) / scale;
        let winding = 0;
        for (const [[x0, y0], [x1, y1]] of edges) {
          if (y0 <= fy) {
            if (y1 > fy && cross(x0, y0, x1, y1, fx, fy) > 0) winding++;
          } else if (y1 <= fy && cross(x0, y0, x1, y1, fx, fy) < 0) winding--;
        }
        if (winding !== 0) mask[py * width + px] = 1;
      }
    }
    return {width, height, baseline: top, advance, mask};
  }
}

/**
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @param {number} px
 * @param {number} py
 */
function cross(x0, y0, x1, y1, px, py) {
  return (x1 - x0) * (py - y0) - (px - x0) * (y1 - y0);
}

/**
 * Turns a TrueType contour (on-curve and off-curve points) into a polygon, quadratic arcs cut into
 * eight lines each.
 * @param {number[]} xs
 * @param {number[]} ys
 * @param {number[]} flags
 * @returns {[number, number][]}
 */
function flatten(xs, ys, flags) {
  const n = xs.length;
  /** @type {{x: number, y: number, on: boolean}[]} */
  const pts = [];
  for (let i = 0; i < n; i++) {
    const cur = {x: xs[i], y: ys[i], on: (flags[i] & 1) === 1};
    const prev = pts[pts.length - 1];
    if (prev && !prev.on && !cur.on) pts.push({x: (prev.x + cur.x) / 2, y: (prev.y + cur.y) / 2, on: true});
    pts.push(cur);
  }
  if (pts.length && !pts[0].on && !pts[pts.length - 1].on) {
    pts.push({x: (pts[0].x + pts[pts.length - 1].x) / 2, y: (pts[0].y + pts[pts.length - 1].y) / 2, on: true});
  }
  const startIndex = pts.findIndex((pt) => pt.on);
  if (startIndex < 0) return [];
  const ring = [...pts.slice(startIndex), ...pts.slice(0, startIndex)];
  /** @type {[number, number][]} */
  const out = [[ring[0].x, ring[0].y]];
  for (let i = 1; i <= ring.length; i++) {
    const pt = ring[i % ring.length];
    if (pt.on) {
      out.push([pt.x, pt.y]);
      continue;
    }
    const prev = ring[i - 1];
    const next = ring[(i + 1) % ring.length];
    for (let s = 1; s <= 8; s++) {
      const t = s / 8;
      const u = 1 - t;
      out.push([u * u * prev.x + 2 * u * t * pt.x + t * t * next.x, u * u * prev.y + 2 * u * t * pt.y + t * t * next.y]);
    }
    i++;
  }
  out.pop(); // the closing point repeats the first
  return out;
}

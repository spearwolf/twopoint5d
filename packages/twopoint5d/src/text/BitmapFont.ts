import {TextureAtlas, type TextureAtlasFrame} from '../texture/TextureAtlas.js';
import {TextureCoords} from '../texture/TextureCoords.js';
import {describeValue} from '../utils/describeValue.js';
import {readBitmapFontSource} from './readBitmapFontSource.js';

/** A char of a BMFont, as the font file writes it: where it lies in the page, and how it is set. */
export interface BitmapFontChar {
  /** The code point of the char. */
  id: number;
  /** Where the glyph lies in the page, in pixels from its top left. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Where the glyph is drawn, in pixels from the pen position and the top of the line. */
  xoffset: number;
  yoffset: number;
  /** How far the pen moves on after the char, in pixels. */
  xadvance: number;
  /** The page of the glyph; a font of one page has 0 everywhere. A char without it is read as one of page 0. */
  page: number;
  /** The channels of the page the glyph is in; 15 for all four. A char without it is read with 15. */
  chnl: number;
}

/** A kerning pair of a BMFont: `amount` pixels more (or, negative, less) between `first` and `second`. */
export interface BitmapFontKerning {
  first: number;
  second: number;
  amount: number;
}

/** The `info` block of a BMFont: how the font was made. Kept as it is read; only `face` and `size` are used. */
export interface BitmapFontInfo {
  face?: string;
  size?: number;
  bold?: number;
  italic?: number;
  charset?: string | string[];
  unicode?: number;
  stretchH?: number;
  smooth?: number;
  aa?: number;
  padding?: number[];
  spacing?: number[];
  outline?: number;
}

/** The `common` block of a BMFont: the metrics every line shares and the size of the page. */
export interface BitmapFontCommon {
  /** The distance of two lines, in pixels. */
  lineHeight: number;
  /** The distance from the top of a line to its baseline, in pixels. */
  base: number;
  /** The size of the page, in pixels. */
  scaleW: number;
  scaleH: number;
  pages?: number;
  packed?: number;
  alphaChnl?: number;
  redChnl?: number;
  greenChnl?: number;
  blueChnl?: number;
}

/**
 * A BMFont in the JSON layout of `parse-bmfont-ascii`, `load-bmfont`, `bmfont2json` and `msdf-bmfont-xml`
 * — and what `BitmapFont.parse()` reads the text and the XML spelling into.
 */
export interface BitmapFontData {
  /** The page files, relative to the font file. */
  pages: string[];
  chars: BitmapFontChar[];
  kernings?: BitmapFontKerning[];
  info?: BitmapFontInfo;
  common: BitmapFontCommon;
}

/** A glyph of a {@link BitmapFont}: its char as the file writes it, the char as a string, and its frame. */
export interface BitmapFontGlyph extends Readonly<BitmapFontChar> {
  readonly char: string;
  readonly frame: TextureAtlasFrame<BitmapFontChar>;
}

export interface BitmapFontOptions {
  /**
   * The coords the page lies in — for a page packed into a larger image. By default the page is the
   * whole image, `new TextureCoords(0, 0, scaleW, scaleH)`.
   */
  parentCoords?: TextureCoords;
}

const WHERE = 'BitmapFont';

// the code points of a pair in one number: a code point is below 0x110000
const pairKey = (first: number, second: number) => first * 0x110000 + second;

const codeOf = (char: string | number): number | undefined => (typeof char === 'number' ? char : char.codePointAt(0));

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const article = (field: string) => (/^[aeiox]/.test(field) ? 'an' : 'a');

const CHAR_FIELDS = ['x', 'y', 'width', 'height', 'xoffset', 'yoffset', 'xadvance', 'page', 'chnl'] as const;
const AT_LEAST_ZERO: ReadonlySet<string> = new Set(['x', 'y', 'width', 'height']);

/**
 * A bitmap font in the AngelCode BMFont format: the metrics of its lines, its glyphs and its kerning
 * pairs, and a {@link TextureAtlas} with one frame per char of its page. `writeText()` lays a string of
 * it out into sprites, `layoutText()` measures one.
 *
 * The page image is not loaded here: {@link page} names it relative to the font file, and it is loaded
 * with `flipY = false` — as `TextureFactory` and `TextureStore` load every image — and the texture class
 * `nearest` for a pixel font.
 *
 * A font is plain data with no `dispose()`.
 */
export class BitmapFont {
  /**
   * Reads a BMFont — the text format (`.fnt`), XML, or JSON as an object or a string — and answers the
   * font and its atlas, `[font, font.atlas]`.
   *
   * The atlas holds one frame per char, named by the char as a string (`'A'`), in the order of the file;
   * its `data` is a frozen copy of the char. The frames are untrimmed: the offsets of a glyph place it in
   * its line, which `writeText()` does. A char of 0 × 0 — the space — has a frame of 0 × 0.
   *
   * @throws {Error} for a source in none of the three spellings or in the binary one, JSON that does not
   *   parse, and every refusal of the constructor.
   */
  static parse(
    source: string | BitmapFontData,
    options?: BitmapFontOptions,
  ): [font: BitmapFont, atlas: TextureAtlas<BitmapFontChar>] {
    const font = new BitmapFont(readBitmapFontSource(source), options);
    return [font, font.atlas];
  }

  /** One frame per char, named by the char. */
  readonly atlas: TextureAtlas<BitmapFontChar>;
  /** The face of `info`, or `''`. */
  readonly face: string;
  /** The size of `info`, or the line height without one. */
  readonly size: number;
  readonly lineHeight: number;
  readonly base: number;
  readonly scaleW: number;
  readonly scaleH: number;
  /** The file of the page as the font names it — relative to the font file — or `undefined`. */
  readonly page: string | undefined;
  /** The `info` block as read, frozen. */
  readonly info: Readonly<BitmapFontInfo>;
  /** The `common` block as read, frozen. */
  readonly common: Readonly<BitmapFontCommon>;

  readonly #glyphs = new Map<number, BitmapFontGlyph>();
  readonly #kernings = new Map<number, number>();

  /**
   * A font of `data` in the JSON layout; `BitmapFont.parse()` reads the other spellings into it.
   *
   * @throws {Error} — each before the atlas holds a frame — for a font without a `common` block or with a
   *   `lineHeight`, `base`, `scaleW` or `scaleH` that is no finite number (the last two above 0), without
   *   `chars`, with more than one page, with a char whose id is no whole number of 0 or more, whose fields
   *   are no finite numbers, whose `x`, `y`, `width` or `height` are below 0, or which reaches beyond the
   *   page, with two chars of one id, and with a kerning pair that is no finite numbers.
   */
  constructor(data: BitmapFontData, options?: BitmapFontOptions) {
    const {common} = data;
    if (common == null || typeof common !== 'object') {
      throw new Error(`${WHERE}: the font has no common block — BMFont writes lineHeight, base, scaleW and scaleH there`);
    }
    for (const key of ['lineHeight', 'base', 'scaleW', 'scaleH'] as const) {
      const value: unknown = common[key];
      const above0 = key === 'scaleW' || key === 'scaleH';
      if (!isFiniteNumber(value) || (above0 && value <= 0)) {
        throw new Error(
          `${WHERE}: common.${key} must be a finite number${above0 ? ' above 0' : ''}, got ${describeValue(value)}`,
        );
      }
    }
    if (!Array.isArray(data.chars)) {
      throw new Error(`${WHERE}: the font has no chars — BMFont lists one entry per glyph`);
    }
    const info: BitmapFontInfo = data.info ?? {};
    const face = typeof info.face === 'string' ? info.face : '';
    const pages = Array.isArray(data.pages) ? data.pages : [];

    const pageCount = Math.max(
      pages.length,
      isFiniteNumber(common.pages) ? common.pages : 0,
      ...data.chars.map((char) => (isFiniteNumber(char?.page) ? char.page + 1 : 0)),
    );
    if (pageCount > 1) {
      throw new Error(
        `${WHERE}: the font "${face}" has ${pageCount} pages — writeText() draws out of one texture; export the font onto one page (BMFont: a larger texture)`,
      );
    }

    const {scaleW, scaleH} = common;
    const chars: BitmapFontChar[] = [];
    const ids = new Set<number>();
    for (const raw of data.chars) {
      const id: unknown = raw?.id;
      if (typeof id !== 'number' || !Number.isInteger(id) || id < 0 || id > 0x10ffff) {
        throw new Error(`${WHERE}: a char has the id ${describeValue(id)} — an id is a whole number of 0 or more`);
      }
      const label = `"${String.fromCodePoint(id)}" (${id})`;
      // a converter that leaves out page and chnl writes a font of one page, all four channels
      const char: BitmapFontChar = {...raw, page: raw.page ?? 0, chnl: raw.chnl ?? 15};
      for (const field of CHAR_FIELDS) {
        const value: unknown = char[field];
        if (!isFiniteNumber(value)) {
          throw new Error(
            `${WHERE}: the char ${label} has ${article(field)} ${field} of ${describeValue(value)} — a finite number`,
          );
        }
        if (AT_LEAST_ZERO.has(field) && value < 0) {
          throw new Error(`${WHERE}: the char ${label} has ${article(field)} ${field} of ${value} — 0 or more`);
        }
      }
      if (char.x + char.width > scaleW) {
        throw new Error(
          `${WHERE}: the char ${label} reaches beyond the page of ${scaleW} × ${scaleH} — x ${char.x} + width ${char.width}`,
        );
      }
      if (char.y + char.height > scaleH) {
        throw new Error(
          `${WHERE}: the char ${label} reaches beyond the page of ${scaleW} × ${scaleH} — y ${char.y} + height ${char.height}`,
        );
      }
      if (ids.has(id)) {
        throw new Error(`${WHERE}: the char ${label} appears twice`);
      }
      ids.add(id);
      chars.push(char);
    }

    const kernings = Array.isArray(data.kernings) ? data.kernings : [];
    kernings.forEach((pair, index) => {
      for (const field of ['first', 'second', 'amount'] as const) {
        const value: unknown = pair?.[field];
        if (!isFiniteNumber(value)) {
          throw new Error(
            `${WHERE}: kerning pair ${index} has ${article(field)} ${field} of ${describeValue(value)} — first, second and amount are finite numbers`,
          );
        }
      }
    });

    // every check has run: nothing below throws
    this.info = Object.freeze({...info});
    this.common = Object.freeze({...common});
    this.face = face;
    this.lineHeight = common.lineHeight;
    this.base = common.base;
    this.scaleW = scaleW;
    this.scaleH = scaleH;
    this.size = isFiniteNumber(info.size) ? info.size : common.lineHeight;
    this.page = pages[0];

    const parent = options?.parentCoords ?? new TextureCoords(0, 0, scaleW, scaleH);
    const atlas = new TextureAtlas<BitmapFontChar>();
    for (const char of chars) {
      const {id, x, y, width, height, xoffset, yoffset, xadvance, page, chnl} = char;
      const data = Object.freeze({id, x, y, width, height, xoffset, yoffset, xadvance, page, chnl});
      const name = String.fromCodePoint(id);
      const frame = atlas.get(atlas.add(name, new TextureCoords(parent, x, y, width, height), data))!;
      this.#glyphs.set(id, Object.freeze({...data, char: name, frame}));
    }
    this.atlas = atlas;

    for (const {first, second, amount} of kernings) {
      this.#kernings.set(pairKey(first, second), amount);
    }
  }

  /** How many glyphs the font holds. */
  get glyphCount(): number {
    return this.#glyphs.size;
  }

  /** The glyph of a char — of the first code point of a string, or of a code point — or `undefined`. */
  glyph(char: string | number): BitmapFontGlyph | undefined {
    const code = codeOf(char);
    return code === undefined ? undefined : this.#glyphs.get(code);
  }

  /** The kerning amount between two chars, in pixels of the font; 0 without a pair. */
  kerning(first: string | number, second: string | number): number {
    const a = codeOf(first);
    const b = codeOf(second);
    if (a === undefined || b === undefined) return 0;
    return this.#kernings.get(pairKey(a, b)) ?? 0;
  }
}

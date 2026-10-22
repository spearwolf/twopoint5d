import {assertFinite} from '../utils/assertFinite.js';
import {assertPositiveFinite} from '../utils/assertPositiveFinite.js';
import {describeValue} from '../utils/describeValue.js';
import type {BitmapFont, BitmapFontGlyph} from './BitmapFont.js';

/** How {@link layoutText} and `writeText()` lay a text out. */
export interface TextLayoutOptions {
  /** Where the text goes, in units of the mesh: the left edge, middle or right edge of every line by `align`. Default 0. */
  x?: number;
  /** The top of the first line — the top of the BMFont line box — in units of the mesh, y up. Default 0. */
  y?: number;
  /** How each line lies against `x`. Default `'left'`. */
  align?: 'left' | 'center' | 'right';
  /** Units of the mesh per pixel of the font. Default 1. */
  scale?: number;
  /** Extra space between two glyphs of a line, in pixels of the font. Default 0. */
  letterSpacing?: number;
  /** The distance of two lines, in pixels of the font, above 0. Default the `lineHeight` of the font. */
  lineHeight?: number;
  /**
   * A line wider than this, in units of the mesh, breaks before the word that made it too wide: at a
   * breakable space, after U+200B, or before an ideograph or a kana. Default: no wrap.
   */
  maxWidth?: number;
  /**
   * A char drawn in place of a char the font lacks — never for a space, a line end, or a control or
   * format char. Default: such a char is skipped.
   */
  fallback?: string;
}

/** A glyph of a {@link TextLayout}: the glyph of the font, its line, and its box in units of the mesh. */
export interface TextLayoutGlyph {
  readonly glyph: BitmapFontGlyph;
  /** The line of the glyph, from 0. */
  readonly line: number;
  /** The left edge of the box. */
  readonly x: number;
  /** The top edge of the box, y up. */
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A text laid out by {@link layoutText}. */
export interface TextLayout {
  /** The visible glyphs in reading order — no space, no char of 0 × 0. */
  readonly glyphs: readonly TextLayoutGlyph[];
  /** How many lines the text takes; an empty text is one empty line. */
  readonly lineCount: number;
  /** The width of the widest line, in units of the mesh; the breakable spaces at the end of a line hang out of it. */
  readonly width: number;
  /** The height of all lines, `lineCount · lineHeight · scale`. */
  readonly height: number;
}

const ALIGNS: readonly string[] = ['left', 'center', 'right'];

const SPACE = 32;

// The classes of a char, tested in this order. A line end ends the line. A breakable space is a place to
// break, hangs at the end of a line and is dropped at a break; a tab is set as U+0020, the others as
// their own glyph or else as U+0020, and one the font has neither for breaks without taking room, as
// U+200B does. A no-break space is set the same way, holds its word together, and is dropped without
// either glyph. A control or format char is dropped: no glyph, no room, never the fallback
const LINE_END = /^[\n\u2028\u2029]$/u;
const TAB = '\t';
const BREAKABLE_SPACE = /^[\u0020\t\u1680\u2000-\u2006\u2008-\u200a\u205f\u3000]$/u;
const ZERO_WIDTH_BREAK = '\u200b';
const NO_BREAK_SPACE = /^[\u00a0\u2007\u202f]$/u;
const CONTROL_OR_FORMAT = /^[\p{Cc}\p{Cf}]$/u;
// a line may break before an ideograph or a kana; a mark after it (。, 」, of the script Common) stays
// with the char before, so a closing mark never starts a line. One the font lacks and no fallback draws
// is skipped and leaves no place to break
const BREAK_BEFORE = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]$/u;

// a char of a line set in the font: its glyph, whether it is a breakable space, and whether the line
// may break before it
interface Entry {
  readonly glyph: BitmapFontGlyph;
  readonly space: boolean;
  readonly breakBefore: boolean;
}

// the options of a layout, checked
interface ResolvedTextLayoutOptions {
  readonly x: number;
  readonly y: number;
  readonly align: 'left' | 'center' | 'right';
  readonly scale: number;
  readonly letterSpacing: number;
  readonly lineHeight: number;
  readonly maxWidth: number | undefined;
  readonly fallback: BitmapFontGlyph | undefined;
}

const resolveOptions = (where: string, font: BitmapFont, options: TextLayoutOptions): ResolvedTextLayoutOptions => {
  const align = options.align ?? 'left';
  if (!ALIGNS.includes(align)) {
    throw new Error(`${where}: the align ${describeValue(align)} is none of 'left', 'center', 'right'`);
  }
  let fallback: BitmapFontGlyph | undefined;
  if (options.fallback !== undefined) {
    const {fallback: char} = options;
    if (typeof char !== 'string' || [...char].length !== 1) {
      throw new Error(`${where}: the fallback ${describeValue(char)} is no single char`);
    }
    fallback = font.glyph(char);
    if (fallback === undefined) {
      throw new Error(`${where}: the fallback ${describeValue(char)} is no glyph of the font "${font.face}"`);
    }
  }
  return {
    x: assertFinite(options.x ?? 0, where, 'x'),
    y: assertFinite(options.y ?? 0, where, 'y'),
    align,
    scale: assertPositiveFinite(options.scale ?? 1, where, 'scale'),
    letterSpacing: assertFinite(options.letterSpacing ?? 0, where, 'letterSpacing'),
    lineHeight: assertPositiveFinite(options.lineHeight ?? font.lineHeight, where, 'lineHeight'),
    maxWidth: options.maxWidth === undefined ? undefined : assertPositiveFinite(options.maxWidth, where, 'maxWidth'),
    fallback,
  };
};

// the lines of a text, each char turned into an entry of its class; the chars that take no room are left out
const entriesOf = (font: BitmapFont, text: string, fallback: BitmapFontGlyph | undefined): Entry[][] => {
  const space = font.glyph(SPACE);
  const lines: Entry[][] = [[]];
  // a place to break left by a char without an entry, for the next entry
  let pendingBreak = false;
  for (const char of text) {
    if (LINE_END.test(char)) {
      lines.push([]);
      pendingBreak = false;
      continue;
    }
    if (BREAKABLE_SPACE.test(char)) {
      const glyph = char === TAB ? space : (font.glyph(char) ?? space);
      if (glyph === undefined) pendingBreak = true;
      else lines.at(-1)!.push({glyph, space: true, breakBefore: false});
      continue;
    }
    if (char === ZERO_WIDTH_BREAK) {
      pendingBreak = true;
      continue;
    }
    let glyph: BitmapFontGlyph | undefined;
    if (NO_BREAK_SPACE.test(char)) {
      glyph = font.glyph(char) ?? space;
    } else if (CONTROL_OR_FORMAT.test(char)) {
      continue;
    } else {
      glyph = font.glyph(char) ?? fallback;
      // the place to break before an ideograph or a kana goes with its glyph: one skipped leaves none,
      // so the mark after it stays with the char before
      if (glyph !== undefined && BREAK_BEFORE.test(char)) pendingBreak = true;
    }
    if (glyph !== undefined) {
      lines.at(-1)!.push({glyph, space: false, breakBefore: pendingBreak});
      pendingBreak = false;
    }
  }
  return lines;
};

// The width of entries set on one line, in pixels of the font: the pen after the last entry that is no
// breakable space, less the letter spacing behind it. The spaces behind it hang out of the line; a line
// of nothing but spaces is 0 wide. A kerning pair moves the second glyph of it
const widthOf = (font: BitmapFont, entries: readonly Entry[], letterSpacing: number): number => {
  let pen = 0;
  let width = 0;
  for (let i = 0; i < entries.length; i++) {
    const {glyph, space} = entries[i]!;
    if (i > 0) pen += font.kerning(entries[i - 1]!.glyph.id, glyph.id);
    pen += glyph.xadvance + letterSpacing;
    if (!space) width = pen - letterSpacing;
  }
  return width;
};

// the pen after `entries` set behind `previous` at `pen`, and the last glyph set, in pixels of the font
const advance = (
  font: BitmapFont,
  previous: BitmapFontGlyph | undefined,
  entries: readonly Entry[],
  pen: number,
  letterSpacing: number,
): {pen: number; last: BitmapFontGlyph | undefined} => {
  let last = previous;
  for (const {glyph} of entries) {
    if (last !== undefined) pen += font.kerning(last.id, glyph.id);
    pen += glyph.xadvance + letterSpacing;
    last = glyph;
  }
  return {pen, last};
};

// A line of the text broken where it is too wide: before the word that would make it wider than
// `maxWidth`, every space at the break dropped. A word wider than maxWidth on its own stays whole
const wrap = (font: BitmapFont, entries: readonly Entry[], maxWidth: number, letterSpacing: number): Entry[][] => {
  // the runs of the line, words and spaces taking turns — and two words in a row where the second may
  // break before it, with no space between them
  const runs: {space: boolean; entries: Entry[]}[] = [];
  for (const entry of entries) {
    const last = runs.at(-1);
    if (last?.space === entry.space && (entry.space || !entry.breakBefore)) last.entries.push(entry);
    else runs.push({space: entry.space, entries: [entry]});
  }

  // The line grows by a running pen, in pixels of the font: each word adds its own glyphs and the kerning
  // pair at its join, and nothing is measured twice — a line of n glyphs costs O(n)
  const lines: Entry[][] = [];
  let line: Entry[] = [];
  let pen = 0;
  let last: BitmapFontGlyph | undefined;
  let hasWord = false;
  let pendingSpaces: Entry[] = [];
  for (const run of runs) {
    if (run.space) {
      pendingSpaces = run.entries;
      continue;
    }
    const spaces = advance(font, last, pendingSpaces, pen, letterSpacing);
    const word = advance(font, spaces.last, run.entries, spaces.pen, letterSpacing);
    if (hasWord && word.pen - letterSpacing > maxWidth) {
      lines.push(line);
      const alone = advance(font, undefined, run.entries, 0, letterSpacing);
      line = run.entries.slice();
      pen = alone.pen;
      last = alone.last;
    } else {
      for (const entry of pendingSpaces) line.push(entry);
      for (const entry of run.entries) line.push(entry);
      pen = word.pen;
      last = word.last;
    }
    hasWord = true;
    pendingSpaces = [];
  }
  // the spaces at the end of a line of the text stay for the pen; they hang out of its width
  lines.push([...line, ...pendingSpaces]);
  return lines;
};

/**
 * Lays `text` out in `font` — the pure half of `writeText()`: no sprites, nothing written. For measuring a
 * text before it is drawn and for a mesh of one's own.
 *
 * The text lies in the x/y plane of the mesh, y up. `(x, y)` is the top of the first line — the top of the
 * BMFont line box, which every `yoffset` is measured from — at its left edge, middle or right edge by
 * `align`; a baseline at `b` is `y: b + font.base · scale`. Line `n` has its top at
 * `y − n · lineHeight · scale`. A glyph lies at the pen plus its `xoffset`, below the top of its line by its
 * `yoffset`; the pen moves on by its `xadvance` and the `letterSpacing`, and a kerning pair moves the second
 * glyph of it by its amount. All measures of the font are multiplied by `scale`.
 *
 * Chars are read by code point. `\n`, U+2028 and U+2029 end a line. A breakable space — U+0020, the tab,
 * U+1680, U+2000–U+2006, U+2008–U+200A, U+205F, U+3000 — moves the pen and yields no glyph: a tab by the
 * advance of U+0020, the others by their own glyph or else by U+0020; one the font has neither for takes
 * no room. A no-break space — U+00A0, U+2007, U+202F — is set as its own glyph or else as U+0020, yields a glyph
 * where that one has a box, holds its word together, and is dropped without either.
 * Control and format chars (`\r`, a soft hyphen, U+200B–U+200F, U+FEFF …) are dropped: no glyph, no room,
 * never the `fallback`. Any other char the font lacks is drawn as `fallback`, or skipped without taking
 * room. A kerning pair forms across a char that is dropped or skipped. A char of 0 × 0 yields no glyph.
 *
 * A line is as wide as the pen after its last char that is no breakable space: the spaces at its end hang
 * out of its width and its alignment. With `maxWidth` a line breaks before the word that would make it
 * wider — at a breakable space, after U+200B, or before an ideograph or a kana (Han, Hiragana, Katakana) —
 * the spaces at the break dropped; a word wider on its own overflows. A mark after an ideograph stays with
 * it, so a closing mark never starts a line. An ideograph or a kana the font lacks and no `fallback`
 * draws is skipped and leaves no place to break.
 *
 * Every call builds a layout object per glyph: lay a text out when it changes, not every frame.
 *
 * @throws {RangeError} for a `scale`, `lineHeight` or `maxWidth` that is no finite number above 0, and an
 *   `x`, `y` or `letterSpacing` that is no finite number.
 * @throws {Error} for an `align` it does not know, and a `fallback` that is no single char or no glyph of the font.
 * @throws {TypeError} for a text that is no string.
 */
export function layoutText(font: BitmapFont, text: string, options?: TextLayoutOptions): TextLayout {
  return layoutTextFor('layoutText', font, text, options ?? {});
}

/** {@link layoutText}, naming `where` in its errors. @internal */
export function layoutTextFor(where: string, font: BitmapFont, text: string, options: TextLayoutOptions): TextLayout {
  if (typeof text !== 'string') {
    throw new TypeError(`${where}: the text must be a string, got ${describeValue(text)}`);
  }
  const {x, y, align, scale, letterSpacing, lineHeight, maxWidth, fallback} = resolveOptions(where, font, options);

  const textLines = entriesOf(font, text, fallback);
  const lines =
    maxWidth === undefined ? textLines : textLines.flatMap((line) => wrap(font, line, maxWidth / scale, letterSpacing));

  const glyphs: TextLayoutGlyph[] = [];
  let width = 0;
  lines.forEach((line, index) => {
    const lineWidth = widthOf(font, line, letterSpacing) * scale;
    width = Math.max(width, lineWidth);
    const left = align === 'left' ? x : align === 'center' ? x - lineWidth / 2 : x - lineWidth;
    const top = y - index * lineHeight * scale;
    let pen = 0;
    for (let i = 0; i < line.length; i++) {
      const {glyph, space} = line[i]!;
      if (i > 0) pen += font.kerning(line[i - 1]!.glyph.id, glyph.id);
      if (!space && glyph.width > 0 && glyph.height > 0) {
        glyphs.push({
          glyph,
          line: index,
          x: left + (pen + glyph.xoffset) * scale,
          y: top - glyph.yoffset * scale,
          width: glyph.width * scale,
          height: glyph.height * scale,
        });
      }
      pen += glyph.xadvance + letterSpacing;
    }
  });

  return {glyphs, lineCount: lines.length, width, height: lines.length * lineHeight * scale};
}

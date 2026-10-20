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
  /** The distance of two lines, in pixels of the font. Default the `lineHeight` of the font. */
  lineHeight?: number;
  /** A line wider than this, in units of the mesh, breaks at a space. Default: no wrap. */
  maxWidth?: number;
  /** A char drawn in place of a char the font lacks. Default: such a char is skipped. */
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
  /** The width of the widest line, in units of the mesh. */
  readonly width: number;
  /** The height of all lines, `lineCount · lineHeight · scale`. */
  readonly height: number;
}

const ALIGNS: readonly string[] = ['left', 'center', 'right'];

const SPACE = 32;

const finite = (where: string, name: string, value: unknown, above0 = false): number => {
  if (typeof value !== 'number' || !Number.isFinite(value) || (above0 && value <= 0)) {
    throw new RangeError(`${where}: the ${name} must be a finite number${above0 ? ' above 0' : ''}, got ${describeValue(value)}`);
  }
  return value;
};

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
    x: finite(where, 'x', options.x ?? 0),
    y: finite(where, 'y', options.y ?? 0),
    align,
    scale: finite(where, 'scale', options.scale ?? 1, true),
    letterSpacing: finite(where, 'letterSpacing', options.letterSpacing ?? 0),
    lineHeight: finite(where, 'lineHeight', options.lineHeight ?? font.lineHeight),
    maxWidth: options.maxWidth === undefined ? undefined : finite(where, 'maxWidth', options.maxWidth, true),
    fallback,
  };
};

// The width of a run of glyphs set on one line, in pixels of the font: the pen after the last glyph,
// less the letter spacing behind it. A kerning pair moves the second glyph of it
const widthOf = (font: BitmapFont, glyphs: readonly BitmapFontGlyph[], letterSpacing: number): number => {
  if (glyphs.length === 0) return 0;
  let pen = 0;
  for (let i = 0; i < glyphs.length; i++) {
    const glyph = glyphs[i]!;
    if (i > 0) pen += font.kerning(glyphs[i - 1]!.id, glyph.id);
    pen += glyph.xadvance + letterSpacing;
  }
  return pen - letterSpacing;
};

// a line of the text broken where it is too wide: at the last space before the word that would make it
// wider than `maxWidth`, every space at the break dropped. A word wider than maxWidth on its own stays whole
const wrap = (
  font: BitmapFont,
  glyphs: readonly BitmapFontGlyph[],
  maxWidth: number,
  letterSpacing: number,
): BitmapFontGlyph[][] => {
  // the runs of the line, words and spaces taking turns
  const runs: {space: boolean; glyphs: BitmapFontGlyph[]}[] = [];
  for (const glyph of glyphs) {
    const space = glyph.id === SPACE;
    const last = runs.at(-1);
    if (last?.space === space) last.glyphs.push(glyph);
    else runs.push({space, glyphs: [glyph]});
  }

  const lines: BitmapFontGlyph[][] = [];
  let line: BitmapFontGlyph[] = [];
  let hasWord = false;
  let pendingSpaces: BitmapFontGlyph[] = [];
  for (const run of runs) {
    if (run.space) {
      pendingSpaces = run.glyphs;
      continue;
    }
    const candidate = [...line, ...pendingSpaces, ...run.glyphs];
    if (hasWord && widthOf(font, candidate, letterSpacing) > maxWidth) {
      lines.push(line);
      line = [...run.glyphs];
    } else {
      line = candidate;
    }
    hasWord = true;
    pendingSpaces = [];
  }
  // the spaces at the end of a line of the text stay
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
 * Chars are read by code point; `\n` ends a line and `\r` is dropped. A char the font lacks is drawn as
 * `fallback`, or skipped without taking room — a kerning pair then forms across it. A char of 0 × 0, the
 * space, moves the pen and yields no glyph. With `maxWidth` a line breaks at the last space before the word
 * that would make it wider, the spaces at the break dropped; a word wider on its own overflows.
 *
 * Every call builds a layout object per glyph: lay a text out when it changes, not every frame.
 *
 * @throws {RangeError} for a `scale` or `maxWidth` that is no finite number above 0, and an `x`, `y`,
 *   `letterSpacing` or `lineHeight` that is no finite number.
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

  // the lines of the text, the chars turned into glyphs and the ones the font lacks left out
  const textLines: BitmapFontGlyph[][] = [[]];
  for (const char of text) {
    if (char === '\n') {
      textLines.push([]);
      continue;
    }
    if (char === '\r') continue;
    const glyph = font.glyph(char) ?? fallback;
    if (glyph !== undefined) textLines.at(-1)!.push(glyph);
  }
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
      const glyph = line[i]!;
      if (i > 0) pen += font.kerning(line[i - 1]!.id, glyph.id);
      if (glyph.width > 0 && glyph.height > 0) {
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

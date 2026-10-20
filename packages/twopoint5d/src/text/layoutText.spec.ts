import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';
import {tinyFontData} from '../testing/bitmapFonts.js';
import {BitmapFont} from './BitmapFont.js';
import {layoutText, type TextLayout} from './layoutText.js';

const font = new BitmapFont(tinyFontData());

/** `[char, line, x, y, width, height]` of every glyph of a layout. */
const boxes = (layout: TextLayout) =>
  layout.glyphs.map(({glyph, line, x, y, width, height}) => [glyph.char, line, x, y, width, height]);

describe('layoutText()', () => {
  describe('one line', () => {
    test('places each glyph by its offsets from the pen and the top of the line, y up', () => {
      const layout = layoutText(font, 'A-');
      // A: pen 0, yoffset 1; '-': pen 4, xoffset 1, yoffset 3
      expect(boxes(layout)).toEqual([
        ['A', 0, 0, -1, 3, 4],
        ['-', 0, 5, -3, 2, 1],
      ]);
      expect(layout.width).toBe(8);
      expect(layout.height).toBe(6);
      expect(layout.lineCount).toBe(1);
    });

    test('moves the second char of a kerning pair by its amount', () => {
      const layout = layoutText(font, 'AV');
      // V: pen 4 − 1 for the pair, xoffset −1
      expect(boxes(layout)).toEqual([
        ['A', 0, 0, -1, 3, 4],
        ['V', 0, 2, -1, 3, 4],
      ]);
      expect(layout.width).toBe(7);
      expect(layoutText(font, 'VA').glyphs[1]?.x).toBe(4);
    });

    test('lays letterSpacing between the chars, not after the last', () => {
      const layout = layoutText(font, 'AV', {letterSpacing: 2});
      expect(boxes(layout).map(([, , x]) => x)).toEqual([0, 4]);
      expect(layout.width).toBe(9);
    });

    test('starts at (x, y), the top of the first line', () => {
      const layout = layoutText(font, 'A', {x: 10, y: 20});
      expect(boxes(layout)).toEqual([['A', 0, 10, 19, 3, 4]]);
    });

    test('scales every measure of the font', () => {
      const layout = layoutText(font, 'AV', {scale: 2, letterSpacing: 1, x: 1, y: 1});
      expect(boxes(layout)).toEqual([
        ['A', 0, 1, -1, 6, 8],
        ['V', 0, 7, -1, 6, 8],
      ]);
      expect(layout.width).toBe(16);
      expect(layout.height).toBe(12);
    });

    test('a space moves the pen and yields no glyph', () => {
      const layout = layoutText(font, ' A ');
      expect(boxes(layout)).toEqual([['A', 0, 3, -1, 3, 4]]);
      expect(layout.width).toBe(10);
    });

    test('reads chars by code point', () => {
      const layout = layoutText(font, '😀A');
      expect(boxes(layout)).toEqual([
        ['😀', 0, 0, 0, 2, 2],
        ['A', 0, 3, -1, 3, 4],
      ]);
    });

    test('skips a char the font lacks, and the kerning pair forms across it', () => {
      const layout = layoutText(font, 'AxV');
      expect(boxes(layout).map(([char, , x]) => [char, x])).toEqual([
        ['A', 0],
        ['V', 2],
      ]);
    });

    test('draws a fallback in place of a char the font lacks', () => {
      const layout = layoutText(font, 'AxV', {fallback: '-'});
      expect(boxes(layout).map(([char, , x]) => [char, x])).toEqual([
        ['A', 0],
        ['-', 5],
        ['V', 7],
      ]);
    });

    test('an empty text is one empty line', () => {
      const layout = layoutText(font, '');
      expect(layout.glyphs).toEqual([]);
      expect(layout.lineCount).toBe(1);
      expect(layout.width).toBe(0);
      expect(layout.height).toBe(6);
    });
  });

  describe('lines and align', () => {
    test('\\n starts a line one line height lower, \\r is dropped', () => {
      const layout = layoutText(font, 'A\r\nAV\n');
      expect(boxes(layout)).toEqual([
        ['A', 0, 0, -1, 3, 4],
        ['A', 1, 0, -7, 3, 4],
        ['V', 1, 2, -7, 3, 4],
      ]);
      expect(layout.lineCount).toBe(3);
      expect(layout.width).toBe(7);
      expect(layout.height).toBe(18);
    });

    test('lineHeight takes the place of the one of the font', () => {
      const layout = layoutText(font, 'A\nA', {lineHeight: 10, scale: 2});
      expect(layout.glyphs[1]?.y).toBe(-22);
      expect(layout.height).toBe(40);
    });

    test('align moves each line on its own: its middle or its right edge to x', () => {
      const centered = layoutText(font, 'A\nAV', {x: 10, align: 'center'});
      expect(boxes(centered).map(([char, line, x]) => [char, line, x])).toEqual([
        ['A', 0, 8],
        ['A', 1, 6.5],
        ['V', 1, 8.5],
      ]);
      const right = layoutText(font, 'A\nAV', {x: 10, align: 'right'});
      expect(boxes(right).map(([char, line, x]) => [char, line, x])).toEqual([
        ['A', 0, 6],
        ['A', 1, 3],
        ['V', 1, 5],
      ]);
    });
  });

  describe('maxWidth: word wrap', () => {
    test('breaks at the last space before the word that would make the line too wide, the spaces dropped', () => {
      // "AV AV" is 17 wide, "AV" 7
      const layout = layoutText(font, 'AV AV AV', {maxWidth: 10});
      expect(layout.lineCount).toBe(3);
      expect(boxes(layout).map(([char, line, x]) => [char, line, x])).toEqual([
        ['A', 0, 0],
        ['V', 0, 2],
        ['A', 1, 0],
        ['V', 1, 2],
        ['A', 2, 0],
        ['V', 2, 2],
      ]);
      expect(layout.width).toBe(7);
    });

    test('counts the kerning pairs at the join of the line and the next word', () => {
      const data = tinyFontData();
      data.kernings = [{first: 65, second: 32, amount: -3}];
      const kerned = new BitmapFont(data);
      // A 4, the pair (A, space) −3, the space 3, A 4: 8 wide — it fits, where 11 would not
      const layout = layoutText(kerned, 'A A', {maxWidth: 8});
      expect(layout.lineCount).toBe(1);
      expect(layout.width).toBe(8);
      expect(layoutText(kerned, 'A A', {maxWidth: 7.5}).lineCount).toBe(2);
    });

    test('keeps words together on a line while they fit', () => {
      const layout = layoutText(font, 'A A A', {maxWidth: 14});
      expect(boxes(layout).map(([, line, x]) => [line, x])).toEqual([
        [0, 0],
        [0, 7],
        [1, 0],
      ]);
    });

    test('a word wider than maxWidth stays whole on a line of its own', () => {
      const layout = layoutText(font, 'A AVAV A', {maxWidth: 5});
      expect(boxes(layout).map(([char, line]) => `${char}${line}`)).toEqual(['A0', 'A1', 'V1', 'A1', 'V1', 'A2']);
    });

    test('drops every space at a break and keeps the leading spaces of a line of the text', () => {
      const layout = layoutText(font, ' A   A', {maxWidth: 8});
      expect(boxes(layout).map(([, line, x]) => [line, x])).toEqual([
        [0, 3],
        [1, 0],
      ]);
    });

    test('\\n still breaks where it stands, and maxWidth counts in units of the mesh', () => {
      const layout = layoutText(font, 'A\nA A', {maxWidth: 16, scale: 2});
      expect(boxes(layout).map(([, line, x]) => [line, x])).toEqual([
        [0, 0],
        [1, 0],
        [2, 0],
      ]);
    });
  });

  test('lays out the pixel-8 fixture: advance 8, a line of 10', () => {
    const [pixel8] = BitmapFont.parse(readFileSync(new URL('./fixtures/pixel-8.fnt', import.meta.url), 'utf8'));
    const layout = layoutText(pixel8, 'HI\n-');
    const h = pixel8.glyph('H')!;
    const dash = pixel8.glyph('-')!;
    expect(boxes(layout)[0]).toEqual(['H', 0, h.xoffset, 0 - h.yoffset, h.width, h.height]);
    expect(boxes(layout)[2]).toEqual(['-', 1, dash.xoffset, -10 - dash.yoffset, dash.width, dash.height]);
    expect(layout.width).toBe(16);
  });

  describe('refusals', () => {
    test.each([
      [{scale: 0}, 'layoutText: the scale must be a finite number above 0, got 0'],
      [{maxWidth: -1}, 'layoutText: the maxWidth must be a finite number above 0, got -1'],
      [{x: Number.NaN}, 'layoutText: the x must be a finite number, got NaN'],
      [{y: '1'}, 'layoutText: the y must be a finite number, got "1"'],
      [{letterSpacing: Infinity}, 'layoutText: the letterSpacing must be a finite number, got Infinity'],
      [{lineHeight: Number.NaN}, 'layoutText: the lineHeight must be a finite number, got NaN'],
    ])('%o', (options, message) => {
      expect(() => layoutText(font, 'A', options as never)).toThrow(RangeError);
      expect(() => layoutText(font, 'A', options as never)).toThrow(message);
    });

    test('an align it does not know', () => {
      expect(() => layoutText(font, 'A', {align: 'middle' as never})).toThrow(
        "layoutText: the align \"middle\" is none of 'left', 'center', 'right'",
      );
    });

    test('a fallback that is no single char, or no glyph of the font', () => {
      expect(() => layoutText(font, 'A', {fallback: '--'})).toThrow('layoutText: the fallback "--" is no single char');
      expect(() => layoutText(font, 'A', {fallback: '?'})).toThrow('layoutText: the fallback "?" is no glyph of the font "tiny"');
    });

    test('a text that is no string', () => {
      expect(() => layoutText(font, 42 as never)).toThrow(TypeError);
      expect(() => layoutText(font, 42 as never)).toThrow('layoutText: the text must be a string, got 42');
    });
  });
});

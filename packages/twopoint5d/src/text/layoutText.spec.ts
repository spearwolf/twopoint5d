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
      expect(layout.width).toBe(7);
    });

    test('a space yields no glyph even where the font gives it a box', () => {
      const data = tinyFontData();
      Object.assign(data.chars[0]!, {x: 12, y: 4, width: 2, height: 2});
      const boxed = new BitmapFont(data);
      expect(boxes(layoutText(boxed, 'A A')).map(([char]) => char)).toEqual(['A', 'A']);
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

  describe('spaces at the end of a line', () => {
    test('hang out of the width and the alignment', () => {
      const right = layoutText(font, 'A  ', {align: 'right'});
      expect(boxes(right).map(([char, , x]) => [char, x])).toEqual([['A', -4]]);
      expect(right.width).toBe(4);
      const firstX = (text: string) => layoutText(font, text, {align: 'center'}).glyphs[0]?.x;
      expect(firstX('AV  ')).toBe(firstX('AV'));
    });

    test('hang out of a line of maxWidth', () => {
      expect(layoutText(font, 'A   ', {maxWidth: 5}).width).toBe(4);
    });

    test('a line of nothing but spaces is 0 wide', () => {
      const layout = layoutText(font, ' \n  ');
      expect(layout.width).toBe(0);
      expect(layout.lineCount).toBe(2);
    });

    test('a line is as wide as the pen after its last char that is no space, less the letter spacing', () => {
      expect(layoutText(font, 'AV ', {letterSpacing: 2}).width).toBe(9);
    });
  });

  describe('chars beyond the printable ones', () => {
    test('a tab is set as a space, and the line breaks at it', () => {
      expect(boxes(layoutText(font, 'A\tA')).map(([char, line, x]) => [char, line, x])).toEqual([
        ['A', 0, 0],
        ['A', 0, 7],
      ]);
      expect(layoutText(font, 'A\tA', {maxWidth: 8}).lineCount).toBe(2);
      expect(boxes(layoutText(font, 'A\tA', {fallback: '-'})).map(([char]) => char)).toEqual(['A', 'A']);
    });

    test('a control or format char is dropped without the fallback, and the kerning pair forms across it', () => {
      const layout = layoutText(font, 'A\u0001\u00adV\ufeff', {fallback: '-'});
      expect(boxes(layout).map(([char, , x]) => [char, x])).toEqual([
        ['A', 0],
        ['V', 2],
      ]);
      expect(layout.width).toBe(7);
    });

    test.each([
      ['U+2028', '\u2028'],
      ['U+2029', '\u2029'],
    ])('%s starts a line as \\n does', (_, separator) => {
      const layout = layoutText(font, `A${separator}V`, {fallback: '-'});
      expect(boxes(layout).map(([char, line, x]) => [char, line, x])).toEqual([
        ['A', 0, 0],
        ['V', 1, -1],
      ]);
      expect(layout.lineCount).toBe(2);
    });

    test('U+200B takes no room and is a place to break', () => {
      const layout = layoutText(font, 'AV\u200bAV', {fallback: '-'});
      expect(boxes(layout).map(([char, line, x]) => [char, line, x])).toEqual([
        ['A', 0, 0],
        ['V', 0, 2],
        ['A', 0, 7],
        ['V', 0, 9],
      ]);
      expect(layoutText(font, 'AV\u200bAV', {maxWidth: 8}).lineCount).toBe(2);
    });

    test('U+3000 the font lacks is set as a space and breaks; U+00A0 the font lacks is set as a space and holds', () => {
      const ideographic = layoutText(font, 'A\u3000A', {fallback: '-'});
      expect(boxes(ideographic).map(([char, , x]) => [char, x])).toEqual([
        ['A', 0],
        ['A', 7],
      ]);
      expect(layoutText(font, 'A\u3000A', {maxWidth: 8}).lineCount).toBe(2);

      const noBreak = layoutText(font, 'A\u00a0A', {fallback: '-', maxWidth: 8});
      expect(boxes(noBreak).map(([char, line, x]) => [char, line, x])).toEqual([
        ['A', 0, 0],
        ['A', 0, 7],
      ]);
      expect(noBreak.width).toBe(11);
    });

    test('a space of a font without U+0020 takes no room and is a place to break', () => {
      const data = tinyFontData();
      data.chars = data.chars.filter(({id}) => id !== 32);
      const spaceless = new BitmapFont(data);
      expect(boxes(layoutText(spaceless, 'A A', {fallback: '-'})).map(([char, , x]) => [char, x])).toEqual([
        ['A', 0],
        ['A', 4],
      ]);
      expect(layoutText(spaceless, 'A A', {maxWidth: 5}).lineCount).toBe(2);
      expect(layoutText(spaceless, 'A\u00a0A', {fallback: '-'}).glyphs.map(({glyph}) => glyph.char)).toEqual(['A', 'A']);
      expect(layoutText(spaceless, 'A\u00a0A').width).toBe(8);
    });

    test('a line breaks before an ideograph, and a closing mark stays with the char before it', () => {
      const layout = layoutText(font, '日本語。', {fallback: '-', maxWidth: 8});
      expect(boxes(layout).map(([char, line, x]) => [char, line, x])).toEqual([
        ['-', 0, 1],
        ['-', 0, 5],
        ['-', 1, 1],
        ['-', 1, 5],
      ]);
    });

    test('a line breaks before a kana', () => {
      const layout = layoutText(font, 'あいう', {fallback: '-', maxWidth: 8});
      expect(boxes(layout).map(([, line]) => line)).toEqual([0, 0, 1]);
    });

    test('a skipped ideograph leaves no place to break: the chars on both sides of it stay one word', () => {
      expect(layoutText(font, 'AV日AV', {maxWidth: 8}).lineCount).toBe(1);
    });

    test('a closing mark after a skipped ideograph stays on the line of the char before it', () => {
      const data = tinyFontData();
      const dash = data.chars.find(({id}) => id === 45)!;
      data.chars = [...data.chars, {...dash, id: 0x3002}];
      const marked = new BitmapFont(data);

      const layout = layoutText(marked, 'AV日。', {maxWidth: 8});
      expect(layout.lineCount).toBe(1);
      expect(layout.glyphs.map(({line}) => line)).toEqual([0, 0, 0]);
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
      [{scale: 0}, 'layoutText: scale must be a finite number above 0, got 0'],
      [{maxWidth: -1}, 'layoutText: maxWidth must be a finite number above 0, got -1'],
      [{x: Number.NaN}, 'layoutText: x must be a finite number, got NaN'],
      [{y: '1'}, 'layoutText: y must be a finite number, got "1"'],
      [{letterSpacing: Infinity}, 'layoutText: letterSpacing must be a finite number, got Infinity'],
      [{lineHeight: Number.NaN}, 'layoutText: lineHeight must be a finite number above 0, got NaN'],
      [{lineHeight: 0}, 'layoutText: lineHeight must be a finite number above 0, got 0'],
      [{lineHeight: -10}, 'layoutText: lineHeight must be a finite number above 0, got -10'],
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

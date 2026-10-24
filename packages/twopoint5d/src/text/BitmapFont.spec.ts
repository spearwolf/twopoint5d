import {readFileSync} from 'node:fs';
import {describe, expect, test} from 'vitest';
import {TextureCoords} from '../texture/TextureCoords.js';
import {BitmapFont, type BitmapFontData} from './BitmapFont.js';

const fixture = (name: string) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

/** A small font of three chars, in the JSON layout. */
const tinyFont = (): BitmapFontData => ({
  pages: ['tiny.png'],
  info: {face: 'tiny', size: 4},
  common: {lineHeight: 6, base: 5, scaleW: 16, scaleH: 8, pages: 1},
  chars: [
    {id: 32, x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 3, page: 0, chnl: 15},
    {id: 65, x: 1, y: 1, width: 3, height: 4, xoffset: 0, yoffset: 1, xadvance: 4, page: 0, chnl: 15},
    {id: 86, x: 5, y: 1, width: 3, height: 4, xoffset: -1, yoffset: 1, xadvance: 4, page: 0, chnl: 15},
  ],
  kernings: [{first: 65, second: 86, amount: -1}],
});

const without = <T extends object>(object: T, key: keyof T): T => {
  const copy = {...object};
  delete copy[key];
  return copy;
};

describe('BitmapFont', () => {
  describe('the three spellings of the pixel-8 fixture', () => {
    const [fromText, textAtlas] = BitmapFont.parse(fixture('pixel-8.fnt'));
    const [fromXml, xmlAtlas] = BitmapFont.parse(fixture('pixel-8.xml'));
    const [fromJson, jsonAtlas] = BitmapFont.parse(JSON.parse(fixture('pixel-8.json')) as BitmapFontData);

    test('carry the metrics of the font', () => {
      for (const font of [fromText, fromXml, fromJson]) {
        expect(font.face).toBe('lookbook pixel 8');
        expect(font.size).toBe(8);
        expect(font.lineHeight).toBe(10);
        expect(font.base).toBe(7);
        expect(font.scaleW).toBe(128);
        expect(font.scaleH).toBe(64);
        expect(font.page).toBe('pixel-8.png');
        expect(font.glyphCount).toBe(95);
      }
    });

    test('read into the same glyphs, info and common', () => {
      expect(fromXml.info).toEqual(fromText.info);
      expect(fromJson.info).toEqual(fromText.info);
      expect(fromXml.common).toEqual(fromText.common);
      expect(fromJson.common).toEqual(fromText.common);
      for (let id = 32; id <= 126; id++) {
        const {frame: textFrame, ...text} = fromText.glyph(id)!;
        const {frame: xmlFrame, ...xml} = fromXml.glyph(id)!;
        const {frame: jsonFrame, ...json} = fromJson.glyph(id)!;
        expect(xml).toEqual(text);
        expect(json).toEqual(text);
        expect(xmlFrame.coords.getTexCoords()).toEqual(textFrame.coords.getTexCoords());
        expect(jsonFrame.coords.getTexCoords()).toEqual(textFrame.coords.getTexCoords());
      }
    });

    test('answer the atlas of the font beside it, one frame per char named by the char, in the order of the file', () => {
      expect(textAtlas).toBe(fromText.atlas);
      expect(xmlAtlas).toBe(fromXml.atlas);
      expect(jsonAtlas).toBe(fromJson.atlas);
      expect(textAtlas.size).toBe(95);
      expect(textAtlas.frameNames().slice(0, 4)).toEqual([' ', '!', '"', '#']);
    });

    test('lay every frame where its char lies in the page, untrimmed', () => {
      const a = fromText.glyph('A')!;
      expect(a).toMatchObject({id: 65, char: 'A', x: 56, y: 12, width: 7, height: 7, xoffset: 0, yoffset: 0, xadvance: 8});
      expect(a.frame).toBe(textAtlas.frame('A'));
      expect(a.frame.coords.getTexCoords()).toEqual([56 / 128, 12 / 64, 7 / 128, 7 / 64]);
      expect(a.frame.data).toEqual({
        id: 65,
        x: 56,
        y: 12,
        width: 7,
        height: 7,
        xoffset: 0,
        yoffset: 0,
        xadvance: 8,
        page: 0,
        chnl: 15,
      });
      expect(Object.isFrozen(a.frame.data)).toBe(true);
      expect(Object.isFrozen(a)).toBe(true);
    });

    test('a space is a glyph of 0 × 0', () => {
      const space = fromText.glyph(' ')!;
      expect(space.width).toBe(0);
      expect(space.height).toBe(0);
      expect(space.xadvance).toBe(8);
    });
  });

  describe('glyph() and kerning()', () => {
    const font = new BitmapFont(tinyFont());

    test('find a glyph by a string — its first code point — or by a code point', () => {
      expect(font.glyph('A')?.id).toBe(65);
      expect(font.glyph('AV')?.id).toBe(65);
      expect(font.glyph(86)?.char).toBe('V');
      expect(font.glyph('x')).toBeUndefined();
      expect(font.glyph('')).toBeUndefined();
      expect(font.glyph(1234)).toBeUndefined();
    });

    test('answer the kerning amount of a pair, and 0 without one', () => {
      expect(font.kerning('A', 'V')).toBe(-1);
      expect(font.kerning(65, 86)).toBe(-1);
      expect(font.kerning('V', 'A')).toBe(0);
      expect(font.kerning('', 'A')).toBe(0);
    });

    test('answer 0 for a number that is no code point, which never meets the key of another pair', () => {
      expect(font.kerning(66, 86 - 0x110000)).toBe(0);
      expect(font.kerning(65.5, 86)).toBe(0);
      expect(font.kerning(65, 0x110000 + 86)).toBe(0);
    });

    test('a font without info takes its size from the line height and has no face', () => {
      const bare = new BitmapFont(without(tinyFont(), 'info'));
      expect(bare.face).toBe('');
      expect(bare.size).toBe(6);
      expect(bare.info).toEqual({});
    });

    test('a font without pages names no page', () => {
      const data = tinyFont();
      data.pages = [];
      expect(new BitmapFont(data).page).toBeUndefined();
    });

    test('lays the frames out in the parentCoords given', () => {
      const parent = new TextureCoords(new TextureCoords(0, 0, 64, 64), 32, 16, 16, 8);
      const [font] = BitmapFont.parse(tinyFont(), {parentCoords: parent});
      expect(font.glyph('A')!.frame.coords.getTexCoords()).toEqual([33 / 64, 17 / 64, 3 / 64, 4 / 64]);
    });

    test('takes a char without page and chnl as one of page 0', () => {
      const data = tinyFont();
      data.chars = [{id: 65, x: 1, y: 1, width: 3, height: 4, xoffset: 0, yoffset: 1, xadvance: 4} as never];
      expect(new BitmapFont(data).glyph('A')).toMatchObject({page: 0, chnl: 15});
    });
  });

  describe('the text format', () => {
    test('reads quoted strings with spaces, lists, negative numbers and kerning pairs, and skips unknown tags', () => {
      const [font] = BitmapFont.parse(
        [
          'info face="My Font Bold" size=-12 bold=1 italic=0 charset="" unicode=1 stretchH=100 smooth=1 aa=1 padding=1,2,3,4 spacing=1,1 outline=0',
          'common lineHeight=14 base=11 scaleW=32 scaleH=16 pages=1 packed=0',
          'page id=0 file="my font_0.png"',
          'chars count=2',
          'char id=65   x=0  y=0  width=5 height=8 xoffset=-1 yoffset=3 xadvance=6 page=0 chnl=15',
          'char id=66 x=6 y=0 width=5 height=8 xoffset=0 yoffset=3 xadvance=6 page=0 chnl=15',
          'kernings count=1',
          'kerning first=65 second=66 amount=-2',
          'whatever key=1',
          '',
        ].join('\r\n'),
      );
      expect(font.face).toBe('My Font Bold');
      // BMFont writes a negative size for "match char height"; the font answers its amount, info keeps it
      expect(font.size).toBe(12);
      expect(font.info.size).toBe(-12);
      expect(font.info.padding).toEqual([1, 2, 3, 4]);
      expect(font.info.charset).toBe('');
      expect(font.page).toBe('my font_0.png');
      expect(font.glyph('A')).toMatchObject({xoffset: -1, yoffset: 3});
      expect(font.kerning('A', 'B')).toBe(-2);
    });

    test('reads leading whitespace and a source without a page', () => {
      const [font] = BitmapFont.parse(
        '\n  common lineHeight=4 base=3 scaleW=4 scaleH=4\nchar id=65 x=0 y=0 width=1 height=1 xoffset=0 yoffset=0 xadvance=1',
      );
      expect(font.glyphCount).toBe(1);
      expect(font.page).toBeUndefined();
    });
  });

  describe('the XML format', () => {
    test('reads attributes in either quotes, decodes the entities, and keeps face, charset and file strings', () => {
      const [font] = BitmapFont.parse(`<?xml version="1.0"?>
<!-- written by hand -->
<font>
  <info face="Tom &amp; Jerry&apos;s &#65;&#x42;" size='10' charset="123" padding="0,0,0,0"/>
  <common lineHeight="12" base="9" scaleW="16" scaleH="16" pages="1"/>
  <pages><page id="0" file="&quot;tj&quot;.png"/></pages>
  <chars count="1"><char id="65" x="0" y="0" width="4" height="4" xoffset="0" yoffset="2" xadvance="5" page="0" chnl="15"/></chars>
  <kernings count="1"><kerning first="65" second="65" amount="1"/></kernings>
</font>`);
      expect(font.face).toBe("Tom & Jerry's AB");
      expect(font.size).toBe(10);
      expect(font.info.charset).toBe('123');
      expect(font.page).toBe('"tj".png');
      expect(font.kerning('A', 'A')).toBe(1);
    });

    test('leaves a named entity outside the five of XML as it is written, a name of Object.prototype as well', () => {
      const [font] = BitmapFont.parse(
        `<font><info face="A&constructor;B&toString;C&__proto__;D&amp;E"/><common lineHeight="4" base="3" scaleW="4" scaleH="4"/></font>`,
      );
      expect(font.face).toBe('A&constructor;B&toString;C&__proto__;D&E');
    });

    test('keeps a numeric entity that is no code point as it is written', () => {
      const [font] = BitmapFont.parse(
        `<font><info face="A&#x110000;B&#xD800;C&#1114112;D&#99999999999999999999;"/><common lineHeight="4" base="3" scaleW="4" scaleH="4"/></font>`,
      );
      expect(font.face).toBe('A&#x110000;B&#xD800;C&#1114112;D&#99999999999999999999;');
    });
  });

  describe('the edges of the readers', () => {
    test('an unquoted value that is no number stays a string in the text format', () => {
      const [font] = BitmapFont.parse('info face=Plain\ncommon lineHeight=4 base=3 scaleW=4 scaleH=4\n');
      expect(font.face).toBe('Plain');
    });

    test('an XML page without an id goes next in line, an unknown entity stays, an empty value in single quotes', () => {
      const [font] = BitmapFont.parse(
        `<font><info face='a&nbsp;b' charset=''/><common lineHeight="4" base="3" scaleW="4" scaleH="4"/><page file="p.png"/></font>`,
      );
      expect(font.face).toBe('a&nbsp;b');
      expect(font.info.charset).toBe('');
      expect(font.page).toBe('p.png');
    });

    test('keeps an attribute named __proto__ as a field of its block in all three spellings, and sets no prototype', () => {
      const text = [
        'info face=tiny size=4 __proto__=1,2',
        'common lineHeight=6 base=5 scaleW=16 scaleH=8 pages=1',
        'page id=0 file="tiny.png"',
        'char id=65 x=1 y=1 width=3 height=4 xoffset=0 yoffset=1 xadvance=4 page=0 chnl=15 __proto__=1,2',
      ].join('\n');
      const xml = `<font><info face="tiny" size="4" __proto__="1,2"/><common lineHeight="6" base="5" scaleW="16" scaleH="8" pages="1"/><page id="0" file="tiny.png"/></font>`;
      const json = `{"info": {"face": "tiny", "size": 4, "__proto__": [1, 2]}, "common": {"lineHeight": 6, "base": 5, "scaleW": 16, "scaleH": 8, "pages": 1}, "pages": ["tiny.png"], "chars": []}`;
      for (const source of [text, xml, json]) {
        const [font] = BitmapFont.parse(source);
        expect(Object.getPrototypeOf(font.info)).toBe(Object.prototype);
        expect(Object.getOwnPropertyDescriptor(font.info, '__proto__')?.value).toEqual([1, 2]);
        expect(font.info.face).toBe('tiny');
      }
      const [font] = BitmapFont.parse(text);
      const data = font.glyph('A')?.frame.data as unknown as Record<string, unknown>;
      expect(data).toMatchObject({
        id: 65,
        x: 1,
        y: 1,
        width: 3,
        height: 4,
        xoffset: 0,
        yoffset: 1,
        xadvance: 4,
        page: 0,
        chnl: 15,
      });
      expect(Object.getPrototypeOf(data)).toBe(Object.prototype);
    });

    test('a page without a file names an empty one', () => {
      const [font] = BitmapFont.parse('common lineHeight=4 base=3 scaleW=4 scaleH=4\npage id=0\n');
      expect(font.page).toBe('');
    });

    test('a face that is no string, pages that are no array and no kernings', () => {
      const data = {...tinyFont(), info: {face: 7 as never}, pages: 'tiny.png' as never};
      delete data.kernings;
      const font = new BitmapFont(data);
      expect(font.face).toBe('');
      expect(font.page).toBeUndefined();
      expect(font.kerning('A', 'V')).toBe(0);
    });
  });

  describe('JSON', () => {
    test('reads a JSON string as it reads the object', () => {
      const [font] = BitmapFont.parse(`  ${JSON.stringify(tinyFont())}`);
      expect(font.glyph('V')?.xoffset).toBe(-1);
      expect(font.kerning('A', 'V')).toBe(-1);
    });

    test('leaves further fields of a converter alone', () => {
      const data = tinyFont() as BitmapFontData & {distanceField: unknown};
      data.distanceField = {fieldType: 'msdf', distanceRange: 4};
      (data.chars[1] as unknown as Record<string, unknown>)['char'] = 'A';
      expect(new BitmapFont(data).glyph('A')?.frame.data).toEqual(tinyFont().chars[1]);
    });

    test('refuses JSON that does not parse', () => {
      expect(() => BitmapFont.parse('{"pages": [')).toThrow(/^BitmapFont: the JSON of the font does not parse — /);
    });
  });

  describe('refusals', () => {
    test.each([
      ['plain words', 'hello world'],
      ['an empty string', ''],
    ])('a string that is no BMFont: %s', (_, source) => {
      expect(() => BitmapFont.parse(source)).toThrow(
        'BitmapFont: the source is neither BMFont text (lines "info …", "common …"), XML (<font>) nor JSON ({"pages", "chars", "common"})',
      );
    });

    test('the binary format', () => {
      expect(() => BitmapFont.parse('BMF\u0003\u0001')).toThrow(
        'BitmapFont: this is a binary BMFont file, which is not read — export the font as text, XML or JSON',
      );
    });

    test.each([
      ['null', () => new BitmapFont(null as never), 'BitmapFont: the font data is null — '],
      ['a number', () => new BitmapFont(42 as never), 'BitmapFont: the font data is 42 — '],
      ['null to parse()', () => BitmapFont.parse(null as never), 'BitmapFont: the font data is null — '],
      ['42 to parse()', () => BitmapFont.parse(42 as never), 'BitmapFont: the font data is 42 — '],
    ])('font data that is no object: %s', (_, build, start) => {
      expect(build).toThrow(`${start}a font is an object in the JSON layout, {pages, chars, common}`);
    });

    test('a font of several hundred thousand chars, the last on page 1, is refused for its pages', () => {
      const data = tinyFont();
      const chars = Array.from({length: 500_000}, () => ({page: 0}));
      chars.push({page: 1});
      data.chars = chars as never;
      expect(() => new BitmapFont(data)).toThrow('BitmapFont: the font "tiny" has 2 pages');
    });

    test('no common block', () => {
      expect(() => new BitmapFont(without(tinyFont(), 'common'))).toThrow(
        'BitmapFont: the font has no common block — BMFont writes lineHeight, base, scaleW and scaleH there',
      );
    });

    test.each([
      ['lineHeight', Number.NaN, 'BitmapFont: common.lineHeight must be a finite number above 0, got NaN'],
      ['lineHeight', 0, 'BitmapFont: common.lineHeight must be a finite number above 0, got 0'],
      ['lineHeight', -10, 'BitmapFont: common.lineHeight must be a finite number above 0, got -10'],
      ['base', '7', 'BitmapFont: common.base must be a finite number, got "7"'],
      ['scaleW', 0, 'BitmapFont: common.scaleW must be a finite number above 0, got 0'],
      ['scaleH', undefined, 'BitmapFont: common.scaleH must be a finite number above 0, got undefined'],
    ])('common.%s of %o', (key, value, message) => {
      const data = tinyFont();
      (data.common as unknown as Record<string, unknown>)[key] = value;
      expect(() => new BitmapFont(data)).toThrow(RangeError);
      expect(() => new BitmapFont(data)).toThrow(message);
    });

    test('no chars', () => {
      expect(() => new BitmapFont(without(tinyFont(), 'chars'))).toThrow(
        'BitmapFont: the font has no chars — BMFont lists one entry per glyph',
      );
    });

    test.each([
      ['two page files', (data: BitmapFontData) => data.pages.push('tiny_1.png'), 2],
      ['common.pages of 3', (data: BitmapFontData) => (data.common.pages = 3), 3],
      ['a char on page 1', (data: BitmapFontData) => (data.chars[1]!.page = 1), 2],
    ])('more than one page: %s', (_, change, pages) => {
      const data = tinyFont();
      change(data);
      expect(() => new BitmapFont(data)).toThrow(
        `BitmapFont: the font "tiny" has ${pages} pages — writeText() draws out of one texture; export the font onto one page (BMFont: a larger texture)`,
      );
    });

    test.each([
      [
        'an id that is no whole number',
        {id: 6.5},
        Error,
        'BitmapFont: a char has the id 6.5 — an id is a whole number from 0 to 0x10FFFF',
      ],
      [
        'an id above 0x10FFFF',
        {id: 0x110000},
        Error,
        'BitmapFont: a char has the id 1114112 — an id is a whole number from 0 to 0x10FFFF',
      ],
      [
        'a field that is no number',
        {xadvance: '4'},
        RangeError,
        'BitmapFont: the xadvance of the char "A" (65) must be a finite number, got "4"',
      ],
      [
        'a negative width',
        {width: -1},
        RangeError,
        'BitmapFont: the width of the char "A" (65) must be a finite number of 0 or more, got -1',
      ],
      [
        'a negative x',
        {x: -1},
        RangeError,
        'BitmapFont: the x of the char "A" (65) must be a finite number of 0 or more, got -1',
      ],
      [
        'a char beyond the page',
        {x: 14},
        Error,
        'BitmapFont: the char "A" (65) reaches beyond the page of 16 × 8 — x 14 + width 3',
      ],
      [
        'a char below the page',
        {y: 5},
        Error,
        'BitmapFont: the char "A" (65) reaches beyond the page of 16 × 8 — y 5 + height 4',
      ],
    ])('%s', (_, change, errorClass, message) => {
      const data = tinyFont();
      Object.assign(data.chars[1]!, change);
      expect(() => new BitmapFont(data)).toThrow(errorClass);
      expect(() => new BitmapFont(data)).toThrow(message);
    });

    test('two chars of one id', () => {
      const data = tinyFont();
      data.chars.push({...data.chars[1]!});
      expect(() => new BitmapFont(data)).toThrow('BitmapFont: the char "A" (65) appears twice');
    });

    test.each([
      [{first: -1}, 'a first of -1'],
      [{first: 0x110000}, 'a first of 1114112'],
      [{second: 1.5}, 'a second of 1.5'],
      [{second: -0x110000 + 5}, 'a second of -1114107'],
      [{first: '65', second: Number.NaN}, 'a first of "65"'],
    ])('a kerning pair whose chars are no code points: %o', (change, named) => {
      const data = tinyFont();
      data.kernings = [{first: 65, second: 86, amount: -1}, {first: 1, second: 86, amount: 3, ...change} as never];
      expect(() => new BitmapFont(data)).toThrow(
        `BitmapFont: kerning pair 1 has ${named} — first and second are code points, whole numbers from 0 to 0x10FFFF`,
      );
    });

    test('a kerning pair whose amount is no number', () => {
      const data = tinyFont();
      data.kernings = [{first: 65, second: 86, amount: Number.NaN}];
      expect(() => new BitmapFont(data)).toThrow(RangeError);
      expect(() => new BitmapFont(data)).toThrow('BitmapFont: the amount of kerning pair 0 must be a finite number, got NaN');
    });

    test('a pair of chars the font lacks is kept and never met', () => {
      const data = tinyFont();
      data.kernings = [{first: 1, second: 2, amount: 3}];
      expect(new BitmapFont(data).kerning(1, 2)).toBe(3);
    });
  });
});

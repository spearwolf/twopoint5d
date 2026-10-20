# Text

Score counters, dialog boxes, the demo scroller: text out of a bitmap font is the most common
sprite of all. The module `text/` reads bitmap fonts and lays strings of them out into sprites of
the kinds of [the sprite guide](sprites.md) — one sprite per glyph, in a `FeatureSprites` of one's
own, drawn in one draw call with everything else of that mesh. It is no mesh of its own and no
layout engine.

## Bitmap fonts

`BitmapFont.parse(source)` reads a font in the AngelCode BMFont format and answers the font and a
`TextureAtlas` with one frame per char of its page:

| spelling | recognised by | written by |
| --- | --- | --- |
| text (`.fnt`) | a string of lines `info …`, `common …`, `char …` | BMFont, Hiero, most tools |
| XML (`.fnt`, `.xml`) | a string starting with `<` | BMFont, Littera |
| JSON | an object, or a string starting with `{` | `msdf-bmfont-xml`, `bmfont2json`, `load-bmfont`, `parse-bmfont-ascii` — `{pages, chars, kernings, info, common}` |

The XML is read by a tokenizer of its own, not a `DOMParser`, so all three read in a worker and under
Node alike. The binary BMFont format is not read; export the font as one of the three.

```ts check
import {BitmapFont, TextureFactory} from '@spearwolf/twopoint5d';

const url = new URL('/fonts/pixel-8.fnt', 'https://example.com');
const [font, atlas] = BitmapFont.parse(await (await fetch(url)).text());

// the page is named relative to the font file; nearest for a pixel font, upright as every atlas
const page = await new TextureFactory().loadAsync(new URL(font.page!, url).href, ['nearest', 'srgb']);

font.lineHeight; // 10: the distance of two lines, in pixels of the font
font.base; //        7: from the top of a line to its baseline
font.glyph('A'); //  {id: 65, char: 'A', x, y, width, height, xoffset, yoffset, xadvance, page, chnl, frame}
font.kerning('A', 'V'); // the kerning pair, 0 without one
atlas.frame('A'); // the frame of the glyph, also font.glyph('A').frame

export {font, page};
```

A glyph keeps what the file says: where it lies in the page (`x`, `y`, `width`, `height`), where it
is drawn from the pen and the top of the line (`xoffset`, `yoffset`) and how far the pen moves on
(`xadvance`), all in pixels of the font. The frames of the atlas are named by the char as a string
and are **untrimmed**: the offsets place a glyph in its line, they are no trim margins. A char of
0 × 0 — the space — has a frame of 0 × 0 and moves the pen alone.

**One page.** A font is drawn out of one texture, so a font of several pages is refused: export it
onto one page, in BMFont with a larger texture size. `BitmapFont.parse(source, {parentCoords})`
reads a page that was packed into a larger image, at the coords given.

**Refusals.** Each names what is wrong and where: a source in none of the three spellings, JSON that
does not parse, a font without a `common` block or with a `lineHeight`, `base`, `scaleW` or `scaleH`
that is no number, no `chars`, more than one page, a char with an id that is no whole number, a field
that is no number, a negative position or size, a glyph that reaches beyond the page, two chars of
one id, a kerning pair that is no numbers.

A font and its atlas are plain data: nothing to dispose. The page texture is the caller's.

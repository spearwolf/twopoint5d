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
0 × 0 — the space — has a frame of 0 × 0 and moves the pen alone. `font.size` is the size of the
font in pixels; BMFont writes it negative for a font made with "match char height", so the font
answers its amount and `font.info.size` keeps the value as written.

**One page.** A font is drawn out of one texture, so a font of several pages is refused: export it
onto one page, in BMFont with a larger texture size. `BitmapFont.parse(source, {parentCoords})`
reads a page that was packed into a larger image, at the coords given.

**Refusals.** Each names what is wrong and where: a source in none of the three spellings, JSON that
does not parse, font data that is no object, a font without a `common` block or with a `lineHeight`,
`base`, `scaleW` or `scaleH` that is no number — `lineHeight`, `scaleW` and `scaleH` above 0 —, no
`chars`, more than one page, a char with an id that is no whole number from 0 to 0x10FFFF, a field
that is no number, a negative position or size, a glyph that reaches beyond the page, two chars of
one id, a kerning pair whose chars are no code points or whose `amount` is no number. A numeric
entity in the XML that is no code point stays as it is written, like an entity the reader does not
know.

A font and its atlas are plain data: nothing to dispose. The page texture is the caller's.

## Writing text into sprites

`writeText(sprites, font, text, options?)` lays a string out and writes it into `sprites`: one sprite
per visible glyph, created in the `FeatureSprites` handed in and answered in reading order. The kind of
the sprites holds `InstancePosition`, `QuadSize` and `AtlasFrame` — `TexturedSpriteKind` does — and
the font's page is their `colorMap`.

```ts check
import {BitmapFont, FeatureSprites, rewriteText, TexturedSpriteKind, writeText} from '@spearwolf/twopoint5d';
import {Color, Scene, type Texture} from 'three/webgpu';

declare const fnt: string; // the text of pixel-8.fnt
declare const page: Texture; // pixel-8.png, loaded with flipY = false and nearest

const [font] = BitmapFont.parse(fnt);
const text = new FeatureSprites(TexturedSpriteKind, {capacity: 256, textures: {colorMap: page}});
new Scene().add(text);

// the top of the first line at y = 40, centred on x = 0, every pixel of the font 2 units
const glyphs = writeText(text, font, 'GAME OVER\npress fire', {x: 0, y: 40, align: 'center', scale: 2});
for (const glyph of glyphs) glyph.setColor(new Color('#ffd166'));

// the text changes: write it into the sprites of the last one
export function rewrite(next: string) {
  rewriteText(text, glyphs, font, next, {x: 0, y: 40, align: 'center', scale: 2});
  for (const glyph of glyphs) glyph.setColor(new Color('#ffd166'));
  text.update();
}
```

**Coordinates.** The text lies in the x/y plane of the mesh, **y up** — the plane of `FlatPlacement`
and of every billboard; a text on the ground is a `FlatPlacement` mesh turned by
`rotation.x = -Math.PI / 2`. `(x, y)` is the **top** of the first line, the top of the BMFont line box
that every `yoffset` is measured from; a baseline at `b` is `y: b + font.base * scale`. With
`s = scale`:

- line `n` (from 0) has its top at `y − n · lineHeight · s`;
- a glyph's box lies at `pen + xoffset · s` and `lineTop − yoffset · s`, `width · s` × `height · s`;
- the pen moves on by `(xadvance + letterSpacing) · s`, and a kerning pair moves the second glyph by
  its `amount · s`;
- a line is as wide as the pen after its last char that is no space, less one `letterSpacing · s` —
  the spacing lies between chars —, and `align` puts its left edge (`'left'`), its middle
  (`'center'`) or its right edge (`'right'`) on `x`, line by line.

**The anchor of the base.** A sprite is placed by its position, and the base decides where its quad
lies around it. `writeText()` reads the extents of the base out of the geometry's `position`
attribute, so the `baseArgs` of the sprites count: under `QuadBase` with its default the position is
the middle of the glyph box, with `baseArgs: [0.5, 0.5, 0.5, -0.5]` it is the top left corner. A
`Rotation` turns a glyph about its position, so the base chooses the pivot.

**`Anchor`.** A kind with the sprite feature `Anchor` takes its text exactly where a kind without it
does: `writeText()` writes no anchor, and a new sprite starts at `(0.5, 0.5)`, which moves nothing.
An anchor set on a glyph afterwards moves the glyph off its box — to turn a glyph about another point
and keep it in place, move it along: `x += (anchorX − 0.5) · width`, `y −= (anchorY − 0.5) · height`.

**What is written.** The frame (`setFrame()`), the size of the box and the position, with the `z` of
the options. Nothing else: a new sprite keeps its white tint and its rotation of 0 until the caller
writes them. `QuadSize` and `AtlasFrame` are static attributes and reach the GPU with the first
`update()` after `createSprite()`; a later change to one glyph goes up after
`spritePool.touchVO(glyph, 'quadSize')` (see "Uploads" in the sprite guide). A glyph that
`rewriteText()` reuses keeps its tint and its rotation, and `rewriteText()` marks its slot for
upload itself: its new frame and size, and a tint written after the call, go up with the next
`update()` without a `touchVO()`.

**Chars.** Read by code point, so a char beyond the BMP is one glyph. Each falls into one class:

| class | chars | set as |
| --- | --- | --- |
| line end | `\n`, U+2028, U+2029 | ends the line |
| breakable space | U+0020, tab, U+1680, U+2000–U+2006, U+2008–U+200A, U+205F, U+3000 | a tab as U+0020, the others as their own glyph or else as U+0020 |
| break without width | U+200B, and a breakable space the font has neither glyph for | takes no room |
| no-break space | U+00A0, U+2007, U+202F | its own glyph or else U+0020, else dropped |
| control and format | `\r`, a soft hyphen, U+200C–U+200F, U+2060, U+FEFF and every other of Cc and Cf | dropped |
| any other | | its glyph, else `fallback`, else skipped |

A space moves the pen and yields no sprite, even where the font gives it a box. A char the font
lacks is drawn as `fallback` when one is given (`{fallback: '?'}`) and otherwise skipped; a
`fallback` is never drawn for a space, a line end, or a control or format char. A char dropped or
skipped takes no room, and the kerning pair forms across it. A tab is one space wide: there are no
tab stops.

**Word wrap.** With `maxWidth`, in units of the mesh, a line breaks before the word that would make
it wider: at a breakable space, after U+200B, or before an ideograph or a kana (the scripts Han,
Hiragana and Katakana). The spaces at the break are dropped. A mark after an ideograph — `。`, `」`
— stays with the char before it, so a closing mark never starts a line. A word wider than
`maxWidth` on its own stays whole on a line of its own and overflows — there is no hyphenation.
`lineHeight` takes the place of the font's, in pixels of the font, above 0.

**Spaces at the end of a line** hang out of it: they count neither in its width nor in its
alignment nor in the `width` of the layout, so `'Score: 100 '` stands where `'Score: 100'` does, and
a line of nothing but spaces is 0 wide.

**Freeing.** The sprites are the caller's. To change a text, `rewriteText(sprites, glyphs, font,
next, options?)` writes the next one into the sprites of the last: it reuses the glyphs in reading
order, frees the ones left over from the last backwards, creates only the ones missing, and rewrites
`glyphs` in place. `rewriteText(sprites, glyphs, font, '')` frees them all. A caller who frees
glyphs itself frees them from the last to the first — `freeSprite()` moves the last sprite of the
pool into the gap, so freed backwards a text at the end of its pool is popped, and no other sprite
moves. `writeText()` keeps no reference to the sprites, to the font or to the text. Neither is
allocation-free: write a text when it changes, not every frame.

**Draw order.** `sortBy()` and `sortByViewDepth()` on a pool the glyphs share with other sprites mix
them in draw order with those sprites — a label may end up behind the sprite it names; give text a
`FeatureSprites` of its own when the order matters. The handles `writeText()` answered stay the same
objects through a sort, still in reading order.

**Refusals.** A kind without `InstancePosition`, `QuadSize` or `AtlasFrame` — `AnimatedSpriteKind`,
whose frame comes out of an `animsMap` — is refused before a sprite is created, naming every feature
missing. A pool that runs full is refused naming how many sprites the text needs; the sprites created
so far are freed again, so nothing of the text is left behind. An error of `createSprite()` — under
`grow`, a pool that cannot grow — goes on to the caller after the same freeing. A `scale`,
`lineHeight` or `maxWidth` that is no number above 0, an `align` it does not know and a `fallback`
the font lacks are refused naming the option. `rewriteText()` refuses a glyph that is no sprite of
the sprites handed in, naming its index, before anything changes; on a pool that runs full the
glyphs keep the text they had. Sprites that are disposed write nothing: `writeText()` answers an
empty array, `rewriteText()` empties `glyphs`.

## Measuring: `layoutText()`

`layoutText(font, text, options?)` is the half of `writeText()` that writes nothing: the boxes of the
visible glyphs in reading order, the number of lines and the size of the text, in units of the mesh,
for the same options. A panel sized to its label, a text centred in a box of its own, a scroller that
knows its length:

```ts check
import {type BitmapFont, layoutText} from '@spearwolf/twopoint5d';

declare const font: BitmapFont;

const {width, height, lineCount, glyphs} = layoutText(font, 'INVENTORY FULL', {scale: 2, maxWidth: 120});
// glyphs[i]: {glyph, line, x, y, width, height} — the box of a glyph, y up, its top edge at y
export const panelSize = {width: width + 8, height: height + 8, lineCount, firstGlyph: glyphs[0]};
```

## A sine scroller

`writeText()` lays the text out once; the scroller moves its glyphs along, and `wave({weight:
'uniform'})` bends them on a sine in the shader — the phase of each glyph comes from its x, so the
glyphs ride the wave as they pass. The CPU writes one x per glyph and one `time` per frame
(see "Waves: sway and scroller" in [the sprite guide](sprites.md)):

```ts check
import {
  AtlasFrame,
  type BitmapFont,
  defineSprite,
  FeatureSprites,
  FlatPlacement,
  InstancePosition,
  QuadBase,
  QuadSize,
  TextureColor,
  Tint,
  wave,
  writeText,
} from '@spearwolf/twopoint5d';
import type {Texture} from 'three/webgpu';

declare const font: BitmapFont;
declare const page: Texture;

const ScrollerKind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Tint, wave({weight: 'uniform'})],
});

const scroller = new FeatureSprites(ScrollerKind, {
  capacity: 128,
  textures: {colorMap: page},
  // 24 units up and down, a wave every 400 units, a third of a wave per second
  uniforms: {waveAmplitude: 24, waveFrequency: 1 / 400, waveSpeed: 1 / 3},
});
const glyphs = writeText(scroller, font, 'GREETINGS TO ALL SCENERS ...', {scale: 4});
const home = glyphs.map((glyph) => glyph.x);
const length = home.at(-1)! + 64;

export function frame(time: number) {
  glyphs.forEach((glyph, i) => {
    // x alone: the y writeText() gave the glyph stays, and the wave moves it in the shader
    glyph.x = (((home[i]! - time * 120) % length) + length) % length - 320;
  });
  scroller.setUniform('time', time);
  scroller.update(); // the position is a dynamic attribute: every update() uploads it
}
```

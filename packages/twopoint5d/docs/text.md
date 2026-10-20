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
does not parse, a font without a `common` block or with a `lineHeight`, `base`, `scaleW` or `scaleH`
that is no number, no `chars`, more than one page, a char with an id that is no whole number, a field
that is no number, a negative position or size, a glyph that reaches beyond the page, two chars of
one id, a kerning pair that is no numbers.

A font and its atlas are plain data: nothing to dispose. The page texture is the caller's.

## Writing text into sprites

`writeText(sprites, font, text, options?)` lays a string out and writes it into `sprites`: one sprite
per visible glyph, created in the `FeatureSprites` handed in and answered in reading order. The kind of
the sprites holds `InstancePosition`, `QuadSize` and `AtlasFrame` — `TexturedSpriteKind` does — and
the font's page is their `colorMap`.

```ts check
import {BitmapFont, FeatureSprites, TexturedSpriteKind, writeText} from '@spearwolf/twopoint5d';
import {Color, Scene, type Texture} from 'three/webgpu';

declare const fnt: string; // the text of pixel-8.fnt
declare const page: Texture; // pixel-8.png, loaded with flipY = false and nearest

const [font] = BitmapFont.parse(fnt);
const text = new FeatureSprites(TexturedSpriteKind, {capacity: 256, textures: {colorMap: page}});
new Scene().add(text);

// the top of the first line at y = 40, centred on x = 0, every pixel of the font 2 units
const glyphs = writeText(text, font, 'GAME OVER\npress fire', {x: 0, y: 40, align: 'center', scale: 2});
for (const glyph of glyphs) glyph.setColor(new Color('#ffd166'));

// the text changes: free the sprites and write it again
export function rewrite(next: string) {
  for (const glyph of glyphs.splice(0)) text.freeSprite(glyph);
  glyphs.push(...writeText(text, font, next, {x: 0, y: 40, align: 'center', scale: 2}));
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
- a line is as wide as the pen after its last char, less one `letterSpacing · s` — the spacing lies
  between chars —, and `align` puts its left edge (`'left'`), its middle (`'center'`) or its right
  edge (`'right'`) on `x`, line by line.

**The anchor of the base.** A sprite is placed by its position, and the base decides where its quad
lies around it. `writeText()` reads the extents of the base out of the geometry's `position`
attribute, so the `baseArgs` of the sprites count: under `QuadBase` with its default the position is
the middle of the glyph box, with `baseArgs: [0.5, 0.5, 0.5, -0.5]` it is the top left corner. A
`Rotation` turns a glyph about its position, so the base chooses the pivot.

**What is written.** The frame (`setFrame()`), the size of the box and the position, with the `z` of
the options. Nothing else: a new sprite keeps its white tint and its rotation of 0 until the caller
writes them. `QuadSize` and `AtlasFrame` are static attributes and reach the GPU with the first
`update()` after `createSprite()`; a later change to one glyph goes up after
`spritePool.touchVO(glyph, 'quadSize')` (see "Uploads" in the sprite guide).

**Chars.** Read by code point, so a char beyond the BMP is one glyph. `\n` ends a line, `\r` is
dropped. A char the font lacks is drawn as `fallback` when one is given (`{fallback: '?'}`), and
otherwise skipped: it takes no room, and the kerning pair forms across it. A space moves the pen and
yields no sprite.

**Word wrap.** With `maxWidth`, in units of the mesh, a line breaks at the last space before the word
that would make it wider; the spaces at the break are dropped. A word wider than `maxWidth` on its own
stays whole on a line of its own and overflows — there is no hyphenation. `lineHeight` takes the place
of the font's, in pixels of the font.

**Freeing.** The sprites are the caller's: `sprites.freeSprite(glyph)` for each. `writeText()` keeps
no reference to them, to the font or to the text — to change a text, free its sprites and write it
again. It is not allocation-free: write a text when it changes, not every frame.

**Draw order.** `sortBy()` and `sortByViewDepth()` on a pool the glyphs share with other sprites mix
them in draw order with those sprites — a label may end up behind the sprite it names; give text a
`FeatureSprites` of its own when the order matters. The handles `writeText()` answered stay the same
objects through a sort, still in reading order.

**Refusals.** A kind without `InstancePosition`, `QuadSize` or `AtlasFrame` — `AnimatedSpriteKind`,
whose frame comes out of an `animsMap` — is refused before a sprite is created, naming every feature
missing. A pool that runs full is refused naming how many sprites the text needs; the sprites created
so far are freed again, so nothing of the text is left behind. A `scale` or `maxWidth` that is no
number above 0, an `align` it does not know and a `fallback` the font lacks are refused naming the
option. Sprites that are disposed write nothing and answer an empty array.

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

`writeText()` lays the text out once; the scroller moves its glyphs. Each sprite keeps the x it was
written at, and every frame moves them all along and bends them on a sine — here on the CPU, one
`setPosition()` per glyph; a feature that bends the sprites in the shader takes that off it:

```ts check
import {type BitmapFont, FeatureSprites, TexturedSpriteKind, writeText} from '@spearwolf/twopoint5d';
import type {Texture} from 'three/webgpu';

declare const font: BitmapFont;
declare const page: Texture;

const scroller = new FeatureSprites(TexturedSpriteKind, {capacity: 128, textures: {colorMap: page}});
const glyphs = writeText(scroller, font, 'GREETINGS TO ALL SCENERS ...', {scale: 4});
const home = glyphs.map((glyph) => glyph.x);
const length = home.at(-1)! + 64;

export function frame(time: number) {
  glyphs.forEach((glyph, i) => {
    const x = ((home[i]! - time * 120) % length + length) % length - 320;
    glyph.setPosition(x, Math.sin(x / 60 + time * 2) * 24);
  });
  scroller.update(); // the position is a dynamic attribute: every update() uploads it
}
```

# Proposal: `DynamicAtlas`, bitmap fonts and `writeText()`

Status: **specified** — phase E, part 1 of
[`sprite-and-texture-roadmap.md`](sprite-and-texture-roadmap.md), §4.11 and §4.12, with decision 6
of its §7 taken: `writeText()` and `BitmapFont` live in a **new module `text/`** with a
`public-api.ts` of its own, re-exported from `src/index.ts`. `tableFrame()` and `PaletteSwap`
(part 2 of phase E) are not part of this proposal.

## 1. Goal

Two things a game draws all the time and the library has no word for: images that exist only at
run time — labels, damage numbers, player names, an avatar from a url — and text out of a bitmap
font — the score, a dialog box, the demo scroller.

```ts
import {BitmapFont, DynamicAtlas, FeatureSprites, TexturedSpriteKind, writeText} from '@spearwolf/twopoint5d';

declare const fnt: string; // the text of a .fnt file
declare const fontTexture: import('three/webgpu').Texture;
declare const portrait: ImageBitmap;

// labels and portraits packed at run time, one texture, one draw call
const ui = new DynamicAtlas({width: 1024, height: 1024, padding: 2});
const label = ui.add('hp', (ctx, w, h) => { ctx.fillStyle = '#fff'; ctx.fillText('HP 10/20', 0, h - 4); }, {width: 96, height: 16});
const face = ui.add('knight', portrait);
const panel = new FeatureSprites(TexturedSpriteKind, {textures: {colorMap: ui.texture}});
panel.createSprite()?.setFrame(face);

// text out of a bitmap font: one sprite per visible glyph, in reading order
const [font] = BitmapFont.parse(fnt);
const text = new FeatureSprites(TexturedSpriteKind, {capacity: 256, textures: {colorMap: fontTexture}});
const glyphs = writeText(text, font, 'GREETINGS TO ALL SCENERS', {x: -200, y: 20, align: 'left'});
for (const glyph of glyphs) text.freeSprite(glyph); // the caller frees them again
```

## 2. What there is today

- `TextureAtlas` maps a name to a frame `{coords, data?}` and an id to the same frame; ids are
  positions in an array and never move. It cannot forget a name: `add()` refuses a name that is
  taken, and nothing takes one back.
- A frame's `coords` are `TextureCoords` relative to a root `TextureCoords` the size of the image;
  `s, t, u, v` come out of that root. `AtlasFrame#setFrame()`, `AtlasFrameTable`,
  `sampleAtlasFrame()` and `FrameBasedAnimations#add()` read nothing but `coords` and — for the trim
  margins — `data.spriteSourceSize`/`data.sourceSize`; a frame without them is untrimmed.
- Every image of the library is read with `flipY = false` (`TextureFactory`'s seed): v counts
  downwards, `TextureCoords` and `sampleAtlasFrame()` depend on it. The lookbook loads its colour
  textures with the class `srgb`.
- `FeatureSprites#createSprite()` answers `undefined` once the pool is full (with a one-time
  warning); `freeSprite()` moves the last sprite into the freed slot, and every handle stays valid.
  The sprites of a kind are placed by `InstancePosition` (`x, y, z` in the local space of the
  mesh), sized by `QuadSize` (the unit quad scaled) and textured by `AtlasFrame`.
- The base of a geometry is laid out once by `make(...baseArgs)` (`FeatureSpritesGeometry`):
  `QuadBase` with its default `[0.5, 0.5]` spans `[-0.5, 0.5]²`, centred on the sprite position;
  `[0.5, 0.5, 0.5, -0.5]` puts the top left corner on it. The geometry keeps no copy of the
  arguments, but its `position` attribute holds the result.
- Vitest runs under Node: there is no `OffscreenCanvas`, no `document`, no `DOMParser`.

The roadmap's sketch is right about the code with one exception: `TextureAtlas` has no way to let
go of a name, which `remove()` needs (§3.4) — a module-internal method is added for it.

## 3. `DynamicAtlas` (module `texture/`)

### 3.1 The API

```ts
export type DynamicAtlasContext = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Draws a frame: the context is moved to the top left of the frame and clipped to it. */
export type DynamicAtlasDraw = (context: DynamicAtlasContext, width: number, height: number) => void;

export type DynamicAtlasImage = ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas;

export interface DynamicAtlasSize {
  width: number;
  height: number;
}

export interface DynamicAtlasOptions {
  /** The size of the atlas in texels — whole numbers of 1 or more. Required without a `canvas`. */
  width?: number;
  height?: number;
  /** A canvas of one's own to pack into; the atlas takes its size and leaves it the caller's. */
  canvas?: HTMLCanvasElement | OffscreenCanvas;
  /** Clear texels between two frames and between a frame and the edge — a whole number of 0 or more. Default 1. */
  padding?: number;
  /** How many texels the edge of every frame is repeated outwards — a whole number of 0 or more. Default 0. */
  extrude?: number;
  /** The filter of the texture, both ways. Default `'linear'`. */
  filter?: 'linear' | 'nearest';
}

export class DynamicAtlas {
  constructor(options: DynamicAtlasOptions);

  readonly width: number;
  readonly height: number;
  readonly padding: number;
  readonly extrude: number;

  /** The frames — an ordinary TextureAtlas; a new one after clear(). */
  get atlas(): TextureAtlas;
  /** The texture of the canvas; the atlas owns it. */
  get texture(): CanvasTexture<HTMLCanvasElement | OffscreenCanvas>;
  get canvas(): HTMLCanvasElement | OffscreenCanvas;
  /** The 2D context of the canvas — to measure text before add(); draw through add() and redraw(). */
  get context(): DynamicAtlasContext;
  get isDisposed(): boolean;

  add(name: TextureAtlasFrameName, draw: DynamicAtlasDraw, size: DynamicAtlasSize): TextureAtlasFrame;
  add(name: TextureAtlasFrameName, image: DynamicAtlasImage, size?: DynamicAtlasSize): TextureAtlasFrame;
  redraw(name: TextureAtlasFrameName, source: DynamicAtlasDraw | DynamicAtlasImage): TextureAtlasFrame;
  remove(name: TextureAtlasFrameName): boolean;
  clear(): void;
  dispose(): void;
}
```

### 3.2 The canvas

Without a `canvas` the atlas builds its own: an `OffscreenCanvas` where the global exists — every
current browser, also in a worker, and no DOM node to hold — and a `document.createElement('canvas')`
otherwise. three uploads both on both backends (`WebGLTextureUtils` takes an `OffscreenCanvas` as an
image source, WebGPU's `copyExternalImageToTexture()` does as well). Where neither exists — Node,
Vitest — the constructor throws:

> `DynamicAtlas: there is no OffscreenCanvas and no document to build a canvas — hand one in: new DynamicAtlas({canvas})`

A `canvas` handed in gives the atlas its size; `width` or `height` beside it is refused with a
`TypeError` (`DynamicAtlas: the size comes from the canvas handed in — leave out width and height`),
since sizing it would change the caller's canvas. A canvas whose `getContext('2d')` answers `null` —
one that already has a WebGL context — is refused naming that.

### 3.3 The texture

`texture` is a `CanvasTexture` of the canvas, built once and never replaced, named
`'twopoint5d.DynamicAtlas'`:

| setting | value | why |
| --- | --- | --- |
| `flipY` | `false` | the convention of every atlas of the library: `TextureCoords` count v downwards, and `sampleAtlasFrame()` reads the wrong place with `true`. `CanvasTexture` defaults to `true`. |
| `colorSpace` | `SRGBColorSpace` | a 2D canvas holds sRGB colours; the class `srgb` the lookbook loads its images with |
| `premultiplyAlpha` | `false` | straight alpha, as every loaded image: the canvas keeps its texels premultiplied, and both upload paths hand them on unpremultiplied with this flag (WebGL's `UNPACK_PREMULTIPLY_ALPHA_WEBGL`, WebGPU's `premultipliedAlpha`) — a half transparent red blends to half red, not a quarter |
| `generateMipmaps` | `false` | every `add()` uploads the whole canvas; building the mip chain each time costs, and the small levels of a packed atlas mix neighbouring frames anyway |
| `minFilter`, `magFilter` | `LinearFilter`, or `NearestFilter` with `filter: 'nearest'` | no mipmap filter without mipmaps; `'nearest'` for pixel art |

Every `add()`, `redraw()`, `remove()` and `clear()` sets `texture.needsUpdate = true`: the renderer
uploads the canvas once with the next render that uses the texture, however many calls came in
between. The upload is the whole canvas; an atlas that changes every frame uploads every frame.

### 3.4 Packing — the shelves

A frame of `width × height` takes a cell of `(width + 2·extrude) × (height + 2·extrude)`: the frame
in the middle, its extruded edges around it. Cells lie `padding` texels apart and `padding` texels
from every edge of the canvas. The frame's `coords` cover the frame alone, never its extrusion.

The packer keeps **shelves**: rows of cells, each as high as the cell that opened it. A cell goes
onto the lowest shelf (by height, the first of equal ones) that is at least as high and still has
room to the right; without one it opens a new shelf below the last. Nothing is ever moved, so a
frame keeps its coords until `clear()`.

A frame that does not fit throws a `RangeError` and changes nothing:

- larger than the atlas can hold at all:
  `DynamicAtlas: the frame "big" of 2000 × 40 does not fit into an atlas of 1024 × 1024 with padding 1 and extrude 0 — build a larger atlas`
- no room left:
  `DynamicAtlas: the atlas of 1024 × 1024 is full — the frame "label-31" of 96 × 16 does not fit beside the 30 frames in it; build a larger one — new DynamicAtlas({width: 2048, height: 2048}) — or clear() it`

There is no silent growth: a larger canvas would move every frame and invalidate every `s, t, u, v`
written to a sprite.

### 3.5 `add()`

`add(name, source, size?)` packs a cell, draws the source into it and adds the frame to `atlas`
under `name`. It answers the frame — the object `atlas.frame(name)` answers —, whose `data` is
`{frame: {x, y, w, h}}`, the rectangle in the canvas in the shape of a TexturePacker entry. The
frame is untrimmed (no `spriteSourceSize`), so `setFrame()` covers the whole quad with it.

- **A draw callback** needs the `size`. The callback runs with the context saved, clipped to the
  frame, translated to its top left, and with the cell cleared; it gets the width and height of the
  frame. The context is restored afterwards, whatever the callback left in it.
- **An image** — `ImageBitmap`, `HTMLImageElement`, `HTMLCanvasElement`, `OffscreenCanvas` — is
  drawn at its own size (`naturalWidth`/`naturalHeight` of an image element, `width`/`height` of the
  rest), or scaled to `size` when one is given; scaling follows `context.imageSmoothingEnabled`.
- A `size` is rounded up to whole texels (`Math.ceil`): text measured by `measureText()` comes in
  fractions. A width or height that is no finite number above 0 is refused with a `RangeError`
  naming the frame and the value.
- An image element that has not loaded (`naturalWidth` 0) is refused:
  `DynamicAtlas: the image of "avatar" has not loaded yet — await image.decode() before add()`.
- A name that is taken is refused before anything is packed:
  `DynamicAtlas: the frame name "hp" is already taken — redraw() draws it anew, remove() lets go of it`.
- A draw callback that throws leaves the atlas as it was: its cell is cleared again and given back,
  no frame is added, and the error goes on to the caller.

**Extrusion.** With `extrude: e > 0` the frame's outermost rows and columns are copied outwards `e`
times — the left column into the `e` columns left of it, and so on, the corners from the corner
texels — by drawing the canvas onto itself with image smoothing off. Linear filtering at the edge of
a frame then reads its own edge, not the padding.

### 3.6 `redraw()`, `remove()`, `clear()`

- `redraw(name, source)` clears the cell of the frame and draws `source` into it at the frame's
  size — a callback with `(context, width, height)`, an image scaled to it — and extrudes again. The
  frame object, its id and its coords stay: every sprite showing it shows the new picture after the
  next upload, nothing is written to them. A score counter or a health label redraws; it does not
  add again. A name the atlas does not hold throws
  (`DynamicAtlas: there is no frame "hp" to redraw — add() it first`).
- `remove(name)` clears the cell and lets go of the name: `atlas.frame(name)` and
  `atlas.frameId(name)` answer `undefined`, and `add(name, …)` may take it again — for a new cell.
  The cell is **not** reused: a shelf packer fragments, and a freed hole would have to fit the next
  frame exactly. The frame keeps its id, `atlas.get(id)` still answers it (showing a cleared
  rectangle) and `atlas.size` stays. Answers `true`, or `false` for a name it does not hold.
- `clear()` clears the canvas and the shelves and starts a **new** `TextureAtlas`: `atlas` answers
  the new one, frame ids start at 0 again. Frames, tables and prepared frames of before are stale.
  The `texture` and the `canvas` stay the same objects.

`remove()` needs the atlas to forget a name. `TextureAtlas` gets a method under a module-internal
symbol (`forgetFrameName` in `texture/internals.ts`, not in `public-api.ts`) that removes the name
from the name map and the name list and leaves the frame at its id.

### 3.7 Ownership and `dispose()`

The atlas builds the texture and — without a `canvas` handed in — the canvas: both are its own. A
canvas handed in stays the caller's: it is drawn on (that is what it was handed in for) but neither
resized nor released. The frames and the `TextureAtlas` are plain data.

`dispose()` disposes the texture, shrinks a canvas of its own to 0 × 0 so its backing store goes at
once, and is idempotent (a flag). Afterwards, by the rules of `docs/resource-lifecycle.md` §3:

- `texture`, `canvas` and `context` claim a value and throw
  (`DynamicAtlas#texture is not available: this atlas has been disposed`);
- `add()` and `redraw()` answer a frame and throw the same way;
- `remove()` answers `false` and `clear()` does nothing;
- `atlas`, `width`, `height`, `padding`, `extrude` answer what they held — plain data, nothing was
  released; `isDisposed` answers `true`.

A sprite still drawing with the texture is the caller's affair, as with every texture.

### 3.8 Refusals of the constructor

`width`/`height` missing without a canvas (`DynamicAtlas: give the size of the atlas — new
DynamicAtlas({width: 1024, height: 1024})`), not whole numbers of 1 or more, `padding`/`extrude`
not whole numbers of 0 or more, a `filter` that is neither `'linear'` nor `'nearest'` — each a
`RangeError` or `TypeError` naming the option and the value (`describeValue()`).

## 4. `BitmapFont` (module `text/`)

### 4.1 The formats

The AngelCode BMFont format in its three spellings. All three carry the same blocks: `info`
(face, size, padding, spacing, …), `common` (`lineHeight`, `base`, `scaleW`, `scaleH`, `pages`, …),
the page files, the chars (`id x y width height xoffset yoffset xadvance page chnl`) and the kerning
pairs (`first second amount`).

| spelling | recognised by | read by |
| --- | --- | --- |
| text (`.fnt`) | a string whose first word is a tag — `info`, `common` | lines of `tag key=value …`; a value in quotes is a string, a list `0,0,0,0` an array of numbers, everything else a number |
| XML (`.fnt`/`.xml`) | a string starting with `<` (after whitespace) | the elements `info`, `common`, `page`, `char`, `kerning` and their attributes, by a small tokenizer — no `DOMParser`, so it runs in Node and in a worker; the five XML entities are decoded; `face`, `charset` and `file` stay strings, every other value is read as a number or a list |
| JSON | an object, or a string starting with `{` | the layout of `parse-bmfont-ascii` / `load-bmfont` / `bmfont2json` / `msdf-bmfont-xml`: `{pages: string[], chars: [...], kernings?: [...], info?: {...}, common: {...}}`; further fields (`char`, `index`, `distanceField`) are left alone |

A string that is none of them is refused naming the three; the binary BMFont format (a string
beginning `BMF`) is refused naming the export settings (`export the font as text, XML or JSON`).

### 4.2 The API

```ts
/** A char as the font file writes it. */
export interface BitmapFontChar {
  id: number; x: number; y: number; width: number; height: number;
  xoffset: number; yoffset: number; xadvance: number; page: number; chnl: number;
}

export interface BitmapFontKerning { first: number; second: number; amount: number; }

/** The JSON layout, and what the text and XML spellings are read into. */
export interface BitmapFontData {
  pages: string[];
  chars: BitmapFontChar[];
  kernings?: BitmapFontKerning[];
  info?: BitmapFontInfo;   // face, size, bold, italic, charset, unicode, stretchH, smooth, aa, padding, spacing, outline — all optional
  common: BitmapFontCommon; // lineHeight, base, scaleW, scaleH required; pages, packed, the channels optional
}

/** A glyph of a font: its char, the char as a string, and its frame in the atlas. */
export interface BitmapFontGlyph extends Readonly<BitmapFontChar> {
  readonly char: string;
  readonly frame: TextureAtlasFrame<BitmapFontChar>;
}

export interface BitmapFontOptions {
  /** The coords the page lies in — by default `new TextureCoords(0, 0, scaleW, scaleH)`. */
  parentCoords?: TextureCoords;
}

export class BitmapFont {
  static parse(source: string | BitmapFontData, options?: BitmapFontOptions): [font: BitmapFont, atlas: TextureAtlas<BitmapFontChar>];
  constructor(data: BitmapFontData, options?: BitmapFontOptions);

  readonly atlas: TextureAtlas<BitmapFontChar>;
  readonly face: string;        // info.face, or ''
  readonly size: number;        // info.size, or lineHeight
  readonly lineHeight: number;
  readonly base: number;
  readonly scaleW: number;
  readonly scaleH: number;
  /** The file of the page as the font names it — relative to the font file — or undefined. */
  readonly page: string | undefined;
  readonly info: Readonly<BitmapFontInfo>;
  readonly common: Readonly<BitmapFontCommon>;
  get glyphCount(): number;

  /** The glyph of a char — a string's first code point, or a code point. */
  glyph(char: string | number): BitmapFontGlyph | undefined;
  /** The kerning amount between two chars in font pixels; 0 without a pair. */
  kerning(first: string | number, second: string | number): number;
}
```

`parse()` reads the spelling into a `BitmapFontData` and answers `[font, font.atlas]` — the tuple
shape of `TexturePackerJson.parse()` and `AsepriteJson.parse()`. The atlas holds one frame per
char, named by the char as a string (`'A'`), in the order of the file; each frame's `data` is a
frozen copy of its char. The frames are untrimmed: the offsets are not trim margins — they move the
glyph inside its line, and `writeText()` applies them (§5.2). A char of width or height 0 — the space
— has a frame of 0 × 0 and is never drawn.

The page image is not loaded: `font.page` names it relative to the font file, and the caller loads
it with `flipY = false` — `TextureFactory`, `TextureStore` — and `nearest` for pixel fonts.

### 4.3 One page

`writeText()` draws into one `FeatureSprites` with one `colorMap`, so a font of several pages
cannot be drawn by it. A font with more than one page — `pages.length` or `common.pages` above 1,
or a char whose `page` is not 0 — is refused:

> `BitmapFont: the font "lookbook chrome" has 2 pages — writeText() draws out of one texture; export the font onto one page (BMFont: a larger texture)`

### 4.4 Refusals

Each throws before the atlas holds a frame, naming the char by itself and its id where one is
involved:

- no `common`, or a `lineHeight`, `base`, `scaleW` or `scaleH` that is no finite number (the last
  two above 0);
- no `chars` array;
- a char whose `id` is no whole number of 0 or more, or a field of §4.2 that is no finite number;
  `width`, `height` below 0;
- a char that lies outside the page: `BitmapFont: the char "A" (65) reaches beyond the page of 128 × 64 — x 120 + width 12`;
- two chars of one id;
- a kerning pair whose fields are no finite numbers (pairs naming chars the font lacks are kept and
  never met).

## 5. `layoutText()` and `writeText()` (module `text/`)

### 5.1 The API

```ts
export interface TextLayoutOptions {
  /** Where the text goes, in the units of the mesh: see §5.2. Default 0, 0. */
  x?: number;
  y?: number;
  /** How each line lies against `x`. Default 'left'. */
  align?: 'left' | 'center' | 'right';
  /** Mesh units per font pixel. Default 1. */
  scale?: number;
  /** Extra space between two glyphs of a line, in font pixels. Default 0. */
  letterSpacing?: number;
  /** The distance of two lines, in font pixels. Default the font's lineHeight. */
  lineHeight?: number;
  /** Lines wider than this, in mesh units, break at a space. Default: no wrap. */
  maxWidth?: number;
  /** A char drawn in place of a char the font lacks. Default: such a char is skipped. */
  fallback?: string;
}

export interface WriteTextOptions extends TextLayoutOptions {
  /** The z of every glyph. Default 0. */
  z?: number;
}

export interface TextLayoutGlyph {
  readonly glyph: BitmapFontGlyph;
  readonly line: number;
  /** The box of the glyph in mesh units: its left and top edge (y up), its width and height. */
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface TextLayout {
  /** The visible glyphs in reading order. */
  readonly glyphs: readonly TextLayoutGlyph[];
  readonly lineCount: number;
  /** The width of the widest line and the height of all lines, in mesh units. */
  readonly width: number;
  readonly height: number;
}

export function layoutText(font: BitmapFont, text: string, options?: TextLayoutOptions): TextLayout;

export function writeText<Api extends InstancePositionApi & QuadSizeApi & AtlasFrameApi>(
  sprites: FeatureSprites<Api>,
  font: BitmapFont,
  text: string,
  options?: WriteTextOptions,
): (Api & VO)[];
```

`layoutText()` is the pure half — no sprites, nothing written — for measuring a text before it is
drawn (a panel sized to its label, a scroller that knows its length) and for a mesh of one's own.
`writeText()` lays the text out with it and writes it into sprites.

### 5.2 The layout — coordinates

The text is laid out in the x/y plane of the mesh, **y up** — the convention of `InstancePosition`
under `FlatPlacement` and of every billboard. A text on the ground is a `FlatPlacement` mesh turned
by `rotation.x = -Math.PI / 2`, as `GroundPlacement` is.

`(x, y)` is the **top** of the first line — the top of the BMFont line box, which every `yoffset` is
measured from — at its left edge, middle or right edge by `align`. To write on a baseline, pass
`y: baselineY + font.base · scale`. With `s = scale`:

- line `n` (from 0) has its top at `y − n · lineHeight · s`;
- the pen of a line starts at 0; a glyph lies at `penX + xoffset · s` (left) and
  `lineTop − yoffset · s` (top), `width · s` wide and `height · s` high; the pen then moves on by
  `(xadvance + kerning(previous, this) + letterSpacing) · s`;
- the width of a line is the pen after its last char less one `letterSpacing · s` — the spacing lies
  between chars, not after the last; an empty line is 0 wide;
- `align` moves the whole line: its left edge to `x` (`'left'`), `x − width / 2` (`'center'`),
  `x − width` (`'right'`);
- `width` of the layout is its widest line, `height` is `lineCount · lineHeight · s`.

Chars are read by code point (`for … of`), so a char beyond the BMP is one glyph. `\n` ends a line,
`\r` is dropped. A char the font lacks is drawn as `fallback` when one is given, and otherwise
skipped: it takes no room and breaks no kerning pair (the pair is formed by the chars on both sides
of it). A char of width or height 0 — the space — moves the pen and yields no glyph.

**Word wrap** (`maxWidth`) is greedy: a line breaks at the last space (U+0020) before the word that
would make it wider than `maxWidth`; the spaces at the break are dropped. A word wider than
`maxWidth` on its own stays whole on a line of its own and overflows — no hyphenation. `\n` still
breaks where it stands.

Not allocation-free: every call builds a layout object per visible glyph. Lay a text out when it
changes, not every frame.

### 5.3 Into sprites — the anchor of the base

`writeText()` creates one sprite per glyph of the layout in `sprites`, in reading order, and writes:

- `setFrame(glyph.frame)`,
- `setSize(width, height)` — the glyph box,
- `setPosition(px, py, z)`, where the position is the glyph box moved by the anchor of the base:
  `px = x − width · minX`, `py = y − height · maxY`, with `minX` and `maxY` the extents of the base's
  `position` attribute (read from the geometry, so `baseArgs` count). Under `QuadBase` with its
  default `[0.5, 0.5]` — extents `−0.5 … 0.5` — the position is the middle of the box; with
  `baseArgs: [0.5, 0.5, 0.5, -0.5]` it is the top left corner.

Nothing else is written: a `Tint`, a `Rotation` or any other feature of the kind keeps the start
value of a new sprite (white, 0) until the caller writes it. A rotation turns a glyph about its
position, so the base decides the pivot.

It answers the handles, in reading order. The caller frees them —
`for (const glyph of glyphs) sprites.freeSprite(glyph)` — and sets the font's texture as the
`colorMap` of the sprites; `writeText()` sets no texture and keeps no reference.

### 5.4 Refusals of `writeText()` and `layoutText()`

- sprites whose kind lacks `InstancePosition`, `QuadSize` or `AtlasFrame` (checked by identity of
  the features) — a `TypeError` before a sprite is created:
  `writeText: the sprites lack the features QuadSize, AtlasFrame — writeText() writes the position, the size and the frame of every glyph; build the kind with InstancePosition, QuadSize and AtlasFrame, as TexturedSpriteKind does`;
- a pool that runs full: the sprites created so far are freed again, and a `RangeError` names the
  count — `writeText: "GREETINGS TO AL…" needs 21 sprites, and the pool ran full after 12 — give the sprites a larger capacity; no sprite was written`;
  `createSprite()`'s one-time warning goes out as well;
- `scale` and `maxWidth` that are no finite number above 0, `x`, `y`, `z`, `letterSpacing` and
  `lineHeight` that are no finite number, an `align` that is none of the three, a `fallback` that is
  no single char or no glyph of the font — each naming the option and its value.

Disposed sprites — `geometry` gone — write nothing: `writeText()` answers an empty array (the
mutating call with nothing left to act on, `resource-lifecycle.md` §3).

## 6. Ownership and lifecycle

`DynamicAtlas` owns its texture and its own canvas (§3.7). `BitmapFont` and its atlas are plain
data with no `dispose()`. `layoutText()` and `writeText()` keep nothing; the sprites `writeText()`
creates are handed straight to the caller (`resource-lifecycle.md` §1, "passes what it took straight
out to its caller"), who frees them.

## 7. Fixtures

`packages/twopoint5d/src/text/fixtures/`: the font `pixel-8` of the lookbook (`apps/lookbook/assets-src/README.md`,
"sine-scroller": `size=8 lineHeight=10 base=7`, advance 8, ASCII 32–126, one page of 128 × 64, white)
— `pixel-8.fnt` and `pixel-8.json` byte for byte, `pixel-8.png`, `OFL.txt` (the licence travels with
the font), and `pixel-8.xml`, written from the `.fnt` by `generate.mjs` in the same folder in
BMFont's XML layout. A `README.md` says where they come from. Kerning and multi-page cases are
written inline in the specs.

## 8. Tests

- `DynamicAtlas.spec.ts` (Vitest, a recording fake canvas from `src/testing/`): the refusals of
  §3.2, §3.5, §3.8; the shelves — positions of a sequence of frames, a taller frame opening a shelf,
  a lower frame going onto the lowest fitting shelf, padding at the edges; both full errors and that
  a refused frame changes nothing; the draw callback's clip, translation and size; images by natural
  size and scaled; `Math.ceil`; extrusion's eight self-copies; a throwing callback rolls back;
  `redraw()` keeps frame and coords; `remove()` frees the name not the space; `clear()` new atlas;
  the texture settings of §3.3 and `needsUpdate` per call; `dispose()` (a)–(d) of the lifecycle
  pattern, a canvas handed in left alone; the atlas works with `AtlasFrameTable` and
  `prepareSpriteFrame()`; Node without a canvas throws the message of §3.2.
- `TextureAtlas.spec.ts`: the internal `forgetFrameName`.
- `BitmapFont.spec.ts`: the three fixtures read into equal fonts and atlases; the text tokenizer
  (quoted strings with spaces, lists, negatives); XML entities; JSON as object and string; kerning;
  every refusal of §4.1, §4.3, §4.4; `parentCoords`.
- `layoutText.spec.ts` / `writeText.spec.ts`: the math of §5.2 on `pixel-8` and inline fonts
  (offsets, kerning, letterSpacing, scale, align per line, `\n`, `\r`, code points beyond the BMP,
  missing chars, fallback, wrap incl. the overlong word); `writeText()` against `TexturedSpriteKind`
  and a kind with `baseArgs: [0.5, 0.5, 0.5, -0.5]` (positions), the refusals of §5.4, the rollback
  on a full pool, disposed sprites.
- Browser, `texture-dynamic-atlas.test.js` (WebGPU and WebGL 2): frames from a callback, an
  `ImageBitmap` and a canvas drawn upright where their pixels are; a frame added after the first
  render shows in the second; `redraw()` shows the new picture with no write to the sprite; a half
  transparent red over black blends to half red (straight alpha); extrusion and padding read back
  from the canvas.
- Browser, `text-bitmap-font.test.js`: `pixel-8` drawn by `writeText()` — two lines, `align` left
  and right — every texel of every glyph's box compared with the page image at the place §5.2
  computes; a glyph with a `yoffset` lands lower by it.

## 9. Docs

- `docs/sprites.md`: a section "Atlases built at run time: `DynamicAtlas`" after "Aseprite sheets"
  — a `ts check` block (labels with `measureText()`, a portrait, `redraw()` for a counter), the
  packing, padding and extrusion, the texture settings, ownership; a pointer to `docs/text.md`.
- `docs/text.md`, the guide of the module `text/`: loading a font (fetch, `parse()`, the page via
  `TextureFactory`), `writeText()` in a `ts check` block, the coordinates and the anchor of the base,
  `layoutText()` for measuring, wrap, freeing, a sine scroller sketch (`Tint` per glyph, positions per
  frame).
- `README.md` of the package: a `text` entry in the module list, `DynamicAtlas` in the texture entry;
  `docs/architecture.md`: the layer `text/` above `sprites/` and its section.
- CHANGELOG `[Unreleased]`, Added: `DynamicAtlas`; `BitmapFont`; `layoutText()` and `writeText()`.

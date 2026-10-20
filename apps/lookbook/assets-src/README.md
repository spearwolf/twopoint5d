# Lookbook asset sources

The generators of the assets under `apps/lookbook/public/assets/<demo>/`, one directory per demo,
and the contract between them and the demos: every output file, its format, its frame names,
palette rows, nine-slice insets and font metrics. A demo is built from this file alone.

`cardboard/` is older and separate: a Python pipeline with its own README, not part of the build
below.

## Rerun

```sh
pnpm lookbook:assets                              # every demo
pnpm lookbook:assets --only=platformer,ui-panels  # some
pnpm lookbook:assets --skip-render                # reuse Blender's render cache
```

`build.mjs` empties `public/assets/<demo>/`, runs `<demo>/generate.mjs`, and formats the JSON it
wrote with Biome (the repo's lint holds every JSON file to it). The outputs are committed; no
build or check of the repo runs the generators, so a change to an asset is a commit of the
generator and its output together. The output is the same, byte for byte, on every run with the
same versions of Node, sharp and Blender.

Requirements: Node (the repo's), `sharp` (a devDependency of the lookbook) to decode the
committed raw images and to resize, and for `boomer-shooter-corridor` Blender on the PATH (tested
with 5.2 LTS, falls back to `/usr/bin/blender`), run headless with `-b --factory-startup`. No
network, no ComfyUI: images painted with ComfyUI are curated sources committed under
`<demo>/raw/` next to a `source.json` that records prompt, seed, workflow and settings.

`pnpm typecheck` checks the generators as JavaScript (`checkJs`, `assets-src/tsconfig.json`,
the lookbook's `assets:check`), and `pnpm lint` formats and lints them like every other file.

## Layout

| path | role |
| --- | --- |
| `build.mjs` | the entry point of `pnpm lookbook:assets` |
| `lib/png.mjs` | PNG encoder (exact pixels, no colour profile) and a decoder via sharp |
| `lib/image.mjs` | `Img`, the RGBA canvas; colours, ramps, seeded `Rng`, value noise, Bayer dithering, ASCII pixel art |
| `lib/pack.mjs` | shelf packer, with optional trimming |
| `lib/formats.mjs` | the JSON and text layouts: TexturePacker hash, free-tex-packer hash, Aseprite hash, BMFont text and JSON |
| `lib/ttf.mjs` | a TrueType reader and rasterizer without anti-aliasing, for pixel fonts |
| `lib/bmfont.mjs` | builds a BMFont from a pixel font |
| `shared/fonts/press-start-2p/` | the source font of every bitmap font, with its licence |
| `<demo>/generate.mjs` | the generator of one demo |

## Conventions for every demo

- **Pixel art at native resolution.** Load with `nearest` filtering (`["nearest", "srgb"]` in a
  `textures.json` item) and scale up in the scene. The soft glows (`sine-scroller/saber-glow`,
  `rope-bridge` blade) are the exception and may also take `linear`.
- **Straight alpha**, no premultiplied edges. Pixel-art sprites are opaque or clear, nothing in
  between; the colour of a clear pixel is 0.
- **Atlases** are TexturePacker "JSON (Hash)" unless the section says otherwise — the layout of
  the atlases already in `public/assets/`, read by `TexturePackerJson.parse()` and by a
  `textures.json` item with `atlasUrl`. Frames are packed untrimmed unless noted, 2 pixels apart.
- **Fonts** are AngelCode BMFont in two flavours with the same metrics: the text format (`.fnt`)
  and JSON in the layout of `parse-bmfont-ascii` / `load-bmfont` (`pages`, `chars`, `info`,
  `common`, `kernings`). One page each, `chnl=15`, no kerning pairs (the source font is
  monospaced). They derive from *Press Start 2P* by CodeMan38 under the SIL Open Font License
  1.1; the licence travels with them as `OFL.txt`, and — the font's name being reserved — the
  derived faces carry names of their own.
- **Palettes** for `PaletteSwap` are small PNGs: row 0 the source colours, each further row a
  replacement set of the same length. Every pixel of the image they belong to uses a row-0
  colour exactly, which the generator checks.

## vector-balls

`vector-balls/balls.png` (128 × 128) + `balls.json`, TexturePacker hash, untrimmed.

| frame | size | what |
| --- | --- | --- |
| `ball-red`, `ball-orange`, `ball-yellow`, `ball-green`, `ball-cyan`, `ball-blue`, `ball-purple`, `ball-pink` | 32 × 32 | a ball shaded in eight bands, white highlight upper left, a faint bounce light lower right |
| `ball-white` | 32 × 32 | the same in greys, for `Tint` |
| `ball-shadow` | 32 × 12 | a floor shadow, dark violet in four alpha steps (40–160) |

## sine-scroller

| file | format | what |
| --- | --- | --- |
| `chrome-32.fnt`, `chrome-32.json`, `chrome-32.png` (512 × 256) | BMFont | the chrome scroller font, ASCII 32–126 |
| `chrome-32-palette.png` (16 × 4) | palette | the 16 colours of the chrome font and three replacement rows |
| `pixel-8.fnt`, `pixel-8.json`, `pixel-8.png` (128 × 64) | BMFont | plain white 8 px font, ASCII 32–126, for `Tint` (above 1 it glows) |
| `OFL.txt` | text | the licence of both fonts |
| `copper-bars.png` (4 × 144) | image | nine copper bars of 16 rows each, stretch horizontally |
| `cycle-tunnel.png` (128 × 128) + `cycle-tunnel-palette.png` (16 × 4) | image + palette | a two-armed spiral tunnel for colour cycling |
| `saber-glow.png` (128 × 128) + `saber-glow.json` | TexturePacker hash | light-saber glow strips |

**`chrome-32`** — `size=32 lineHeight=36 base=28`, every glyph advances 32 pixels. The 8 px source
glyphs are scaled 4× and outlined by 2 pixels (8-neighbourhood), so a glyph's box reaches 2 pixels
beyond its cell: `xoffset` and `yoffset` go down to −2. The capitals stand on the baseline at
y = 28; descenders (`g j p q y , ;`) reach y = 32. The fill is a chrome gradient in bands of two
rows: deep blue sky brightening to a white horizon at rows 12–13, a dark brown line at 14–15, the
ground from brown to pale gold below.

**`chrome-32-palette.png`** — 16 entries per row; entry 0 is the outline `#0a0418`, the same in
every row; entries 1–15 the gradient from the top of the letters down. Cycle entries 1–15 with
`paletteShift` to run the colours through the letters.

| row | colours |
| --- | --- |
| 0 | the source chrome: `#1a2a6c` … `#ffffff` (sky, entries 1–7), `#2a1408` (horizon, 8), `#5a2c0c` … `#fffadc` (ground, 9–15) |
| 1 | rainbow, cyclic — 15 hues |
| 2 | copper / gold, dark at both ends |
| 3 | ice, cyclic — deep blue to pale cyan and back |

**`pixel-8`** — `size=8 lineHeight=10 base=7`, advance 8, white, no outline. The capitals stand on
the baseline at y = 7, descenders reach y = 8. The same font is in `ui-panels/`.

**`copper-bars.png`** — bar *n* (0–8) is rows `16·n` to `16·n + 15`: red, orange, yellow, green,
cyan, blue, purple, magenta, and bar 8 in greys for `Tint`. Each bar runs dark → saturated →
near-white → back in eight steps, symmetric.

**`cycle-tunnel`** — the image uses exactly the 16 colours of palette row 0: the greys `i · 17`
(`#000000`, `#111111`, … `#ffffff`), entry *i* for grey *i*. Cycle all 16 entries.

| row | colours, cyclic |
| --- | --- |
| 0 | greys, the source |
| 1 | rainbow, 16 hues |
| 2 | fire: black-red → orange → yellow-white → back |
| 3 | sea: deep blue → pale cyan → back |

**`saber-glow`** — frames `saber-cyan`, `saber-green`, `saber-red`, `saber-purple`, `saber-white`
(a pale blue-white for `Tint`), each 64 × 16: a white core in rows 6–9, then the colour, its alpha
falling off to 0 at the edges. Every column is the same, so a strip repeats along its length
(`RepeatingTextureColor`); `Tint` above 1 plus bloom makes the glow.

## platformer

| file | format | what |
| --- | --- | --- |
| `fighter.png` (256 × 256) + `fighter.json` | Aseprite hash, trimmed | the kung-fu fighter, 24 frames |
| `goblin.png` (128 × 128) + `goblin.json` | Aseprite hash, trimmed | the goblin, 13 frames, in palette row 0 colours |
| `goblin-palette.png` (16 × 4) | palette | the goblin's source colours and its red, blue and green variants |
| `sky.png`, `mountains.png`, `machines.png` (512 × 216 each) | image | three parallax layers, back to front |
| `tiles.png` (64 × 128) + `tiles.json` | TexturePacker hash | the tile set |

Generators: `platformer/puppet.mjs` (capsule puppet with two-bone IK), `fighter.mjs`,
`goblin.mjs` (palette and poses), `backdrop.mjs` (layers and tiles), `generate.mjs`.

**The Aseprite sheets** follow Aseprite 1.3's `--format json-hash` export with `--trim
--list-tags --list-layers --list-slices`: frame keys `"fighter 0.aseprite"` … `"fighter
23.aseprite"` in frame order, each with `frame`, `rotated`, `trimmed`, `spriteSourceSize`,
`sourceSize` and `duration` (ms); `meta.app` is `https://www.aseprite.org/`, `meta.frameTags`
holds `name`, `from`, `to` (inclusive), `direction` and `color`, `meta.slices` one slice `pivot`.
Both characters face **right**; mirror them with `Flip`.

**`fighter`** — a 70s martial-arts film hero in a yellow jumpsuit with black side stripes, black
bowl cut, black slippers. Canvas (`sourceSize`) 64 × 64; frames trimmed to their pixels.

| tag | frames | direction | durations (ms) |
| --- | --- | --- | --- |
| `idle` | 0–3 | `pingpong` | 160, 140, 140, 160 — fighting stance, breathing |
| `walk` | 4–9 | `forward` | 100 each — a stride in guard |
| `kick` | 10–14 | `forward` | 80, 70, **320**, 90, 110 — chamber, extend, the held high side kick (frame 12), re-chamber, stance |
| `flying-kick` | 15–20 | `forward` | 100, 90, 90, **380**, 100, 140 — crouch, take-off, tuck, the held flying kick (frame 18), descent, landing |
| `hit` | 21–23 | `forward` | 80, 180, 160 — recoil and recover |

`kick`, `flying-kick` and `hit` are one-shots (`playback: 'once'`). Slice `pivot`: one key at frame
0, bounds the whole canvas `{x: 0, y: 0, w: 64, h: 64}`, `pivot {x: 32, y: 63}` — the pixel the
feet stand on, the middle of the bottom row; as an anchor, (0.5, 1) of the untrimmed frame. In
`idle` and `walk` the soles are on row 63; the flying kick leaves the ground inside the canvas,
so the pivot stays where the ground is.

**`goblin`** — squat, big-eared, a spiked club over its shoulder, facing right. Canvas 56 × 48,
trimmed. Slice `pivot`: bounds `{x: 0, y: 0, w: 56, h: 48}`, `pivot {x: 28, y: 47}`.

| tag | frames | direction | durations (ms) |
| --- | --- | --- | --- |
| `walk` | 0–3 | `forward` | 130 each |
| `attack` | 4–7 | `forward` | 140, 60, **260**, 140 — wind-up, swing, the held strike (frame 6), recover |
| `hit` | 8–9 | `forward` | 90, 200 |
| `die` | 10–12 | `forward` | 120, 120, 400 — falls on its back; hold the last frame, then `Fade` |

**`goblin-palette.png`** — 16 entries, one row per variant. Every pixel of `goblin.png` is
exactly one of the row-0 colours (checked by the generator); entries 0, 5 and 9–13 are the same in
every row.

| entry | paints | row 0, olive (source) | row 1, red | row 2, blue | row 3, green |
| --- | --- | --- | --- | --- | --- |
| 0 | outline | `#1a1016` | `#1a1016` | `#1a1016` | `#1a1016` |
| 1–3 | skin light, skin, skin shadow | `#a8b04a` `#788a2e` `#4c5a1e` | `#f07a5e` `#c0402e` `#782018` | `#86bcf0` `#4a74c0` `#2a4080` | `#8ee86a` `#44a838` `#22661e` |
| 4 | eye | `#ffd23a` | `#fff27a` | `#ff5040` | `#ff3a3a` |
| 5 | teeth, claws | `#f0e6c8` | = | = | = |
| 6–8 | cloth light, cloth, cloth shadow | `#a8744a` `#7a4e30` `#4e301e` | `#6a6a7c` `#46465a` `#2a2a36` | `#a678c4` `#6e4490` `#40265a` | `#c89448` `#8a6020` `#563a12` |
| 9–11 | club light, club, club shadow | `#c89a60` `#946a3c` `#5e4026` | = | = | = |
| 12 | strap | `#2c1e1a` | = | = | = |
| 13 | spikes | `#b8c0cc` | = | = | = |
| 14 | mouth | `#6a1a22` | `#2a0a10` | `#401838` | `#5a1020` |
| 15 | inner ear | `#d07a6a` | `#ffb0a0` | `#c8a8f4` | `#f0a080` |

**The parallax layers** — 512 × 216 each, seamless horizontally (`RepeatingTextureColor` or two
quads side by side), lit by a sunset low on the horizon.

| layer | content | suggested scroll factor |
| --- | --- | --- |
| `sky.png` | opaque; a dithered dusk gradient (indigo to gold, horizon at y ≈ 176), stars, a ringed planet at (372, 64), a small moon at (118, 38) | 0.05 |
| `mountains.png` | transparent above; alien crags with a pink rim light, the tallest spire reaching the top edge | 0.25 |
| `machines.png` | transparent above; a machine city — towers with lit windows and red beacons, chimneys, domes, pipes — standing on a floor at y = 192, solid dark below | 0.5 |

**`tiles`** — TexturePacker hash, untrimmed, a Turrican tech set in steel blue with a cyan glow
strip and amber warning stripes. Tiles meet seamlessly on a 16-pixel grid.

| frame | size | what |
| --- | --- | --- |
| `ground-top`, `ground-top-left`, `ground-top-right` | 16 × 16 | the walkable top of the ground and its two ends |
| `ground` | 16 × 16 | the fill below |
| `platform`, `platform-left`, `platform-right` | 16 × 8 | a floating platform and its ends |
| `girder` | 16 × 16 | a truss, stacks vertically under a platform |
| `crate` | 16 × 16 | a tech crate with warning chevrons |
| `lamp` | 16 × 16 | a lamp post with a cyan light, standing on the bottom edge |

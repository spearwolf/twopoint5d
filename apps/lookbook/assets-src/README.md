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

## rope-bridge

| file | format | what |
| --- | --- | --- |
| `bridge.png` (128 × 256) + `bridge.json` | TexturePacker hash, untrimmed | segment textures and the parts of the bridge |
| `cave-back.png`, `cave-mid.png`, `cave-front.png` (512 × 288 each) | image | a dark cave in three parallax layers, back to front |

**Segment textures** — drawn along x, the segment's length; y runs across it. Every column equals
the one 32 pixels on (checked by the generator), so each 64 × 16 frame repeats along a segment
without a seam: `RepeatingTextureColor` with a 64 × 16 frame on a segment `length` long and
`thickness` thick repeats it `(length / thickness) / 4` times.

| frame | size | what |
| --- | --- | --- |
| `rope` | 64 × 16 | twisted hemp, rows 1–14 (an outline row at 1 and 14), three strands per 16 pixels |
| `chain` | 64 × 16 | iron links, one face-on and one edge-on per 32 pixels |
| `vine` | 64 × 16 | a thin stem with leaves, mostly transparent — hanging greenery |
| `saber-blade` | 64 × 16 | a light-saber blade in white: opaque core in rows 6–9, alpha falling off to the edges; colour it with `Tint` above 1 and bloom |

**Parts** — pixel art, outlined `#120c10`.

| frame | size | what |
| --- | --- | --- |
| `saber-hilt` | 32 × 12 | a chrome hilt, the emitter at the right end (x = 31), a red stud; the blade starts at the right edge |
| `plank-0`, `plank-1`, `plank-2` | 32 × 8 | weathered planks seen from the side, nail heads near both ends — a deck plank hangs between two rope points |
| `post` | 16 × 48 | a wooden post with rope wound round its top, standing on the bottom edge |
| `lantern` | 16 × 24 | a hanging lantern with pale cyan glass, its ring at the top |
| `mote` | 16 × 16 | a soft round glow in white, alpha only — lumafly particles, tinted |

**The cave** — 512 × 288 each, seamless horizontally, cool blue-black, no pixel-art outlines:
smooth shading at native resolution.

| layer | content | suggested scroll factor |
| --- | --- | --- |
| `cave-back.png` | opaque; deep blue haze brighter towards the middle, faint distant pillars, three pale light shafts falling from the upper left | 0.1 |
| `cave-mid.png` | transparent between; ceiling with stalactites down to y ≈ 120 and a floor from y ≈ 220, slate blue with a blue rim light `#4a6a9a` on the edges facing the open cave | 0.4 |
| `cave-front.png` | transparent between; near-black stalactites and rocks at the top and bottom edges, rim `#2a3a5a` | 0.8, or in front of the bridge |

## swaying-grass

| file | format | what |
| --- | --- | --- |
| `meadow.png` (128 × 256) + `meadow.json` | free-tex-packer JSON (hash), untrimmed | 18 plants of a night meadow |
| `meadow-back.png` (512 × 256) | image | the night behind the meadow, seamless horizontally |
| `meadow-ground.png` (128 × 24) | image | a strip of soil with a grass edge on top, seamless horizontally |

**`meadow.json`** is the layout free-tex-packer-core 0.3.9 writes with its "JSON (hash)" exporter:
the TexturePacker frame fields plus `"pivot": {"x": 0.5, "y": 0.5}` on every frame (a constant of
the exporter — *not* the plant's foot), `meta.app` `http://github.com/odrick/free-tex-packer-core`,
`meta.version` `0.3.9`, a numeric `meta.scale` of `1`, and the frames in packing order. The
generator packs the plants itself; the same images run through free-tex-packer-core give the same
fields, sizes and flags, only another packing.

Every plant is a separate image whose **foot is on the bottom row at x = ⌊width / 2⌋** (checked by
the generator) and which grows upwards — the base of `wave({weight: 'top'})`: anchor the quads at
the bottom centre. Pixel art, outlined `#08141a`, teal greens lit from the left.

| frames | size | what |
| --- | --- | --- |
| `blade-0` … `blade-5` | 9 × 24, 9 × 32, 11 × 40, 11 × 46, 13 × 54, 13 × 62 | single blades, tapering, bending left and right in turn |
| `tuft-0`, `tuft-1`, `tuft-2` | 20 × 20, 26 × 28, 32 × 36 | blades fanning out of one foot |
| `daisy` | 13 × 30 | white petals, yellow heart |
| `poppy` | 13 × 34 | a red cup |
| `bluebell` | 15 × 32 | three hanging blue bells |
| `glowcap` | 11 × 36 | a glowing cyan bulb on a stem — tint above 1 for bloom |
| `lumen-lily` | 15 × 40 | a glowing pink blossom with two leaves — tint above 1 for bloom |
| `reed-0`, `reed-1`, `reed-2` | 11 × 56, 11 × 64, 13 × 72 | cattails with a leaf |
| `fern` | 30 × 34 | two curling fronds |

**`meadow-back.png`** — a dithered night sky (deep blue to teal at the horizon), stars, a pale moon
at (400, 54), two rows of dark hills from y ≈ 125 with a lighter rim, fireflies over the lower half.
**`meadow-ground.png`** — soil with lighter stones, a wavy grass edge in the top 3–7 rows (clear
above it).

## ui-panels

| file | format | what |
| --- | --- | --- |
| `panels.png` (128 × 128) + `panels.json` | TexturePacker hash, **untrimmed** | 15 nine-slice frames |
| `panels.aseprite.json` | Aseprite hash | the same sheet as an Aseprite UI kit: one frame, one slice with `center` per panel |
| `panels.insets.json` | JSON | `{"<frame>": [left, top, right, bottom]}` — the insets of every panel |
| `icons.png` (64 × 128) + `icons.json` | TexturePacker hash | 18 item icons, 12 × 12 |
| `pixel-8.fnt`, `pixel-8.json`, `pixel-8.png`, `OFL.txt` | BMFont | the white 8 px font, identical to `sine-scroller/` |
| `portraits/knight.png`, `rogue.png`, `witch.png`, `wizard.png`, `ranger.png`, `barbarian.png` | image, 96 × 96 | anime portraits of a dungeon party, transparent background |

**Panels** — Tiny-Rogue-style pixel art, outlined `#14101a`, the outer corner pixels clear. Insets
are pixels of the frame, in the order of `NineSlice`'s `setSliceInsets(left, top, right, bottom)`.
Every panel is drawn from a cross-section, so its edges are the same along their length (checked
by the generator): stretched, nothing smears. Decorations sit in the corners only.

| frame | size | insets (l, t, r, b) | what |
| --- | --- | --- | --- |
| `panel-stone` | 24 × 24 | 8, 8, 8, 8 | stone frame with gold rivets, dark hollow inside `#1e1a26` — inventories, the main window |
| `panel-wood` | 24 × 24 | 7, 7, 7, 7 | wooden frame with nails, dark wood inside — shops, chests |
| `panel-parchment` | 24 × 24 | 6, 6, 6, 6 | parchment, light inside `#f2e6c6` — quest text, maps; write on it with a dark tint |
| `panel-dark` | 24 × 24 | 5, 5, 5, 5 | near-black `#120e1a`, thin gold trim, ruby corners — dialogue boxes |
| `button-up`, `button-hover`, `button-down` | 24 × 16 | 4, 4, 4, 4 | a raised brass button, lit, pressed (bevel turned round — move its label 1 px down) |
| `slot` | 20 × 20 | 4, 4, 4, 4 | a sunken inventory slot; a 12 × 12 icon fits its 12 × 12 middle |
| `bar-frame` | 32 × 10 | 3, 3, 3, 3 | the frame of a bar; its 26 × 4 inside is the empty bar `#0e0c14` |
| `bar-fill-red`, `bar-fill-blue`, `bar-fill-green` | 8 × 4 | 0, 1, 0, 1 | the fill of a bar: a light top row, a dark bottom row; stretch to the bar's inside (4 high) |
| `portrait-frame` | 40 × 40 | 6, 6, 6, 6 | a gold frame with ruby corners, **clear inside** — lay it over a portrait |
| `tooltip` | 16 × 16 | 3, 3, 3, 3 | a small dark box — tooltips, labels, damage numbers |
| `divider` | 32 × 5 | 5, 0, 5, 0 | a horizontal gold rule with studs at both ends; stretch in x only |

**`panels.aseprite.json`** follows Aseprite's json-hash export of a UI kit drawn on one canvas:
`frames` holds one frame `"panels 0.aseprite"` covering the whole 128 × 128 sheet (100 ms, no
tags); `meta.slices` holds one slice per panel, named like its frame, with a single key at frame 0
whose `bounds` is the panel's rect in the sheet (the same as its `frame` in `panels.json`) and
whose `center` is the stretchable middle relative to `bounds`: `{x: left, y: top, w: width − left
− right, h: height − top − bottom}`. The insets follow as `left = center.x`, `top = center.y`,
`right = bounds.w − center.x − center.w`, `bottom = bounds.h − center.y − center.h`.

**Icons** — 12 × 12, outlined `#1a1220`: `icon-sword`, `icon-axe`, `icon-shield`, `icon-helmet`,
`icon-potion-red`, `icon-potion-blue`, `icon-potion-green`, `icon-key`, `icon-coin`, `icon-gem`,
`icon-scroll`, `icon-bomb`, `icon-heart`, `icon-skull`, `icon-ring`, `icon-book`, `icon-torch`,
`icon-apple`. Drawn as text in `ui-panels/icons.mjs`.

**Portraits** — 96 × 96 RGBA, the head and shoulders, background removed; illustrations, so
`linear` filtering suits them (also when `DynamicAtlas` packs them at run time). Painted with
ComfyUI (WAI-illustrious-SDXL v17, then BiRefNet) and curated; the sources are
`ui-panels/raw/<name>.webp` (512 × 512) and `ui-panels/raw/source.json` records prompt, seed,
workflow, model and sampler of each. The generator cuts a square around the head (`PORTRAITS` in
`ui-panels/generate.mjs`) and resizes it with lanczos3.

| file | who |
| --- | --- |
| `knight.png` | a silver-haired female knight in plate armour |
| `rogue.png` | a hooded rogue with a red scarf and a smirk |
| `witch.png` | a witch with a wide purple hat and glowing eyes |
| `wizard.png` | an old wizard with a long white beard and a blue hat |
| `ranger.png` | a blonde elf ranger with a braid |
| `barbarian.png` | a red-haired, horned barbarian, grinning |

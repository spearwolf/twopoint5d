# Stage art fixtures

Exports of one painted scene, `kitchen`, as the art reads them (§4.1 and §4.3 of
[the proposal](../../../docs/proposals/stage-art-layers.md)):

- `kitchen-aseprite.json` — the json of Aseprite's sheet export of `kitchen.aseprite`, split by
  layers, trimmed, the empty cels left out (`--ignore-empty`), in the layout "Array": the export
  the guide (`docs/stage-art.md`) tells a user to make
- `kitchen-aseprite-empty-cels.json` — the same export without `--ignore-empty`
- `kitchen-ftp.json` — free-tex-packer's "JSON (hash)" over the layer PNGs a paint tool exports of
  the same scene, trimmed, the frames named after §4.2

## How they were made

### Aseprite

[`kitchen.lua`](kitchen.lua) paints the scene through Aseprite's Lua API and saves it as
`kitchen.aseprite`; [`export.mjs`](export.mjs) runs it and exports the file twice with the Aseprite
CLI, **Aseprite 1.3.17.2** (the Linux build, `1.3.17.2-x64`):

```sh
ASEPRITE=<path to the Aseprite binary> node packages/twopoint5d/src/stage-art/fixtures/export.mjs
```

The binary is the one `ASEPRITE` names, else `aseprite` on the `PATH`. The script writes
`kitchen.aseprite` — Aseprite writes it byte for byte the same again — and both json files as
Aseprite wrote them, from

```sh
aseprite -b --split-layers --trim [--ignore-empty] kitchen.aseprite \
  --sheet kitchen.png --data kitchen.json --format json-array \
  --filename-format '{layer}#{frame}' --list-layers --list-tags --list-slices
```

The sheet both name, `kitchen.png`, is written to a temporary directory and dropped: the specs read
the json only, and no browser test draws the kitchen. `biome.jsonc` leaves the json files alone, so
that they keep Aseprite's formatting — one field per line in a frame entry, a layer, a tag and a
slice on one line each.

### free-tex-packer

[`generate.mjs`](generate.mjs) writes `kitchen-ftp.json`, the output of free-tex-packer-core 0.3.9
itself:

```sh
node packages/twopoint5d/src/stage-art/fixtures/generate.mjs
```

It holds where the packer put each picture, and checks that table against the packer when it runs
with `--check-packer` in a directory where the packer is installed — free-tex-packer-core is **no
dependency of this repo**:

```sh
mkdir /tmp/ftp && cd /tmp/ftp
npm init -y
npm install free-tex-packer-core@0.3.9 pngjs@7
node <repo>/packages/twopoint5d/src/stage-art/fixtures/generate.mjs --check-packer
```

It draws one PNG of the full canvas per picture, opaque over the box of the picture and
transparent around it, packs them with the options of `PACKER_OPTIONS` in `generate.mjs` —
trimmed, not rotated, no padding, `removeFileExtension` on — and fails where the json differs by a
byte from the one it writes.

## The scene

A canvas of 320 × 180, four frames of 200, 100, 100 and 150 ms. The layers, bottom first:

| layer | in | user data | box at each frame (x, y, w × h) | what it tests |
| --- | --- | --- | --- | --- |
| `backdrop` | — | `depth=600`, color `#d95763ff` | a group | a group's depth and color |
| `wall` | `backdrop` | — | 0, 0, 320 × 180 at all four | a layer that takes its group's depth; a cel the size of the canvas, untrimmed |
| `window` | `backdrop` | `depth=600`, color `#5fcde4ff` | 196, 22, 84 × 64 at all four | a layer with a depth of its own in a group |
| `table` | — | — | 40, 118, 240 × 62 at all four | a layer on the plane |
| `carafe5` | — | — | 92, 70, 34 × 52 at all four (filled at 0–1, an outline at 2–3) | the pivot of a slice named like the layer |
| `ladle` | — | — | 150, 84, 18 × 40 at 0–2; no cel at 3 | an empty cel |
| `steam` | — | — | 100, 40, 14 × 26 / 98, 34, 18 × 32 / 96, 28, 22 × 38 / 97, 31, 20 × 35 | cels that differ in size |

| tag | frames | direction |
| --- | --- | --- |
| `puff` | 1–3 | `pingpong` |

| slice | color | keys |
| --- | --- | --- |
| `carafe5` | `#0000ffff` | frame 0: bounds `92, 70, 34 × 52`, pivot `17, 51` — the pixel (109, 121) of the canvas |

The pixels are plain filled rectangles, a color per layer. A slice drawn in Aseprite's editor is
blue; one made through the Lua API has no color, so `kitchen.lua` gives it the blue.

`kitchen-ftp.json` holds the pictures of the same scene as a paint tool exports them, one PNG per
picture: `wall@600`, `window@600`, `table`, `carafe5` (frame 0), `carafe5-empty` (frame 2),
`carafe5.pivot` (the pixel 109, 121), `ladle` (frame 0) and `steam#0` to `steam#3`. A group has
no file of its own; its depth stands in the names of its layers.

## What Aseprite writes for a split-layer sheet

Aseprite 1.3.17.2 writes the facts below; the two fixtures show those of the scene. The ones the
scene has no case for — a hidden layer, `{group}`, `{frame01}`, `repeat`, the user data of a cel, a
slice's `center`, `--tag`, `--frame-range`, `--layer`, the paddings — were checked against exports
of a copy of `kitchen.aseprite` changed for them, which is not committed. A citation `src/…` names
the place in Aseprite's source (`aseprite/aseprite` at the tag `v1.3.18.6`) that explains a fact.

### The command

- **`--split-layers` applies to the files opened after it.** Written after the file, as in
  `aseprite -b kitchen.aseprite --split-layers …`, it splits nothing: the sheet holds one entry of
  the whole canvas per frame, named `#0` to `#3` — `{layer}` is empty —, and `--list-layers` lists
  the layers all the same. The option sets the split for the file still to come
  (`app/cli/cli_processor.cpp:256–260`), and Aseprite adds a file to the sheet as soon as it reads
  its name (`:613`, `openFile()` at `:703–709`). `--layer`, `--frame-range` and `--tag` act on the
  file the same way: written after it, they pick nothing.
- `--trim`, `--ignore-empty`, `--filename-format`, `--list-layers`, `--list-tags` and
  `--list-slices` apply wherever they stand. `--trim` trims each cel for a sheet.
- Without `--filename-format` a frame is named `kitchen (wall) 0.aseprite` — `{title} ({layer})
  {frame}.{extension}`.
- The sheet type is `rows` unless `--sheet-type` names another.

### The frames

- **One entry per visible image layer and frame.** The groups have no entry. A hidden layer has
  none either, unless `--all-layers` stands before the file.
- **Layer by layer, bottom first, each layer's frames in order.** The layers of a group come
  before the layers above the group.
- **`{layer}` is the plain name of the layer**, without its group: `window#0`. `{group}` is the
  name of the group the layer is directly in, empty at the top: `{group}/{layer}` writes
  `backdrop/window` and `/table`.
- **`{frame}` counts the frames of the export from 0**, without leading zeros; `{frame01}` starts
  at 1 and pads to two digits. Without `--tag` or `--frame-range` the frames of the export are those
  of the sprite, and `{frame}` is the frame of the sprite. The count goes on past an entry
  `--ignore-empty` leaves out, so the names keep the frame numbers of the sprite: a layer without a
  cel at frame 1 has `#0`, `#2`, `#3`. With `--tag puff` or `--frame-range 1,3` the frames 1 to 3
  of the sprite are named `#0` to `#2` — while `frameTags` keeps `from: 1, to: 3`.
- **A trimmed cel** is the box of the pixels of its layer at its frame, on the canvas:
  `spriteSourceSize` is that box, `sourceSize` the canvas. `trimmed` is `false` only where the box
  is the whole canvas (`wall`). `frame` is the place of the box in the sheet, the size of the box
  — with `--extrude` too, which puts the extruded pixels around it — but grown by `--inner-padding`
  on every side: with `--inner-padding 2` the `window` is a `frame` of 88 × 68 with the
  `spriteSourceSize` 84 × 64. The art draws such a frame from its picture alone, its tex coords
  inset by the padding; a frame grown otherwise is a problem of its layer.
- **An empty cel is an entry of 1 × 1**, unless `--ignore-empty` is given. With `--trim` alone a
  layer without a cel at a frame keeps its entry: `spriteSourceSize` `0, 0, 1 × 1`, `trimmed`
  `true`, a `frame` of 1 × 1 in the sheet — `ladle#3` in `kitchen-aseprite-empty-cels.json`.
  `--ignore-empty` leaves the entry out, and the frame number of its name with it:
  `kitchen-aseprite.json` has no `ladle#3`. The sheet keeps its size either way.
- **`duration`** is the duration of the frame of the sprite, the same for every layer.
- **The sheet:** the type `rows` without `--sheet-width` puts every layer on a row of its own, its
  frames side by side, a row as high as its highest entry; the size of the sheet is the union of
  the entries — 1280 × 436 here.

### `meta`

- **`frameTags`** are listed once per sprite, not once per layer. `from` and `to` are frames of
  the sprite, not positions in `frames`: in a split-layer sheet they name the `{frame}` of each
  layer's entries, as long as no `--tag` or `--frame-range` renumbers them. `repeat` is written as
  a string, and only above 0 (`"repeat": "2"`), after `direction`; the user data of the tag
  follows — a tag made through the Lua API is `#000000ff`.
- **`layers`** lists, for every exported layer, the layer and every group it is in, each once: a
  group is inserted before the first of its layers. So `backdrop` stands in `meta.layers`, before
  `wall`. A layer in a group names the group it is directly in by `group`; a layer at the top has
  none. `opacity` and `blendMode` are written for an image layer, not for a group. A hidden layer,
  not exported, is not listed (`app/doc_exporter.cpp:1594–1637`).
- **User data** follows the fields of its layer, group, tag or slice: `color` as `#rrggbbaa` in
  lower case where the color has an alpha above 0, `data` — the text of "User Data" — where it is
  not empty. So the user data of a layer and of a group lands on its own entry of `meta.layers`, as
  `data` and `color`. A layer lists `cels` only where a cel has user data — or, by the source, a
  z-index (`app/doc_exporter.cpp:1640–1676`): `"cels": [{ "frame": 0, "data": "…" }]`.
- **`slices`** are listed once per sprite; a key's `frame` is a frame of the sprite, its `bounds`
  lie on the canvas, its `center` and `pivot` are relative to `bounds`. The user data of a slice,
  its `color`, follows its name.
- **`image`** is the file name of `--sheet` without its directory: `--sheet out/kitchen.png` writes
  `kitchen.png`. **`app`** is `http://www.aseprite.org/` in the Linux build — the builds for
  Windows and macOS write `https://www.aseprite.org/` (`ver/info.c:13–22`). **`version`** is the
  version of the build, `1.3.17.2-x64`.

## What free-tex-packer writes over the layer PNGs

free-tex-packer-core 0.3.9 as installed from npm:

- **The frames are in the order the packer placed them**, not in the order of the files nor of
  their names: the names are sorted (`PackProcessor.js:79`), and `MaxRectsBin` takes the best fit
  of the pictures left, one after the other, and lists each as it places it
  (`packers/MaxRectsBin.js:62–100`). The order of `kitchen-ftp.json` keeps no stacking order of
  the paint file (§4.3).
- **`removeFileExtension`** drops the last extension only (`exporters/index.js:74–78`):
  `carafe5.pivot.png` is the frame `carafe5.pivot`.
- **A trimmed picture** is the box of its pixels with an alpha above 0 within the PNG: its
  `spriteSourceSize`, the PNG its `sourceSize` (`utils/Trimmer.js:67–100`). A picture without a
  visible pixel becomes 1 × 1 at `0, 0`, as in Aseprite (`utils/Trimmer.js:90–96`).
- Every frame carries `"pivot": {"x": 0.5, "y": 0.5}`, `meta.scale` is a number
  (`exporters/JsonHash.mst`).

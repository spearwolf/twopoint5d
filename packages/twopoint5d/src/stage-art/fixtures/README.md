# Stage art fixtures

Two exports of one painted scene, `kitchen`, as the art reads them (§4.1 and §4.3 of
[the proposal](../../../docs/proposals/stage-art-layers.md)):

- `kitchen-aseprite.json` — the json of Aseprite's sheet export of `kitchen.aseprite`, split by
  layers and trimmed, in the layout "Array"
- `kitchen-ftp.json` — free-tex-packer's "JSON (hash)" over the layer PNGs a paint tool exports of
  the same scene, trimmed, the frames named after §4.2

## How they were made

Aseprite is not installed on the machine the fixtures were made on. [`generate.mjs`](generate.mjs)
writes both, in the formatting each tool writes — Aseprite's one field per line in a frame entry
and a layer, a tag and a slice on one line each; free-tex-packer's json indented by two spaces,
without a newline at the end. `biome.jsonc` leaves the json files alone, so that they keep it.

```sh
node packages/twopoint5d/src/stage-art/fixtures/generate.mjs
```

writes both files again. The image both name, `kitchen.png`, is not part of the fixture.

The Aseprite json follows the exporter of Aseprite **v1.3.18.6**, read in its source on GitHub
(`aseprite/aseprite` at the tag `v1.3.18.6`); the facts below cite that source by file and line.
It stands for the command

```sh
aseprite -b --split-layers --trim kitchen.aseprite \
  --sheet kitchen.png --data kitchen.json --format json-array \
  --filename-format '{layer}#{frame}' --list-layers --list-tags --list-slices
```

The free-tex-packer json is the output of free-tex-packer-core 0.3.9 itself: `generate.mjs` holds
where the packer put each picture, and checks that table against the packer when it runs with
`--check-packer` in a directory where the packer is installed — free-tex-packer-core is **no
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
| `carafe5` | — | — | 92, 70, 34 × 52 at all four (full at 0–1, empty at 2–3) | the pivot of a slice named like the layer |
| `ladle` | — | — | 150, 84, 18 × 40 at 0–2; no cel at 3 | an empty cel |
| `steam` | — | — | 100, 40, 14 × 26 / 98, 34, 18 × 32 / 96, 28, 22 × 38 / 97, 31, 20 × 35 | cels that differ in size |

| tag | frames | direction |
| --- | --- | --- |
| `puff` | 1–3 | `pingpong` |

| slice | keys |
| --- | --- |
| `carafe5` | frame 0: bounds `92, 70, 34 × 52`, pivot `17, 51` — the pixel (109, 121) of the canvas |

`kitchen-ftp.json` holds the pictures of the same scene as a paint tool exports them, one PNG per
picture: `wall@600`, `window@600`, `table`, `carafe5` (frame 0), `carafe5-empty` (frame 2),
`carafe5.pivot` (the pixel 109, 121), `ladle` (frame 0) and `steam#0` to `steam#3`. A group has
no file of its own; its depth stands in the names of its layers.

## What Aseprite writes for a split-layer sheet

Every fact cites `src/…` of Aseprite v1.3.18.6. Where the source leaves a fact open, the entry
says so and names the choice the fixture makes.

### The command

- **`--split-layers` applies to the files opened after it.** The option sets the split for the
  file still to come (`app/cli/cli_processor.cpp:256–260`), and Aseprite adds a file to the sheet
  as soon as it reads its name (`app/cli/cli_processor.cpp:613`, `openFile()` at `:703–709`
  handing `cof.splitLayers` to `addDocumentSamples()`). Written after the file, as in
  `aseprite -b kitchen.aseprite --split-layers …`, it splits nothing: the sheet holds one entry per
  frame, and `{layer}` is empty in their names (`#0`, `#1`, …). `--all-layers`, `--layer`,
  `--ignore-layer`, `--tag` and `--frame-range` act on the file the same way (`:275–306`,
  `:670–673`).
- `--trim`, `--ignore-empty`, `--filename-format`, `--list-layers`, `--list-tags` and
  `--list-slices` set the exporter (`app/cli/cli_processor.cpp:308–312`, `:333–338`, `:377–381`,
  `:560–588`); they apply wherever they stand. `--trim` trims each cel for a sheet
  (`setTrimCels()`, `:337`).
- The sheet type is `rows` unless `--sheet-type` names another (`app/cli/cli_processor.cpp:620–622`).

### The frames

- **One entry per visible image layer and frame.** With `--split-layers` the exporter adds one
  item per layer of `allVisibleLayers()` and leaves the groups out (`app/doc_exporter.cpp:949–955`).
  A hidden layer, and every layer of a hidden group, is not exported (`doc/layer.cpp:425–436`)
  unless `--all-layers` stands before the file.
- **Layer by layer, bottom first, each layer's frames in order.** The entries are written in the
  order they are captured, item by item and frame by frame (`app/doc_exporter.cpp:996–1075`,
  `:1476`). `allVisibleLayers()` walks the layers of a group in the order the group keeps them
  (`doc/layer.cpp:425–436`), the bottom one first: the background layer, always the bottom one,
  is `layers().front()` (`doc/sprite.cpp:289–297`). The layers of a group come before the layers
  above the group.
- **`{layer}` is the plain name of the layer**, `layer->name()`, without its group
  (`app/doc_exporter.cpp:1067`, `app/filename_formatter.cpp:142`). `{group}` is the name of the
  group the layer is directly in, empty at the top (`app/doc_exporter.cpp:1068`,
  `app/filename_formatter.cpp:143`).
- **`{frame}` is the frame of the sprite**, counted from 0 over the frames of the export — every
  frame unless `--tag` or `--frame-range` picks some (`app/doc_exporter.cpp:1071`, `:1074`). The
  count goes on past an entry left out, so the names keep the frame numbers of the sprite. `{frame}`
  is written without leading zeros; `{frame01}` would start at 1 and pad to two digits
  (`app/filename_formatter.cpp:27–53`).
- **A trimmed cel** is the box of the pixels of its layer at its frame, on the canvas:
  `spriteSourceSize` is that box, `sourceSize` the canvas (`app/doc_exporter.cpp:1078–1080`,
  `:1124–1177`, `:1479`, `:1496–1503`); only the layer of the entry is drawn while its box is
  measured (`app/doc_exporter.cpp:352–356`). `trimmed` is `false` only where the box is the whole
  canvas (`app/doc_exporter.cpp:300–304`). `frame` has the size of the box, without
  `--inner-padding` or `--extrude` (`app/doc_exporter.cpp:290–298`, `:1489–1493`).
- **An empty cel is an entry of 1 × 1**, unless `--ignore-empty` is given. With `--trim` alone a
  layer without a cel at a frame, or with a cel without a visible pixel, keeps its entry:
  `spriteSourceSize` `0, 0, 1 × 1`, `trimmed` `true`, a frame of 1 × 1 in the sheet
  (`app/doc_exporter.cpp:1150–1164`). `--ignore-empty` leaves the entry out
  (`app/doc_exporter.cpp:1126`, `:1156–1157`), and the frame number of its name with it. The
  fixture follows the command above: `ladle#3` is such an entry.
- **`duration`** is the duration of the frame of the sprite, the same for every layer
  (`app/doc_exporter.cpp:1504`).
- **The sheet:** the type `rows` without `--sheet-width` puts every layer on a row of its own,
  its frames side by side, a row as high as its highest entry (`app/doc_exporter.cpp:567`,
  `:591–601`, `:620–627`); the size of the sheet is the union of the entries
  (`app/doc_exporter.cpp:1254–1297`).

### `meta`

- **`frameTags`** are listed once per sprite, not once per layer (`app/doc_exporter.cpp:1544–1551`).
  `from` and `to` are frames of the sprite (`tag->fromFrame()`, `app/doc_exporter.cpp:1568–1569`),
  not positions in `frames`: in a split-layer sheet they name the `{frame}` of each layer's
  entries. `repeat` is written as a string, and only above 0 (`:1573–1575`), followed by the user
  data of the tag (`:1576`).
- **`layers`** lists, for every exported layer, the layer and every group it is in, each once: a
  group is inserted before the first of its layers, the outermost group first
  (`app/doc_exporter.cpp:1594–1617`). So the groups appear in `meta.layers`, and the order is the
  order of the frames with each group in front of its layers. A layer in a group names the group
  it is directly in by `group`; a layer at the top has none (`app/doc_exporter.cpp:1631–1632`).
  `opacity` and `blendMode` are written for an image layer, not for a group
  (`app/doc_exporter.cpp:1634–1637`). A hidden layer, not exported, is not listed.
- **User data** follows the fields of its layer, group, tag, slice or cel
  (`app/doc_exporter.cpp:1576`, `:1638`, `:1713`): `color` as `#rrggbbaa` in lower case where the
  color has an alpha above 0, `data` — the text of "User Data" — where it is not empty, and
  `properties` where an extension set some (`app/doc_exporter.cpp:118–186`). So the user data of a
  layer and of a group lands on its own entry of `meta.layers`, as `data` and `color`. A layer
  lists `cels` only where a cel has a z-index or user data (`app/doc_exporter.cpp:1640–1676`).
- **`slices`** are listed once per sprite (`app/doc_exporter.cpp:1697–1704`); a key's `frame` is a
  frame of the sprite, its `bounds` lie on the canvas, its `center` and `pivot` are relative to
  `bounds` (`app/doc_exporter.cpp:1716–1748`). The user data of a slice, its `color`, follows its
  name (`:1713`).
- **`image`** is the file name of `--sheet` (`app/doc_exporter.cpp:1520–1522`). **`app`** is
  `https://www.aseprite.org/` in the builds for Windows and macOS and `http://www.aseprite.org/`
  in those for Linux (`ver/info.c:13–22`). **`version`** is the version of the build
  (`ver/info.c`, `get_app_version()`); the source sets it at build time (`ver/CMakeLists.txt`) and
  leaves the form of a release open. *Open in the source:* the fixture writes `1.3.18.6-x64`, after
  the form of the release builds the earlier fixtures (`../../texture/fixtures/aseprite/`) write.

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

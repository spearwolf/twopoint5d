# Aseprite fixtures

Two exports of one sprite sheet, `fighter.aseprite`, as Aseprite's "Export Sprite Sheet" writes
its json data: `fighter-hash.json` in the layout "Hash", `fighter-array.json` in the layout
"Array". `AsepriteJson.spec.ts` and the browser test `texture-aseprite-sheet.test.js` read them.

## How they were made

Aseprite is not installed on the machine the fixtures were made on. They are written by
[`generate.mjs`](generate.mjs) to the export format as Aseprite documents it — the
[CLI options `--data`, `--format json-hash|json-array`, `--list-tags`, `--list-slices`,
`--list-layers`](https://www.aseprite.org/docs/cli/) and the json the exporter writes for them —
in Aseprite's own formatting: one field per line in a frame entry, a frame tag and a slice on one
line each, `"repeat"` as a string, the rectangles of a slice key without the space after the
opening brace. `biome.jsonc` leaves the json files alone, so that they keep that formatting.

`node packages/twopoint5d/src/texture/fixtures/aseprite/generate.mjs` writes both files again. The image the
json names, `fighter.png`, is not part of the fixture: the browser test paints the sheet itself
and hands it to the store as `overrideImageUrl`.

## The sheet

16 frames of 16 × 16 pixels on a sheet of 64 × 64, four to a row, `fighter 0.aseprite` to
`fighter 15.aseprite` — Aseprite's default file name format `{title} {frame}.{extension}`.

| tag | frames | direction | repeat | durations (ms) |
| --- | --- | --- | --- | --- |
| `idle` | 0–3 | `pingpong` | | 100 each |
| `walk` | 4–7 | `forward` | | 100 each |
| `kick` | 8–10 | `forward` | `"1"` | 80, 80, 240 |
| `block` | 11–12 | `reverse` | | 120 each |
| `spin` | 13–15 | `pingpong_reverse` | | 60, 60, 120 |

| slice | keys |
| --- | --- |
| `hitbox` | frame 0: bounds `4, 2, 8 × 14`, pivot `4, 14`; frame 8: bounds `2, 2, 13 × 14`, pivot `6, 14` |
| `panel` | frame 0: bounds `0, 0, 16 × 16`, center `4, 4, 8 × 8` |

The "Array" export is trimmed ("Trim Cels"): every frame lost 2 pixels at its left, its top and
its right, so `frame` is 12 × 14, `trimmed` is `true` and `spriteSourceSize` is `2, 2, 12 × 14`
of the `sourceSize` 16 × 16. The "Hash" export is untrimmed.

# free-tex-packer fixtures

A real export of [free-tex-packer](https://github.com/odrick/free-tex-packer-core), for the specs
that hold `TexturePackerJson` to it (`../../TexturePackerJson.freeTexPacker.spec.ts`) and the browser
test `packages/twopoint5d-testing/test/sprites-free-tex-packer.test.js`.

- `sheet.png` — the sheet, 24 × 7 texels
- `sheet-hash.json` — its "JsonHash" export, byte for byte as the packer wrote it
- `sheet-array.json` — its "JsonArray" export, byte for byte
- `generate.mjs` — the script that drew the three source images and ran the packer

The frames:

| frame | in the sheet | what it tests |
| --- | --- | --- |
| `banner.png` | upright, untrimmed, 24 × 3 white | a plain frame |
| `gem.png` | turned by 90° clockwise, untrimmed, 4 × 6 | a rotated frame |
| `hero.png` | turned and trimmed: 4 × 6 cut out of 9 × 9, margins 2, 1, 3, 2 | both at once |

`gem` and `hero` hold six colored cells of 2 × 2 texels — two columns, three rows: red, green /
blue, yellow / cyan, magenta for `hero`, the same six in reverse order for `gem` — so a turn or a
mirror of the frame shows.

## Producing them again

free-tex-packer-core is **no dependency of this repo**. Run the generator in a project of its own,
outside the repo:

```sh
mkdir /tmp/ftp && cd /tmp/ftp
npm init -y
npm install free-tex-packer-core@0.3.9 pngjs@7
cp <repo>/packages/twopoint5d/src/texture/fixtures/free-tex-packer/generate.mjs .
node generate.mjs out
cp out/sheet.png out/sheet-hash.json out/sheet-array.json <repo>/packages/twopoint5d/src/texture/fixtures/free-tex-packer/
```

With these versions the output is byte for byte the files committed here. The directory is left
out of `biome ci` (see `biome.jsonc`), so the JSON stays as the packer wrote it.

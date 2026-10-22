# Cardboard cut-outs

Generates the assets of the lookbook demo `cardboard-parade` into `apps/lookbook/public/assets/cardboard/`:

- `cardboard.png` and `cardboard.json` — a TexturePacker "JSON Hash" atlas of 22 frames: three
  trees, a bush, three houses, a fence segment, four signposts, four figures, a dog and a duck, all
  standing on the bottom edge of their frame, and the flat frames `blob`, `foot_left`,
  `foot_right` and `paw` for the ground
- `turntable.webp` — the disc the theatre stands on, the end grain of a tree slice

The texture catalog `public/assets/textures.json` names them `cardboardAtlas` and
`cardboardTurntable`.

## Rerun

```sh
python3 apps/lookbook/assets-src/cardboard/build_cardboard.py                # render, shade, cut, pack, check
python3 apps/lookbook/assets-src/cardboard/build_cardboard.py --skip-render  # reuse .render-cache/
```

Requirements: `blender` on the PATH (tested with 5.2 LTS; the script falls back to
`/usr/bin/blender`) and `python3` with Pillow and numpy. A full build takes about two seconds;
Blender renders on the CPU. The output is byte-stable for unchanged inputs and the same versions
of Blender, numpy, Pillow and its libwebp. No build or check of the repo runs it: a change to the
props is a commit of the scripts and of their output together.

## Files

| file | role |
| --- | --- |
| `prop_defs.py` | The props as data — primitives and convex hulls per prop, the material of each part — plus the paper colors, the light, the bands and the scale. Plain Python, shared by both sides. |
| `blender_render.py` | Runs inside Blender. Builds each prop, cuts a standing one off at the ground, and renders one G-buffer image per prop. |
| `build_cardboard.py` | Entry point. Runs Blender, then shades, downscales, cuts, draws the flat frames and the turntable, packs, checks and writes. |
| `.render-cache/` | The raw renders (gitignored). |

## Pipeline

1. **Geometry (Blender, `bpy`).** A prop is a handful of boxes, cylinders, cones, spheres and
   convex hulls out of `prop_defs.py`, at 64 pixels a meter, facing −y. A standing prop is cut off
   at z = 0, so a part may sink into the ground and the print still ends level at the feet.
2. **G-buffer render (Cycles).** One orthographic front view per prop, 4× supersampled. Every
   material emits an encoding instead of a lit color: red and green are x and z of the world
   normal mapped to [0, 1], blue the material id divided by 255, alpha the coverage. One sample, a
   box filter of 0.01 px, no bounces, no dithering and the Raw view transform make every pixel an
   exact point sample. The frame leaves room for the cut margin above and beside the print and
   puts the bottom of the margin on the bottom edge of the frame.
3. **Shading (numpy).** The y of a visible normal follows from x and z. The light from the upper
   left (`LIGHT`) is cut into three bands (`BANDS`), each indexing the three-color ramp of the
   material in `MATERIALS`: flat gouache, no gradients.
4. **Downscale 4× → 1×.** A vote of the 16 samples of a pixel picks its color, so colors never
   blend; it is opaque when at least 7 of them hit a surface.
5. **The cut.** A seeded paper grain over the print, the coverage dilated by `MARGIN` pixels and
   filled with paper, and a ring of `PAPER_EDGE` around it: the die-cut margin of a printed sheet.
6. **Flat frames and turntable (numpy).** The blob shadow, a soft radial alpha; a shoe print for
   each foot and a paw, toes at the top of the frame; the tree slice with its year rings and bark.
7. **Pack and check.** Shelves in a sheet 1024 pixels wide and a power of two high, 2 pixels
   apart. The script exits non-zero when a frame of `prop_defs.py` is missing or empty, touches the
   top, left or right edge of its frame, or — for a standing prop — when its print does not end
   `MARGIN` pixels above the bottom edge with the margin on it.

## In the demo

`src/demos/cardboard-parade/CardboardParade.ts` sizes every sprite as its frame at 64 pixels a
meter and builds the standing ones with `baseArgs: [0.5, 0.5, 0, 0.5]`, which puts the pivot of
the quad on the middle of its bottom edge — the feet. The back of a cut-out is not in the atlas:
the color stage `CardboardBack` of the demo draws it. The pivot on the feet is also what a prop
turns and leans about: a signpost tilts by its quaternion, and a fence panel falls onto its back
about its bottom edge without leaving the ground.

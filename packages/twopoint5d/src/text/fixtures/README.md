# BMFont fixtures

The font `pixel-8` of the lookbook, for the specs of `BitmapFont`, `layoutText()` and `writeText()`
(`../*.spec.ts`) and the browser test `packages/twopoint5d-testing/test/text-bitmap-font.test.js`.

- `pixel-8.fnt` — the BMFont text format, a copy of
  `apps/lookbook/public/assets/sine-scroller/pixel-8.fnt`
- `pixel-8.json` — the JSON layout of `parse-bmfont-ascii` / `load-bmfont`, a copy of the lookbook's
- `pixel-8.png` — the page, 128 × 64, white glyphs on clear
- `pixel-8.xml` — the same font in BMFont's XML layout, written from the `.fnt` by `generate.mjs`
- `OFL.txt` — the licence: the font derives from *Press Start 2P* by CodeMan38 under the SIL Open
  Font License 1.1, and the licence travels with it

`apps/lookbook/assets-src/README.md` ("sine-scroller") describes the font: `size=8 lineHeight=10
base=7`, every glyph advances 8 pixels, ASCII 32–126 on one page, no kerning pairs. The capitals
stand on the baseline at y = 7, descenders reach y = 8.

After copying the three lookbook files again, run
`node packages/twopoint5d/src/text/fixtures/generate.mjs` to write the XML anew.

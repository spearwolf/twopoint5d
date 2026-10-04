# twopoint5d lookbook

The living documentation of `@spearwolf/twopoint5d`: 18 runnable demos, each linked to its
own source, searchable by tags.

## Running it

From the repo root, `pnpm lookbook` (an alias for `pnpm nx dev lookbook`, which depends on
`^build` and therefore builds the library first). From `apps/lookbook/` itself,
`pnpm dev`. Both serve at `http://localhost:4321/lookbook` — the path comes from `base` in
`astro.config.mjs`; without it the root URL 404s. For installing dependencies, see the
repo-root `README.md`.

## What's in `src/`

- `pages/index.astro` — the overview page, the only page using `Layout.astro`
- `pages/demos/<name>.astro` — 18 demo pages, all built on `VanillaDemo.astro`
- `pages/demos/_<name>.json` — 18 metadata files, one per demo page
- `demos/` — the demo code itself, TypeScript, grouped by demo; the three map2d demos
  share `map2d/`
- `components/` — the lookbook UI: the card grid, the tag cloud, search, and
  `TexturePreview`, the texture preview of the demo pages
- `layouts/`
- `data/tag-categories.json` — the ordering of the tag cloud
- `images/`
- `styles/`

Three path aliases resolve into `src/`: `~components/*`, `~layouts/*` and `~demos/*`,
declared in `tsconfig.json`. All 18 demo pages import through them.

## Adding a demo

1. Put the reusable classes under `src/demos/<name>/`. The wiring lives in the page's
   `<script>` block instead — every demo page has one, and all of them import from
   `~demos/…` there.
2. Add `src/pages/demos/<name>.astro`, using the `VanillaDemo.astro` layout. Existing
   pages import it under the local name `Layout`, e.g. `first-sprite.astro`. With
   `fullscreenCanvas` the layout writes a canvas that fills the window, and
   `getFullscreenCanvas()` from `src/demos/utils/fullscreenCanvas.ts` hands it to the
   script of the page. `<TexturePreview>` from `src/components/` shows a texture in a
   corner of the page, filled by `showTexturePreview()`. The layout lays the navbar of
   `DemoNavBar.astro` over the top of the page; a page that keeps its content clear of
   it pads by `var(--demo-nav-bar-height)`, as `display-multi.astro` does. `?ui=0` in the
   URL of any demo page hides the navbar, e.g. for a demo embedded in an iframe, and sets
   the variable to `0px`; `?preview=1` hides the `<demo-ui>` as well, see
   [Preview images](#preview-images).
3. Add `src/pages/demos/_<name>.json` next to it. The leading underscore keeps Astro from
   turning it into a route, while `import.meta.glob('../../pages/demos/*.json')` in
   `src/demos/utils/loadMetadataForDemos.ts` still picks it up. `title` and `url` are
   required — `url` must match the page's route, since the card links to it.
   `shortDescription` (the text of the card), `description` (Markdown, the dialog of the
   demo page, and the card when there is no `shortDescription`), `order` (the position
   among the cards, ascending, 0 when missing) and `tags` are optional, per the `IDemo`
   interface in the same file. The JSON names no image: the card shows
   `public/images/demo-preview/<name>.webp`. The dialog of a demo page links to the page's own source
   on GitHub; `DemoNavBar.astro` builds that link from the route, so the JSON carries
   none. A tag that starts with a capital letter names an export of
   `@spearwolf/twopoint5d`. `scripts/lookbook/demoMetadata.test.mjs` (`pnpm test:scripts`)
   checks the tags, the tags of `data/tag-categories.json` and that `url` is the page's
   route; a class from three.js needs an entry with its reason there.
   `_textured-sprites.json` shows the full pattern.
4. Generate its card image: `pnpm lookbook:generate-previews --only=<name>` writes
   `public/images/demo-preview/<name>.webp`; see [Preview images](#preview-images).

## Preview images

Every card on the overview shows `public/images/demo-preview/<name>.webp`, `<name>` being
the demo page. `pnpm lookbook:generate-previews` (from the repo root) writes them: it
builds the lookbook, starts `astro preview` on a free port, opens each demo in
Playwright's Chromium at 1000×700 — the `aspect-10/7` of the card — and saves a WebP
screenshot. `scripts/lookbook/demoPreviews.test.mjs` (`pnpm test:scripts`) fails when a demo
has no image, an image has no demo, or an image has another size.

| Flag | Effect |
| --- | --- |
| `--only=<name>,<name>` | only these demos |
| `--url=<base>` | use a running lookbook, e.g. `http://localhost:4321/lookbook` from `pnpm lookbook`, instead of starting one |
| `--headed` | show the browser window |
| `--timeout=<ms>` | how long a demo may take to signal, 30000 by default |

A failed demo keeps its old image, and the run exits with 1. The run prints whether
Chromium found a WebGPU adapter; without one three.js renders with WebGL 2, which works
but may look slightly different.

The screenshot is taken when the page dispatches `lookbook.generatePreview` on the
`document`. `VanillaDemo.astro` does that `DEFAULT_PREVIEW_DELAY_MS` (5 s) after the page
started. A demo that knows better takes over:

```ts
import {deferPreview} from '~demos/utils/demoPreview';

const preview = deferPreview(); // synchronously, before the first await of the script
// … build the scene, load the textures …
preview.ready(display); // the event follows the next frame the display renders
```

`ready()` takes every display of the page, or none (then it waits two animation frames).
A `deferPreview()` after the event fired only logs a warning. `first-sprite.astro` is the
example.

`?preview=1` is the URL the generator opens: it hides the navbar like `?ui=0` and the
`<demo-ui>` layer as well, so the image shows what the demo draws.

## Checks

`pnpm nx typecheck lookbook` runs `astro check` over the `.astro` and `.ts` files of the
lookbook and is part of the repo-wide `pnpm typecheck`. `pnpm nx build lookbook` builds
the static site. The library is pulled in as `workspace:*`, so a change in
`packages/twopoint5d` shows up here as soon as it's built.

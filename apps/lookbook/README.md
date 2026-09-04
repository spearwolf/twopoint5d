# twopoint5d lookbook

The living documentation of `@spearwolf/twopoint5d`: 17 runnable demos, each linked to its
own source, searchable by tags.

## Running it

From the repo root, `pnpm lookbook` (an alias for `pnpm nx dev lookbook`, which depends on
`^build` and therefore builds the library first). From `apps/lookbook/` itself, `pnpm dev`.
Both serve at `http://localhost:4321/lookbook` — the path comes from `base` in
`astro.config.mjs`; without it the root URL 404s. For installing dependencies, see the
repo-root `README.md`.

## What's in `src/`

- `pages/index.astro` — the overview page, the only page using `Layout.astro`
- `pages/demos/<name>.astro` — 17 demo pages, all built on `VanillaDemo.astro`
- `pages/demos/_<name>.json` — 17 metadata files, one per demo page
- `demos/` — the demo code itself, TypeScript, grouped by demo
- `components/` — the lookbook UI: the card grid, the tag cloud, search
- `layouts/`
- `data/tag-categories.json` — the ordering of the tag cloud
- `images/`
- `styles/`

Three path aliases resolve into `src/`: `~components/*`, `~layouts/*` and `~demos/*`, declared
in `tsconfig.json`. All 17 demo pages import through them.

## Adding a demo

1. Put the reusable classes under `src/demos/<name>/`. The wiring lives in the page's
   `<script>` block instead — every demo page has one, and all of them import from
   `~demos/…` there.
2. Add `src/pages/demos/<name>.astro`, using the `VanillaDemo.astro` layout. Existing pages
   import it under the local name `Layout`, e.g. `crosses.astro`.
3. Add `src/pages/demos/_<name>.json` next to it. The leading underscore keeps Astro from
   turning it into a route, while `import.meta.glob('../../pages/demos/*.json')` in
   `src/demos/utils/loadMetadataForDemos.ts` still picks it up. `title` and `url` are
   required — `url` must match the page's route, since the card links to it.
   `description`, `tags` and `previewImage` are optional, per the `IDemo` interface in the
   same file; without `previewImage`, `Card.astro` falls back to a default image, as in
   `_stage-nested-pipelines.json` and `_stage-postprocessing.json`. `showSource` isn't read
   by the overview at all — the demo page imports it from its own JSON file and passes it to
   the layout, which builds the source link in `DemoNavBar.astro`. `_textured-sprites.json`
   shows the full pattern.
4. Drop the preview image into `public/images/demo-preview/`, referenced by its bare file
   name — `src/demos/utils/demoPreviewImageUrl.ts` prepends the path.

## Checks

`pnpm nx typecheck lookbook` runs `astro check` over the 36 `.astro` and 22 `.ts` files and
is part of the repo-wide `pnpm typecheck`. `pnpm nx build lookbook` builds the static site.
The library is pulled in as `workspace:*`, so a change in `packages/twopoint5d` shows up here
as soon as it's built.

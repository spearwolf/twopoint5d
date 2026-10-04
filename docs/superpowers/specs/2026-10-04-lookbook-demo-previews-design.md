# Lookbook demo previews — design

Status: approved in brainstorming, 2026-10-04

## Goal

Every demo card on the lookbook overview shows a preview image. Until now each image was
a screenshot taken by hand. A new task, `pnpm lookbook:generate-previews`, produces them:
it opens every demo in a headless Chromium, waits until the demo says it is ready (or
until a default timeout), takes a screenshot in the aspect ratio of the card and writes
it into the app.

Success means:

- one command regenerates the preview of every demo, or of the demos named on the
  command line;
- every image has the aspect ratio the card shows (`aspect-10/7` in `Card.astro`), so
  `object-cover` crops nothing;
- a demo that needs more than the default delay — textures still loading, a scene that
  takes a while to settle — can take over and signal its own moment, after its next
  rendered frame;
- `pnpm test:scripts` fails when a demo has no preview, when an image is left over from
  a removed demo, or when an image has the wrong size.

Out of scope: running the generator in `pnpm run ci` (it needs a browser with GPU timing
and produces binary diffs), deterministic animation frames, and per-demo viewport sizes.

## Current state

- `Card.astro` shows the image in an `aspect-10/7` box with `object-cover`; the 13
  existing PNGs range from 512×333 to 1500×999, so most of them are cropped.
- Four demos have no `previewImage` (`first-sprite`, `stage-nested-pipelines`,
  `stage-postprocessing`, `stage-projections`) and fall back to
  `src/images/20221122-dark-circles-back-1024x.jpg`. The three `map2d-*` demos share
  `map2d-layer3d.png`.
- `VanillaDemo.astro` reads `?ui=0` in an inline script and hides the navbar. The
  `<demo-ui>` layer (lil-gui panels, buttons; used by 10 of 18 demos) stays visible.
- `playwright` is a root devDependency; Chromium is installed for `pnpm test:browser`.

## Part 1 — the preview protocol inside the page

### Event

`document` receives one `CustomEvent` named `lookbook.generatePreview`, at most once per
page load. The name follows the two events already in `src/components/constants.ts`
(`lookbook.showDemos`, `lookbook.toggleTag`):

```ts
// src/components/constants.ts
export const EVENT_GENERATE_PREVIEW = 'lookbook.generatePreview';
```

Its type joins `LookBookEventMap` in `src/components/types.ts`:

```ts
export interface LookBookGeneratePreviewEvent extends CustomEvent {
  detail: {
    demoId: string;
    /** `timeout`: the default delay ran out; `ready`: the demo called `ready()` */
    trigger: 'timeout' | 'ready';
  };
}
```

`demoId` is the last segment of the page path, the same id `DemoNavBar.astro` derives.

### Module `src/demos/utils/demoPreview.ts`

State lives at module level — `deferred`, `fired`, the timer — so the order in which the
layout's script and the demo's script run does not matter: a `deferPreview()` that comes
first wins over the timer that is armed later.

```ts
export const DEFAULT_PREVIEW_DELAY_MS = 5000;

/** Called once by VanillaDemo.astro. Starts the default delay unless a demo took over. */
export function armPreviewTimeout(): void;

/** Cancels the default delay; the demo fires the event itself through the handle. */
export function deferPreview(): PreviewHandle;

export interface PreviewHandle {
  /**
   * Fires the event after the next rendered frame: with displays, after the next
   * `OnDisplayRenderFrame` of each of them plus one `requestAnimationFrame`, so the frame
   * has been composited; without, after two `requestAnimationFrame`s.
   */
  ready(...displays: Display[]): void;
}
```

Rules:

- `armPreviewTimeout()` does nothing when `deferred` is set. Otherwise it starts a timer
  of `DEFAULT_PREVIEW_DELAY_MS`; when it runs out, two `requestAnimationFrame`s later the
  event fires with `trigger: 'timeout'`.
- `deferPreview()` clears the timer and sets `deferred`. A second call returns the same
  handle. A call after the event fired logs a `console.warn` and returns a handle whose
  `ready()` does nothing — this is the case of a `deferPreview()` placed after an
  `await`.
- `ready()` waits through `once()` of `@spearwolf/eventize` on each display, so a demo
  with several displays (`stage-projections` has two, `display-multi` six) passes all of
  them. A second `ready()` does nothing.
- "Demo start", the moment the delay counts from, is the run of the layout's module
  script, after the document is parsed — not `display.start()`, which the layout does
  not know.
- The timer is armed on every visit, not only in preview mode. A `setTimeout` and an
  event nobody listens to cost nothing, and a demo behaves the same with and without
  `?preview=1`.

A demo that takes over calls `deferPreview()` synchronously at the top of its script,
before its first `await`:

```ts
import {deferPreview} from '~demos/utils/demoPreview';

const preview = deferPreview();
const display = new Display(getFullscreenCanvas());
// … load textures, build the scene …
await display.start();
preview.ready(display);
```

### `VanillaDemo.astro`

- The inline script also reads `?preview=1`. It sets `data-demo-ui="off"` (everything
  `?ui=0` does) and `data-demo-preview="on"` on `<html>`, before the first paint.
- A global rule hides the overlay layer in preview mode:
  `:root[data-demo-preview='on'] demo-ui { display: none; }`.
- A new bundled `<script>` imports `armPreviewTimeout` from `~demos/utils/demoPreview` and
  calls it.

Both the layout's script and the demo's script import the same module; Vite emits it as
one shared chunk, so both see the same state. The implementation verifies this in the
production build (`astro build` + `astro preview`), not only in the dev server.

## Part 2 — the generator

### Invocation

- Root `package.json`:
  `"lookbook:generate-previews": "pnpm nx run lookbook:build && node scripts/lookbook/generateDemoPreviews.mjs"`.
  The lookbook build comes from the Nx cache when nothing changed, and pnpm appends the
  flags of `pnpm lookbook:generate-previews --only=…` to the end of the script, which is
  the `node` call — no Nx target has to forward them. (The brainstorming had an Nx
  target `generate-previews`; the plain script does the same with one moving part less.)
- Flags:
  - `--only=<id>[,<id>…]` — only these demos; an unknown id is an error;
  - `--url=<base>` — use a running server (e.g. `http://localhost:4321/lookbook` from
    `pnpm lookbook`) instead of starting one;
  - `--headed` — show the browser window, for debugging or when headless gets no GPU;
  - `--timeout=<ms>` — how long a demo may take to fire the event, 30000 by default.

### Files

- `scripts/lookbook/generateDemoPreviews.mjs` — the generator. It lives in `scripts/`
  so the `scripts` project type-checks it (`checkJs`).
- `scripts/lookbook/demoPreviewConfig.mjs` — the constants (event name, size, quality,
  timeout, Chromium flags) and the parsing of the flags; importable by specs without
  starting a run.
- `scripts/lookbook/previewServer.mjs` — starts and stops `astro preview`.
- `scripts/lookbook/lookbookDemos.mjs` — lists the demos (id and parsed JSON) from
  `apps/lookbook/src/pages/demos/_*.json`; shared by the generator and the specs.
  `demoMetadata.test.mjs` moves to it as well.
- `scripts/lookbook/webpSize.mjs` — reads width and height from a WebP header
  (`VP8 `, `VP8L` and `VP8X` chunks); shared by the generator and the spec.

### Server

Without `--url`: find a free port (`net.createServer().listen(0)`), spawn
`astro preview --host 127.0.0.1 --port <port>` in `apps/lookbook` as its own process
group, poll `http://127.0.0.1:<port>/lookbook/` until it answers 200 (30 s at most), and
kill the process group at the end, on error and on `SIGINT`/`SIGTERM`.

### Browser

- Playwright's `chromium` (its headless shell), headless unless `--headed`, launched with
  `--enable-unsafe-webgpu --ignore-gpu-blocklist --enable-features=Vulkan --use-angle=vulkan`.
  A probe on 2026-10-04 (Chromium 153, Linux, RTX 4070 Ti) found the hardware adapter
  with exactly these flags and none without them; `channel: 'chromium'` found only
  SwiftShader. Without an adapter three.js falls back to WebGL 2; the generator logs
  which of the two it got, once per run, and carries on.
- One browser context with `viewport: {width: 1000, height: 700}` and
  `deviceScaleFactor: 1`. `PREVIEW_WIDTH` and `PREVIEW_HEIGHT` carry a comment that they
  follow `aspect-10/7` in `apps/lookbook/src/components/Card.astro`.

### Per demo

Sequential, a fresh page for each — parallel pages would compete for the GPU and stretch
the default delay. A full run takes about 18 × 6 s.

1. `page.addInitScript()` installs a listener for `lookbook.generatePreview` before any
   script of the page runs; it stores the event's `detail` in
   `window.__lookbookPreview`. No race with an early event.
2. `pageerror` and `console` messages of type `error` are collected.
3. `page.goto(<base>/demos/<id>/?preview=1)`, then
   `page.waitForFunction(() => window.__lookbookPreview)` with a 30 s timeout.
4. A CDP session takes the screenshot: `Page.captureScreenshot` with
   `format: 'webp', quality: 85`. Playwright's own `page.screenshot()` knows only PNG
   and JPEG; CDP gives WebP without a new dependency.
5. `webpSize()` checks the result is 1000×700. The bytes go to `<id>.webp.tmp` in
   `apps/lookbook/public/images/demo-preview/` and are renamed to `<id>.webp`.

### Failures and report

- A timeout, a failed navigation or a screenshot of the wrong size leaves the existing
  image untouched and marks the demo as failed.
- Page errors are reported but do not fail the demo.
- At the end a table: id, trigger (`ready`/`timeout`), duration, size in KB, errors.
  The exit code is 1 when at least one demo failed.

`demoPreviewConfig.mjs` exports the event name as a constant of its own (an `.mjs`
cannot import the TypeScript constant); a spec holds it equal to
`EVENT_GENERATE_PREVIEW`.

## Part 3 — migration, tests, docs

### Metadata and card

- `previewImage` is removed from every `_*.json`. `loadMetadataForDemos()` sets
  `previewImage: \`${id}.webp\`` and `IDemo.previewImage` becomes required.
- `Card.astro` takes `image` as a required prop; the fallback to
  `src/images/20221122-dark-circles-back-1024x.jpg` and the file itself go away (nothing
  else references it).
- The 12 PNG files in `public/images/demo-preview/` are deleted and replaced by 18
  `<id>.webp` files.
- Order: protocol and generator land first; then one commit holds the generated images
  together with the switch of the metadata and the card, so the app never points at a
  missing file.

### Demos that take over

- `first-sprite` adopts `deferPreview()` / `ready(display)` as the reference demo — the
  smallest one, and the one the README points new readers to.
- All other demos start on the default delay. After the first full run every image is
  looked at; a demo whose image is empty, still loading or caught at a poor moment
  adopts `deferPreview()` in a step of its own.

### Specs

`scripts/lookbook/demoPreviews.test.mjs`, run by `pnpm test:scripts` and therefore part of
the CI gate:

- every demo has `public/images/demo-preview/<id>.webp`;
- the directory holds nothing else;
- every image is 1000×700 according to its WebP header;
- no `_*.json` carries `previewImage`;
- the event name exported by the generator equals `EVENT_GENERATE_PREVIEW` in
  `apps/lookbook/src/components/constants.ts`.

The in-page module gets no browser spec of its own: the lookbook has no test runner, and
a run of the generator exercises the protocol end to end.

### Docs

- `apps/lookbook/README.md`: a section "Preview images" — the command, its flags, the
  protocol, `?preview=1` next to `?ui=0`, and the rule that `deferPreview()` comes before
  the first `await`. "Adding a demo" drops `previewImage` and points to
  `pnpm lookbook:generate-previews --only=<id>`.
- `AGENTS.md`: a bullet for `pnpm lookbook:generate-previews` under Commands, and the
  preview spec in the list under `pnpm test:scripts`.

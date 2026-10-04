# Lookbook Demo Previews Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pnpm lookbook:generate-previews` screenshots every lookbook demo at the moment the demo signals it is ready and writes a 1000×700 WebP per demo into the app, which the demo cards show.

**Architecture:** A module in the lookbook (`demoPreview.ts`) dispatches `lookbook.generatePreview` on `document` — after a 5 s default delay, or when a demo that took over with `deferPreview()` calls `ready(display)` after its next rendered frame. A Node script drives Playwright's Chromium against `astro preview`, waits for that event per demo, captures a WebP through CDP and writes it as `public/images/demo-preview/<id>.webp`. The card derives the image from the demo id; a `node:test` spec holds images, ids and sizes together.

**Tech Stack:** Astro 7, TypeScript (lookbook: TS 6 via `astro check`; `scripts/`: JS with `checkJs` under TS 7), Playwright 1.63 (`playwright` package, no test runner), Chrome DevTools Protocol, `node:test`, Biome.

**Spec:** `docs/superpowers/specs/2026-10-04-lookbook-demo-previews-design.md`

## Global Constraints

- Event name: `lookbook.generatePreview`, dispatched on `document`, at most once per page load; detail `{demoId: string; trigger: 'timeout' | 'ready'}`.
- Default delay: `DEFAULT_PREVIEW_DELAY_MS = 5000`, counted from the run of the layout's module script.
- Image: WebP, quality 85, exactly 1000×700 (`aspect-10/7` of `Card.astro`), viewport 1000×700 at `deviceScaleFactor: 1`.
- Image path: `apps/lookbook/public/images/demo-preview/<id>.webp`; no `previewImage` field in any `_<id>.json`.
- Chromium launch args: `--enable-unsafe-webgpu --ignore-gpu-blocklist --enable-features=Vulkan --use-angle=vulkan`.
- Per-demo timeout: 30000 ms by default, `--timeout=<ms>` overrides.
- The generator is not part of `pnpm run ci`; the spec `demoPreviews.test.mjs` is (through `pnpm test:scripts`).
- Code, comments and docs in English (AGENTS.md). Commits follow Conventional Commits and end with the two attribution lines of the session.
- Relative imports in the lookbook `.ts` files follow the surrounding code (aliases `~components/*`, `~demos/*`); `import type` for types (Biome `useImportType`).
- Browser code in the lookbook needs `// biome-ignore lint/suspicious/noConsole: <reason>` for a `console.*` call; `.mjs` files may log freely.
- `pnpm run ci` is the pre-commit gate for the last task; every task runs at least `pnpm lint` and the type check that covers its files.

## Review Focus

1. **A demo never fires the event** (it called `deferPreview()` and its `ready()` never comes, or its script throws) — the run waits `--timeout`, keeps the old image byte-for-byte, goes on with the next demo and exits 1. Pinned in Task 4, Step 7.
2. **An unknown id in `--only`** (typo) — the run stops before it starts a server or a browser, names the unknown id and the known ones, exits 2. Pinned in Task 3, Step 1.
3. **Ctrl-C in the middle of a run** — no `astro preview` process survives, no `*.tmp` file stays in the preview directory. Pinned in Task 4, Step 8.
4. **The card's aspect ratio drifts from the image size** (someone changes `aspect-10/7` or the constants) — a spec fails. Pinned in Task 3, Step 1.
5. **Overlays leak into the image** (`<demo-ui>` panels, the navbar, its blur) — `?preview=1` hides all of them. Pinned in Task 1, Step 7 (computed styles) and Task 6 (visual review).

---

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/lookbook/src/components/constants.ts` (modify) | gains `EVENT_GENERATE_PREVIEW` |
| `apps/lookbook/src/components/types.ts` (modify) | gains `LookBookGeneratePreviewEvent` in `LookBookEventMap` |
| `apps/lookbook/src/demos/utils/demoPreview.ts` (create) | the in-page protocol: timer, `deferPreview()`, `ready()`, dispatch |
| `apps/lookbook/src/layouts/VanillaDemo.astro` (modify) | reads `?preview=1`, hides `<demo-ui>`, arms the timer |
| `apps/lookbook/src/pages/demos/first-sprite.astro` (modify) | reference demo that takes over |
| `scripts/lookbook/webpSize.mjs` (create) + `webpSize.test.mjs` | width/height from a WebP header |
| `scripts/lookbook/demoPreviewConfig.mjs` (create) + `demoPreviewConfig.test.mjs` | constants, flag parsing, demo selection |
| `scripts/lookbook/lookbookDemos.mjs` (create) | lists demo ids, metadata, pages, the preview directory |
| `scripts/lookbook/demoMetadata.test.mjs` (modify) | reads the demos through `lookbookDemos.mjs` |
| `scripts/lookbook/previewServer.mjs` (create) | starts/stops `astro preview` on a free port |
| `scripts/lookbook/generateDemoPreviews.mjs` (create) | the run: browser, per-demo capture, report, exit code |
| `scripts/project.json` (modify) | `playwright` becomes an input of the scripts' type check |
| `package.json` (modify) | root script `lookbook:generate-previews` |
| `scripts/lookbook/demoPreviews.test.mjs` (create) | every demo has its image, nothing else, right size, no `previewImage` |
| `apps/lookbook/src/demos/utils/loadMetadataForDemos.ts` (modify) | `previewImage` derived from the id |
| `apps/lookbook/src/components/Card.astro` (modify) | `image` required, no fallback |
| `apps/lookbook/src/pages/demos/_*.json` (modify) | drop `previewImage` |
| `apps/lookbook/public/images/demo-preview/*` | 12 PNGs out, 18 WebPs in |
| `apps/lookbook/src/images/20221122-dark-circles-back-1024x.jpg` (delete) | the fallback teaser, unused afterwards |
| `apps/lookbook/README.md`, `AGENTS.md` (modify) | docs |

---

### Task 1: The preview protocol inside the demo page

**Files:**
- Modify: `apps/lookbook/src/components/constants.ts`
- Modify: `apps/lookbook/src/components/types.ts`
- Create: `apps/lookbook/src/demos/utils/demoPreview.ts`
- Modify: `apps/lookbook/src/layouts/VanillaDemo.astro`
- Modify: `apps/lookbook/src/pages/demos/first-sprite.astro`
- Verify with: a throwaway Playwright script in the session's scratchpad (not committed)

**Interfaces:**
- Consumes: `Display#onRenderFrame(listener): UnsubscribeFunc` from `@spearwolf/twopoint5d` (type only).
- Produces:
  - `EVENT_GENERATE_PREVIEW = 'lookbook.generatePreview'` in `~components/constants`
  - `LookBookGeneratePreviewEvent` with `detail: {demoId: string; trigger: 'timeout' | 'ready'}` in `~components/types`
  - `DEFAULT_PREVIEW_DELAY_MS: 5000`, `armPreviewTimeout(): void`, `deferPreview(): PreviewHandle`, `interface PreviewHandle {ready(...displays: Display[]): void}` in `~demos/utils/demoPreview`
  - HTML attributes `data-demo-preview="on"` and `data-demo-ui="off"` on `<html>` for `?preview=1`

The lookbook has no unit test runner (see spec, "Specs"); this task is verified by `astro check`, Biome and a scripted browser check against the dev server.

- [ ] **Step 1: Add the event constant**

`apps/lookbook/src/components/constants.ts` becomes:

```ts
export const EVENT_SHOW_DEMOS = 'lookbook.showDemos';
export const EVENT_TOGGLE_TAG = 'lookbook.toggleTag';
/** Dispatched by a demo page when it is ready for the screenshot of its preview image. */
export const EVENT_GENERATE_PREVIEW = 'lookbook.generatePreview';
```

(Keep whatever else the file holds; only the third export is new.)

- [ ] **Step 2: Add the event type**

In `apps/lookbook/src/components/types.ts`, change the first line to

```ts
import type {EVENT_GENERATE_PREVIEW, EVENT_SHOW_DEMOS, EVENT_TOGGLE_TAG} from './constants.js';
```

add after `LookBookToggleTagEvent`:

```ts
export interface LookBookGeneratePreviewEventDetail {
  /** The last segment of the page path, the id of the demo's `_<id>.json`. */
  demoId: string;
  /** `timeout`: the default delay ran out; `ready`: the demo called `ready()` of its handle. */
  trigger: 'timeout' | 'ready';
}

/** The demo page is ready for the screenshot of its preview image; see `~demos/utils/demoPreview`. */
export interface LookBookGeneratePreviewEvent extends CustomEvent {
  detail: LookBookGeneratePreviewEventDetail;
}
```

and extend the map:

```ts
export interface LookBookEventMap {
  [EVENT_SHOW_DEMOS]: LookBookShowDemosEvent;
  [EVENT_TOGGLE_TAG]: LookBookToggleTagEvent;
  [EVENT_GENERATE_PREVIEW]: LookBookGeneratePreviewEvent;
}
```

- [ ] **Step 3: Write the module**

Create `apps/lookbook/src/demos/utils/demoPreview.ts`:

```ts
import type {Display} from '@spearwolf/twopoint5d';
import {EVENT_GENERATE_PREVIEW} from '~components/constants';
import type {LookBookGeneratePreviewEventDetail} from '~components/types';

/**
 * The preview protocol of the lookbook demos. `pnpm lookbook:generate-previews` opens every
 * demo with `?preview=1` and takes its screenshot when the page dispatches
 * EVENT_GENERATE_PREVIEW on the document: DEFAULT_PREVIEW_DELAY_MS after VanillaDemo.astro
 * armed the timer, or when a demo that took over with deferPreview() calls ready().
 *
 * The state lives in this module. VanillaDemo.astro and the script of the page import the
 * same instance, and whichever of the two runs first, a deferPreview() wins over the timer.
 */
export const DEFAULT_PREVIEW_DELAY_MS = 5000;

export interface PreviewHandle {
  /**
   * Dispatches the event after the next rendered frame: with displays, once each of them has
   * rendered its next frame and one more animation frame has passed, so the frame is on the
   * screen; without, after two animation frames. A second call does nothing.
   */
  ready(...displays: Display[]): void;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let handle: PreviewHandle | undefined;
let fired = false;

const lateHandle: PreviewHandle = {ready() {}};

function fire(trigger: LookBookGeneratePreviewEventDetail['trigger']): void {
  if (fired) return;
  fired = true;
  // every demo page is served at <base>/demos/<id>/, as DemoNavBar.astro reads it as well
  const demoId = location.pathname.split('/').filter(Boolean).at(-1) ?? '';
  document.dispatchEvent(new CustomEvent(EVENT_GENERATE_PREVIEW, {detail: {demoId, trigger}}));
}

function afterAnimationFrames(count: number, callback: () => void): void {
  if (count <= 0) {
    callback();
    return;
  }
  requestAnimationFrame(() => afterAnimationFrames(count - 1, callback));
}

/** Starts the default delay, unless a demo took over already. VanillaDemo.astro calls it once. */
export function armPreviewTimeout(): void {
  if (handle || fired || timer !== undefined) return;
  timer = setTimeout(() => {
    timer = undefined;
    // a deferPreview() in the two frames still wins
    afterAnimationFrames(2, () => {
      if (!handle) fire('timeout');
    });
  }, DEFAULT_PREVIEW_DELAY_MS);
}

/**
 * Takes the moment of the screenshot over from the default delay. Call it synchronously at
 * the top of the page's script, before its first `await`: once the event is out, the handle
 * it returns does nothing.
 */
export function deferPreview(): PreviewHandle {
  if (handle) return handle;
  if (fired) {
    // biome-ignore lint/suspicious/noConsole: the author of the demo has to see the late call
    console.warn('[lookbook] deferPreview(): the preview event fired already, call deferPreview() before the first await');
    return lateHandle;
  }
  clearTimeout(timer);
  timer = undefined;

  let called = false;
  handle = {
    ready(...displays: Display[]) {
      if (called) return;
      called = true;
      if (displays.length === 0) {
        afterAnimationFrames(2, () => fire('ready'));
        return;
      }
      let pending = displays.length;
      for (const display of displays) {
        const unsubscribe = display.onRenderFrame(() => {
          unsubscribe();
          pending -= 1;
          if (pending === 0) afterAnimationFrames(1, () => fire('ready'));
        });
      }
    },
  };
  return handle;
}
```

- [ ] **Step 4: Wire the layout**

In `apps/lookbook/src/layouts/VanillaDemo.astro`, replace the inline script in `<head>` with:

```astro
    <script is:inline>
      // ?ui=0 hides the chrome of the lookbook around the demo, for a demo embedded in an
      // iframe; ?preview=1 is the page `pnpm lookbook:generate-previews` takes its screenshot
      // of, without the chrome and without the <demo-ui> either. Both are set before the
      // first paint, so nothing flashes up. A block: a classic script's top-level const would
      // land in the global scope of the page
      {
        const params = new URLSearchParams(location.search);
        const preview = params.get('preview') === '1';
        if (preview || params.get('ui') === '0') {
          document.documentElement.dataset.demoUi = 'off';
        }
        if (preview) {
          document.documentElement.dataset.demoPreview = 'on';
        }
      }
    </script>
```

Below `<slot />` in `<body>` add:

```astro
    <script>
      import {armPreviewTimeout} from '~demos/utils/demoPreview';

      // the default moment of the preview screenshot; a demo takes it over with deferPreview()
      armPreviewTimeout();
    </script>
```

In the `<style is:global>` block, right after the closing `}` of `@layer components { … }`, add:

```css
  /* ?preview=1: the screenshot shows what the demo draws, not the panels and buttons over it.
     Outside the layer, so it wins over the display: block in there */
  :root[data-demo-preview='on'] demo-ui {
    display: none;
  }
```

- [ ] **Step 5: Make `first-sprite` the reference demo**

In `apps/lookbook/src/pages/demos/first-sprite.astro`, in the `<script>`:

after the existing imports add

```ts
  import {deferPreview} from '~demos/utils/demoPreview';
```

right after the `CAMERA_DISTANCE` constant (before `new Display(...)`) add

```ts
  // the preview screenshot waits for the sprite, not for the default delay
  const preview = deferPreview();
```

and inside `display.onInit(async ({renderer}) => { … })`, directly after `scene.add(sprites);`, add

```ts
    // the next frame draws the sprite: the moment for the preview image
    preview.ready(display);
```

- [ ] **Step 6: Type check and lint**

Run: `pnpm build:twopoint5d && pnpm nx typecheck lookbook && pnpm lint`
Expected: `astro check` reports `0 errors`, Biome reports no diagnostics. If Biome complains about formatting, run `pnpm format` and re-run `pnpm lint`.

- [ ] **Step 7: Verify in the browser against the dev server**

Start the dev server in the background: `pnpm lookbook` (serves `http://localhost:4321/lookbook`).

Write `<scratchpad>/check-protocol.mjs` (the scratchpad directory of the session; import Playwright by absolute path, since the scratchpad is outside the repo):

```js
import {chromium} from '/home/spw/spaceland/twopoint5d/node_modules/playwright/index.mjs';

const base = 'http://localhost:4321/lookbook';
const browser = await chromium.launch({
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-angle=vulkan'],
});
const page = await browser.newPage({viewport: {width: 1000, height: 700}});
await page.addInitScript(() => {
  document.addEventListener('lookbook.generatePreview', (e) => {
    window.__events ??= [];
    window.__events.push({...e.detail, at: Math.round(performance.now())});
  });
});

for (const id of ['crosses', 'first-sprite', 'animated-sprites']) {
  await page.goto(`${base}/demos/${id}/?preview=1`);
  await page.waitForFunction(() => window.__events?.length, null, {timeout: 30000});
  await page.waitForTimeout(6000); // a second event would show up within this window
  const result = await page.evaluate(() => {
    // checkVisibility(), not getComputedStyle().display: the navbar hides its wrapper, and a
    // child of a display: none element still reports its own display value
    const visible = (selector) => document.querySelector(selector)?.checkVisibility() ?? 'absent';
    return {events: window.__events, demoUi: visible('demo-ui'), navBar: visible('.lookbook-demo-header'), blur: visible('.progressive-blur')};
  });
  console.log(id, JSON.stringify(result));
}
await browser.close();
```

Run: `node <scratchpad>/check-protocol.mjs`
Expected (timings vary):
- `crosses` → exactly one event, `trigger: "timeout"`, `at` ≈ 5000–6500; `demoUi: "absent"`, `navBar: false`, `blur: false`.
- `first-sprite` → exactly one event, `trigger: "ready"`, `at` well below 5000; `navBar: false`, `blur: false`.
- `animated-sprites` → exactly one event, `trigger: "timeout"`; `demoUi: false` (this page has a `<demo-ui>`), `navBar: false`, `blur: false`.

Cross-check without `?preview=1`: change the URL to `${base}/demos/animated-sprites/` for one run; then `demoUi`, `navBar` and `blur` are `true`, and the event still fires once with `trigger: "timeout"` (the timer is armed on every visit).

Then stop the dev server.

- [ ] **Step 8: Commit**

```bash
git add apps/lookbook/src/components/constants.ts apps/lookbook/src/components/types.ts \
  apps/lookbook/src/demos/utils/demoPreview.ts apps/lookbook/src/layouts/VanillaDemo.astro \
  apps/lookbook/src/pages/demos/first-sprite.astro
git commit -m "feat(lookbook): let a demo page signal the moment of its preview screenshot"
```

(with the two attribution lines of the session at the end of the message)

---

### Task 2: Read the size of a WebP image

**Files:**
- Create: `scripts/lookbook/webpSize.mjs`
- Test: `scripts/lookbook/webpSize.test.mjs`

**Interfaces:**
- Produces: `webpSize(bytes: Uint8Array): {width: number, height: number}` — throws `Error` whose message starts with `webpSize:` for anything that is not a WebP with a `VP8 `, `VP8L` or `VP8X` first chunk.

- [ ] **Step 1: Write the failing test**

Create `scripts/lookbook/webpSize.test.mjs`:

```js
import assert from 'node:assert/strict';
import {describe, it} from 'node:test';
import {webpSize} from './webpSize.mjs';

// a RIFF container whose first chunk starts at byte 12 and carries `payload` from byte 20;
// the sizes in the headers are not read, so they stay zero
const webp = (fourcc, payload) =>
  Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.from(fourcc), Buffer.alloc(4), payload, Buffer.alloc(16)]);

const vp8x = (width, height) => {
  const payload = Buffer.alloc(10);
  payload.writeUIntLE(width - 1, 4, 3);
  payload.writeUIntLE(height - 1, 7, 3);
  return webp('VP8X', payload);
};

const vp8l = (width, height) => {
  const payload = Buffer.alloc(5);
  payload[0] = 0x2f;
  payload.writeUInt32LE(((width - 1) | ((height - 1) << 14)) >>> 0, 1);
  return webp('VP8L', payload);
};

const vp8 = (width, height, scaleBits = 0) => {
  const payload = Buffer.alloc(10);
  payload.set([0x9d, 0x01, 0x2a], 3);
  payload.writeUInt16LE(width | (scaleBits << 14), 6);
  payload.writeUInt16LE(height | (scaleBits << 14), 8);
  return webp('VP8 ', payload);
};

describe('webpSize()', () => {
  it('reads the canvas size of an extended WebP (VP8X)', () => {
    assert.deepEqual(webpSize(vp8x(1000, 700)), {width: 1000, height: 700});
  });

  it('reads the size of a lossless WebP (VP8L)', () => {
    assert.deepEqual(webpSize(vp8l(1000, 700)), {width: 1000, height: 700});
  });

  it('reads the size of a lossy WebP (VP8), without its scale bits', () => {
    assert.deepEqual(webpSize(vp8(1000, 700, 3)), {width: 1000, height: 700});
  });

  it('refuses a file that is no WebP', () => {
    assert.throws(() => webpSize(Buffer.from('\x89PNG\r\n\x1a\n'.padEnd(40, '\0'))), /^Error: webpSize: /);
  });

  it('refuses a WebP whose first chunk it does not know', () => {
    assert.throws(() => webpSize(webp('ALPH', Buffer.alloc(10))), /^Error: webpSize: /);
  });

  it('refuses a lossy WebP without the start code of a key frame', () => {
    assert.throws(() => webpSize(webp('VP8 ', Buffer.alloc(10))), /^Error: webpSize: /);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/lookbook/webpSize.test.mjs`
Expected: FAIL — `Cannot find module '.../scripts/lookbook/webpSize.mjs'`.

- [ ] **Step 3: Write the implementation**

Create `scripts/lookbook/webpSize.mjs`:

```js
// The width and height of a WebP image, read from its header: the generator of the lookbook
// previews checks each screenshot with it, and a spec checks the images in the app.
// https://developers.google.com/speed/webp/docs/riff_container

/**
 * @param {Uint8Array} bytes the file, or at least its first 30 bytes
 * @returns {{width: number, height: number}}
 */
export function webpSize(bytes) {
  const buf = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (buf.length < 30 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WEBP') {
    throw new Error('webpSize: not a WebP file');
  }
  const chunk = buf.toString('latin1', 12, 16);
  switch (chunk) {
    // the extended format: the canvas size, 24 bits each, minus one
    case 'VP8X':
      return {width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1};
    // lossless: a signature byte, then 14 bits each, minus one
    case 'VP8L': {
      if (buf[20] !== 0x2f) throw new Error('webpSize: a VP8L chunk without its signature');
      const bits = buf.readUInt32LE(21);
      return {width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1};
    }
    // lossy: the frame tag, the start code of a key frame, then 14 bits each and two scale bits
    case 'VP8 ': {
      if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) {
        throw new Error('webpSize: a VP8 chunk without the start code of a key frame');
      }
      return {width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff};
    }
    default:
      throw new Error(`webpSize: unknown first chunk ${JSON.stringify(chunk)}`);
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test scripts/lookbook/webpSize.test.mjs`
Expected: `ℹ pass 6`, `ℹ fail 0`.

- [ ] **Step 5: Type check and lint**

Run: `pnpm exec tsc -p scripts/tsconfig.json && pnpm lint`
Expected: no output from `tsc`, no Biome diagnostics.

- [ ] **Step 6: Commit**

```bash
git add scripts/lookbook/webpSize.mjs scripts/lookbook/webpSize.test.mjs
git commit -m "feat(scripts): read the size of a WebP image from its header"
```

---

### Task 3: Configuration, flags and the list of demos

**Files:**
- Create: `scripts/lookbook/demoPreviewConfig.mjs`
- Create: `scripts/lookbook/lookbookDemos.mjs`
- Test: `scripts/lookbook/demoPreviewConfig.test.mjs`
- Modify: `scripts/lookbook/demoMetadata.test.mjs:12-48` (read demos through `lookbookDemos.mjs`)

**Interfaces:**
- Consumes: `EVENT_GENERATE_PREVIEW` in `apps/lookbook/src/components/constants.ts` (Task 1), read as text.
- Produces, from `demoPreviewConfig.mjs`:
  - `EVENT_GENERATE_PREVIEW = 'lookbook.generatePreview'`
  - `PREVIEW_WIDTH = 1000`, `PREVIEW_HEIGHT = 700`, `PREVIEW_QUALITY = 85`, `DEFAULT_TIMEOUT_MS = 30000`
  - `CHROMIUM_GPU_ARGS: string[]`
  - `parsePreviewArgs(argv: string[]): {only?: string[], url?: string, headed: boolean, timeoutMs: number}` — throws on unknown flags, positionals, a non-positive or non-integer `--timeout`
  - `selectDemos(ids: string[], only?: string[]): string[]` — `ids` order kept; throws `Error` naming unknown and known ids
- Produces, from `lookbookDemos.mjs`:
  - `demosDir: string`, `previewDir: string` (absolute paths, trailing separator not guaranteed — always join with `path.join`)
  - `listLookbookDemos(): {id: string, file: string, json: any}[]` sorted by id
  - `listDemoPages(): string[]` — the names of the `.astro` pages without extension

- [ ] **Step 1: Write the failing test**

Create `scripts/lookbook/demoPreviewConfig.test.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';
import {
  DEFAULT_TIMEOUT_MS,
  EVENT_GENERATE_PREVIEW,
  PREVIEW_HEIGHT,
  PREVIEW_WIDTH,
  parsePreviewArgs,
  selectDemos,
} from './demoPreviewConfig.mjs';
import {listDemoPages, listLookbookDemos} from './lookbookDemos.mjs';

const lookbookFile = (rel) => fileURLToPath(new URL(`../../apps/lookbook/src/${rel}`, import.meta.url));

describe('the configuration of the preview generator', () => {
  it('listens for the event the lookbook dispatches', () => {
    const source = fs.readFileSync(lookbookFile('components/constants.ts'), 'utf8');
    const match = source.match(/EVENT_GENERATE_PREVIEW = '([^']+)'/);
    assert.equal(match?.[1], EVENT_GENERATE_PREVIEW);
  });

  it('takes screenshots in the aspect ratio of the card', () => {
    const card = fs.readFileSync(lookbookFile('components/Card.astro'), 'utf8');
    const ratios = [...card.matchAll(/aspect-(\d+)\/(\d+)/g)].map(([, w, h]) => [Number(w), Number(h)]);
    assert.equal(ratios.length, 1, 'Card.astro sets one aspect-<w>/<h> on its image');
    const [[w, h]] = ratios;
    assert.equal(PREVIEW_WIDTH * h, PREVIEW_HEIGHT * w, `${PREVIEW_WIDTH}×${PREVIEW_HEIGHT} is not ${w}:${h}`);
  });
});

describe('parsePreviewArgs()', () => {
  it('has defaults for a run without flags', () => {
    assert.deepEqual(parsePreviewArgs([]), {only: undefined, url: undefined, headed: false, timeoutMs: DEFAULT_TIMEOUT_MS});
  });

  it('reads --only as a comma separated list, --url without its trailing slash, --headed and --timeout', () => {
    assert.deepEqual(
      parsePreviewArgs(['--only=crosses, first-sprite,', '--url=http://localhost:4321/lookbook/', '--headed', '--timeout=1000']),
      {only: ['crosses', 'first-sprite'], url: 'http://localhost:4321/lookbook', headed: true, timeoutMs: 1000},
    );
  });

  it('refuses an unknown flag', () => {
    assert.throws(() => parsePreviewArgs(['--onyl=crosses']), /onyl/);
  });

  it('refuses a timeout that is no positive whole number of milliseconds', () => {
    for (const value of ['0', '-5', '1.5', 'soon']) {
      assert.throws(() => parsePreviewArgs([`--timeout=${value}`]), /--timeout/);
    }
  });
});

describe('selectDemos()', () => {
  const ids = ['animated-sprites', 'crosses', 'first-sprite'];

  it('takes every demo without --only', () => {
    assert.deepEqual(selectDemos(ids, undefined), ids);
  });

  it('keeps the order of the demos, not of --only', () => {
    assert.deepEqual(selectDemos(ids, ['first-sprite', 'animated-sprites']), ['animated-sprites', 'first-sprite']);
  });

  it('names the unknown and the known ids for a typo', () => {
    assert.throws(() => selectDemos(ids, ['crosess']), /unknown demo id\(s\): crosess — known: animated-sprites, crosses, first-sprite/);
  });
});

describe('listLookbookDemos()', () => {
  it('lists one demo per metadata file, sorted by id, paired with its page', () => {
    const demos = listLookbookDemos();
    const ids = demos.map(({id}) => id);
    assert.deepEqual(ids, [...ids].sort());
    assert.deepEqual(ids, [...listDemoPages()].sort());
    assert.ok(ids.includes('first-sprite'));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/lookbook/demoPreviewConfig.test.mjs`
Expected: FAIL — `Cannot find module '.../scripts/lookbook/demoPreviewConfig.mjs'`.

- [ ] **Step 3: Write `lookbookDemos.mjs`**

Create `scripts/lookbook/lookbookDemos.mjs`:

```js
// The demos of the lookbook as the scripts see them: one page `pages/demos/<id>.astro` and
// one metadata file `pages/demos/_<id>.json` per demo, and one preview image
// `public/images/demo-preview/<id>.webp`.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const demosDir = fileURLToPath(new URL('../../apps/lookbook/src/pages/demos/', import.meta.url));
export const previewDir = fileURLToPath(new URL('../../apps/lookbook/public/images/demo-preview/', import.meta.url));

/** @returns {{id: string, file: string, json: any}[]} sorted by id */
export function listLookbookDemos() {
  return fs
    .readdirSync(demosDir)
    .filter((file) => /^_.*\.json$/.test(file))
    .sort()
    .map((file) => ({
      id: file.slice(1, -'.json'.length),
      file,
      json: JSON.parse(fs.readFileSync(path.join(demosDir, file), 'utf8')),
    }));
}

/** @returns {string[]} the names of the demo pages, without `.astro` */
export function listDemoPages() {
  return fs
    .readdirSync(demosDir)
    .filter((file) => file.endsWith('.astro'))
    .map((file) => file.slice(0, -'.astro'.length));
}
```

- [ ] **Step 4: Write `demoPreviewConfig.mjs`**

Create `scripts/lookbook/demoPreviewConfig.mjs`:

```js
// The constants and the flags of `pnpm lookbook:generate-previews`, apart from the run
// itself so a spec can import them.
import {parseArgs} from 'node:util';

// the lookbook cannot hand a TypeScript constant to a Node script; demoPreviewConfig.test.mjs
// holds this one equal to EVENT_GENERATE_PREVIEW in apps/lookbook/src/components/constants.ts
export const EVENT_GENERATE_PREVIEW = 'lookbook.generatePreview';

// the card shows its image in an aspect-10/7 box (apps/lookbook/src/components/Card.astro),
// up to about 450 CSS pixels wide, twice that on a high-density screen
export const PREVIEW_WIDTH = 1000;
export const PREVIEW_HEIGHT = 700;
export const PREVIEW_QUALITY = 85;

export const DEFAULT_TIMEOUT_MS = 30_000;

// without these, the headless shell of Playwright's Chromium finds no WebGPU adapter on Linux
// and three.js falls back to WebGL 2 on SwiftShader; with them it gets the hardware adapter
export const CHROMIUM_GPU_ARGS = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-angle=vulkan'];

/**
 * @param {string[]} argv the arguments after the script name
 * @returns {{only: string[] | undefined, url: string | undefined, headed: boolean, timeoutMs: number}}
 */
export function parsePreviewArgs(argv) {
  const {values} = parseArgs({
    args: argv,
    options: {
      only: {type: 'string'},
      url: {type: 'string'},
      headed: {type: 'boolean', default: false},
      timeout: {type: 'string'},
    },
    strict: true,
    allowPositionals: false,
  });

  const timeoutMs = values.timeout === undefined ? DEFAULT_TIMEOUT_MS : Number(values.timeout);
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error(`--timeout: expected a positive whole number of milliseconds, got ${JSON.stringify(values.timeout)}`);
  }

  return {
    only: values.only
      ?.split(',')
      .map((id) => id.trim())
      .filter(Boolean),
    url: values.url?.replace(/\/+$/, ''),
    headed: values.headed ?? false,
    timeoutMs,
  };
}

/**
 * @param {string[]} ids every demo, in the order of the run
 * @param {string[] | undefined} only the ids of `--only`
 * @returns {string[]}
 */
export function selectDemos(ids, only) {
  if (!only) return [...ids];
  const known = new Set(ids);
  const unknown = only.filter((id) => !known.has(id));
  if (unknown.length > 0) {
    throw new Error(`unknown demo id(s): ${unknown.join(', ')} — known: ${ids.join(', ')}`);
  }
  return ids.filter((id) => only.includes(id));
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test scripts/lookbook/demoPreviewConfig.test.mjs`
Expected: `ℹ pass 10`, `ℹ fail 0`. (The `parseArgs` message for the unknown flag is `Unknown option '--onyl'`, which the `/onyl/` matcher accepts.)

- [ ] **Step 6: Move `demoMetadata.test.mjs` onto the helper**

In `scripts/lookbook/demoMetadata.test.mjs`:

- remove `const demosUrl = …` and `const demosDir = …` (lines 12–13) and the `pages` / `metadata` definitions (around lines 42–46: `const files = …`, `const pages = …`, `const metadata = …`);
- add to the imports `import {listDemoPages, listLookbookDemos} from './lookbookDemos.mjs';`
- define instead:

```js
const pages = listDemoPages();
const metadata = listLookbookDemos();
```

`metadata` keeps the `{file, json}` shape the three `it` blocks destructure (they ignore the extra `id`). Remove the `fs`/`fileURLToPath` imports only if nothing else in the file uses them — `tagCategoriesFile` and `entry` still use `fileURLToPath`, and the third `it` reads `tagCategoriesFile` with `fs`, so both imports stay.

Run: `node --test scripts/lookbook/demoMetadata.test.mjs`
Expected: `ℹ pass 3`, `ℹ fail 0` — unchanged from before.

- [ ] **Step 7: Type check and lint**

Run: `pnpm exec tsc -p scripts/tsconfig.json && pnpm lint`
Expected: no output from `tsc`, no Biome diagnostics.

- [ ] **Step 8: Commit**

```bash
git add scripts/lookbook/demoPreviewConfig.mjs scripts/lookbook/demoPreviewConfig.test.mjs \
  scripts/lookbook/lookbookDemos.mjs scripts/lookbook/demoMetadata.test.mjs
git commit -m "feat(scripts): add the configuration and the flags of the lookbook preview generator"
```

---

### Task 4: The generator

**Files:**
- Create: `scripts/lookbook/previewServer.mjs`
- Create: `scripts/lookbook/generateDemoPreviews.mjs`
- Modify: `scripts/project.json` (type check input `playwright`)
- Modify: `package.json` (root script)

**Interfaces:**
- Consumes: `webpSize()` (Task 2); everything from `demoPreviewConfig.mjs` and `lookbookDemos.mjs` (Task 3); the event and `?preview=1` (Task 1).
- Produces:
  - `startPreviewServer(): Promise<{baseUrl: string, stop(): void}>` — `baseUrl` like `http://127.0.0.1:43123/lookbook`, no trailing slash
  - root script `pnpm lookbook:generate-previews [--only=…] [--url=…] [--headed] [--timeout=…]`
  - exit code 0 when every selected demo got its image, 1 when at least one failed, 2 for a usage or startup error

The generator drives a real browser against a real server, so it gets no `node:test` spec (`pnpm test:scripts` runs in a CI job without browsers); Steps 5–8 run it and check what it did.

- [ ] **Step 1: Write the server helper**

Create `scripts/lookbook/previewServer.mjs`:

```js
// Starts `astro preview` of the built lookbook on a free port, for the preview generator.
import {spawn} from 'node:child_process';
import net from 'node:net';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

const lookbookDir = fileURLToPath(new URL('../../apps/lookbook/', import.meta.url));
// `base` in apps/lookbook/astro.config.mjs
const BASE_PATH = '/lookbook';
const STARTUP_TIMEOUT_MS = 30_000;

/** @returns {Promise<number>} */
function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

/** @returns {Promise<{baseUrl: string, stop: () => void}>} */
export async function startPreviewServer() {
  const port = await findFreePort();
  // a process group of its own: stop() ends pnpm, astro and whatever astro started, and a
  // Ctrl-C in the terminal reaches the generator only, which then stops the group
  const child = spawn('pnpm', ['exec', 'astro', 'preview', '--host', '127.0.0.1', '--port', String(port)], {
    cwd: lookbookDir,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', (chunk) => {
    output += chunk;
  });
  child.stderr.on('data', (chunk) => {
    output += chunk;
  });

  const stop = () => {
    if (child.pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {
      // the group is gone already
    }
  };

  const baseUrl = `http://127.0.0.1:${port}${BASE_PATH}`;
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`astro preview exited with code ${child.exitCode}:\n${output}`);
    }
    try {
      const response = await fetch(`${baseUrl}/`);
      if (response.ok) return {baseUrl, stop};
    } catch {
      // not listening yet
    }
    await delay(250);
  }
  stop();
  throw new Error(`astro preview did not answer at ${baseUrl}/ within ${STARTUP_TIMEOUT_MS} ms:\n${output}`);
}
```

- [ ] **Step 2: Write the generator**

Create `scripts/lookbook/generateDemoPreviews.mjs`:

```js
// `pnpm lookbook:generate-previews`: opens every lookbook demo with ?preview=1 in Chromium,
// waits for the demo's EVENT_GENERATE_PREVIEW and writes a screenshot of it as
// apps/lookbook/public/images/demo-preview/<id>.webp. See the "Preview images" section of
// apps/lookbook/README.md.
import fs from 'node:fs';
import path from 'node:path';
import {chromium} from 'playwright';
import {
  CHROMIUM_GPU_ARGS,
  EVENT_GENERATE_PREVIEW,
  PREVIEW_HEIGHT,
  PREVIEW_QUALITY,
  PREVIEW_WIDTH,
  parsePreviewArgs,
  selectDemos,
} from './demoPreviewConfig.mjs';
import {listLookbookDemos, previewDir} from './lookbookDemos.mjs';
import {startPreviewServer} from './previewServer.mjs';
import {webpSize} from './webpSize.mjs';

/** @typedef {{id: string, ok: boolean, trigger?: string, seconds: number, kilobytes?: number, problems: string[]}} DemoResult */

/**
 * @param {import('playwright').BrowserContext} context
 * @param {string} baseUrl
 * @returns {Promise<string | undefined>} the adapter, or undefined when three.js falls back to WebGL 2
 */
async function describeWebGpuAdapter(context, baseUrl) {
  const page = await context.newPage();
  try {
    // a page of the lookbook: WebGPU is only there in a secure context, which localhost is
    await page.goto(`${baseUrl}/`);
    return await page.evaluate(async () => {
      const adapter = await /** @type {any} */ (navigator).gpu?.requestAdapter();
      return adapter ? `${adapter.info.vendor} ${adapter.info.architecture}`.trim() : undefined;
    });
  } finally {
    await page.close();
  }
}

/**
 * @param {import('playwright').BrowserContext} context
 * @param {string} baseUrl
 * @param {string} id
 * @param {number} timeoutMs
 * @returns {Promise<DemoResult>}
 */
async function captureDemo(context, baseUrl, id, timeoutMs) {
  const started = performance.now();
  const seconds = () => (performance.now() - started) / 1000;
  /** @type {string[]} */
  const problems = [];
  const target = path.join(previewDir, `${id}.webp`);
  const temporary = `${target}.tmp`;
  const page = await context.newPage();
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
  });

  try {
    // installed before any script of the page runs, so not even an early event goes unheard
    await page.addInitScript((eventName) => {
      document.addEventListener(eventName, (event) => {
        const w = /** @type {any} */ (window);
        w.__lookbookPreview ??= /** @type {CustomEvent} */ (event).detail;
      });
    }, EVENT_GENERATE_PREVIEW);

    await page.goto(`${baseUrl}/demos/${id}/?preview=1`, {waitUntil: 'load', timeout: timeoutMs});
    const detail = await (
      await page.waitForFunction(() => /** @type {any} */ (window).__lookbookPreview, null, {timeout: timeoutMs})
    ).jsonValue();

    // page.screenshot() knows PNG and JPEG only; the DevTools protocol of Chromium writes WebP
    const cdp = await context.newCDPSession(page);
    const {data} = await cdp.send('Page.captureScreenshot', {format: 'webp', quality: PREVIEW_QUALITY});
    const bytes = Buffer.from(data, 'base64');
    const {width, height} = webpSize(bytes);
    if (width !== PREVIEW_WIDTH || height !== PREVIEW_HEIGHT) {
      throw new Error(`the screenshot is ${width}×${height}, not ${PREVIEW_WIDTH}×${PREVIEW_HEIGHT}`);
    }

    fs.writeFileSync(temporary, bytes);
    fs.renameSync(temporary, target);
    return {id, ok: true, trigger: detail?.trigger, seconds: seconds(), kilobytes: bytes.length / 1024, problems};
  } catch (error) {
    fs.rmSync(temporary, {force: true});
    const message = error instanceof Error ? error.message.split('\n')[0] : String(error);
    return {id, ok: false, seconds: seconds(), problems: [...problems, message]};
  } finally {
    await page.close();
  }
}

/** @param {DemoResult} result */
function printResult({id, ok, trigger, seconds, kilobytes, problems}) {
  const columns = [
    id.padEnd(36),
    (ok ? 'ok' : 'FAILED').padEnd(7),
    (trigger ?? '-').padEnd(8),
    `${seconds.toFixed(1)} s`.padStart(7),
    kilobytes === undefined ? '' : `${Math.round(kilobytes)} KB`.padStart(8),
  ];
  console.log(columns.join(' '));
  for (const problem of problems) console.log(`    ${problem}`);
}

async function main() {
  const options = parsePreviewArgs(process.argv.slice(2));
  const ids = selectDemos(
    listLookbookDemos().map(({id}) => id),
    options.only,
  );

  /** @type {{baseUrl: string, stop: () => void} | undefined} */
  let server;
  /** @type {import('playwright').Browser | undefined} */
  let browser;
  const onSignal = (/** @type {NodeJS.Signals} */ signal) => {
    server?.stop();
    process.exit(signal === 'SIGINT' ? 130 : 143);
  };
  process.once('SIGINT', onSignal);
  process.once('SIGTERM', onSignal);

  try {
    server = options.url ? undefined : await startPreviewServer();
    const baseUrl = options.url ?? /** @type {{baseUrl: string}} */ (server).baseUrl;

    browser = await chromium.launch({headless: !options.headed, args: CHROMIUM_GPU_ARGS});
    const context = await browser.newContext({
      viewport: {width: PREVIEW_WIDTH, height: PREVIEW_HEIGHT},
      deviceScaleFactor: 1,
    });

    const adapter = await describeWebGpuAdapter(context, baseUrl);
    console.log(`lookbook at ${baseUrl}`);
    console.log(`WebGPU adapter: ${adapter ?? 'none, three.js renders with WebGL 2'}`);
    console.log(`${ids.length} demo(s) into ${path.relative(process.cwd(), previewDir)}\n`);

    /** @type {DemoResult[]} */
    const results = [];
    for (const id of ids) {
      const result = await captureDemo(context, baseUrl, id, options.timeoutMs);
      printResult(result);
      results.push(result);
    }

    const failed = results.filter(({ok}) => !ok).map(({id}) => id);
    console.log(
      failed.length === 0
        ? `\n${results.length} preview(s) written`
        : `\n${failed.length} of ${results.length} failed, their old images stay: ${failed.join(', ')}`,
    );
    return failed.length === 0 ? 0 : 1;
  } finally {
    await browser?.close();
    server?.stop();
  }
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error) => {
    console.error(`generateDemoPreviews: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 2;
  },
);
```

- [ ] **Step 3: Register the script and the type check input**

In the root `package.json`, under `"scripts"`, directly after `"lookbook": "pnpm nx dev lookbook"` add (mind the comma on the line before):

```json
    "lookbook:generate-previews": "pnpm nx run lookbook:build && node scripts/lookbook/generateDemoPreviews.mjs"
```

In `scripts/project.json`, extend the `externalDependencies` list of the `typecheck` inputs:

```json
        {"externalDependencies": ["typescript", "@typescript/typescript6", "@types/node", "yaml", "playwright"]}
```

- [ ] **Step 4: Type check and lint**

Run: `pnpm exec tsc -p scripts/tsconfig.json && pnpm lint`
Expected: no output from `tsc`, no Biome diagnostics. If `tsc` cannot resolve `import('playwright')` types, check that `node_modules/playwright/index.d.ts` exists (`pnpm install`).

- [ ] **Step 5: Run it on two demos**

Run: `pnpm lookbook:generate-previews --only=crosses,first-sprite`
Expected:
- the build of the lookbook runs (or comes from the Nx cache);
- `WebGPU adapter: nvidia lovelace` (on the developer machine; another machine may print the WebGL 2 line — not an error);
- two lines, both `ok`: `crosses` with `timeout` at about 6 s, `first-sprite` with `ready` well under 5 s;
- `2 preview(s) written`, exit code 0 (`echo $?`).

The `ready` of `first-sprite` in this production build also proves that the layout's script and the page's script share one instance of `demoPreview.ts`: with two instances, the layout's timer would not know of the `deferPreview()` and the trigger would read `timeout`.

Check the files: `ls -la apps/lookbook/public/images/demo-preview/*.webp` lists `crosses.webp` and `first-sprite.webp`; `node -e "import('./scripts/lookbook/webpSize.mjs').then(({webpSize}) => console.log(webpSize(require('fs').readFileSync('apps/lookbook/public/images/demo-preview/crosses.webp'))))"` prints `{ width: 1000, height: 700 }`.

Look at both images — with the Read tool directly if it renders WebP, otherwise open `http://127.0.0.1:<port>/lookbook/images/demo-preview/<id>.webp` of a running `astro preview` or `pnpm lookbook` in the Playwright MCP browser and take a screenshot — and check that each shows its demo with neither navbar nor panels.

- [ ] **Step 6: Run it against a running server**

Start `pnpm lookbook` in the background, then run:
`node scripts/lookbook/generateDemoPreviews.mjs --url=http://localhost:4321/lookbook/ --only=crosses`
Expected: `lookbook at http://localhost:4321/lookbook` (trailing slash gone), `crosses ok timeout`, exit code 0, no second `astro preview` started (`pgrep -fa "astro preview"` prints nothing). Stop the dev server.

- [ ] **Step 7: Review Focus 1 — a demo that never fires keeps its old image**

```bash
sha256sum apps/lookbook/public/images/demo-preview/crosses.webp > <scratchpad>/crosses.sha
node scripts/lookbook/generateDemoPreviews.mjs --only=crosses,first-sprite --timeout=1000; echo "exit $?"
sha256sum -c <scratchpad>/crosses.sha
ls apps/lookbook/public/images/demo-preview/ | grep -c '\.tmp$'
```

Expected: `crosses FAILED` with a `Timeout 1000ms exceeded` line (its event comes after 5 s), `first-sprite ok ready` (the run went on), the summary `1 of 2 failed, their old images stay: crosses`, `exit 1`, `crosses.webp: OK` from `sha256sum -c`, and `0` temporary files.

- [ ] **Step 8: Review Focus 3 — Ctrl-C leaves nothing behind**

```bash
# job control on: without it a background job of a non-interactive shell ignores SIGINT,
# and the check would prove nothing
set -m
node scripts/lookbook/generateDemoPreviews.mjs & GEN=$!
until pgrep -f "astro preview" >/dev/null; do sleep 0.5; done   # the server is up
sleep 3                                                         # the browser has started too
kill -INT $GEN; wait $GEN; echo "exit $?"
pgrep -fa "astro preview" || echo "no astro preview left"
ls apps/lookbook/public/images/demo-preview/ | grep '\.tmp$' || echo "no tmp files"
git status --short apps/lookbook/public/images/demo-preview/
```

Expected: `exit 130`, `no astro preview left`, `no tmp files`. `git status` may list webp files the run finished before the signal; restore them with `git checkout -- apps/lookbook/public/images/demo-preview/` / `git clean -f apps/lookbook/public/images/demo-preview/*.webp` except `crosses.webp` and `first-sprite.webp` from Step 5, which Task 5 needs anyway — or simply keep all of them, Task 5 regenerates every image.

(Never poll without the `sleep`: an empty `until` loop spins a CPU core, and other sessions and tests share the machine. If the executing harness blocks `sleep` in the foreground, run the block through its background/monitor mechanism instead.)

- [ ] **Step 9: Commit**

Commit the code only, no images yet (Task 5 commits the images together with the switch of the metadata):

```bash
git add scripts/lookbook/previewServer.mjs scripts/lookbook/generateDemoPreviews.mjs scripts/project.json package.json
git commit -m "feat(lookbook): generate the preview images of the demos with pnpm lookbook:generate-previews"
```

---

### Task 5: Switch the cards to one generated image per demo

**Files:**
- Test: `scripts/lookbook/demoPreviews.test.mjs` (create)
- Modify: `apps/lookbook/src/demos/utils/loadMetadataForDemos.ts:5-18,63`
- Modify: `apps/lookbook/src/components/Card.astro:1-20`
- Modify: every `apps/lookbook/src/pages/demos/_*.json` that has `previewImage` (13 files)
- Delete: `apps/lookbook/public/images/demo-preview/*.png` (12 files), `apps/lookbook/src/images/20221122-dark-circles-back-1024x.jpg`
- Create: `apps/lookbook/public/images/demo-preview/<id>.webp` × 18 (generated)

**Interfaces:**
- Consumes: `listLookbookDemos()`, `previewDir` (Task 3); `webpSize()` (Task 2); `PREVIEW_WIDTH`, `PREVIEW_HEIGHT` (Task 3); the generator (Task 4).
- Produces: `IDemo.previewImage: string` (required, always `<id>.webp`); `Card` prop `image: string` (required).

- [ ] **Step 1: Write the failing spec**

Create `scripts/lookbook/demoPreviews.test.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {describe, it} from 'node:test';
import {PREVIEW_HEIGHT, PREVIEW_WIDTH} from './demoPreviewConfig.mjs';
import {listLookbookDemos, previewDir} from './lookbookDemos.mjs';
import {webpSize} from './webpSize.mjs';

// `pnpm lookbook:generate-previews` writes one image per demo, and the card of the demo
// derives its path from the id. This spec holds the directory to the demos: an image for
// each, nothing else, each in the size the card shows.
const demos = listLookbookDemos();
const files = fs.readdirSync(previewDir);
const expected = new Set(demos.map(({id}) => `${id}.webp`));

describe('the preview images of the lookbook demos', () => {
  it('has a <id>.webp for every demo', () => {
    const missing = [...expected].filter((file) => !files.includes(file));
    assert.deepEqual(missing, [], 'run `pnpm lookbook:generate-previews --only=<id>` for these demos');
  });

  it('holds nothing but the images of the demos', () => {
    const extra = files.filter((file) => !expected.has(file));
    assert.deepEqual(extra, [], 'these files belong to no demo; delete them');
  });

  it(`keeps every image at ${PREVIEW_WIDTH}×${PREVIEW_HEIGHT}, the aspect ratio of the card`, () => {
    const offenders = files
      .filter((file) => expected.has(file))
      .map((file) => ({file, ...webpSize(fs.readFileSync(path.join(previewDir, file)))}))
      .filter(({width, height}) => width !== PREVIEW_WIDTH || height !== PREVIEW_HEIGHT)
      .map(({file, width, height}) => `${file}: ${width}×${height}`);
    assert.deepEqual(offenders, []);
  });

  it('lets no metadata file name an image, the card derives it from the id', () => {
    const offenders = demos.filter(({json}) => 'previewImage' in json).map(({file}) => file);
    assert.deepEqual(offenders, []);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node --test scripts/lookbook/demoPreviews.test.mjs`
Expected: FAIL — `has a <id>.webp` lists the demos that have no WebP yet (Task 4 wrote at least `crosses` and `first-sprite`), `holds nothing but` lists the 12 PNGs, `lets no metadata file` lists 13 JSON files. The size test may pass already.

- [ ] **Step 3: Generate every image**

Run: `pnpm lookbook:generate-previews`
Expected: 18 lines, all `ok`, `18 preview(s) written`, exit 0. A `FAILED` demo: read its problems, fix the cause (usually a page error), re-run with `--only=<id>`. Do not go on with a missing image.

- [ ] **Step 4: Remove the old images and the fallback**

```bash
git rm -q apps/lookbook/public/images/demo-preview/*.png apps/lookbook/src/images/20221122-dark-circles-back-1024x.jpg
```

- [ ] **Step 5: Drop `previewImage` from the metadata**

```bash
node -e '
const fs = require("fs");
const dir = "apps/lookbook/src/pages/demos/";
for (const file of fs.readdirSync(dir).filter((f) => /^_.*\.json$/.test(f))) {
  const src = fs.readFileSync(dir + file, "utf8");
  // the line, together with the comma that separated it from its neighbour
  const out = src.replace(/,\n\s*"previewImage": "[^"]*"(?=\n)/, "").replace(/\n\s*"previewImage": "[^"]*",(?=\n)/, "");
  if (out !== src) { JSON.parse(out); fs.writeFileSync(dir + file, out); console.log("updated", file); }
}'
grep -l previewImage apps/lookbook/src/pages/demos/_*.json || echo "no previewImage left"
```

Expected: 13 `updated` lines, then `no previewImage left`. `JSON.parse(out)` throws on a file the regexes left broken; fix it by hand then.

- [ ] **Step 6: Derive the image from the id**

In `apps/lookbook/src/demos/utils/loadMetadataForDemos.ts`, in `IDemo` replace `previewImage?: string;` with:

```ts
  /** `<id>.webp` in `public/images/demo-preview/`, written by `pnpm lookbook:generate-previews`. */
  previewImage: string;
```

and in the `map` callback replace the `return` with:

```ts
  // a copy: json.tags is the array of the imported metadata module
  return {
    ...json,
    id,
    href: makeUrl(json.url),
    previewImage: `${id}.webp`,
    tags: json.tags ? [...json.tags].sort() : undefined,
  };
```

- [ ] **Step 7: Make the card's image required**

In `apps/lookbook/src/components/Card.astro` frontmatter: delete the line `import defaultTeaserImage from '../images/20221122-dark-circles-back-1024x.jpg?url';`, change `image?: string;` to

```ts
  /** The file name of the preview image in `public/images/demo-preview/`. */
  image: string;
```

and replace `const previewImage = image ? demoPreviewImageUrl(image) : defaultTeaserImage;` with

```ts
const previewImage = demoPreviewImageUrl(image);
```

`DemoCardsGrid.astro` passes `image={previewImage}` already and stays as it is.

- [ ] **Step 8: Run the spec and the checks**

Run: `node --test scripts/lookbook/demoPreviews.test.mjs scripts/lookbook/demoMetadata.test.mjs`
Expected: all pass (`ℹ fail 0`).

Run: `pnpm nx typecheck lookbook && pnpm nx build lookbook && pnpm lint`
Expected: `0 errors` from `astro check`, the build succeeds, no Biome diagnostics.

- [ ] **Step 9: Look at the overview**

Run `pnpm lookbook` in the background and open `http://localhost:4321/lookbook/` (Playwright MCP `browser_navigate` + `browser_take_screenshot`, full page, viewport 1440×900). Expected: 18 cards, each with its own image, none cropped visibly at the sides (10:7 into 10:7), no broken image icon. Stop the server.

- [ ] **Step 10: Commit**

```bash
git add scripts/lookbook/demoPreviews.test.mjs apps/lookbook/src/demos/utils/loadMetadataForDemos.ts \
  apps/lookbook/src/components/Card.astro apps/lookbook/src/pages/demos/_*.json \
  apps/lookbook/public/images/demo-preview/
git commit -m "feat(lookbook): show a generated 1000x700 preview of its own on every demo card"
```

---

### Task 6: Review the images; demos with a poor moment take over

**Files:**
- Modify: `apps/lookbook/src/pages/demos/<id>.astro` for each demo found wanting (none known in advance)
- Modify: `apps/lookbook/public/images/demo-preview/<id>.webp` for those demos (regenerated)

**Interfaces:**
- Consumes: `deferPreview()` / `PreviewHandle#ready(...displays)` (Task 1); the generator's `--only` (Task 4).

- [ ] **Step 1: Look at every image**

Serve the overview as in Task 5, Step 9, and screenshot it; zoom in on cards as needed (or open the WebP files one by one in a Playwright page at `http://localhost:4321/lookbook/images/demo-preview/<id>.webp` and take a PNG screenshot of each to look at).

For each of the 18 demos write one line into the task report: `<id>: fine` or `<id>: <what is wrong>`. An image is wanting when:
- the canvas is empty or shows only the clear color while the demo draws something later;
- textures are missing (white or black quads) or a loading state is visible;
- the frame catches a transition (a camera halfway, sprites all piled at the origin) that does not show what the demo is about;
- any overlay is visible (navbar, title, lil-gui panel, buttons, `<demo-ui>` text). An overlay is a bug of Task 1, not of the demo: fix it there instead.

- [ ] **Step 2: Let each wanting demo take over**

For every demo marked in Step 1, apply the pattern of `first-sprite.astro` (Task 1, Step 5):

```ts
  import {deferPreview} from '~demos/utils/demoPreview';

  // the preview screenshot waits for <what the demo waits for>, not for the default delay
  const preview = deferPreview();
```

placed before the first `await` of the page's script, and `preview.ready(display)` (or `preview.ready(display1, display2)` for a page with several displays) at the point where the scene is complete — typically at the end of the `onInit` callback or after the last `await` that loads assets. For a demo that just needs more time (a scene that settles), call `ready()` from a timer instead:

```ts
  setTimeout(() => preview.ready(demo), 8000);
```

and say in the comment what it waits for.

- [ ] **Step 3: Regenerate those demos**

Run: `pnpm lookbook:generate-previews --only=<id>,<id>…`
Expected: each `ok`, trigger `ready`. Look at the images again as in Step 1.

- [ ] **Step 4: Checks**

Run: `pnpm nx typecheck lookbook && pnpm lint && node --test scripts/lookbook/demoPreviews.test.mjs`
Expected: `0 errors`, no diagnostics, `ℹ fail 0`.

- [ ] **Step 5: Commit** (skip when Step 1 found every image fine)

```bash
git add apps/lookbook/src/pages/demos/ apps/lookbook/public/images/demo-preview/
git commit -m "feat(lookbook): let the demos that need it pick the moment of their preview"
```

---

### Task 7: Docs and the full gate

**Files:**
- Modify: `apps/lookbook/README.md` (section "Adding a demo", new section "Preview images")
- Modify: `AGENTS.md` (Commands)

**Interfaces:**
- Consumes: everything above; names must match exactly: `pnpm lookbook:generate-previews`, `--only`, `--url`, `--headed`, `--timeout`, `?preview=1`, `deferPreview()`, `ready()`, `lookbook.generatePreview`, `DEFAULT_PREVIEW_DELAY_MS`.

- [ ] **Step 1: README — "Adding a demo"**

Read the whole section first. Remove every mention of `previewImage` and of putting an image into `public/images/demo-preview/` by hand. Add as the last step of the list:

```markdown
N. Generate its card image: `pnpm lookbook:generate-previews --only=<name>` writes
   `public/images/demo-preview/<name>.webp`; see [Preview images](#preview-images).
```

(numbered to follow the list's last item).

- [ ] **Step 2: README — new section "Preview images"**

Add after "Adding a demo":

````markdown
## Preview images

Every card on the overview shows `public/images/demo-preview/<id>.webp`, the id being the
name of the demo page. `pnpm lookbook:generate-previews` (from the repo root) writes them:
it builds the lookbook, starts `astro preview` on a free port, opens each demo in
Playwright's Chromium at 1000×700 — the `aspect-10/7` of the card — and saves a WebP
screenshot. `scripts/lookbook/demoPreviews.test.mjs` (`pnpm test:scripts`) fails when a demo
has no image, an image has no demo, or an image has another size.

| Flag | Effect |
| --- | --- |
| `--only=<id>,<id>` | only these demos |
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
````

- [ ] **Step 3: AGENTS.md — Commands**

After the bullet `- \`pnpm lookbook\` — Astro dev server at <http://localhost:4321/lookbook>` add:

```markdown
- `pnpm lookbook:generate-previews` — the preview image of every lookbook demo, through
  Playwright's Chromium against `astro preview`; `--only=<id>,…` for some. Not part of
  `pnpm run ci`: it needs a browser and writes binary files. The protocol is in
  `apps/lookbook/README.md`, "Preview images"
```

and in the `pnpm test:scripts` bullet, after "one that holds the tags and routes of the lookbook's demo metadata to the library's exports,", add "one that holds the preview images of the lookbook to its demos, ids and card size,".

- [ ] **Step 4: Docs checks**

Run: `pnpm lint && node --test scripts/checkDocSnippets/typecheckInputs.test.mjs`
Expected: no Biome diagnostics; `ℹ pass 1`. (The README's `ts` block is a plain excerpt, not `ts check`, so the snippet check does not compile it.)

- [ ] **Step 5: The full gate**

Run: `pnpm run ci`
Expected: every part passes — lint, build, typecheck, checkPkgTypes, checkNameableTypes, lintPkg, test:scripts (now with `webpSize`, `demoPreviewConfig` and `demoPreviews` specs), test:coverage, test:allocations, test:browser. On a failure: fix the cause, re-run the part that failed, then the whole gate.

- [ ] **Step 6: Commit**

```bash
git add apps/lookbook/README.md AGENTS.md
git commit -m "docs(lookbook): describe how the demo preview images are generated"
```

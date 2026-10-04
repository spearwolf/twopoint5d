# Lookbook Navbar View Transitions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Navigating between the lookbook explorer and a demo morphs the top navbar — the rainbow line rolls the explorer header up into the top edge on the way in and pulls it down over the demo title on the way back — while the rest of the page keeps the browser's default crossfade.

**Architecture:** Native cross-document view transitions: both layouts opt in through a shared stylesheet (`@view-transition { navigation: auto }`), the navbar components give their elements paired `lb-*` view-transition names, and each layout imports the choreography of the direction that ends on it, because the pseudo-element tree is styled by the new document. No JavaScript in the navigation path. A `node:test` spec holds the names of each page to the design and the stylesheets to the names; the motion itself is verified in real browsers.

**Tech Stack:** Astro 7 (static pages, `base: '/lookbook'`), CSS View Transitions Level 2, Tailwind 4 (untouched), `node:test` (`pnpm test:scripts`, JS with `checkJs` under TS 7), Playwright 1.63 for throwaway verification scripts, Biome.

**Spec:** `docs/superpowers/specs/2026-10-04-lookbook-nav-view-transitions-design.md`

## Global Constraints

- All view-transition names carry the prefix `lb-`. The explorer declares exactly `lb-curtain`, `lb-dialog`, `lb-logo`, `lb-rainbow`, `lb-search`, `lb-wordmark`; a demo declares exactly `lb-caption-post`, `lb-caption-pre`, `lb-curtain`, `lb-demo-title`, `lb-dialog`, `lb-logo`, `lb-rainbow`.
- A name is set in the `<style>` of the component that owns the element; `lb-dialog` only on `dialog…[open]`.
- Timing tokens on `:root`: `--lb-vt-duration: 450ms`, `--lb-vt-ease: cubic-bezier(0.22, 1, 0.36, 1)`, `--lb-vt-fade: 150ms`.
- `prefers-reduced-motion: reduce` → `@view-transition { navigation: none; }`.
- No change to any page under `apps/lookbook/src/pages/demos/`; no JavaScript in the navigation path (the only exceptions are the documented fallbacks of Task 4, each used only if its check fails).
- `?ui=0` and `?preview=1` look and behave as before; `pnpm lookbook:generate-previews` is unaffected.
- Code, comments and docs in English (AGENTS.md). Commits follow Conventional Commits and end with the two attribution lines of the session. No audit or review run numbers anywhere in code, comments, tests or commits.
- Slowing animations down for inspection happens per page through CDP (`Animation.setPlaybackRate`) or a video recording — never by loading the machine.
- Every task runs `pnpm lint` and `node --test scripts/lookbook/navViewTransitions.test.mjs`; Tasks 2–4 also `pnpm nx typecheck lookbook`; the last task runs `pnpm run ci`.

## Review Focus

1. **A name occurs twice on one page** (a component rendered twice, a selector that matches two elements) — the browser skips the *whole* transition without an error. Pinned in Task 2, Step 1 (each name once per page, each name-carrying component rendered once).
2. **The build drops or rewrites `@view-transition`** (the CSS minifier, the at-rule nested in `@media`) — transitions work in `astro dev` and silently not in production. Pinned in Task 1, Step 6 (grep of the built CSS).
3. **Reduced motion** — a user who asked for no motion gets the hard switch of today, in both directions. Pinned in Task 4, Step 5.
4. **Narrow viewport (375px)** — the explorer header and the demo title wrap or truncate differently; the curtain, the line and the logo still meet without a jump. Pinned in Task 4, Step 4.
5. **Back button and bfcache, with the search dialog left open** — returning to the explorer plays the reverse transition, and a restored open search dialog fades in instead of breaking the transition. Pinned in Task 4, Step 3.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `apps/lookbook/src/styles/view-transitions.css` (create) | opt-in, reduced-motion opt-out, timing tokens, keyframes, group stacking order, curtain clip, rainbow snapshots |
| `apps/lookbook/src/styles/view-transitions-into-demo.css` (create) | choreography explorer → demo; imported by the demo layout |
| `apps/lookbook/src/styles/view-transitions-to-explorer.css` (create) | choreography demo → explorer; imported by the explorer layout |
| `apps/lookbook/src/layouts/Layout.astro` (modify) | imports, `<link rel="expect">` for `#lb-explorer-nav` |
| `apps/lookbook/src/layouts/VanillaDemo.astro` (modify) | imports, `<link rel="expect">` for `#lb-demo-nav` |
| `apps/lookbook/src/components/LookbookHeader.astro` (modify) | names `lb-curtain`, `lb-logo`, `lb-wordmark`, `lb-rainbow`; rainbow container box; wrapper id |
| `apps/lookbook/src/components/SearchLookbook.astro` (modify) | names `lb-search`, `lb-dialog` |
| `apps/lookbook/src/components/DemoNavBar.astro` (modify) | curtain element; caption/title classes; names; rainbow container box; wrapper id |
| `scripts/lookbook/navViewTransitions.test.mjs` (create) | the wiring spec |
| `apps/lookbook/README.md` (modify) | section "Navbar view transitions" |
| `AGENTS.md` (modify) | the new spec in the list of `pnpm test:scripts` |

Throwaway verification scripts live in the session's scratchpad directory and are not committed.

---

### Task 1: Opt both layouts into cross-document view transitions

After this task every navigation between the explorer and a demo crossfades the whole page (the browser default); the navbar does not morph yet.

**Files:**
- Create: `apps/lookbook/src/styles/view-transitions.css`
- Modify: `apps/lookbook/src/layouts/Layout.astro` (frontmatter)
- Modify: `apps/lookbook/src/layouts/VanillaDemo.astro` (frontmatter)
- Test: `scripts/lookbook/navViewTransitions.test.mjs` (create)

**Interfaces:**
- Consumes: nothing.
- Produces: the stylesheet `../styles/view-transitions.css` (imported by both layouts) with the tokens `--lb-vt-duration`, `--lb-vt-ease`, `--lb-vt-fade` on `:root` and the keyframes `lb-fade-in`, `lb-fade-out`, `lb-slide-in-left`, `lb-slide-out-left` (the slides read `--lb-vt-slide-from`). The test file's helpers `src(file)`, `importsOf(source)` are reused by Tasks 2 and 3.

- [ ] **Step 1: Write the failing test**

Create `scripts/lookbook/navViewTransitions.test.mjs`:

```js
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {describe, it} from 'node:test';
import {fileURLToPath} from 'node:url';

// The navbar of the lookbook morphs between the explorer and a demo through cross-document
// view transitions (apps/lookbook/README.md, "Navbar view transitions"). The browser pairs the
// elements of the two pages by their view-transition-name and skips the whole transition when a
// name occurs twice in one page; neither the build nor `astro check` sees any of it. This spec
// holds the names of each page to the pairs of the design, and the stylesheets to the names the
// pages declare.

/** @param {string} file a path below `apps/lookbook/src/` */
const src = (file) => fs.readFileSync(fileURLToPath(new URL(`../../apps/lookbook/src/${file}`, import.meta.url)), 'utf8');

/** @param {string} source @returns {string[]} the specifiers of the side-effect imports */
const importsOf = (source) => [...source.matchAll(/^import\s+'([^']+)';/gm)].map((m) => m[1] ?? '');

describe('the navbar view transitions', () => {
  it('both layouts opt in through the shared stylesheet', () => {
    for (const layout of ['layouts/Layout.astro', 'layouts/VanillaDemo.astro']) {
      assert.ok(
        importsOf(src(layout)).includes('../styles/view-transitions.css'),
        `${layout} does not import ../styles/view-transitions.css`,
      );
    }
  });

  it('opts every same-origin navigation in, and opts out under reduced motion', () => {
    const css = src('styles/view-transitions.css');
    assert.match(css, /@view-transition\s*\{\s*navigation:\s*auto;?\s*\}/);
    assert.match(
      css,
      /@media\s*\(prefers-reduced-motion:\s*reduce\)\s*\{\s*@view-transition\s*\{\s*navigation:\s*none;?\s*\}\s*\}/,
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test scripts/lookbook/navViewTransitions.test.mjs`
Expected: FAIL — `ENOENT … styles/view-transitions.css` and `layouts/Layout.astro does not import ../styles/view-transitions.css`.

- [ ] **Step 3: Write the shared stylesheet**

Create `apps/lookbook/src/styles/view-transitions.css`:

```css
/* Cross-document view transitions between the explorer and the demos: the navbar morphs from
   one shape to the other, everything else keeps the browser's default crossfade. The
   pseudo-element tree of a transition lives in the new document and takes the new document's
   styles, so each layout imports the choreography of the direction that ends on it
   (view-transitions-into-demo.css, view-transitions-to-explorer.css), and both import this file:
   the opt-in, the timing, the keyframes and what both directions share. The names are set by the
   components that own the elements; apps/lookbook/README.md, "Navbar view transitions", lists the
   pairs. */

@view-transition {
  navigation: auto;
}

/* asked for no motion: the hard switch of a browser without view transitions */
@media (prefers-reduced-motion: reduce) {
  @view-transition {
    navigation: none;
  }
}

:root {
  --lb-vt-duration: 450ms;
  --lb-vt-ease: cubic-bezier(0.22, 1, 0.36, 1);
  --lb-vt-fade: 150ms;
}

/* every group morphs in the same time and curve, the root's crossfade included; the images of a
   group inherit both unless a choreography sets an animation of its own */
::view-transition-group(*) {
  animation-duration: var(--lb-vt-duration);
  animation-timing-function: var(--lb-vt-ease);
}

@keyframes lb-fade-in {
  from {
    opacity: 0;
  }
}

@keyframes lb-fade-out {
  to {
    opacity: 0;
  }
}

/* a caption slides in from --lb-vt-slide-from, set on the image it moves */
@keyframes lb-slide-in-left {
  from {
    opacity: 0;
    transform: translateX(var(--lb-vt-slide-from));
  }
}

@keyframes lb-slide-out-left {
  to {
    opacity: 0;
    transform: translateX(var(--lb-vt-slide-from));
  }
}
```

The group stacking order, the curtain clip and the rainbow snapshot rules join this file in Task 3, when there are names for them to address.

- [ ] **Step 4: Import it in both layouts**

In `apps/lookbook/src/layouts/Layout.astro`, the frontmatter becomes:

```astro
---
import '../styles/global.css';
import '../styles/view-transitions.css';

export interface Props {
  title: string;
}

const {title} = Astro.props;
---
```

In `apps/lookbook/src/layouts/VanillaDemo.astro`, below `import '../styles/global.css';`:

```astro
import '../styles/view-transitions.css';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `node --test scripts/lookbook/navViewTransitions.test.mjs`
Expected: PASS, 2 tests.

- [ ] **Step 6: Check that the build keeps the at-rules**

Run:

```bash
pnpm nx build lookbook
grep -rhoE '@view-transition\{navigation:(auto|none)\}' apps/lookbook/dist/_astro/*.css | sort | uniq -c
grep -rhoE '@media \(prefers-reduced-motion: ?reduce\)\{@view-transition' apps/lookbook/dist/_astro/*.css | head -1
```

Expected: both `navigation:auto` and `navigation:none` appear (at least once each), and the second grep prints the `@media … {@view-transition` prefix. If the minifier dropped or rewrote either rule, stop and report the built CSS — do not work around it in this task.

- [ ] **Step 7: Lint, type check of the scripts, commit**

Run: `pnpm lint && pnpm nx typecheck scripts`
Expected: both pass.

```bash
git add apps/lookbook/src/styles/view-transitions.css apps/lookbook/src/layouts/Layout.astro apps/lookbook/src/layouts/VanillaDemo.astro scripts/lookbook/navViewTransitions.test.mjs
git commit -F - <<'EOF'
feat(lookbook): opt the explorer and the demos into cross-document view transitions

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hu8jLnxXLJxg8GrfqmAo4w
EOF
```

---

### Task 2: Pair the navbar elements of both pages by name

After this task the navbar morphs with the browser's default group animation (a crossfade of each pair while it moves); the choreography follows in Task 3.

**Files:**
- Modify: `apps/lookbook/src/components/LookbookHeader.astro`
- Modify: `apps/lookbook/src/components/SearchLookbook.astro` (`<style>` only)
- Modify: `apps/lookbook/src/components/DemoNavBar.astro`
- Modify: `apps/lookbook/src/layouts/Layout.astro` (`<head>`)
- Modify: `apps/lookbook/src/layouts/VanillaDemo.astro` (`<head>`)
- Test: `scripts/lookbook/navViewTransitions.test.mjs`

**Interfaces:**
- Consumes: `src(file)` from Task 1's test file.
- Produces:
  - the names of the Global Constraints on these elements: explorer `header.lookbook-header` (`lb-curtain`), `img.primary` (`lb-logo`), `img.secondary` (`lb-wordmark`), `.rainbow-line-container` (`lb-rainbow`), `.open-search-dialog-action` (`lb-search`), `.search-lookbook-dialog[open]` (`lb-dialog`); demo `.demo-nav-curtain` (`lb-curtain`), `.rainbow-line-container` (`lb-rainbow`), `.open-show-source-dialog-action img` (`lb-logo`), `.demo-caption-pre` / `.demo-caption-post` (`lb-caption-pre` / `lb-caption-post`), `.demo-nav-title` (`lb-demo-title`), `.show-source-dialog[open]` (`lb-dialog`)
  - ids `lb-explorer-nav` (sticky wrapper of `LookbookHeader`) and `lb-demo-nav` (`.demo-nav-bar`)
  - test helpers `declaredNames(source)`, `PAGES` for Task 3

- [ ] **Step 1: Write the failing tests**

Add to `scripts/lookbook/navViewTransitions.test.mjs`, above the `describe`:

```js
// the components that make up the navbar of each page, and the names the design pairs between them
const PAGES = {
  explorer: {
    components: ['components/LookbookHeader.astro', 'components/SearchLookbook.astro'],
    names: ['lb-curtain', 'lb-dialog', 'lb-logo', 'lb-rainbow', 'lb-search', 'lb-wordmark'],
  },
  demo: {
    components: ['components/DemoNavBar.astro'],
    names: ['lb-caption-post', 'lb-caption-pre', 'lb-curtain', 'lb-demo-title', 'lb-dialog', 'lb-logo', 'lb-rainbow'],
  },
};

/**
 * Every `view-transition-name: lb-…` of a source, with the text of the rule's selector (which
 * may carry the comment in front of it)
 *
 * @param {string} source
 * @returns {{selector: string, name: string}[]}
 */
const declaredNames = (source) =>
  [...source.matchAll(/([^{}]+)\{[^{}]*?view-transition-name:\s*(lb-[a-z-]+)/g)].map((m) => ({
    selector: (m[1] ?? '').trim(),
    name: m[2] ?? '',
  }));

/** @param {{components: string[]}} page */
const namesOf = (page) => page.components.flatMap((file) => declaredNames(src(file)));

/** @param {string} source @param {string} tag */
const count = (source, tag) => source.split(tag).length - 1;
```

and inside the `describe`:

```js
  for (const [page, spec] of Object.entries(PAGES)) {
    it(`the ${page} declares exactly the names of the design, each once`, () => {
      const declared = namesOf(spec)
        .map(({name}) => name)
        .sort();
      assert.deepEqual(declared, spec.names);
    });
  }

  it('renders each component that carries names once per page', () => {
    assert.equal(count(src('pages/index.astro'), '<LookbookHeader'), 1);
    assert.equal(count(src('components/LookbookHeader.astro'), '<SearchLookbook'), 1);
    assert.equal(count(src('layouts/VanillaDemo.astro'), '<DemoNavBar'), 1);
  });

  it('names a dialog only while it is open', () => {
    const dialogs = [...namesOf(PAGES.explorer), ...namesOf(PAGES.demo)].filter(({name}) => name === 'lb-dialog');
    assert.equal(dialogs.length, 2);
    for (const {selector} of dialogs) {
      assert.match(selector, /\[open\]$/, `lb-dialog is set on "${selector}", which matches a closed dialog too`);
    }
  });

  it('holds the first render of each layout until its navbar is parsed', () => {
    for (const [layout, component, id] of /** @type {[string, string, string][]} */ ([
      ['layouts/Layout.astro', 'components/LookbookHeader.astro', 'lb-explorer-nav'],
      ['layouts/VanillaDemo.astro', 'components/DemoNavBar.astro', 'lb-demo-nav'],
    ])) {
      assert.match(
        src(layout),
        new RegExp(`<link[^>]*rel="expect"[^>]*href="#${id}"[^>]*blocking`),
        `${layout} has no render-blocking <link rel="expect"> for #${id}`,
      );
      assert.match(src(component), new RegExp(`id="${id}"`), `${component} carries no element #${id}`);
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/lookbook/navViewTransitions.test.mjs`
Expected: the two "declares exactly the names" tests FAIL (actual `[]`), "names a dialog only while it is open" FAILS (0 ≠ 2), "holds the first render" FAILS; "renders each component … once" PASSES already (it guards a property the code has today).

- [ ] **Step 3: Name the explorer header**

In `apps/lookbook/src/components/LookbookHeader.astro`, the markup's wrapper gets the id:

```astro
<div id="lb-explorer-nav" class="z-50 sticky top-0 y-0">
```

In its `<style>`, replace the `.rainbow-line-container` rule and add the names:

```css
  .lookbook-header {
    background-color: var(--color-header-background);
    box-shadow: 0 0 20px #4c4c42;
    /* the roller blind of the view transition: the rainbow line below rolls it up into the
       top edge of a demo and pulls it down again on the way back */
    view-transition-name: lb-curtain;
  }

  /* right below the header, as high as the line itself: the demo's container has the same box
     at the top of the window, so the view transition moves the line instead of squashing it */
  .rainbow-line-container {
    --rainbow-line-height: 4px;
    position: absolute;
    top: 100%;
    left: 0;
    display: block;
    width: 100%;
    height: var(--rainbow-line-height);
    pointer-events: none;
    view-transition-name: lb-rainbow;
  }

  .lookbook-header img.primary {
    max-height: 48px;
    margin-left: 0.75rem;
    view-transition-name: lb-logo;
  }

  .lookbook-header img.secondary {
    filter: drop-shadow(0 0 2px #ccc) drop-shadow(0 0 15px #999);
    max-height: 48px; /* 66 */
    margin-left: 1rem;
    view-transition-name: lb-wordmark;
  }
```

(The existing `.lookbook-header`, `img.primary` and `img.secondary` rules are replaced by these; nothing else in them changes. The container's containing block is the sticky wrapper, which is exactly as high as the header, so `top: 100%` paints the line where `bottom: 0; height: 0` did.)

- [ ] **Step 4: Name the search button and the open search dialog**

In `apps/lookbook/src/components/SearchLookbook.astro`, add to the existing `.open-search-dialog-action { … }` rule:

```css
    view-transition-name: lb-search;
```

and add to the existing `.search-lookbook-dialog[open] { … }` rule:

```css
    /* fades out when a search result opens a demo */
    view-transition-name: lb-dialog;
```

- [ ] **Step 5: Add the curtain and the names to the demo navbar**

In `apps/lookbook/src/components/DemoNavBar.astro`, the markup from `<div class="demo-nav-bar">` to the end of its `<header>` becomes:

```astro
<div id="lb-demo-nav" class="demo-nav-bar">
  <div class="demo-nav-curtain" aria-hidden="true"></div>

  <div class="progressive-blur" aria-hidden="true">
    <div></div>
    <div></div>
    <div></div>
    <div></div>
  </div>

  <div class="rainbow-line-container">
    <RainbowLine shadow colorSliceWidth={32} cycleColors={RAINBOW_COLORS} />
  </div>

  <header class="lookbook-demo-header flex justify-start items-center gap-3 px-3 sm:gap-4 sm:px-4 lg:px-6">
    <figure class="flex shrink-0 items-center justify-start gap-1.5 text-slate-300">
      <figcaption class="demo-caption-pre">a</figcaption>
      <button class="interactive-action open-show-source-dialog-action">
        <img class="h-8" src={twopoint5d} alt="twopoint5d" />
      </button>
      <figcaption class="demo-caption-post">demo::</figcaption>
    </figure>

    <div class="demo-nav-title min-w-0 flex-1 truncate font-bold text-white">{title}</div>
  </header>
</div>
```

In its `<style>`, the `.rainbow-line-container` rule becomes:

```css
  .rainbow-line-container {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: var(--demo-layer-nav-bar);
    --rainbow-line-height: var(--demo-nav-bar-rainbow-line-height);
    /* as high as the line, like the explorer's container, so the view transition moves it */
    height: var(--rainbow-line-height);
    view-transition-name: lb-rainbow;
  }
```

and these rules join it, after `.open-show-source-dialog-action`:

```css
  /* the partner of the explorer's header in the view transition: no height and no paint of its
     own, the explorer's header background rolls up into it and comes down out of it */
  .demo-nav-curtain {
    position: fixed;
    inset: 0 0 auto 0;
    height: 0;
    view-transition-name: lb-curtain;
  }
  .open-show-source-dialog-action img {
    view-transition-name: lb-logo;
  }
  .demo-caption-pre {
    view-transition-name: lb-caption-pre;
  }
  .demo-caption-post {
    view-transition-name: lb-caption-post;
  }
  .demo-nav-title {
    view-transition-name: lb-demo-title;
  }
```

and the existing `.show-source-dialog { … }` rule is followed by:

```css
  /* fades out when "Explore LookBook" leaves the demo */
  .show-source-dialog[open] {
    view-transition-name: lb-dialog;
  }
```

- [ ] **Step 6: Hold the first render until the navbar is parsed**

In `apps/lookbook/src/layouts/Layout.astro`, in `<head>` after the `<title>`:

```astro
    <!-- the view transition from a demo takes its snapshot of this page once the navbar is parsed;
         a later page on this layout without the LookbookHeader renders when its document is parsed -->
    <link rel="expect" href="#lb-explorer-nav" blocking="render" />
```

In `apps/lookbook/src/layouts/VanillaDemo.astro`, in `<head>` after the `<title>`:

```astro
    <!-- the view transition from the explorer takes its snapshot of this page once the navbar is parsed -->
    <link rel="expect" href="#lb-demo-nav" blocking="render" />
```

- [ ] **Step 7: Run the tests and the type check**

Run: `node --test scripts/lookbook/navViewTransitions.test.mjs && pnpm nx typecheck lookbook`
Expected: all tests PASS; `astro check` reports 0 errors.

If `astro check` rejects the `blocking` attribute on `<link>` (it is missing from Astro's attribute types), write it as a spread in both layouts — the test still finds `blocking` in the tag:

```astro
    <link rel="expect" href="#lb-demo-nav" {...{blocking: 'render'}} />
```

- [ ] **Step 8: Look at it once in Chrome**

Run `pnpm lookbook` (dev server at `http://localhost:4321/lookbook`), open the explorer in Chrome, click a card, then use "Explore LookBook" in the demo's dialog. Expected: the header elements move/crossfade between their two places instead of jumping; the explorer looks unchanged at rest (the rainbow line sits exactly under the header, as before); a demo looks unchanged at rest; `?ui=0` on a demo shows no navbar and no stray curtain. The DevTools console shows no view-transition warning (a duplicate name would log `Unexpected duplicate view-transition-name`).

- [ ] **Step 9: Lint and commit**

Run: `pnpm lint`
Expected: pass.

```bash
git add apps/lookbook/src/components/LookbookHeader.astro apps/lookbook/src/components/SearchLookbook.astro apps/lookbook/src/components/DemoNavBar.astro apps/lookbook/src/layouts/Layout.astro apps/lookbook/src/layouts/VanillaDemo.astro scripts/lookbook/navViewTransitions.test.mjs
git commit -F - <<'EOF'
feat(lookbook): pair the navbar elements of the explorer and the demos for the view transition

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hu8jLnxXLJxg8GrfqmAo4w
EOF
```

---

### Task 3: Choreograph both directions

**Files:**
- Modify: `apps/lookbook/src/styles/view-transitions.css` (append)
- Create: `apps/lookbook/src/styles/view-transitions-into-demo.css`
- Create: `apps/lookbook/src/styles/view-transitions-to-explorer.css`
- Modify: `apps/lookbook/src/layouts/Layout.astro` (frontmatter)
- Modify: `apps/lookbook/src/layouts/VanillaDemo.astro` (frontmatter)
- Modify: `apps/lookbook/README.md`
- Modify: `AGENTS.md` (the `pnpm test:scripts` bullet)
- Test: `scripts/lookbook/navViewTransitions.test.mjs`

**Interfaces:**
- Consumes: tokens and keyframes of Task 1; names and helpers (`PAGES`, `namesOf`, `importsOf`, `src`) of Tasks 1–2.
- Produces: the two choreography stylesheets, each imported by exactly one layout.

- [ ] **Step 1: Write the failing tests**

Add to `scripts/lookbook/navViewTransitions.test.mjs`, above the `describe`:

```js
/**
 * The names a stylesheet addresses through `::view-transition-<part>(lb-…)`
 *
 * @param {string} css
 * @param {string} part `group`, `image-pair`, `old` or `new`
 */
const addressed = (css, part) =>
  new Set([...css.matchAll(new RegExp(`::view-transition-${part}\\((lb-[a-z-]+)\\)`, 'g'))].map((m) => m[1] ?? ''));

/** @param {{components: string[]}} page */
const nameSet = (page) => new Set(namesOf(page).map(({name}) => name));
```

and inside the `describe`:

```js
  it('lets each layout carry the choreography of the direction that ends on it', () => {
    const explorer = importsOf(src('layouts/Layout.astro'));
    const demo = importsOf(src('layouts/VanillaDemo.astro'));
    assert.ok(explorer.includes('../styles/view-transitions-to-explorer.css'));
    assert.ok(!explorer.includes('../styles/view-transitions-into-demo.css'));
    assert.ok(demo.includes('../styles/view-transitions-into-demo.css'));
    assert.ok(!demo.includes('../styles/view-transitions-to-explorer.css'));
  });

  for (const [file, from, to] of /** @type {[string, {components: string[]}, {components: string[]}][]} */ ([
    ['styles/view-transitions-into-demo.css', PAGES.explorer, PAGES.demo],
    ['styles/view-transitions-to-explorer.css', PAGES.demo, PAGES.explorer],
  ])) {
    it(`${file} addresses old images of the page it leaves and new images of the page it ends on`, () => {
      const css = src(file);
      for (const name of addressed(css, 'old')) {
        assert.ok(nameSet(from).has(name), `${file} animates the old image of ${name}, which the page it leaves never names`);
      }
      for (const name of addressed(css, 'new')) {
        assert.ok(nameSet(to).has(name), `${file} animates the new image of ${name}, which the page it ends on never names`);
      }
    });
  }

  it('addresses only names that one of the pages declares', () => {
    const declared = new Set([...nameSet(PAGES.explorer), ...nameSet(PAGES.demo)]);
    for (const file of [
      'styles/view-transitions.css',
      'styles/view-transitions-into-demo.css',
      'styles/view-transitions-to-explorer.css',
    ]) {
      const css = src(file);
      for (const part of ['group', 'image-pair', 'old', 'new']) {
        for (const name of addressed(css, part)) {
          assert.ok(declared.has(name), `${file} addresses ${name}, which no page declares`);
        }
      }
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test scripts/lookbook/navViewTransitions.test.mjs`
Expected: "lets each layout carry the choreography" FAILS; the two per-file tests FAIL with `ENOENT`; "addresses only names" FAILS with `ENOENT`.

- [ ] **Step 3: Append the shared rules to `view-transitions.css`**

```css
/* bottom to top above the root: the curtain and the line come down over the demo title, and
   the logo lies over the captions, so "demo::" slides out from behind it */
::view-transition-group(lb-demo-title) {
  z-index: 1;
}
::view-transition-group(lb-curtain) {
  z-index: 2;
}
::view-transition-group(lb-caption-pre),
::view-transition-group(lb-caption-post) {
  z-index: 3;
}
::view-transition-group(lb-rainbow) {
  z-index: 4;
}
::view-transition-group(lb-logo) {
  z-index: 5;
}
::view-transition-group(lb-wordmark),
::view-transition-group(lb-search) {
  z-index: 6;
}
::view-transition-group(lb-dialog) {
  z-index: 7;
}

/* the roller blind: the group's height runs between the explorer's 64px header and the demo's
   0px curtain, its top edge stays at 0 and the images stay anchored at the top, so the clip at
   the bottom edge cuts the header background off from below as the blind rolls up and reveals it
   from the top as it comes down. The other three sides leave room for the header's shadow. No
   fade: the height is the only motion */
::view-transition-group(lb-curtain) {
  clip-path: inset(-32px -32px 0 -32px);
}
::view-transition-old(lb-curtain),
::view-transition-new(lb-curtain) {
  animation: none;
}

/* <rainbow-line> draws from a worker into an OffscreenCanvas and loads its script async, so on
   the new page it is empty for its first frames. The old snapshot stays opaque all the way and
   covers for it; the new line fades in over it at the very end. Normal blending: under the
   default plus-lighter the two lines would add up to an overbright flash */
::view-transition-old(lb-rainbow) {
  animation: none;
  opacity: 1;
  mix-blend-mode: normal;
}
::view-transition-new(lb-rainbow) {
  animation: lb-fade-in 100ms linear calc(var(--lb-vt-duration) - 100ms) both;
  mix-blend-mode: normal;
}
```

- [ ] **Step 4: Write the explorer → demo choreography**

Create `apps/lookbook/src/styles/view-transitions-into-demo.css`:

```css
/* Explorer → demo, imported by the demo layout: the view transition that ends on a demo page
   takes this page's styles. The curtain, the line and the logo morph by the shared rules of
   view-transitions.css; here the parts that only one of the two pages has */

/* what the explorer's header holds and a demo's does not, and a search dialog left open */
::view-transition-old(lb-wordmark),
::view-transition-old(lb-search),
::view-transition-old(lb-dialog) {
  animation: lb-fade-out var(--lb-vt-fade) ease-out both;
}

/* "a" comes in from the left edge, "demo::" from behind the logo */
::view-transition-new(lb-caption-pre) {
  --lb-vt-slide-from: -2.5rem;
  animation: lb-slide-in-left 300ms var(--lb-vt-ease) 150ms both;
}
::view-transition-new(lb-caption-post) {
  --lb-vt-slide-from: -3.5rem;
  animation: lb-slide-in-left 250ms var(--lb-vt-ease) 200ms both;
}

::view-transition-new(lb-demo-title) {
  animation: lb-fade-in 200ms ease-out 250ms both;
}
```

- [ ] **Step 5: Write the demo → explorer choreography**

Create `apps/lookbook/src/styles/view-transitions-to-explorer.css`:

```css
/* Demo → explorer, imported by the explorer layout: the view transition that ends on the
   explorer takes this page's styles. The curtain and the line come down over the demo title by
   the shared rules of view-transitions.css; here the parts that only one of the two pages has */

/* the demo dialog, open while its "Explore LookBook" link is followed; its backdrop is part of the
   root and goes with the root's crossfade */
::view-transition-old(lb-dialog) {
  animation: lb-fade-out var(--lb-vt-fade) ease-out both;
}

::view-transition-old(lb-caption-pre) {
  --lb-vt-slide-from: -2.5rem;
  animation: lb-slide-out-left 250ms ease-in both;
}
::view-transition-old(lb-caption-post) {
  --lb-vt-slide-from: -3.5rem;
  animation: lb-slide-out-left 250ms ease-in both;
}

/* under the curtain that comes down over it */
::view-transition-old(lb-demo-title) {
  animation: lb-fade-out 200ms ease-out 100ms both;
}

::view-transition-new(lb-wordmark),
::view-transition-new(lb-search) {
  animation: lb-fade-in 200ms ease-out 250ms both;
}
```

- [ ] **Step 6: Import the choreographies**

In `apps/lookbook/src/layouts/Layout.astro`, below `import '../styles/view-transitions.css';`:

```astro
// the choreography of a view transition that ends on this layout: back from a demo to the
// explorer. Only index.astro uses this layout; a later page on it inherits that choreography
import '../styles/view-transitions-to-explorer.css';
```

In `apps/lookbook/src/layouts/VanillaDemo.astro`, below `import '../styles/view-transitions.css';`:

```astro
// the choreography of a view transition that ends on a demo: in from the explorer
import '../styles/view-transitions-into-demo.css';
```

The test's `importsOf` matches `^import\s+'…';` lines, so the comments above do not disturb it.

- [ ] **Step 7: Run the tests and the type check**

Run: `node --test scripts/lookbook/navViewTransitions.test.mjs && pnpm nx typecheck lookbook`
Expected: all tests PASS; `astro check` 0 errors.

- [ ] **Step 8: Document it in the README**

In `apps/lookbook/README.md`, insert before `## Checks`:

```markdown
## Navbar view transitions

Going from the explorer to a demo and back morphs the navbar through cross-document view
transitions: the rainbow line rolls the explorer's header up into the top edge of the demo,
and pulls it down over the demo title on the way back. Everything else crossfades. Both
layouts opt in through `src/styles/view-transitions.css`, which also holds the timing, the
keyframes and the rules both directions share.

The pseudo-elements of a transition take the styles of the page it ends on. The demo layout
therefore imports the choreography into a demo (`view-transitions-into-demo.css`), the
explorer layout the one back (`view-transitions-to-explorer.css`), and neither has to know
where it came from.

The browser pairs elements by `view-transition-name`. Each name is set in the component
that owns the element:

| Name | Explorer | Demo |
| --- | --- | --- |
| `lb-curtain` | the header (`LookbookHeader`) | `.demo-nav-curtain`, 0px high (`DemoNavBar`) |
| `lb-rainbow` | the rainbow line under the header | the rainbow line at the top |
| `lb-logo` | the twopoint5d logo | the twopoint5d logo |
| `lb-wordmark`, `lb-search` | the lookbook wordmark, the search button | — |
| `lb-caption-pre`, `lb-caption-post`, `lb-demo-title` | — | "a", "demo::", the title |
| `lb-dialog` | the open search dialog | the open demo dialog |

A name that occurs twice in one page makes the browser skip the whole transition, without an
error. `scripts/lookbook/navViewTransitions.test.mjs` (`pnpm test:scripts`) holds each page
to this table and the stylesheets to the names. A new navbar element either gets a name, a
row here and a place in both choreographies, or stays part of the root's crossfade.

Under `prefers-reduced-motion: reduce`, and in a browser without cross-document view
transitions, navigation is a plain page switch.
```

In `AGENTS.md`, the `pnpm test:scripts` bullet lists the specs of the lookbook one by one. After "one that holds the preview images of the lookbook to its demos, ids and card size," insert:

```markdown
  one that holds the view-transition names of the lookbook's navbar to its two pages and
  the stylesheets to those names,
```

(re-wrap the bullet so no line exceeds the width of its neighbours).

- [ ] **Step 9: Look at both directions in Chrome**

Run `pnpm lookbook`, then in Chrome: explorer → card → demo, demo dialog → "Explore LookBook". Expected, at normal speed: the line runs up with the header background behind it and the logo settles below it; the captions slide in, the title fades in; on the way back the line and the background come down over the title, the captions leave to the left, wordmark and search fade in. No overbright flash on the line at the end. Exact frame-by-frame review is Task 4.

- [ ] **Step 10: Lint and commit**

Run: `pnpm lint`
Expected: pass.

```bash
git add apps/lookbook/src/styles apps/lookbook/src/layouts/Layout.astro apps/lookbook/src/layouts/VanillaDemo.astro apps/lookbook/README.md AGENTS.md scripts/lookbook/navViewTransitions.test.mjs
git commit -F - <<'EOF'
feat(lookbook): roll the explorer header up into the demo navbar and down again

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hu8jLnxXLJxg8GrfqmAo4w
EOF
```

---

### Task 4: Verify in real browsers and settle the open snapshot questions

The spec lists seven points that depend on how browsers capture snapshots ("To verify during implementation"). This task checks each one against the built site, applies the documented fallback only where a check fails, and records the outcome in the final commit message.

**Files:**
- Create (scratchpad, not committed): `<scratchpad>/vt-frames.mjs`
- Modify only if a check fails: the files named in that check's fallback
- Test: `scripts/lookbook/navViewTransitions.test.mjs` stays green; `pnpm run ci`

**Interfaces:**
- Consumes: everything of Tasks 1–3.
- Produces: nothing new for other tasks; a verification record in the commit message.

- [ ] **Step 1: Build and serve the production site**

```bash
pnpm nx build lookbook
cd apps/lookbook && pnpm preview   # serves http://localhost:4321/lookbook, leave it running in the background
```

- [ ] **Step 2: Write the frame capture script**

Create `<scratchpad>/vt-frames.mjs` (run from the repo root with `node <scratchpad>/vt-frames.mjs <out-dir> [width] [height]`; it resolves `playwright` from the repo):

```js
import {mkdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const require = createRequire(path.join(process.cwd(), 'package.json'));
const {chromium} = require('playwright');

const [outDir = 'vt-frames', width = '1280', height = '800'] = process.argv.slice(2);
const BASE = 'http://localhost:4321/lookbook';
mkdirSync(outDir, {recursive: true});

const browser = await chromium.launch({
  args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan', '--use-angle=vulkan'],
});
const context = await browser.newContext({
  viewport: {width: Number(width), height: Number(height)},
  recordVideo: {dir: outDir, size: {width: Number(width), height: Number(height)}},
});
const page = await context.newPage();
const cdp = await context.newCDPSession(page);
// a tenth of the speed, per page and only for this page; set again after each navigation,
// because a new document may start with the default rate
const slow = async () => {
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', {playbackRate: 0.1});
};

const shoot = async (label) => {
  for (let i = 0; i < 12; i++) {
    await page.screenshot({path: path.join(outDir, `${label}-${String(i).padStart(2, '0')}.png`)});
    await page.waitForTimeout(400);
  }
};

await page.goto(`${BASE}/`);
await page.waitForTimeout(1500);
// leave from a scrolled explorer: the sticky header has to be captured at the top all the same
await page.mouse.wheel(0, 1200);
await page.waitForTimeout(500);
await slow();
page.on('framenavigated', () => void slow());
await Promise.all([page.locator('.link-card:not(.hidden) a').nth(8).click(), shoot('into-demo')]);

await page.waitForTimeout(1500);
await page.locator('button.open-show-source-dialog-action').click();
await page.waitForTimeout(500);
await slow();
await Promise.all([page.getByRole('link', {name: 'Explore LookBook'}).click(), shoot('to-explorer')]);

await page.waitForTimeout(1500);
await page.goBack();
await shoot('back-to-demo');
await page.goForward();
await shoot('forward-to-explorer');

await context.close();
await browser.close();
```

- [ ] **Step 3: Capture and review both directions, back and forward**

Run: `node <scratchpad>/vt-frames.mjs <scratchpad>/frames-desktop`
Then look at the PNGs (Read tool) of each label. If the screenshots show only start and end states (the playback rate did not hold across the navigation), extract frames from the recorded `.webm` instead: `ffmpeg -i <video>.webm -vf fps=30 <scratchpad>/frames-desktop/video-%03d.png`.

Expected for `into-demo` (left from a scrolled explorer): the header background shrinks from below while the line moves up with its lower edge; the logo shrinks in place and ends below the line; "a" and "demo::" slide in from the left, "demo::" from behind the logo; wordmark and search fade within the first third; the title fades in last; the line keeps its colors throughout and does not flash at the end.
Expected for `to-explorer`: the dialog fades within the first third; the line and the background come down together and cover the title before it is gone; the captions leave to the left; the logo grows back; wordmark and search fade in at the end.
Expected for `back-to-demo` / `forward-to-explorer`: the same two transitions on history traversal (a page restored from the bfcache included).

Then repeat the `to-explorer` part with the search dialog left open on the explorer: on the explorer, press Ctrl+K before clicking a card through the dialog's result list, go back with the browser's back button; expected: the transition plays, the restored search dialog fades in (or is closed), the console holds no `duplicate view-transition-name` error.

Check the seven spec points against these frames and the DevTools console, one by one:

1. **0px curtain captured** — the header background rolls up to the top instead of fading out. Fallback if it fades or vanishes at once: in `DemoNavBar.astro`, `.demo-nav-curtain { height: 1px; opacity: 0; }` (comment: a 0px element formed no group in <browser>).
2. **`backdrop-filter` in the header snapshot** — the rolling background looks like the header at rest. If it looks visibly lighter or patchy, the fallback in `LookbookHeader.astro`:
   ```html
   <script>
     // the snapshot of the header for the view transition into a demo leaves its backdrop blur
     // out: a denser background for the last frame of the page, cleared again on a bfcache return
     addEventListener('pageswap', () => document.documentElement.setAttribute('data-lb-leaving', ''));
     addEventListener('pageshow', () => document.documentElement.removeAttribute('data-lb-leaving'));
   </script>
   ```
   with `:global(:root[data-lb-leaving]) .lookbook-header { background-color: rgb(18 22 28 / 92%); }` in its `<style>`.
3. **Curtain clip** — the background never shows below the line. Fallback if `clip-path` on the group is ignored: `overflow: clip;` on `::view-transition-group(lb-curtain)` instead (the shadow is cut at the sides, which the line hides).
4. **Stacking order** — the line and the background lie over the title on the way back; the logo lies over "demo::". If the order is ignored, stop and report with frames: there is no CSS fallback within the spec.
5. **Custom properties on the pseudo-elements** — the timing matches the tables of the spec (the title fades in last, not at once). Fallback: replace each `var(--lb-vt-…)` in the three stylesheets with its literal value and drop the tokens.
6. **Dialog in the top layer** — the dialog fades as a whole while the backdrop crossfades with the root. Fallback if the dialog is not captured on its own (it vanishes in the first frame or the transition is skipped): in the `<script>` of `DemoNavBar.astro` and of `SearchLookbook.astro`, `addEventListener('pageswap', () => dialog.close());`, and drop the `[open]` names and the `lb-dialog` rows of the test's `PAGES`, the README table and both choreographies.
7. **Firefox** — Step 6.

After any fallback: `node --test scripts/lookbook/navViewTransitions.test.mjs`, rebuild, recapture, re-check.

- [ ] **Step 4: Narrow viewport**

Run: `node <scratchpad>/vt-frames.mjs <scratchpad>/frames-narrow 375 812`
Expected: the same choreography at 375px — the header (search button narrower, wordmark possibly smaller) and the demo title (truncated) still meet the curtain, the line and the logo without a jump at the start or the end of either direction.

- [ ] **Step 5: Reduced motion, `?ui=0`, `?preview=1`, the preview generator**

- In the frame script, `browser.newContext({…, reducedMotion: 'reduce'})` for one run (`<scratchpad>/frames-reduced`): expected a hard switch — the first screenshot after the click shows the new page at rest, no intermediate states.
- Open `http://localhost:4321/lookbook/demos/first-sprite/?ui=0` and `…?preview=1`: no navbar, no curtain, the demo as before.
- Run `pnpm lookbook:generate-previews --only=first-sprite` (it starts its own `astro preview` on a free port), then `git diff --stat apps/lookbook/public/images/demo-preview/`; expected: the run succeeds. Restore the image with `git checkout apps/lookbook/public/images/demo-preview/first-sprite.webp` — a regenerated preview is not part of this change.

- [ ] **Step 6: Safari (macOS and iOS) and Firefox**

- Safari: use the `testing-on-mac-safari` skill against the preview server (both directions, back button, and the swipe-back gesture on iOS and on a macOS trackpad). If the Mac cannot be reached, record "Safari not verified: Mac unreachable" for the commit message and the report — do not mark it as passed.
- Firefox: run the frame script with `firefox` instead of `chromium` (Playwright's Firefox is installed for `pnpm test:browser`). Expected: either both transitions play, or a clean hard switch with no flash and no broken layout. Record which.

- [ ] **Step 7: Full gate**

Run: `pnpm run ci`
Expected: passes.

- [ ] **Step 8: Commit (only if Steps 3–6 changed files)**

```bash
git add <the files the applied fallbacks touched>
git commit -F - <<'EOF'
fix(lookbook): <what the fallback does, e.g. give the demo's curtain 1px so Chrome forms a group for it>

Verified: Chrome <version> both directions, history traversal, 375px, reduced motion;
Safari <version or "not verified: …">; Firefox <version>: <transitions | hard switch>.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01Hu8jLnxXLJxg8GrfqmAo4w
EOF
```

If no fallback was needed, there is nothing to commit; the verification record goes into the final report to the user instead. Stop the preview server.

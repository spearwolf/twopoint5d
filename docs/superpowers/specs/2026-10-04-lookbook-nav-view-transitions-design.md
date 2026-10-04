# Lookbook navbar view transitions — design

Status: approved in brainstorming, 2026-10-04

## Goal

Going from the lookbook overview (the explorer, `pages/index.astro`) to a demo and back
replaces the whole document. Today the top navbar jumps from one shape to the other. With
this change the navbar morphs between its two shapes. The cards grid and the demo canvas
keep the browser's default crossfade. Everything below the navbar is out of scope.

The two navbars differ in one telling way. In the explorer, the rainbow line is the
**bottom edge** of a 4rem header with a background of its own. In a demo, the rainbow line
is a 3px line at the **top** of the window, with the logo and the title below it. The
transition treats the header background as a roller blind and the rainbow line as its
bottom edge.

**Explorer → demo**

- The rainbow line moves up from the bottom of the header to the top of the window, and
  it rolls the header background up with it.
- The twopoint5d logo shrinks from 48px to 32px and stays where it is vertically. It ends
  up below the line, so relative to the line it moves down.
- The captions around the logo (`a`, `demo::`) slide in from the left.
- The lookbook wordmark and the search button fade out. The demo title fades in late.

**Demo → explorer** (the "Explore LookBook" link or the logo link in the demo dialog, and
the browser's back button)

- The rainbow line moves down and pulls the header background down with it. Together they
  cover the demo title, which fades out underneath.
- The logo grows back to 48px.
- The captions slide out to the left. The wordmark and the search button fade in.
- An open dialog (the demo dialog, or the search dialog on the way into a demo) fades out
  quickly.

Success means:

- in a browser with cross-document view transitions, both directions play as described,
  and so do back and forward, including a page restored from the bfcache;
- in a browser without them, and under `prefers-reduced-motion: reduce`, navigation stays
  the hard switch it is today, with no flash and no broken layout;
- a demo opened directly, with `?ui=0` or with `?preview=1`, looks and behaves exactly as
  before, so `pnpm lookbook:generate-previews` is not affected;
- no change to a single demo page and no JavaScript in the navigation path.

Out of scope: transitions of the cards grid or the demo canvas beyond the default
crossfade, transitions between two demos (there is no link between demos today), and a
JavaScript fallback for browsers without cross-document view transitions.

## Approach

Native **cross-document view transitions**. Both layouts opt in with
`@view-transition { navigation: auto; }`. The navbar elements get paired
`view-transition-name`s, and the choreography is CSS on the `::view-transition-*`
pseudo-elements.

Rejected:

- **Astro's `<ClientRouter />`** would turn the lookbook into a single-page app. Every demo
  would then have to tear down its `Display`, its workers and its listeners on
  `astro:before-swap`, and its module scripts run only once per session. That is a rewrite
  of 18 demos for a header animation.
- **A hand-made intro animation** (a `sessionStorage` flag set on click, a WAAPI animation
  on the next page) cannot animate the outgoing page, so the morph, which is the point of
  the effect, is impossible.

### Why no direction detection is needed

In a cross-document view transition, the pseudo-element tree lives in the **new**
document and is styled by the new document's stylesheets. The outgoing page only decides
which of its elements get captured, through their `view-transition-name`. The demo layout
therefore carries the choreography of "into a demo", and the explorer layout the
choreography of "back to the explorer". Neither needs to know where it came from.

`Layout.astro` serves `index.astro` only. A later page on that layout would inherit the
"back to the explorer" choreography, so the import has a comment saying so.

## Current state

- `LookbookHeader.astro`: a `div.sticky.top-0.z-50` around
  `header.lookbook-header` (h-16, `--color-header-background`, `box-shadow: 0 0 20px`,
  `backdrop-blur-xs`). The header holds `img.primary` (twopoint5d logo, max-height 48px),
  `img.secondary` (lookbook wordmark), `<SearchLookbook />` and `.rainbow-line-container`
  (`position: absolute; bottom: 0; height: 0`, line at the default 4px).
- `DemoNavBar.astro`: `.demo-nav-bar` (`display: contents`) holds `.progressive-blur`,
  `.rainbow-line-container` (`position: fixed; inset: 0 0 auto 0`, line 3px through
  `--demo-nav-bar-rainbow-line-height`, height from its content), and
  `header.lookbook-demo-header` with a `figure` (`figcaption` "a", the logo button with
  `img.h-8`, `figcaption` "demo::") and the title `div`. The `<dialog>` after it repeats
  a similar figure; that one is not part of the transition.
- `<rainbow-line>` (`public/js/rainbow-line-v0.6.0.js`) draws into an `OffscreenCanvas`
  from a worker. Its script loads `async type="module"`, so on a freshly loaded page the
  element is undefined at first and empty for the first frames after that.
- Both pages navigate through plain `<a href>`; the search dialog also calls
  `window.location.assign()` on Enter. Both are same-origin navigations and are covered
  by `navigation: auto`.

## Elements and names

All names carry the prefix `lb-`. Each name is set in the component that owns the
element, in that component's `<style>`. A name is unique per document, so `lb-dialog` is
set on `dialog[open]` only, and no page has two open dialogs.

| Name | Explorer (`LookbookHeader`, `SearchLookbook`) | Demo (`DemoNavBar`) |
| --- | --- | --- |
| `lb-curtain` | `header.lookbook-header` | new `div.demo-nav-curtain`, fixed at the top, height 0 |
| `lb-rainbow` | `.rainbow-line-container` | `.rainbow-line-container` |
| `lb-logo` | `img.primary` | the logo `img` in `.open-show-source-dialog-action` |
| `lb-wordmark` | `img.secondary` | — |
| `lb-search` | `.open-search-dialog-action` | — |
| `lb-caption-pre` | — | `figcaption` "a" of the navbar header |
| `lb-caption-post` | — | `figcaption` "demo::" of the navbar header |
| `lb-demo-title` | — | the title `div` |
| `lb-dialog` | `dialog.search-lookbook-dialog[open]` | `dialog.show-source-dialog[open]` |

A named descendant is cut out of its ancestor's snapshot. The `lb-curtain` snapshot of the
explorer header therefore holds only the background and the shadow.

The captions get a class each (`demo-caption-pre`, `demo-caption-post`), so the selectors
do not reach the figure inside the dialog.

### Geometry the morph relies on

- **Rainbow container.** Both containers get the same box: `height:
  var(--rainbow-line-height)`, with `--rainbow-line-height: 4px` set explicitly on the
  explorer side, where today it falls back to the component's default. In the explorer
  the container moves from `bottom: 0; height: 0` to `top: 100%` with that height, which
  paints the line at the same place as before. The morph of `lb-rainbow` is then a
  translation plus a 4px → 3px change of height, not a squash of a 0px box. The blurred
  shadow line overflows the box and is captured as ink overflow.
- **Curtain.** `div.demo-nav-curtain` sits inside `.demo-nav-bar`, so `?ui=0` hides it
  with the rest. It is `position: fixed; inset: 0 0 auto 0; height: 0` and paints
  nothing. The group of `lb-curtain` animates from the 64px header box to this 0px box,
  and back.

## Choreography

### Files

- `apps/lookbook/src/styles/view-transitions.css` — imported by both layouts: the
  `@view-transition` opt-in, the reduced-motion opt-out, the timing tokens, the
  keyframes, the stacking order of the groups and the rules both directions share
  (curtain clip, rainbow snapshots).
- `apps/lookbook/src/styles/view-transitions-into-demo.css` — imported by
  `VanillaDemo.astro`.
- `apps/lookbook/src/styles/view-transitions-to-explorer.css` — imported by
  `Layout.astro`.

### Shared rules

```css
@view-transition {
  navigation: auto;
}
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

::view-transition-group(*) {
  animation-duration: var(--lb-vt-duration);
  animation-timing-function: var(--lb-vt-ease);
}
```

- **Curtain.** `::view-transition-group(lb-curtain)` gets
  `clip-path: inset(-32px -32px 0 -32px)`: it clips exactly at the group's bottom edge,
  where the rainbow line runs, and leaves room for the 20px shadow on the other three
  sides. (`overflow-clip-margin` would widen the clip at the bottom too and let the
  background show below the line.) Its old and new images get
  `animation: none`, so the group's own height animation is the only motion. The group's
  top edge stays at 0 while its height shrinks, and the images stay anchored at the top,
  so the clip cuts the header background off from below: the blind rolls up. Growing,
  the group reveals the background from the top down.
- **Rainbow.** `::view-transition-old(lb-rainbow)` gets `animation: none; opacity: 1`
  and stays opaque for the whole transition. `::view-transition-new(lb-rainbow)` fades
  in over the last 100ms (`animation-delay: calc(var(--lb-vt-duration) - 100ms)`). Both
  images get `mix-blend-mode: normal`: under the default `plus-lighter`, an opaque old
  line plus a fading-in new one would add up to an overbright flash. The
  new line may still be empty while it moves, as described under "Current state", and
  the old snapshot covers for it. For 450ms the frozen colors of the old snapshot are not
  noticeable.
- **Stacking order** of the groups, bottom to top, through `z-index` on
  `::view-transition-group(…)`: root, `lb-demo-title`, `lb-curtain`, `lb-caption-pre`,
  `lb-caption-post`, `lb-rainbow`, `lb-logo`, `lb-wordmark`, `lb-search`, `lb-dialog`.
  The curtain and the line cover the title. The logo lies over the captions, so
  `demo::` slides out from behind it.

Keyframes: `lb-fade-in`, `lb-fade-out`, `lb-slide-in-left` (from
`translateX(var(--lb-vt-slide-from)); opacity: 0`), `lb-slide-out-left` (the reverse).
`--lb-vt-slide-from` is set per caption: off-screen for `a`, and from behind the logo
for `demo::`. Exact values are tuned against the running app.

### Explorer → demo (`view-transitions-into-demo.css`)

| Element | Animation | Time |
| --- | --- | --- |
| `lb-curtain`, `lb-rainbow`, `lb-logo` | group morph | 0–450ms |
| `lb-wordmark`, `lb-search` (old only) | `lb-fade-out` | 0–150ms |
| `lb-dialog` (old only, search dialog) | `lb-fade-out` | 0–150ms |
| `lb-caption-pre` (new only) | `lb-slide-in-left` | 150–450ms |
| `lb-caption-post` (new only) | `lb-slide-in-left` | 200–450ms |
| `lb-demo-title` (new only) | `lb-fade-in` | 250–450ms |
| root | default crossfade | 0–450ms |

### Demo → explorer (`view-transitions-to-explorer.css`)

| Element | Animation | Time |
| --- | --- | --- |
| `lb-curtain`, `lb-rainbow`, `lb-logo` | group morph | 0–450ms |
| `lb-dialog` (old only, demo dialog) | `lb-fade-out` | 0–150ms |
| `lb-caption-pre`, `lb-caption-post` (old only) | `lb-slide-out-left` | 0–250ms |
| `lb-demo-title` (old only) | `lb-fade-out` | 100–300ms |
| `lb-wordmark`, `lb-search` (new only) | `lb-fade-in` | 250–450ms |
| root | default crossfade, which takes the dialog's backdrop with it | 0–450ms |

## First frame of the new page

Both layouts get a render-blocking expectation for their navbar, so the browser does not
take the new snapshot before the navbar is parsed:

```html
<link rel="expect" href="#lb-demo-nav" blocking="render" />
```

`#lb-demo-nav` is the `.demo-nav-bar` wrapper, and `#lb-explorer-nav` is the sticky
wrapper of `LookbookHeader`. The expectation releases when the element's closing tag is
parsed. A browser that does not know `rel="expect"` ignores it.

## Edge cases

- **`?ui=0` / `?preview=1`.** `.demo-nav-bar` is `display: none`, so none of the demo's
  names is rendered and nothing pairs. The root still crossfades. Neither mode is reached
  by navigation in practice, and the preview generator loads each page directly.
- **Scrolled explorer.** The header is sticky, so it is captured at the top of the
  viewport whatever the scroll position. Back to the explorer restores the scroll
  position, and the header is at the top there too.
- **bfcache.** A page restored from the bfcache takes part in the transition like a fresh
  one. If the search dialog was open when the explorer was left, it is open again on
  return; `lb-dialog` is then new-only and fades in with the default animation.
- **Swipe-back in Safari (iOS, macOS trackpad).** The browser plays its own gesture
  animation. Whether a view transition runs on top of it is checked on a device.
- **An open dialog on the page left behind.** "Explore LookBook" lives in the demo dialog,
  so that path always starts with the dialog open (and a search result, with the search
  dialog open). The dialog's `::backdrop` is part of the root snapshot, and every named
  navbar group is drawn above the root: on the first frame the navbar shows untinted over
  the backdrop, which then crossfades out with the root. Accepted — taking the navbar
  names away while a dialog is open would drop the morph on exactly this path, and closing
  the dialog in `pageswap` would put JavaScript into the navigation path.
- **Middle click / new tab.** No transition, as before.

## To verify during implementation

These points depend on how browsers capture snapshots, and they are verified, not
assumed:

1. A 0px-high element with a `view-transition-name` (the demo curtain) is captured and
   forms a group. If not, it gets a 1px height and `opacity: 0`.
2. The explorer header's `backdrop-filter` in its snapshot: the snapshot may show the
   header without the blur. At 65% background opacity that is acceptable. If it looks
   wrong, the curtain gets a solid background for the duration of the transition.
3. `clip-path` on a `::view-transition-group` clips the curtain at its bottom edge as
   intended.
4. `z-index` on `::view-transition-group(…)` orders the groups in every target browser.
5. Custom properties on `:root` reach the `::view-transition-*` pseudo-elements.
6. A dialog in the top layer with a `view-transition-name` is captured on its own, and
   its `::backdrop` falls into the root snapshot.
7. Firefox: whether the current release supports cross-document view transitions (the
   sources disagree). With support, both directions play. Without it, navigation is the
   hard switch of today.

## Testing

There is no meaningful unit test for an animation, and the lookbook has no browser test
suite of its own. Verification is manual and recorded in the commit:

- **Chrome**, through the DevTools MCP: slow the animations down per page with the CDP
  call `Animation.setPlaybackRate` (0.1) and take screenshots at several points in both
  directions, with the back button and with a bfcache restore. Nothing loads the machine
  to slow things down.
- **Safari on macOS and on iOS** through the `testing-on-mac-safari` skill, including the
  swipe-back gesture.
- **Firefox**: the transition if it is supported, otherwise a clean hard switch.
- `prefers-reduced-motion: reduce` emulated in Chrome: a hard switch.
- A demo with `?ui=0` and with `?preview=1` looks as before;
  `pnpm lookbook:generate-previews --only=first-sprite` still runs.
- `pnpm run ci` passes.

## Documentation

`apps/lookbook/README.md` gets a short section "Navbar view transitions": the table of
name pairs, the rule that the new page's stylesheet carries the choreography, and the
note that a new navbar element either gets a name and a place in both choreographies or
stays part of the root crossfade.

# Proposal: native fullscreen for a display — `display.fullscreen`

Status: **phase A, B and the deprecation of phase C implemented** — see
[`docs/display.md`](../display.md), "Fullscreen" and the cheat sheet "The fullscreen"; the Vitest
specs `src/display/DisplayFullscreen.spec.ts` and `src/display/Display.spec.ts` ("fullscreen"), the
browser test `packages/twopoint5d-testing/test/display-fullscreen.test.js`. Open: the device checks
of §2.3, §7 and §10, the viewport measurement of §10, and the lookbook of §11 (phase D). From the
Trello card "Resize-Verhalten modernisieren (Fullscreen)" of the board list `display`. Deviations of
the build from the first draft of this spec, which the sections below now state as built:

- the prefixes of the pseudo classes are statics of `DisplayFullscreen`, not of `Display`, so the
  controller does not import the display at runtime (§7);
- `Display#onFullscreenChange()` beside the event, as for every other event of the display (§3.2);
- the size source also follows the state the controller reports, because the promise of a request
  or an exit resolves before `fullscreenchange` (§5);
- a canvas that measured a fullscreen parent gets back its inline size when the fullscreen is left
  (§5);
- every leave in landscape of a fullscreen `onLandscape` entered holds off the arming, an exit
  button of the page included (§6.3);
- with only the pseudo mode there, a page that loads in landscape enters it at once (§6.2);
- the `overflow:hidden` of the root element lives in the sheet of the document, not in
  `styleSheetRoot` (§7).

A display can follow the size of the window today (`resize-to="window"`), but it cannot put
anything on the whole screen: `resize-to="fullscreen"` only means "as large as the window, at
`position: fixed`". A game on a phone wants the browser's bars gone, and it wants them gone when
the phone turns sideways, without a button to hunt for. `display.fullscreen` asks the browser for
its native fullscreen, toggles it, follows it when the user leaves it, enters it on its own when the
screen turns to landscape, and falls back to a fullscreen of CSS where the browser has none and the
app asked for it.

## 1. Goal

| who | what they get | § |
| --- | --- | --- |
| a game or a demo with a fullscreen button | `display.fullscreen.toggle()` in the click handler; the button reads `isAvailable` and `isActive` and listens to `OnDisplayFullscreenChange` | 3 |
| a game on a phone that wants the whole screen in landscape | `fullscreen: {onLandscape: true}`: the turn to landscape enters fullscreen, or the next tap does where the browser asks for a gesture; the turn back leaves it | 6 |
| a game that only plays in landscape | `orientationLock: 'landscape'`: once in native fullscreen, the screen stays sideways | 6.4 |
| an app on an iPhone, or in an iframe without `allow="fullscreen"` | `fallback: 'pseudo'`: the target covers the viewport through CSS, with the same API and the same event | 7 |
| pixel art under `Display#pixelZoom` | a fullscreen target that is not the canvas, so the zoom keeps whole pixels (§4), and a size source that follows the fullscreen (§5) | 4, 5 |
| a page with HTML over its canvas | the default target is the element around the canvas, so the HTML stays on screen | 4 |

## 2. The platform

Six facts shape everything below.

1. **`requestFullscreen()` needs transient user activation.** The call has to happen synchronously
   in the handler of an activating event — `click`, `keydown` other than Escape, `pointerup` of a
   pointer that is not a mouse, `pointerdown` of a mouse, `touchend` — or within the few seconds of
   activation that follow one. A `request()` that awaits anything before it calls the browser loses
   the gesture. `exitFullscreen()` needs no activation.
2. **A turn of the screen may count as a gesture.** The fullscreen spec once allowed a request
   triggered by a user-generated orientation change, and Chrome on Android was reported in 2022 to
   special-case `requestFullscreen()` from a `screen.orientation` `change` handler. Whether that still
   holds in current Chrome, and whether any other browser does it, is not settled. §6.2 is built so
   that it works either way: it tries at once and falls back to the next tap.
3. **The iPhone has no element fullscreen, as far as is known.** Safari on the iPhone has long
   offered fullscreen for `<video>` only; a beta of Safari 17.2 had the Fullscreen API on the iPhone
   and lost it again. A claim that iOS 26 brings "true fullscreen for games" comes from a secondary
   source. `isSupported` is feature detection and nothing else — no sniffing of the user agent: what
   `fullscreenEnabled` and `requestFullscreen` report is what the controller believes. Phase A
   checks on the iOS simulator what an iPhone reports and whether a request then works; the guide
   states the result, the code does not depend on it. An iPhone without the API gets §7. iPadOS and
   macOS Safari have the unprefixed API since 16.4.
4. **The browser restyles the fullscreen element.** The UA stylesheet gives an element in fullscreen
   (other than the root) `position: fixed`, `inset: 0`, `width` and `height` of `100%`,
   `object-fit: contain` and `transform: none`, all `!important`. A UA declaration with
   `!important` beats an author declaration with `!important`, the inline style of the display
   included. §4 draws the consequence.
5. **`fullscreenEnabled` is `false` in an iframe** that lacks `allow="fullscreen"`, and every request
   from it fails.
6. **Shadow DOM retargets.** `document.fullscreenElement` names the shadow host when the element in
   fullscreen sits in a shadow root; the shadow root's own `fullscreenElement` names the element.
   Every check below asks the root node of the element in question
   (`element.getRootNode().fullscreenElement`), never the document directly.

## 3. API

### 3.1 The option

`DisplayParameters` gains `fullscreen`, read once by the constructor:

```ts
export type FullscreenMode = 'native' | 'pseudo';

// the values of `screen.orientation.lock()`; spelled out here because the DOM lib of TypeScript
// does not carry `lock()` and its type
export type DisplayOrientationLock =
  | 'any' | 'natural' | 'landscape' | 'portrait'
  | 'portrait-primary' | 'portrait-secondary' | 'landscape-primary' | 'landscape-secondary';

export interface DisplayFullscreenOptions {
  /** The element that goes fullscreen. Default: see §4. */
  element?: HTMLElement;
  /** Passed to `requestFullscreen()`. Default `'hide'`: a game wants the navigation bar gone. */
  navigationUI?: 'auto' | 'hide' | 'show';
  /** Locks the screen once native fullscreen is entered, §6.4. Default: no lock. */
  orientationLock?: DisplayOrientationLock;
  /** `'pseudo'` covers the viewport through CSS where native fullscreen is not available, §7. Default `false`. */
  fallback?: 'pseudo' | false;
  /** Enter fullscreen when the screen turns to landscape, §6. Default `false`. */
  onLandscape?: boolean;
  /**
   * Leave a fullscreen that `onLandscape` entered when the screen turns back to portrait, §6.3.
   * Default `true`, or `false` while `orientationLock` is a landscape type, §6.4.
   */
  exitOnPortrait?: boolean;
}

interface DisplayParameters {
  // …
  fullscreen?: DisplayFullscreenOptions;
}
```

### 3.2 The controller

`src/display/DisplayFullscreen.ts`, exported from `src/display/public-api.ts`. The display builds it
in its constructor and keeps it for its life; `Display.ts` does not grow by the logic of §5 to §7
beyond the size source rule of §5.

```ts
export class DisplayFullscreen {
  readonly display: Display;

  /** The browser offers native fullscreen here: `fullscreenEnabled` of the document, and `requestFullscreen` on the target. */
  get isSupported(): boolean;
  /** A `request()` can succeed: `isSupported`, or `fallback` is `'pseudo'`. What a fullscreen button shows itself by. */
  get isAvailable(): boolean;

  /** The target is in fullscreen right now, native or pseudo, by this controller or by anyone. */
  get isActive(): boolean;
  /** How it is: `'native'`, `'pseudo'`, or `undefined` while not active. */
  get mode(): FullscreenMode | undefined;
  /** `onLandscape` waits for a tap to enter fullscreen, §6.2. A page can show a hint by it. */
  get isArmed(): boolean;

  // the options of §3.1, writable at any time; a new `element` takes effect with the next request,
  // a fullscreen in progress stays on the element it entered with
  element: HTMLElement;
  navigationUI: 'auto' | 'hide' | 'show';
  orientationLock: DisplayOrientationLock | undefined;
  fallback: 'pseudo' | false;
  onLandscape: boolean;
  exitOnPortrait: boolean;

  /** Enter fullscreen. Resolves with `isActive` afterwards; never rejects, §3.4. */
  request(): Promise<boolean>;
  /** Leave a fullscreen of the target. Resolves with `isActive` afterwards — `false` once left. */
  exit(): Promise<boolean>;
  /** `exit()` while active, `request()` otherwise. Resolves with `isActive` afterwards. */
  toggle(): Promise<boolean>;
}

class Display {
  /** The fullscreen of this display. Throws after `dispose()`, as the other members do. */
  get fullscreen(): DisplayFullscreen;
  /** Subscribes to `OnDisplayFullscreenChange`. */
  readonly onFullscreenChange: (listener: (props: DisplayFullscreenChangeProps) => unknown) => UnsubscribeFunc;
}
```

`request()` calls `element.requestFullscreen({navigationUI})` synchronously, before its first
`await`, so the gesture of the caller reaches the browser (§2.1). It reads no layout and waits for
no renderer; a `request()` before `start()` works.

`isActive` in native mode is `element.getRootNode().fullscreenElement === element` (§2.6): the
target is the top fullscreen element of its root. A fullscreen that another element of the page
stacks on top of the target makes `isActive` `false` until it is left again; `exit()` does not pop
a fullscreen that is not the target's.

### 3.3 The event

`src/events.ts` gains `OnDisplayFullscreenChange = 'fullscreenChange'` and its interface:

```ts
export interface DisplayFullscreenChangeProps {
  display: Display;
  isActive: boolean;
  mode: FullscreenMode | undefined;
  isArmed: boolean;
  element: HTMLElement;
}

export interface IOnDisplayFullscreenChange {
  [OnDisplayFullscreenChange](props: DisplayFullscreenChangeProps): void;
}
```

It goes out whenever `isActive`, `mode` or `isArmed` changes — from a `request()`, from Escape, from
the back gesture of Android, from an `exitFullscreen()` of someone else, from §6. It is `retain`ed,
so a button attached later hears the state it has to show. The state always comes from the
`fullscreenchange` event of the target's document, never from what a call of this controller
expected: a fullscreen the browser refused emits nothing.

### 3.4 Refusal

`request()` resolves with `false` instead of rejecting. A rejection would turn every
`button.onclick = () => display.fullscreen.toggle()` into an unhandled rejection, and a refusal is
an ordinary outcome on the web — a missing gesture, an iframe, a phone. The developer hears why,
once per page, through `console.warn`, after the pattern of the warning about
`Display.MaxResolution`:

- a refused native request: the message names the user activation and the synchronous call (§2.1);
- a request where `isAvailable` is `false`: the message names the iframe attribute, the iPhone, and
  `fallback: 'pseudo'`.

A request while already active resolves with `true` and changes nothing.

## 4. The target element

The default target is the element around the canvas:

- a display built around a host element: the host;
- a display built around a canvas, or around a `WebGPURenderer`: the parent element of the canvas at
  the time of the request, or the canvas where it has none.

The canvas itself makes a poor target, by §2.4. The browser forces it to `100%` of the screen with
`object-fit: contain`, over the inline size the display writes. Under `Display#pixelZoom` the
display shrinks the CSS size of the canvas to whole pixels of the drawing buffer; in fullscreen that
size is overridden, and the buffer is stretched by a fraction — the pixel art loses its whole
pixels. HTML that sits beside the canvas — a HUD, `<demo-ui>` in the lookbook — leaves the screen
with everything else that is not the target.

An app that names the canvas as `element` gets what it asks for. The guide says what that costs.

In the lookbook the canvas of a demo page sits in `<body>` with `resize-to="window"`: the default
target is the body, the canvas stays at `position: fixed` and the size of the window, which in
fullscreen is the size of the screen, and the navbar and `<demo-ui>` stay on screen.

## 5. The size source during fullscreen

The resize model (`Display.ts`, the class comment "Resize model") resolves the size source from the
`resize-to` attribute, `resizeToCallback` and `resizeToElement`. One rule joins it:

> While an element that contains the canvas is in fullscreen — native, by anyone, or pseudo by this
> display — and the size source is an element outside that fullscreen element, or the canvas itself
> while the fullscreen element is not the canvas, the display measures the fullscreen element
> instead.

"Contains" and "outside" go across shadow boundaries: the containing fullscreen element is the
nearest inclusive ancestor of the canvas, through shadow hosts, that is the `fullscreenElement` of
its root node (§2.6) or the pseudo target of this display.

Why: with the canvas as target and its parent as size source, the parent keeps its size while the
canvas covers the screen; the drawing buffer would stay the size of the parent. A canvas that is its
own size source — the default of a display built around a canvas or a `WebGPURenderer` — measures
the inline size the display wrote into it, not a size of the layout; with its parent as the default
target (§4) it would keep its old size in a corner of a screen-sized parent. Any other size source
inside the fullscreen element needs nothing — it follows the fullscreen through layout, and the
`ResizeObserver` reports it.

A canvas that measures the fullscreen element gets its size, not its position: siblings in front of
it or a padding of the parent push it partly off the screen. The guide recommends
`resize-to="window"` or a host element for a page whose canvas shares its parent.

What the rule leaves alone:

- `resize-to="window"`: in native fullscreen the window is the screen;
- `resizeToCallback`: what it answers still wins, as it does over every element.

A canvas that measured a fullscreen parent gets back the inline size — and the zoom bookkeeping of a
canvas that measures itself under a `pixelZoom` — it had before, once the fullscreen is left; else it
would read back the size of the screen and keep it.

The containing fullscreen element is worked out on every `fullscreenchange` of the document of the
canvas, on every enter and exit of the pseudo mode, and on every change of state the controller
reports — not in every frame. The last one is needed: the promise of `requestFullscreen()` and of
`exitFullscreen()` resolves before the browser fires `fullscreenchange` (Firefox and WebKit on
entering, Chromium on leaving), and a `resize()` right after the promise would measure the old
state. Each of these marks the
size dirty, so the next frame measures; the observer then watches the fullscreen element as it
watches any size source. The display listens to `fullscreenchange` from its constructor on, whether
or not anyone uses `display.fullscreen`: the rule holds for a fullscreen the app enters on its own.

## 6. Fullscreen on landscape

### 6.1 Which devices

The orientation is that of the screen, not of the viewport: a desktop window wider than tall
matches `(orientation: landscape)`. The controller reads `screen.orientation.type` and its `change`
event; where `screen.orientation` does not exist, the media query `(orientation: landscape)` and its
`change`.

`onLandscape` acts only where `matchMedia('(pointer: coarse) and (hover: none)')` matches: a device
whose primary input is a finger. Desktops stay out, tablets come in; no heuristic tells a phone from
a tablet reliably, and the guide says so. The query is read anew at every turn, so a tablet that
gets a mouse and a keyboard stops entering fullscreen.

The listeners for the orientation and the query exist only while `onLandscape` is `true`.

### 6.2 Entering

Every turn to landscape, with the gate of §6.1 open and the target not active:

1. **Try at once.** `request()` from the `change` handler of the orientation (§2.2). Where it
   succeeds, done.
2. **Arm.** Where native fullscreen refuses, the controller arms: `isArmed` turns `true`, the event
   goes out, and a listener waits on the target for the next `pointerup` of a non-mouse pointer or
   `click` — in the capture phase, passive, without `preventDefault()`, so the tap reaches the game
   as well. That tap calls `request()` synchronously in its handler and disarms, whether the
   request succeeds or not.

A page that loads in landscape arms at construction and does not try at once: no turn has
happened, and nothing grants an exemption. `onLandscape` set to `true` later does the same.

Where native fullscreen is not available and `fallback` is `'pseudo'`, the pseudo mode needs no
gesture: the turn enters it at once and never arms, and a page that loads in landscape enters it at
construction.

### 6.3 Leaving

- **The turn back.** A turn to portrait disarms. With `exitOnPortrait` (the default), it also leaves
  a fullscreen that `onLandscape` entered. A fullscreen the app entered through `request()` — a
  button pressed while in portrait — stays.
- **The user leaves.** Where the user leaves a fullscreen that `onLandscape` entered — Escape, the
  back gesture, the browser's own control, an exit button of the page — while the screen is still
  landscape, the controller does
  not arm again until the screen has turned to portrait and back. A page that throws the user back
  into fullscreen at the next tap after they left it is a trap; this rule is the reason the feature
  can be on by default in a game.
- **Switched off.** `onLandscape = false` disarms and takes the listeners down. A fullscreen in
  progress stays.

### 6.4 Locking the orientation

With `orientationLock`, the controller calls `screen.orientation.lock(orientationLock)` once native
fullscreen is entered, and `screen.orientation.unlock()` once it is left — only where it locked. A
lock the browser refuses (iOS, a desktop, a browser that wants fullscreen first) is caught and
dropped without a word: the lock is a wish, not a contract. The pseudo mode never locks; browsers
grant a lock in fullscreen only.

A locked screen does not turn back, so two combinations cannot work as written:

- **A landscape lock with `onLandscape`** — the setup of a game that only plays in landscape. Left
  at its default, `exitOnPortrait` is `false` while a landscape lock is set, and nothing warns. An
  explicit `exitOnPortrait: true` beside it warns once and stays out of effect while the lock holds.
- **A portrait lock with `onLandscape`.** Locking would turn the screen to portrait, the turn would
  leave the fullscreen and undo the lock, and the next turn would start it over. The controller
  warns once and does not lock while `onLandscape` is `true`; `onLandscape` keeps working.

`any` and `natural` conflict with nothing.

## 7. The pseudo fullscreen

Opt-in through `fallback: 'pseudo'`. Used only where `isSupported` is `false`; a browser with native
fullscreen always gets the native one, also when it refuses a request.

Entering:

- the target gets a class from `Stylesheets.retainRule()` under the prefix
  `DisplayFullscreen.CssRulesPrefixPseudo` (`'twopoint5d-fullscreen--pseudo'`) in `styleSheetRoot`:
  `position:fixed;inset:0;width:auto;height:auto;max-width:none;max-height:none;margin:0;box-sizing:border-box;transform:none;z-index:2147483647;`
  — the same box the UA stylesheet gives a native fullscreen element (§2.4), without `!important`;
- the root element of the target's document gets a class under the prefix
  `DisplayFullscreen.CssRulesPrefixPseudoRoot` with `overflow:hidden`, so the page behind does not
  scroll while the target covers it; its rule goes into the sheet of that document, whatever shadow
  root the target's rule goes into — a rule in a shadow root never reaches `<html>`;
- `isActive` turns `true`, `mode` is `'pseudo'`, the event goes out, and the size source rule of §5
  takes the target as the containing fullscreen element.

Leaving — through `exit()`, `toggle()`, the turn back of §6.3, or Escape: while pseudo mode holds,
the controller listens for `keydown` of Escape on the document, as the browser does for its native
mode. Both classes come off through `Stylesheets.releaseRule()`.

What it cannot do, and the guide says so: hide the bars of the browser; escape an ancestor with a
`transform`, `filter`, `perspective` or `contain` that makes itself the containing block of a fixed
element — such a target covers that ancestor, not the viewport; or rise above an ancestor's stacking
context. A target that sits directly in `<body>` meets none of these. A page that wants the bars
gone on an iPhone is installed to the home screen with `display: fullscreen` or `standalone` in its
web app manifest — the guide gives the recipe, the library has no part in it.

Whether `inset: 0` follows the toolbar of Safari as it collapses and expands, or whether the box
needs `height: 100dvh`, is checked on a device in phase A, before the rule is final.

## 8. `resize-to="fullscreen"`

Next to a real fullscreen, the attribute value `"fullscreen"` (and `":fullscreen"`) is a trap: it
means the window, and nothing about the screen.

- It stays an alias of `"window"`, with a `console.warn` once per page that names `"window"` and
  `display.fullscreen`.
- `Display.CssRulesPrefixFullscreen` and the class it names, `twopoint5d-canvas--fullscreen`, stay
  as they are, writable as before; the JSDoc marks the static deprecated. A rename now would change
  the class on the canvas, which page CSS may select — a change of behaviour, not a deprecation.
- The release that drops `"fullscreen"` — the next minor after the one that ships phase C —
  renames the static to `CssRulesPrefixWindow` and the class to `twopoint5d-canvas--window` in one
  breaking change, with a migration note.

The CHANGELOG lists the attribute value and the static under "Deprecated", one line each.

## 9. Lifecycle

- **Construction.** The controller is built with the display; the `fullscreenchange` listener of §5
  goes onto the document of the canvas. With `onLandscape`, the listeners of §6.1 as well, and the
  arming of §6.2 for a page that starts in landscape.
- **`styleSheetRoot`.** A new root gets the pseudo rules as well, where this display has installed
  them — the same as `#installRules()` does for the other rules.
- **`dispose()`.** Where the target of this display is in fullscreen and this controller entered it,
  `dispose()` leaves it: `exitFullscreen()` with its promise caught, or the classes of §7 released;
  a lock of §6.4 is undone. A fullscreen someone else entered stays. All listeners come off —
  `fullscreenchange`, orientation, query, the armed tap, Escape. The canvas handed back by
  `#giveBackCallersCanvas()` carries no class of this module. After `dispose()`, `display.fullscreen`
  throws.
- **Several displays on a page.** Each has its own controller and target. In native mode two
  displays that share a target see the same `isActive` — the browser holds the state — and whichever
  calls `exit()` leaves it for both. The pseudo mode is the state of one controller: no module-wide
  registry of pseudo targets, and a second display on the same target sees neither `isActive` nor,
  under §5, a containing fullscreen element from it. One target per display is what the guide shows.

## 10. The viewport of a phone

The window size under `resize-to="window"` is `innerWidth × innerHeight`. Whether that is right on a
phone — the URL bar that collapses, the on-screen keyboard, pinch zoom — is unchecked; in native
fullscreen most of it is moot, in the pseudo mode and in a page that never goes fullscreen it is
not. Phase C measures before it changes anything:

- on Android Chrome and iOS Safari, a page with `resize-to="window"` logs `innerWidth`,
  `innerHeight`, `visualViewport.width` and `.height`, and the box of a probe of `100dvh` — at load,
  with the URL bar collapsed and expanded, with the keyboard open, under pinch zoom, in landscape;
- the window measurement changes only if `innerHeight` leaves a gap below the canvas or reaches
  under a bar; what replaces it follows from the log. Pinch zoom must not resize the canvas, which
  rules out `visualViewport` as the size itself.

"`innerHeight` is right" is a valid result; then the guide states it, and phase C changes no code.

## 11. The lookbook

- `DemoNavBar` gets a fullscreen button, shown while `isAvailable`, its state from
  `OnDisplayFullscreenChange`. A demo hands its display to the navbar through a small registry in
  `apps/lookbook/src/demos/utils/`; a demo without a display shows no button.
- `platformer` and `boomer-shooter-corridor` pass `fullscreen: {onLandscape: true, fallback: 'pseudo'}`
  and show "tap for fullscreen" while `isArmed`.

## 12. Phases

| phase | content | § |
| --- | --- | --- |
| A | `DisplayFullscreen` with `request()`, `exit()`, `toggle()`, `isSupported`, `isAvailable`, `isActive`, `mode`; the default target; `navigationUI`; `orientationLock`; `OnDisplayFullscreenChange`; the size source rule; `dispose()`; the check of §2.3 and §7 on an iPhone | 2.3, 3, 4, 5, 6.4, 9 |
| B | `onLandscape`, the device gate, the try at once, the armed tap, `exitOnPortrait`, the rule against the trap; `fallback: 'pseudo'` | 6, 7 |
| C | the deprecation of `resize-to="fullscreen"`; the viewport measurement on Android Chrome and iOS Safari | 8, 10 |
| D | the lookbook | 11 |

## 13. Tests

### 13.1 Vitest (`src/display/DisplayFullscreen.spec.ts`)

The controller takes what it reads of the platform — the fullscreen calls and `fullscreenElement`,
`screen.orientation`, `matchMedia` — through a small interface of its own, which the display fills
from the window of its canvas and the spec fills with fakes. The arming of §6 is a state machine
that runs without a real turn of a screen.

- `request()` calls `requestFullscreen` with the `navigationUI` before any `await`;
- a refusal resolves `false`, warns once per page, and emits nothing;
- `isActive` follows `fullscreenchange`, also for an exit the controller did not start;
- `isActive` asks the root node: a target in a shadow root;
- `exit()` leaves a fullscreen stacked above the target alone;
- the default target for each construction path;
- `orientationLock`: locks after entering, unlocks after leaving, swallows a refusal, never locks in
  pseudo mode; a landscape lock beside `onLandscape` turns the default `exitOnPortrait` off without a
  warning and warns for an explicit `true`; a portrait lock beside `onLandscape` warns and does not
  lock;
- §6: a turn tries at once; a refusal arms; the armed tap requests and disarms; a turn back disarms
  and leaves only what `onLandscape` entered; the user's exit holds off arming until portrait and
  back; the gate keeps a fine pointer out; a page that loads in landscape arms; `onLandscape = false`
  takes the listeners down;
- §7: used only where `isSupported` is `false`; classes on and off; Escape leaves; a turn enters
  without arming;
- `dispose()` leaves only a fullscreen this controller entered, and leaves no listener behind.

`Display.spec.ts` gains the size source rule of §5: a canvas in fullscreen with a parent as size
source measures the fullscreen element; so does a canvas that is its own size source, inside a
fullscreen parent; a size source inside the fullscreen element and `resize-to="window"` stay as they
are; `resizeToCallback` still wins; a `fullscreenchange` marks the
size dirty.

### 13.2 Browser (`packages/twopoint5d-testing/test/display-fullscreen.test.js`)

A native request needs a trusted gesture, which a script cannot make. The runner gets one through
`@web/test-runner-commands` (`sendMouse`), a new dev dependency of `twopoint5d-testing`:

- a click requests fullscreen on the default target; `isActive`, the event, and a drawing buffer of
  the size of the viewport of the headless browser after the next frame;
- the canvas as target with its parent as size source: the buffer follows the canvas (§5);
- `exit()` and the event;
- the pseudo mode, forced by a target in an iframe without `allow="fullscreen"`: the box covers the
  viewport, the buffer follows it.

What no runner can do — turn a screen, show the bars of a phone — is checked on devices: Android
Chrome on a phone through `adb reverse`, as "Trying it on a phone" in the guide describes, and iOS
Safari in the simulator on the Mac. A phase ships once its Vitest and browser tests pass; the device
checks decide what the guide states about a platform (§2.3, §7, §10), and a check still open is
named there as unchecked rather than holding the phase back.

## 14. Docs and CHANGELOG

- [`docs/display.md`](../display.md): a section "Fullscreen" — a button first, then fullscreen on
  landscape, then the pseudo fallback with what it cannot do and the manifest recipe for the iPhone;
  rows in the cheat sheet; the deprecation of `resize-to="fullscreen"` where the guide explains
  `resize-to`. Each phase grows its part in its own commit.
- `src/stage/README.md`: one line under the `Display` idioms.
- `CHANGELOG.md` of the library, under `## [Unreleased]`: `display.fullscreen`,
  `DisplayFullscreen`, `OnDisplayFullscreenChange` and the option under "Added"; the size source rule
  under "Changed"; `resize-to="fullscreen"` and `Display.CssRulesPrefixFullscreen` under
  "Deprecated".
- The Trello card moves on with each phase.

## 15. Left out

- **`webkit` prefixes.** Safari has the unprefixed API since 16.4; older ones run no WebGPU and gain
  a fullscreen only through the pseudo mode.
- **Keyboard Lock** (`navigator.keyboard.lock(['Escape'])`), which keeps Escape for a game in
  fullscreen. An app adds it in one line where it wants it.
- **A Screen Wake Lock** for long play without touch. Not fullscreen; a candidate of its own.
- **A declarative attribute** for the fullscreen beside `resize-to`. The options and the controller
  cover it; an attribute that is read in every frame should not grow a second job.
- **Fullscreen on another screen** (the `screen` option of `requestFullscreen()`, Window Management
  API).
- **Telling a phone from a tablet.** §6.1 gates by the pointer and nothing else.

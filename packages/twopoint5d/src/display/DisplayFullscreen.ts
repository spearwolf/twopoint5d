import {describeValue} from '../utils/describeValue.js';
import type {Display} from './Display.js';
import {Stylesheets} from './Stylesheets.js';
import type {DisplayFullscreenChangeProps, DisplayFullscreenOptions, DisplayOrientationLock, FullscreenMode} from './types.js';

// the warnings to the developer go out once per page, as the one about Display.MaxResolution
let refusedWarningWasShown = false;
let unavailableWarningWasShown = false;
let exitOnPortraitWarningWasShown = false;
let portraitLockWarningWasShown = false;

/** @internal for specs: clears the once-per-page flags of the warnings */
export function resetFullscreenWarnings(): void {
  refusedWarningWasShown = false;
  unavailableWarningWasShown = false;
  exitOnPortraitWarningWasShown = false;
  portraitLockWarningWasShown = false;
}

function warnRefused(): void {
  if (refusedWarningWasShown) return;
  refusedWarningWasShown = true;
  // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
  console.warn(
    'Display#fullscreen: the browser refused the fullscreen request. A request needs a user gesture: call request() or toggle() synchronously in a click, keydown or pointerup handler.',
  );
}

function warnUnavailable(): void {
  if (unavailableWarningWasShown) return;
  unavailableWarningWasShown = true;
  // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
  console.warn(
    `Display#fullscreen: native fullscreen is not available here (an iframe without allow="fullscreen", an iPhone, or a browser without the unprefixed Fullscreen API, such as Safari before 16.4). Set fullscreen.fallback = 'pseudo' for a fullscreen of CSS.`,
  );
}

function warnExitOnPortrait(): void {
  if (exitOnPortraitWarningWasShown) return;
  exitOnPortraitWarningWasShown = true;
  // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
  console.warn('Display#fullscreen: exitOnPortrait has no effect while orientationLock holds the screen in landscape.');
}

function warnPortraitLock(type: DisplayOrientationLock): void {
  if (portraitLockWarningWasShown) return;
  portraitLockWarningWasShown = true;
  // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
  console.warn(
    `Display#fullscreen: orientationLock ${describeValue(type)} and onLandscape cannot work together; the screen is not locked while onLandscape is on.`,
  );
}

// The box a browser gives an element in native fullscreen, and as the browser does, with
// !important: an inline size — the one a display writes into its canvas, the one of a host
// element in the markup — would win over it otherwise and keep the target in its corner
const PSEUDO_CSS =
  'position:fixed!important;inset:0!important;width:100%!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;margin:0!important;box-sizing:border-box!important;transform:none!important;z-index:2147483647!important;object-fit:contain;';
// on the root element of the document, so the page behind the target does not scroll
const PSEUDO_ROOT_CSS = 'overflow:hidden;';

// a device whose primary input is a finger: desktops stay out of onLandscape, tablets come in
const COARSE_POINTER_QUERY = '(pointer: coarse) and (hover: none)';
// where screen.orientation does not exist
const LANDSCAPE_QUERY = '(orientation: landscape)';

// The fullscreen element of the root `element` sits in: a shadow root names the element itself,
// where the document would name the shadow host
function fullscreenElementOfRoot(element: HTMLElement): Element | null | undefined {
  return (element.getRootNode?.() as Partial<DocumentOrShadowRoot> | undefined)?.fullscreenElement;
}

// The element is in the fullscreen stack of its root, under another element on top: `:fullscreen`
// matches every element of the stack, and the fullscreen element of the root lies inside it when
// a video or a dialog of the app goes fullscreen within it. Read with optional calls, and a browser
// that does not know the pseudo-class throws a SyntaxError
function isInFullscreenStack(element: HTMLElement): boolean {
  let matches = false;
  try {
    matches = element.matches?.(':fullscreen') === true;
  } catch {
    matches = false;
  }
  if (matches) return true;
  const top = fullscreenElementOfRoot(element);
  return top != null && top !== element && element.contains?.(top) === true;
}

// An exit nobody waits for: its answer is dropped, and a document that refuses at once has
// nothing to leave
function leaveQuietly(doc: Document): void {
  try {
    doc.exitFullscreen().catch(() => {});
  } catch {
    // nothing to leave
  }
}

// lock() and unlock() of `screen.orientation`, which the DOM lib of TypeScript does not carry
interface LockableOrientation {
  lock?(orientation: DisplayOrientationLock): Promise<void>;
  unlock?(): void;
}

/** Who entered the fullscreen this controller holds. */
type EnteredBy = 'request' | 'landscape';

/** Who asked to leave: a call of exit() or toggle(), or the turn to portrait of onLandscape. */
type ExitBy = 'call' | 'portrait';

// Calls that overlap with an answer of the browser still to come. The browser answers one native
// call of the controller at a time, a request or an exit; what is asked meanwhile is noted on that
// call as what follows it, in the other direction — an exit once a request is granted, a request
// once an exit is through. A call of the page in the direction of the call under way takes back what
// is noted, a call in the other direction notes it: the last call of the page wins. A turn of
// onLandscape gives way to the page: it notes an exit only where the page has noted nothing, and it
// takes back only the exit of a turn.

// a native request the browser has not answered yet
interface PendingRequest {
  element: HTMLElement;
  // a request() of the page that joins one of onLandscape makes what the browser grants the page's own
  by: EnteredBy;
  // a refusal is told to the developer once a request() or the armed tap has asked, not for the try
  // of a turn alone
  warn: boolean;
  // who asked to leave while it was open: once granted, what the browser granted is left
  exitAfter?: ExitBy;
  // an exit() of the page noted on it was a refusal of the user where the screen was at the call:
  // it holds off the arming once the browser has answered. A request() after it takes it back with
  // the exit, a turn to portrait lifts it
  declines: boolean;
}

// a native exit until its promise settles. The fullscreen element stays set until the browser is
// through, and the fullscreen ends right after
interface PendingExit {
  // the page asked to enter while the browser was leaving: once through, the controller asks again
  requestAfter: boolean;
  // a turn to landscape, or the armed tap, came while the browser was leaving: once through, the
  // controller evaluates the turn anew
  turnAfter: boolean;
  // as on a request: an exit() of the page refused where the screen was at the call, applied once
  // the exit is through, taken back by a request() after it, lifted by a turn to portrait
  declines: boolean;
}

// The calls of one stretch of overlap — from the first native call until nothing follows any more —
// share one promise. It resolves once, with isActive at that end: where the last call of the page
// asked to be, as far as the browser granted it
interface Run {
  promise: Promise<boolean>;
  resolve(active: boolean): void;
}

// the pseudo mode as it was entered: what to take off again, and where its rules live
interface PseudoState {
  element: HTMLElement;
  className: string;
  root: HTMLElement | ShadowRoot;
  documentElement?: HTMLElement;
  rootClassName?: string;
  by: EnteredBy;
}

/**
 * What a {@link DisplayFullscreen} reads of its display and of the page. The display fills it;
 * a spec fills it with stubs. Not exported from the package.
 */
export interface DisplayFullscreenHost {
  readonly doc: Document;
  readonly view: Window & typeof globalThis;
  /** The element around the canvas — read at each request while no `element` is set. */
  defaultElement(): HTMLElement;
  /**
   * Puts `OnDisplayFullscreenChange` on the display. Never throws: a listener that throws is
   * reported and changes nothing.
   */
  emit(props: DisplayFullscreenChangeProps): void;
  /** The pseudo target entered (the element) or left (`undefined`). */
  pseudoTargetChanged(target: HTMLElement | undefined): void;
  styleSheetRoot(): HTMLElement | ShadowRoot;
}

/**
 * The fullscreen of a {@link Display}: {@link Display.fullscreen}.
 *
 * It asks the browser for its native fullscreen on a target element — by default the element
 * around the canvas, so that HTML beside the canvas stays on the screen and a `pixelZoom` keeps
 * whole pixels. Its state comes from the `fullscreenchange` of the document, never from what a
 * call expected: Escape, the back gesture of a phone and an `exitFullscreen()` of someone else
 * reach {@link DisplayFullscreen.isActive} and `OnDisplayFullscreenChange` alike.
 *
 * {@link DisplayFullscreen.request}, {@link DisplayFullscreen.exit} and
 * {@link DisplayFullscreen.toggle} never reject, not even behind a listener of
 * `OnDisplayFullscreenChange` that throws; they resolve with `isActive` afterwards. A refusal — a
 * missing user gesture, an iframe without `allow="fullscreen"`, a phone without the API — is told
 * to the developer once per page on the console.
 *
 * An element inside the target that goes fullscreen itself — a video, a dialog of the app — lies on
 * top of the target: `isActive` is `false` while it holds, its lock stays, and `onLandscape`
 * neither requests nor arms. Once it is left the fullscreen is the controller's own again, as
 * before; a turn while it held is not caught up.
 *
 * `onLandscape` takes no fullscreen from anyone. While another element of the page is in
 * fullscreen and the target is not in its stack — a video or a dialog that went fullscreen on its
 * own, inside the target or outside it — it neither requests nor arms, and an armed display
 * disarms. Leaving that fullscreen in landscape holds off the arming as leaving the target's does.
 *
 * The controller outlives {@link Display.dispose} as a reference someone holds, and stays usable
 * as one: `request()`, `exit()` and `toggle()` resolve `false` — a call still open at the dispose
 * as well —, and {@link DisplayFullscreen.isDisposed} says so.
 */
export class DisplayFullscreen {
  /** The base of the class name of the pseudo target. */
  static CssRulesPrefixPseudo = 'twopoint5d-fullscreen--pseudo';
  /** The base of the class name the root element of the document carries while the pseudo mode holds. */
  static CssRulesPrefixPseudoRoot = 'twopoint5d-fullscreen--pseudo-root';

  readonly display: Display;

  /**
   * `'pseudo'` covers the viewport with the target through CSS where native fullscreen is not
   * available — an iPhone, an iframe without `allow="fullscreen"`. It cannot hide the bars of the
   * browser. A browser with native fullscreen always gets the native one. Default `false`.
   *
   * After {@link Display.dispose} a write changes nothing.
   */
  fallback: 'pseudo' | false;

  /**
   * Passed to `requestFullscreen()`. Default `'hide'`.
   *
   * After {@link Display.dispose} a write changes nothing.
   */
  navigationUI: 'auto' | 'hide' | 'show';

  readonly #host: DisplayFullscreenHost;

  #element?: HTMLElement;

  // the element of a native fullscreen this controller has seen entered, kept until it is left:
  // a new `element` takes effect with the next request
  #activeElement?: HTMLElement;
  // who entered #activeElement; undefined for a fullscreen someone else entered
  #entered?: EnteredBy;
  // a native request until its promise settles. A second request — the armed tap and the click of
  // a button inside the target, one tap — joins it instead of asking again
  #pending?: PendingRequest;
  // a native exit until its promise settles. A second exit joins it; a request is noted on it
  #pendingExit?: PendingExit;
  // the promise every call gets while the browser is answering, or something follows its answer
  #run?: Run;

  // what the last event said, so a fullscreenchange that changes nothing emits nothing
  #emittedActive = false;
  #emittedMode: FullscreenMode | undefined;
  #emittedArmed = false;

  // the screen is locked by this controller
  #locked = false;

  #orientationLock?: DisplayOrientationLock;
  #onLandscape = false;
  // the value of the options or the setter; the getter answers the effective one
  #exitOnPortrait?: boolean;

  // what onLandscape listens to for a turn: screen.orientation, else the media query
  #watchedOrientation?: EventTarget;
  // the element whose next tap requests fullscreen while armed
  #armedElement?: HTMLElement;
  // the user left a fullscreen while the screen was landscape — the target's, whoever entered it, or
  // one of another element: no arming until the screen has turned to portrait and back. An exit() of
  // the page decides it at the call; while the browser is still answering it is noted on the call
  // under way
  #declined = false;
  // what #readState() read last: another element than the target is in fullscreen. The end of that
  // fullscreen in landscape counts as a leave of the user
  #foreignHeld = false;

  readonly #onTurn = (): void => {
    this.#turned();
  };

  readonly #onPseudoKey = (event: Event): void => {
    // the key a browser leaves its native fullscreen with
    if ((event as KeyboardEvent).key !== 'Escape') return;
    this.#leavePseudo();
    this.#emitIfChanged();
  };

  readonly #onArmedTap = (event: Event): void => {
    // a mouse grants a gesture with its pointerdown, not with its pointerup; its click follows
    if (event.type === 'pointerup' && (event as PointerEvent).pointerType === 'mouse') return;
    // a fullscreen the browser has granted another element before its fullscreenchange: the tap
    // takes nothing from it
    if (this.#fullscreenHolds()) {
      this.#disarm();
      this.#emitIfChanged();
      return;
    }
    this.#disarm();
    // synchronously in the handler of the tap: the gesture reaches the browser
    const answer = this.#request('landscape');
    this.#emitIfChanged();
    // a tap the browser does not count as a gesture: the next one may
    void answer.then((active) => this.#rearm(active));
  };

  // the pseudo mode of this controller; no other display sees it
  #pseudo?: PseudoState;

  #disposed = false;

  readonly #onFullscreenChange = (): void => {
    this.#syncState();
  };

  constructor(display: Display, host: DisplayFullscreenHost, options?: DisplayFullscreenOptions) {
    this.display = display;
    this.#host = host;
    this.#element = options?.element;
    this.navigationUI = options?.navigationUI ?? 'hide';
    this.fallback = options?.fallback ?? false;
    this.#orientationLock = options?.orientationLock;
    this.#exitOnPortrait = options?.exitOnPortrait;

    host.doc.addEventListener('fullscreenchange', this.#onFullscreenChange);
    // a display built while a video is in fullscreen: the end of that fullscreen in landscape is a
    // leave as well
    this.#foreignHeld = this.#foreignFullscreen();

    this.onLandscape = options?.onLandscape ?? false;
  }

  /**
   * Locks the screen through `screen.orientation.lock()` once native fullscreen is entered, and
   * unlocks it once that is left. A lock the browser refuses is dropped without a word: the lock
   * is a wish, not a contract. A portrait type is not locked while `onLandscape` is on.
   *
   * After {@link Display.dispose} it takes a value and warns nothing; nothing is locked.
   */
  get orientationLock(): DisplayOrientationLock | undefined {
    return this.#orientationLock;
  }

  set orientationLock(type: DisplayOrientationLock | undefined) {
    this.#orientationLock = type;
    this.#warnConflicts();
  }

  /**
   * Enter fullscreen when the screen turns to landscape, on a device whose primary input is a
   * finger: at once where the browser lets the turn count as a gesture, else with the next tap
   * on the target ({@link DisplayFullscreen.isArmed}). The user who leaves a fullscreen in
   * landscape — the target's, whoever entered it, or one of another element — is not thrown into
   * one until the screen has turned to portrait and back. While another element of the page is in
   * fullscreen, a turn asks nothing and arms nothing: a request would pull the target over it.
   *
   * Switched on while the browser is still answering a request or an exit, it arms once that answer
   * is in — where the screen is still landscape, the target out of fullscreen and no other element
   * in fullscreen.
   *
   * After {@link Display.dispose} a write changes nothing; the getter answers the last value.
   */
  get onLandscape(): boolean {
    return this.#onLandscape;
  }

  set onLandscape(on: boolean) {
    if (on === this.#onLandscape || this.#disposed) return;
    this.#onLandscape = on;
    if (on) {
      this.#watchOrientation();
      // no turn has happened, and nothing grants an exemption: a page in landscape arms — or, where
      // only the pseudo mode is there, which needs no gesture, enters it. While the browser is still
      // answering a request or an exit, its answer decides first: the arming is held against the state
      // once the run is through, as the answer of a request of onLandscape is
      if (this.#isLandscape() && this.#gateIsOpen()) {
        if (this.#pending != null || this.#pendingExit != null) {
          void this.#joinRun().then((active) => this.#rearm(active));
        } else if (!this.#fullscreenHolds()) {
          if (this.isSupported) this.#arm();
          else if (this.fallback === 'pseudo') this.#enterPseudo('landscape');
        }
      }
    } else {
      this.#unwatchOrientation();
      this.#disarm();
      this.#declined = false;
      this.#emitIfChanged();
    }
    this.#warnConflicts();
  }

  /**
   * Leave a fullscreen that `onLandscape` entered when the screen turns back to portrait.
   * `true` by default, and `false` while a landscape `orientationLock` holds — a locked screen
   * does not turn back. Where the browser refuses the lock, and in the pseudo mode, which never
   * locks, the turn back leaves.
   *
   * After {@link Display.dispose} it takes a value and warns nothing; nothing is left.
   */
  get exitOnPortrait(): boolean {
    if (this.#locked && this.#locksLandscape()) return false;
    return this.#exitOnPortrait ?? true;
  }

  set exitOnPortrait(exit: boolean) {
    this.#exitOnPortrait = exit;
    this.#warnConflicts();
  }

  /**
   * The target of the next request: the `element` of the options, or the element around the
   * canvas while none is set. A new element takes effect with the next request; a fullscreen in
   * progress stays on the element it entered with.
   *
   * After {@link Display.dispose} it answers the element it had at the dispose; a write is kept
   * and changes nothing.
   */
  get element(): HTMLElement {
    return this.#element ?? this.#host.defaultElement();
  }

  set element(element: HTMLElement) {
    this.#element = element;
  }

  /**
   * The browser offers native fullscreen here: `fullscreenEnabled` of the document, and
   * `requestFullscreen` on the target. It reads the unprefixed Fullscreen API alone.
   *
   * After {@link Display.dispose} it keeps answering.
   */
  get isSupported(): boolean {
    return this.#host.doc.fullscreenEnabled === true && typeof this.element.requestFullscreen === 'function';
  }

  /**
   * A {@link DisplayFullscreen.request} can succeed. What a fullscreen button shows itself by.
   *
   * `false` after {@link Display.dispose}.
   */
  get isAvailable(): boolean {
    return !this.#disposed && (this.isSupported || this.fallback === 'pseudo');
  }

  /**
   * The target is in fullscreen right now — native by this controller or by anyone, or pseudo.
   *
   * After {@link Display.dispose} it keeps answering from the document: `true` while anyone holds
   * the target in fullscreen. The pseudo mode is left by the dispose.
   */
  get isActive(): boolean {
    return this.#pseudo != null || this.#nativeElement() != null;
  }

  /**
   * How the target is in fullscreen: `'native'`, `'pseudo'`, or `undefined` while not active.
   *
   * After {@link Display.dispose} it keeps answering from the document: `'native'` while anyone
   * holds the target in fullscreen. The pseudo mode is left by the dispose.
   */
  get mode(): FullscreenMode | undefined {
    if (this.#pseudo != null) return 'pseudo';
    return this.#nativeElement() != null ? 'native' : undefined;
  }

  /**
   * `onLandscape` waits for a tap on the target to enter fullscreen. A page can show a hint by it.
   * Never `true` while the target is in fullscreen — whoever entered it, native or pseudo — or lies
   * under an element stacked on it, nor while another element of the page is in fullscreen.
   *
   * `false` after {@link Display.dispose}.
   */
  get isArmed(): boolean {
    return this.#armedElement != null;
  }

  /**
   * `true` once the display that built this controller is disposed, and from then on. Branch on
   * it wherever a reference to the controller outlives the display.
   */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * Enter fullscreen. Call it synchronously in the handler of a click, a key or a tap: the
   * browser grants a request only with a user gesture, and this method hands it on before it
   * awaits anything. Resolves with {@link DisplayFullscreen.isActive} afterwards; never rejects.
   *
   * While the browser is still answering a request or an exit, the last call wins: a request
   * joins a request still open and takes back an `exit()` called after it; during an exit it is
   * noted, and the browser is asked once the exit is through. Every call of such an overlap
   * resolves with `isActive` once the controller has done what the last one asked, and an `exit()`
   * it takes back holds off no arming. A fullscreen a request carries is the page's own, also when
   * it shares the request of `onLandscape` or finds the fullscreen `onLandscape` has entered — on
   * top, or under an element of the app that lies on top of it: a turn to portrait leaves it
   * standing.
   *
   * After {@link Display.dispose} it resolves `false` and asks nothing; a request still open when
   * the dispose runs resolves `false` as well, and a fullscreen the browser grants after the
   * dispose is left again.
   */
  request(): Promise<boolean> {
    return this.#request('request');
  }

  /**
   * Leave a fullscreen of the target. Resolves with {@link DisplayFullscreen.isActive} afterwards —
   * `false` once left; never rejects.
   *
   * While the browser is still answering, the last call wins: an exit while a request is open leaves
   * once the browser has granted it, and one while an exit is under way joins that exit and takes
   * back a `request()` called after it. Every call of such an overlap resolves with `isActive` once
   * the controller has done what the last one asked. Called in landscape while `onLandscape` is on,
   * it holds off the arming until the screen has turned to portrait and back — whoever entered the
   * fullscreen, and however late the browser answers —, unless a `request()` after it, while the
   * browser is still answering, takes it back.
   *
   * After {@link Display.dispose} it resolves `false` and leaves nothing; an exit still open when
   * the dispose runs resolves `false`.
   */
  exit(): Promise<boolean> {
    return this.#exit('call');
  }

  /**
   * {@link DisplayFullscreen.exit} while active, {@link DisplayFullscreen.request} otherwise.
   * Resolves with `isActive` afterwards; never rejects.
   *
   * While the browser is still answering, it goes by the state the page was last told through
   * `OnDisplayFullscreenChange` — not active while a request is open, active while an exit is under
   * way — and acts as `request()` or `exit()` does then: the last call wins.
   *
   * After {@link Display.dispose} it resolves `false` and calls nothing.
   */
  toggle(): Promise<boolean> {
    if (this.#disposed) return Promise.resolve(false);
    // the page acts on what the last event told it: the state before an answer still to come, or —
    // for a listener of a fullscreenchange the browser fires before its answer — the one after it
    const active = this.#pending != null || this.#pendingExit != null ? this.#emittedActive : this.isActive;
    return active ? this.exit() : this.request();
  }

  /** @internal called by the `styleSheetRoot` setter of the display: an active pseudo mode takes its rule along */
  installRules(root: HTMLElement | ShadowRoot): void {
    const pseudo = this.#pseudo;
    if (pseudo == null || this.#disposed || root === pseudo.root) return;
    // the class name does not depend on the root, so the target keeps its class
    Stylesheets.retainRule(DisplayFullscreen.CssRulesPrefixPseudo, PSEUDO_CSS, root);
    Stylesheets.releaseRule(DisplayFullscreen.CssRulesPrefixPseudo, pseudo.root);
    pseudo.root = root;
  }

  /**
   * @internal called by `Display#dispose()`. The state goes down first and the one event last: a
   * listener that calls back finds the controller disposed, and a host that throws — only the stub
   * of a spec can — throws once nothing is left standing
   */
  dispose(): void {
    if (this.#disposed) return;
    // first: a listener of the event below and every late answer of the browser find it disposed
    this.#disposed = true;

    // the default target is read off the canvas, which the display is about to give up: the
    // getters of a controller held past the dispose answer from the element it had
    this.#element ??= this.element;

    // a request still open is not forgotten: its answer holds it, and leaves what the browser grants
    this.#pending = undefined;
    // an exit under way leaves already: a second exitFullscreen() could take off the next element
    // of the stack as well. A request noted on it is dropped with it
    const exiting = this.#pendingExit != null;
    this.#pendingExit = undefined;
    // every call still waiting: nothing follows the answers of the browser any more
    const run = this.#run;
    this.#run = undefined;
    run?.resolve(false);

    // the pseudo mode is always this controller's own
    this.#leavePseudo();

    // only a fullscreen this controller entered, and only while the target lies on top: the app's
    // own stays, and so does one stacked on the target — exitFullscreen() would take that one off
    if (!exiting && this.#entered != null && this.#nativeElement() != null) leaveQuietly(this.#host.doc);

    this.#unlock();
    this.#unwatchOrientation();
    this.#disarm();
    this.#host.doc.removeEventListener('fullscreenchange', this.#onFullscreenChange);
    this.#activeElement = undefined;
    this.#entered = undefined;

    this.#emitIfChanged();
  }

  // the element of the native fullscreen of the target, or undefined: the element it entered
  // with while that holds, else the target of the next request
  #nativeElement(): HTMLElement | undefined {
    // while a request is pending, the element asked for: a new `element` set meanwhile does not
    // make the controller miss the fullscreen it entered
    const candidate = this.#activeElement ?? this.#pending?.element ?? this.element;
    return fullscreenElementOfRoot(candidate) === candidate ? candidate : undefined;
  }

  // `warn` is false for the try at once of a turn: a browser that asks for a gesture refuses it,
  // and the tap that follows is the plan, not a mistake of the developer
  #request(by: EnteredBy, warn = true): Promise<boolean> {
    if (this.#disposed) return Promise.resolve(false);

    const open = this.#pending;
    if (open != null) {
      if (warn) open.warn = true;
      if (by === 'request') {
        // the page asks to enter: an exit noted before is taken back — the page's or a turn's —, and
        // what the browser grants is the page's own. A fullscreenchange the browser fired before its
        // answer has already told who entered
        open.exitAfter = undefined;
        open.declines = false;
        open.by = 'request';
        if (this.#activeElement === open.element && this.#entered != null) this.#entered = 'request';
      }
      return this.#joinRun();
    }

    const exit = this.#pendingExit;
    if (exit != null) {
      // the fullscreen element stays set until the browser is through, and the fullscreen ends
      // right after: answering true now would be wrong a moment later. The page's request is asked
      // for once the exit is through; the armed tap is evaluated then as a turn is
      if (by === 'request') {
        exit.requestAfter = true;
        exit.declines = false;
      } else {
        exit.turnAfter = true;
      }
      return this.#joinRun();
    }

    if (by === 'request') {
      // whoever asked for a fullscreen decides: the page asks for the one onLandscape has entered,
      // and it is the page's own from now on — a turn to portrait leaves it standing. So it is while
      // an element of the app lies on top of the target as well: #entered stays set as long as the
      // target is in the fullscreen stack, and the request below asks for the target again
      if (this.#pseudo?.by === 'landscape') this.#pseudo.by = 'request';
      else if (this.#entered === 'landscape') this.#entered = 'request';
    }
    if (this.isActive) return Promise.resolve(true);

    if (!this.isSupported) {
      if (this.fallback === 'pseudo') {
        this.#enterPseudo(by);
        return Promise.resolve(true);
      }
      warnUnavailable();
      return Promise.resolve(false);
    }

    // before the call: the fullscreenchange it causes, and a call of a listener of it, may come
    // before the call returns
    const run = this.#joinRun();
    const request: PendingRequest = {element: this.element, by, warn, declines: false};
    this.#pending = request;
    let answer: Promise<void>;
    try {
      // before any await: the gesture of the caller has to reach the browser
      answer = request.element.requestFullscreen({navigationUI: this.navigationUI});
    } catch {
      this.#pending = undefined;
      // a listener of a fullscreenchange fired during the call may have disposed the controller
      if (request.warn && !this.#disposed) warnRefused();
      this.#endRun();
      return run;
    }

    answer.then(
      () => {
        if (this.#disposed) {
          // granted after the dispose: this controller asked for it, and nothing follows it any more
          if (fullscreenElementOfRoot(request.element) === request.element) leaveQuietly(this.#host.doc);
          return;
        }
        // #readState() reads who entered off #pending; the request is settled before the event, so
        // a listener that calls back finds it answered — and joins the run, which is still open
        this.#readState();
        this.#pending = undefined;
        if (request.exitAfter != null) {
          // a call or a turn asked to leave while the browser was still answering: leave what it
          // granted, unless an element of the app has stacked on it meanwhile
          if (this.#nativeElement() != null) this.#leaveNative(request.declines);
        } else if (this.#nativeElement() != null) {
          this.#lock();
        }
        this.#emitIfChanged();
        this.#endRun();
      },
      () => {
        this.#pending = undefined;
        if (this.#disposed) return;
        // the user left before the browser answered: the refusal noted at the call holds off the
        // arming that follows the end of the run, and takes down an arming that waits for a tap
        if (request.declines && this.#onLandscape) this.#decline();
        if (request.warn) warnRefused();
        // only where the refusal of the user has disarmed: a refusal of the browser alone emits nothing
        this.#emitIfChanged();
        this.#endRun();
      },
    );
    return run;
  }

  #exit(by: ExitBy): Promise<boolean> {
    if (this.#disposed) return Promise.resolve(false);

    if (this.#pseudo != null) {
      this.#leavePseudo();
      this.#emitIfChanged();
      return Promise.resolve(this.isActive);
    }

    // the user leaves in landscape, whatever is left — whoever entered it, or is entering it: decided
    // where the screen is at the call, not where it is once the browser answers, and noted on the call
    // under way until the browser has answered — a request() after it takes it back, a turn to
    // portrait lifts it, as one after the answer would
    const declines = by === 'call' && this.#onLandscape && this.#isLandscape();

    const running = this.#pendingExit;
    if (running != null) {
      // a second exit joins the one under way. The page's takes back a request() noted on it and a
      // turn that came before it: the last call wins
      if (declines) running.declines = true;
      if (by === 'call') {
        running.requestAfter = false;
        running.turnAfter = false;
      }
      return this.#joinRun();
    }

    const request = this.#pending;
    if (request != null) {
      // once the browser has granted it, what it granted is left. A turn to portrait notes its exit
      // only where the page has noted none: a turn back takes back the exit of the turn, never the
      // one the page asked for
      if (declines) request.declines = true;
      if (by === 'call' || request.exitAfter == null) request.exitAfter = by;
      return this.#joinRun();
    }

    // a fullscreen another element has stacked on top of the target is not the target's to leave
    if (this.#nativeElement() == null) return Promise.resolve(this.isActive);

    const run = this.#joinRun();
    this.#leaveNative(declines);
    return run;
  }

  // The native exit of the target, inside the open run: the caller has made sure the target lies on
  // top and nothing else is under way
  #leaveNative(declines: boolean): void {
    // before the call: the fullscreenchange it causes may come before the call returns
    const exit: PendingExit = {requestAfter: false, turnAfter: false, declines};
    this.#pendingExit = exit;
    const settle = (): void => {
      // the dispose has resolved the run
      if (this.#disposed) return;
      this.#readState();
      this.#pendingExit = undefined;
      // the refusal of the exit() of the page, unless a request() or a turn to portrait has taken it back
      if (exit.declines && this.#onLandscape) this.#decline();
      // the page asked to enter while the browser was leaving: ask now, still inside the run
      if (exit.requestAfter) void this.#request('request');
      this.#emitIfChanged();
      this.#endRun();
      // a turn to landscape while the browser was leaving is a turn of its own, outside the calls of
      // the page; a request of the page just asked is shared by it. Only in landscape: an exit the
      // browser refused leaves the target on top, and in portrait the turn would leave again
      if (exit.turnAfter && this.#isLandscape()) this.#turned();
    };
    try {
      this.#host.doc.exitFullscreen().then(settle, settle);
    } catch {
      settle();
    }
  }

  // the promise of the open run, or of a new one
  #joinRun(): Promise<boolean> {
    let run = this.#run;
    if (run == null) {
      let resolve: (active: boolean) => void = () => {};
      const promise = new Promise<boolean>((settle) => {
        resolve = settle;
      });
      run = {promise, resolve};
      this.#run = run;
    }
    return run.promise;
  }

  // after an answer of the browser: the run ends once nothing follows any more
  #endRun(): void {
    const run = this.#run;
    if (run == null || this.#pending != null || this.#pendingExit != null) return;
    this.#run = undefined;
    run.resolve(this.isActive);
  }

  #syncState(): void {
    this.#readState();
    this.#emitIfChanged();
  }

  #readState(): void {
    if (this.#disposed) return;

    const active = this.#nativeElement();
    if (active != null) {
      // the target lies on top, whoever entered it: no tap is awaited
      this.#disarm();
      if (this.#activeElement == null) {
        this.#activeElement = active;
        this.#entered = this.#pending?.by;
      }
    } else if (this.#activeElement != null && !isInFullscreenStack(this.#activeElement)) {
      // the user left the fullscreen of the target, whoever entered it, while the screen still is
      // landscape — Escape, the back gesture, the browser's own control: a page that throws them back
      // in with the next tap is a trap. An exit of this controller has decided that at its call: an
      // exit() of the page where the screen was then, and the exit of the turn to portrait never — a
      // quick turn back would leave the page in landscape without a fullscreen and unarmed
      if (this.#pendingExit == null && this.#onLandscape && this.#isLandscape()) {
        this.#decline();
      }
      this.#activeElement = undefined;
      this.#entered = undefined;
      this.#unlock();
    }
    // else a fullscreen stacked on the target, or none: the target keeps who entered it and its
    // lock until it lies on top again or leaves the stack

    const foreign = this.#foreignFullscreen();
    if (foreign) {
      // a fullscreen of another element: no tap is awaited, onLandscape takes nothing from it
      this.#disarm();
    } else if (
      this.#foreignHeld &&
      !this.#holdsTarget() &&
      this.#pendingExit == null &&
      this.#onLandscape &&
      this.#isLandscape()
    ) {
      // its end in landscape is a leave as the target's is; an exit of this controller has decided
      // at its call
      this.#decline();
    }
    this.#foreignHeld = foreign;
  }

  #orientation(): LockableOrientation | undefined {
    return this.#host.view.screen?.orientation as LockableOrientation | undefined;
  }

  #lock(): void {
    const type = this.#orientationLock;
    if (type != null && this.#onLandscape && type.startsWith('portrait')) return;
    const lock = this.#orientation()?.lock;
    if (type == null || typeof lock !== 'function') return;
    try {
      lock.call(this.#orientation(), type).then(
        () => {
          // a fullscreen that was left while the lock was pending gets no lock left behind; one with
          // an element stacked on it keeps its lock
          if (this.#disposed || !this.#holdsTarget()) {
            this.#orientation()?.unlock?.();
          } else {
            this.#locked = true;
          }
        },
        () => {
          // iOS, a desktop, a browser that wants something else first: the lock is a wish
        },
      );
    } catch {
      // the same, refused at once
    }
  }

  #unlock(): void {
    if (!this.#locked) return;
    this.#locked = false;
    try {
      this.#orientation()?.unlock?.();
    } catch {
      // nothing is locked that could stay locked
    }
  }

  #locksLandscape(): boolean {
    return this.#orientationLock?.startsWith('landscape') === true;
  }

  #warnConflicts(): void {
    if (this.#disposed || !this.#onLandscape) return;
    if (this.#locksLandscape() && this.#exitOnPortrait === true) warnExitOnPortrait();
    if (this.#orientationLock?.startsWith('portrait')) warnPortraitLock(this.#orientationLock);
  }

  // the orientation of the screen, not of the viewport: a desktop window wider than tall matches
  // (orientation: landscape) as well
  #isLandscape(): boolean {
    const type = this.#host.view.screen?.orientation?.type;
    if (typeof type === 'string') return type.startsWith('landscape');
    return this.#host.view.matchMedia?.(LANDSCAPE_QUERY).matches === true;
  }

  // read anew at every turn: a tablet that gets a mouse and a keyboard stops entering fullscreen
  #gateIsOpen(): boolean {
    return this.#host.view.matchMedia?.(COARSE_POINTER_QUERY).matches === true;
  }

  #watchOrientation(): void {
    const view = this.#host.view;
    const orientation = view.screen?.orientation as EventTarget | undefined;
    const target = typeof orientation?.addEventListener === 'function' ? orientation : view.matchMedia?.(LANDSCAPE_QUERY);
    target?.addEventListener('change', this.#onTurn);
    this.#watchedOrientation = target;
  }

  #unwatchOrientation(): void {
    this.#watchedOrientation?.removeEventListener('change', this.#onTurn);
    this.#watchedOrientation = undefined;
  }

  #turned(): void {
    if (this.#disposed || !this.#onLandscape) return;

    if (!this.#isLandscape()) {
      // portrait lifts a refusal, also one an exit() has noted on a request or an exit still under way
      this.#declined = false;
      if (this.#pending != null) this.#pending.declines = false;
      if (this.#pendingExit != null) this.#pendingExit.declines = false;
      this.#disarm();
      if (this.#enteredBy() === 'landscape' && this.exitOnPortrait) void this.#exit('portrait');
      this.#emitIfChanged();
      return;
    }

    // an exit is still under way: the turn is evaluated once it is through
    const exit = this.#pendingExit;
    if (exit != null) {
      exit.turnAfter = true;
      return;
    }

    // back in landscape before the browser has answered a request: the turn to portrait between
    // is taken back, and what the browser grants stays — unless the page has called exit() meanwhile
    if (this.#pending?.exitAfter === 'portrait') this.#pending.exitAfter = undefined;

    if (this.#fullscreenHolds() || this.#declined || !this.#gateIsOpen()) return;

    if (!this.isSupported) {
      // the pseudo mode needs no gesture: the turn enters it, and nothing arms
      if (this.fallback === 'pseudo') this.#enterPseudo('landscape');
      return;
    }

    // at once: a browser may let the turn count as a gesture
    void this.#request('landscape', false).then((active) => this.#rearm(active));
  }

  // after a run of answers of the browser that onLandscape waits for — its own request, or
  // onLandscape switched on while one was under way: a refusal arms, unless the controller is
  // disposed or anything has changed in the meantime — a newer request or an exit is under way, say
  #rearm(active: boolean): void {
    if (
      !active &&
      !this.#disposed &&
      this.#onLandscape &&
      this.#isLandscape() &&
      !this.#fullscreenHolds() &&
      !this.#declined &&
      this.#pending == null &&
      this.#pendingExit == null
    ) {
      this.#arm();
    }
  }

  // The target is in fullscreen, or under an element stacked on it: isActive is false while a video
  // or a dialog of the app lies on top, and a request or an arming would pull the target over it.
  // #fullscreenHolds() adds what this leaves out: another element in fullscreen while the
  // target is not in the stack
  #holdsTarget(): boolean {
    return this.isActive || this.#activeElement != null;
  }

  // Another element than the target is in fullscreen — a video or a dialog of the app that went
  // fullscreen on its own, inside the target or outside it, or an element of someone else — while the
  // target is not in the stack. The document names every fullscreen of the page, a shadow root none
  // outside it; the root of the target covers a target in another document
  #foreignFullscreen(): boolean {
    if (this.#holdsTarget()) return false;
    return this.#host.doc.fullscreenElement != null || fullscreenElementOfRoot(this.element) != null;
  }

  // onLandscape takes no fullscreen from anyone: it neither requests nor arms while the target holds
  // a fullscreen or another element is in one
  #fullscreenHolds(): boolean {
    return this.#holdsTarget() || this.#foreignFullscreen();
  }

  // the user has left a fullscreen in landscape: no arming until the screen has turned to portrait
  // and back — and no tap that waits for one either. State alone: the caller emits
  #decline(): void {
    this.#declined = true;
    this.#disarm();
  }

  // a request still open counts: a turn to portrait leaves what the browser grants it
  #enteredBy(): EnteredBy | undefined {
    return this.#pseudo?.by ?? this.#entered ?? this.#pending?.by;
  }

  #enterPseudo(by: EnteredBy): void {
    const element = this.element;
    const root = this.#host.styleSheetRoot();
    const documentElement = (element.ownerDocument ?? this.#host.doc).documentElement;

    const className = Stylesheets.retainRule(DisplayFullscreen.CssRulesPrefixPseudo, PSEUDO_CSS, root);
    element.classList.add(className);
    const pseudo: PseudoState = {element, className, root, by};

    // the root element sits in the document: its rule goes into the sheet of the document, whatever
    // shadow root the target's rule goes into
    if (documentElement != null) {
      pseudo.documentElement = documentElement;
      pseudo.rootClassName = Stylesheets.retainRule(DisplayFullscreen.CssRulesPrefixPseudoRoot, PSEUDO_ROOT_CSS, documentElement);
      documentElement.classList.add(pseudo.rootClassName);
    }

    this.#disarm();
    this.#pseudo = pseudo;
    this.#host.doc.addEventListener('keydown', this.#onPseudoKey);
    this.#host.pseudoTargetChanged(element);
    this.#emitIfChanged();
  }

  // state alone: the caller emits once its whole change is made
  #leavePseudo(): void {
    const pseudo = this.#pseudo;
    if (pseudo == null) return;

    // as for the native mode: the user who leaves in landscape, whoever entered the pseudo mode, is
    // not thrown back in
    if (this.#onLandscape && this.#isLandscape()) this.#decline();

    pseudo.element.classList.remove(pseudo.className);
    Stylesheets.releaseRule(DisplayFullscreen.CssRulesPrefixPseudo, pseudo.root);
    if (pseudo.documentElement != null && pseudo.rootClassName != null) {
      pseudo.documentElement.classList.remove(pseudo.rootClassName);
      Stylesheets.releaseRule(DisplayFullscreen.CssRulesPrefixPseudoRoot, pseudo.documentElement);
    }

    this.#pseudo = undefined;
    this.#host.doc.removeEventListener('keydown', this.#onPseudoKey);
    this.#host.pseudoTargetChanged(undefined);
  }

  #arm(): void {
    if (this.#armedElement != null) return;
    const element = this.element;
    // capture and passive, without preventDefault(): the tap reaches the page as well
    element.addEventListener('pointerup', this.#onArmedTap, {capture: true, passive: true});
    element.addEventListener('click', this.#onArmedTap, {capture: true, passive: true});
    this.#armedElement = element;
    this.#emitIfChanged();
  }

  // state alone: the caller emits once its whole change is made
  #disarm(): void {
    const element = this.#armedElement;
    if (element == null) return;
    element.removeEventListener('pointerup', this.#onArmedTap, {capture: true});
    element.removeEventListener('click', this.#onArmedTap, {capture: true});
    this.#armedElement = undefined;
  }

  #emitIfChanged(): void {
    const isActive = this.isActive;
    const mode = this.mode;
    const isArmed = this.isArmed;
    if (isActive === this.#emittedActive && mode === this.#emittedMode && isArmed === this.#emittedArmed) return;

    this.#emittedActive = isActive;
    this.#emittedMode = mode;
    this.#emittedArmed = isArmed;
    this.#host.emit({display: this.display, isActive, mode, isArmed, element: this.#activeElement ?? this.element});
  }
}

import type {Display} from './Display.js';
import type {DisplayFullscreenChangeProps, DisplayFullscreenOptions, DisplayOrientationLock, FullscreenMode} from './types.js';

// the warnings to the developer go out once per page, as the one about Display.MaxResolution
let refusedWarningWasShown = false;
let unavailableWarningWasShown = false;

/** @internal for specs: clears the once-per-page flags of the warnings */
export function resetFullscreenWarnings(): void {
  refusedWarningWasShown = false;
  unavailableWarningWasShown = false;
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
    `Display#fullscreen: native fullscreen is not available here (an iframe without allow="fullscreen", or an iPhone). Set fullscreen.fallback = 'pseudo' for a fullscreen of CSS.`,
  );
}

// The fullscreen element of the root `element` sits in: a shadow root names the element itself,
// where the document would name the shadow host
function fullscreenElementOfRoot(element: HTMLElement): Element | null | undefined {
  return (element.getRootNode?.() as Partial<DocumentOrShadowRoot> | undefined)?.fullscreenElement;
}

// lock() and unlock() of `screen.orientation`, which the DOM lib of TypeScript does not carry
interface LockableOrientation {
  lock?(orientation: DisplayOrientationLock): Promise<void>;
  unlock?(): void;
}

/** Who entered the fullscreen this controller holds. */
type EnteredBy = 'request' | 'landscape';

/**
 * What a {@link DisplayFullscreen} reads of its display and of the page. The display fills it;
 * a spec fills it with stubs. Not exported from the package.
 */
export interface DisplayFullscreenHost {
  readonly doc: Document;
  readonly view: Window & typeof globalThis;
  /** The element around the canvas — read at each request while no `element` is set. */
  defaultElement(): HTMLElement;
  /** Puts `OnDisplayFullscreenChange` on the display. */
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
 * {@link DisplayFullscreen.toggle} never reject; they resolve with `isActive` afterwards. A
 * refusal — a missing user gesture, an iframe without `allow="fullscreen"`, a phone without the
 * API — is told to the developer once per page on the console.
 */
export class DisplayFullscreen {
  readonly display: Display;

  /** Passed to `requestFullscreen()`. Default `'hide'`. */
  navigationUI: 'auto' | 'hide' | 'show';

  /**
   * Locks the screen through `screen.orientation.lock()` once native fullscreen is entered, and
   * unlocks it once that is left. A lock the browser refuses is dropped without a word: the lock
   * is a wish, not a contract.
   */
  orientationLock: DisplayOrientationLock | undefined;

  readonly #host: DisplayFullscreenHost;

  #element?: HTMLElement;

  // the element of a native fullscreen this controller has seen entered, kept until it is left:
  // a new `element` takes effect with the next request
  #activeElement?: HTMLElement;
  // who entered #activeElement; undefined for a fullscreen someone else entered
  #entered?: EnteredBy;
  // set from a request until the fullscreenchange it causes
  #requesting?: EnteredBy;

  // what the last event said, so a fullscreenchange that changes nothing emits nothing
  #emittedActive = false;
  #emittedMode: FullscreenMode | undefined;
  #emittedArmed = false;

  // the screen is locked by this controller
  #locked = false;

  #disposed = false;

  readonly #onFullscreenChange = (): void => {
    this.#syncState();
  };

  constructor(display: Display, host: DisplayFullscreenHost, options?: DisplayFullscreenOptions) {
    this.display = display;
    this.#host = host;
    this.#element = options?.element;
    this.navigationUI = options?.navigationUI ?? 'hide';
    this.orientationLock = options?.orientationLock;

    host.doc.addEventListener('fullscreenchange', this.#onFullscreenChange);
  }

  /**
   * The target of the next request: the `element` of the options, or the element around the
   * canvas while none is set. A new element takes effect with the next request; a fullscreen in
   * progress stays on the element it entered with.
   */
  get element(): HTMLElement {
    return this.#element ?? this.#host.defaultElement();
  }

  set element(element: HTMLElement) {
    this.#element = element;
  }

  /** The browser offers native fullscreen here: `fullscreenEnabled` of the document, and `requestFullscreen` on the target. */
  get isSupported(): boolean {
    return this.#host.doc.fullscreenEnabled === true && typeof this.element.requestFullscreen === 'function';
  }

  /** A {@link DisplayFullscreen.request} can succeed. What a fullscreen button shows itself by. */
  get isAvailable(): boolean {
    return this.isSupported;
  }

  /** The target is in fullscreen right now — by this controller or by anyone. */
  get isActive(): boolean {
    return this.#nativeElement() != null;
  }

  /** How the target is in fullscreen: `'native'`, or `undefined` while not active. */
  get mode(): FullscreenMode | undefined {
    return this.#nativeElement() != null ? 'native' : undefined;
  }

  /** `onLandscape` waits for a tap to enter fullscreen. */
  get isArmed(): boolean {
    return false;
  }

  /**
   * Enter fullscreen. Call it synchronously in the handler of a click, a key or a tap: the
   * browser grants a request only with a user gesture, and this method hands it on before it
   * awaits anything. Resolves with {@link DisplayFullscreen.isActive} afterwards; never rejects.
   */
  request(): Promise<boolean> {
    return this.#request('request');
  }

  /** Leave a fullscreen of the target. Resolves with {@link DisplayFullscreen.isActive} afterwards — `false` once left. */
  exit(): Promise<boolean> {
    if (this.#disposed) return Promise.resolve(false);

    // a fullscreen another element has stacked on top of the target is not the target's to leave
    if (this.#nativeElement() == null) return Promise.resolve(this.isActive);

    const settle = (): boolean => {
      this.#syncState();
      return this.isActive;
    };
    try {
      return this.#host.doc.exitFullscreen().then(settle, settle);
    } catch {
      return Promise.resolve(settle());
    }
  }

  /** {@link DisplayFullscreen.exit} while active, {@link DisplayFullscreen.request} otherwise. Resolves with `isActive` afterwards. */
  toggle(): Promise<boolean> {
    return this.isActive ? this.exit() : this.request();
  }

  /** @internal called by `Display#dispose()` */
  dispose(): void {
    if (this.#disposed) return;

    // only a fullscreen this controller entered: the app's own stays
    if (this.#entered != null && this.#nativeElement() != null) {
      try {
        this.#host.doc.exitFullscreen().catch(() => {});
      } catch {
        // a document that refuses at once has nothing to leave
      }
    }

    this.#unlock();
    this.#host.doc.removeEventListener('fullscreenchange', this.#onFullscreenChange);
    this.#activeElement = undefined;
    this.#entered = undefined;
    this.#disposed = true;
  }

  // the element of the native fullscreen of the target, or undefined: the element it entered
  // with while that holds, else the target of the next request
  #nativeElement(): HTMLElement | undefined {
    const candidate = this.#activeElement ?? this.element;
    return fullscreenElementOfRoot(candidate) === candidate ? candidate : undefined;
  }

  #request(by: EnteredBy): Promise<boolean> {
    if (this.#disposed) return Promise.resolve(false);
    if (this.isActive) return Promise.resolve(true);

    if (!this.isSupported) {
      warnUnavailable();
      return Promise.resolve(false);
    }

    const element = this.element;
    // before the call: the fullscreenchange it causes may come before the call returns
    this.#requesting = by;
    let pending: Promise<void>;
    try {
      // before any await: the gesture of the caller has to reach the browser
      pending = element.requestFullscreen({navigationUI: this.navigationUI});
    } catch {
      this.#requesting = undefined;
      warnRefused();
      return Promise.resolve(false);
    }

    return pending.then(
      () => {
        this.#syncState();
        if (this.#nativeElement() != null) this.#lock();
        return this.isActive;
      },
      () => {
        this.#requesting = undefined;
        warnRefused();
        return false;
      },
    );
  }

  #syncState(): void {
    if (this.#disposed) return;

    const active = this.#nativeElement();
    if (active != null) {
      if (this.#activeElement == null) {
        this.#activeElement = active;
        this.#entered = this.#requesting;
      }
      this.#requesting = undefined;
    } else if (this.#activeElement != null) {
      this.#activeElement = undefined;
      this.#entered = undefined;
      this.#unlock();
    }

    this.#emitIfChanged();
  }

  #orientation(): LockableOrientation | undefined {
    return this.#host.view.screen?.orientation as LockableOrientation | undefined;
  }

  #lock(): void {
    const type = this.orientationLock;
    const lock = this.#orientation()?.lock;
    if (type == null || typeof lock !== 'function') return;
    try {
      lock.call(this.#orientation(), type).then(
        () => {
          // a fullscreen that was left while the lock was pending gets no lock left behind
          if (this.#disposed || this.#nativeElement() == null) {
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

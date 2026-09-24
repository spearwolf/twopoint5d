import {emit, type EventizedObject, eventize, off} from '@spearwolf/eventize';

import {Stylesheets} from '../display/Stylesheets.js';
import {InputControlBase} from './InputControlBase.js';
import {readOption} from './readOption.js';

export interface PanViewState {
  x: number;
  y: number;

  pixelRatio?: number;
}

enum HideCursorState {
  NO = 0,
  MAYBE = 1,
  YES = 2,
}

interface PanInternalState {
  pointerType: string;

  panX: number;
  panY: number;

  lastX: number;
  lastY: number;
}

const mergePan = (states: PanInternalState[]) =>
  states.reduce(
    ({panX, panY}, state) => {
      panX += state.panX;
      panY += state.panY;

      state.panX = 0;
      state.panY = 0;

      return {panX, panY};
    },
    {
      panX: 0,
      panY: 0,
    },
  );

const MOUSE = 'mouse';

const KEYUP = 'keyup';
const KEYDOWN = 'keydown';

const POINTERUP = 'pointerup';
const POINTERDOWN = 'pointerdown';
const POINTERMOVE = 'pointermove';
const POINTERCANCEL = 'pointercancel';

type KeyedSpeedField = 'speedNorth' | 'speedSouth' | 'speedEast' | 'speedWest';

const DEFAULT_KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD'] as const;
const DEFAULT_KEY_CODES = [87, 83, 65, 68] as const;

// the speed field each of the four keys drives, in the order keys and keyCodes list them
const KEYED_SPEED_FIELDS: readonly KeyedSpeedField[] = ['speedNorth', 'speedSouth', 'speedWest', 'speedEast'];

const holdsDefault = (values: readonly unknown[], defaults: readonly unknown[]): boolean =>
  values.length === defaults.length && values.every((value, index) => value === defaults[index]);

// the rule name is taken from the cursor value, so that controls with different cursors get
// rules of their own. Every character outside [a-zA-Z0-9-] is written as _<hex>_ — "_" as well —
// which keeps the encoding injective: url(a.png) and url(a-png) never share a rule
const cursorRuleName = (cursor: string): string =>
  `PanControl2D-${cursor.replace(/[^a-zA-Z0-9-]/g, (ch) => `_${ch.charCodeAt(0).toString(16)}_`)}`;

// The root a cursor rule is retained for and given back to: the shadow root or the document that
// the styleSheetRoot stands for at the retain, pinned down as that shadow root or the head of that
// document. Stylesheets looks the sheet up from where the root sits at each call, and an element
// that moves between the retain and the release would lead the release to another sheet
function pinnedRootOf(root: HTMLElement | ShadowRoot): HTMLElement | ShadowRoot {
  const node = root.getRootNode();
  // by property, not by instanceof, so a shadow root of another realm passes as well
  if ('host' in node && 'adoptedStyleSheets' in node) return node as ShadowRoot;
  return root.ownerDocument.head;
}

export interface PanControl2DOptions {
  state?: PanViewState;

  /**
   * Cursor css style while panning. Default is 'none' (hide cursor).
   *
   * A value the browser does not understand as a value of the CSS property `cursor` is refused
   * with a warning on the console, and the control takes `'none'`.
   */
  cursorPanStyle?: string;

  cursorStylesTarget?: HTMLElement;

  /**
   * The element pointer coordinates are measured against: the control subtracts the
   * `getBoundingClientRect()` of this element from every pointer position. Default is the
   * `cursorStylesTarget`, and with that `document.body`.
   *
   * What matters for a pan is that the rectangle stays the same throughout a drag — the pan is
   * a difference of two measurements, and a fixed offset cancels out. Name the canvas here when
   * it sits in a shadow root: the browser retargets `event.target` onto the shadow host there,
   * and a canvas is not its host.
   */
  coordsTarget?: HTMLElement;

  /**
   * The root the cursor style rule is installed in. Default is `document.head`.
   *
   * A rule only reaches the elements of the root it sits in, so a control whose
   * `cursorStylesTarget` lives inside a shadow root has to name that root here — otherwise the
   * target carries the cursor class without a rule behind it. Both options have to mean the same
   * root: a `styleSheetRoot` named here while `cursorStylesTarget` stays on `document.body` puts
   * the class just as far out of the rule's reach.
   */
  styleSheetRoot?: HTMLElement | ShadowRoot;

  /** Scroll speed while using the keys. Pixels per seconds. Default is 100. */
  speed?: number;

  /**
   * Mouse button for panning. Default is 1.
   * - `1` left button
   * - `2` right button
   * - `4` middle button
   * - `8` 4th button, typical 'back'
   * - `16` 5th button, typical 'forward'
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/MouseEvent/buttons
   */
  mouseButton?: number;

  /**
   * The `KeyboardEvent.code` of the four keys, in this order:
   * 1. up
   * 2. down
   * 3. left
   * 4. right
   *
   * Default is `['KeyW', 'KeyS', 'KeyA', 'KeyD']`: the keys at the _WASD_ position, whatever the
   * keyboard layout labels them.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
   */
  keys?: [string, string, string, string];

  /**
   * Key codes in this order:
   * 1. up
   * 2. down
   * 3. left
   * 4. right
   *
   * Default is `[87, 83, 65, 68]`.
   *
   * @deprecated Use {@link PanControl2DOptions.keys}. `KeyboardEvent.keyCode` depends on the
   * keyboard layout. As long as `keyCodes` holds anything other than `[87, 83, 65, 68]` and
   * `keys` holds its default, the control compares `event.keyCode` with `keyCodes` instead of
   * `event.code` with `keys`.
   */
  keyCodes?: [number, number, number, number];

  disablePointer?: boolean;
  disableKeyboard?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface PanControl2D extends EventizedObject {}

export class PanControl2D extends InputControlBase {
  pixelsPerSecond = 0;

  speedNorth = 0;
  speedEast = 0;
  speedSouth = 0;
  speedWest = 0;

  #pointersDown: Map<number, PanInternalState> = new Map();

  // the pan a pointer collected before it ended, waiting for the next update() to deliver it
  #releasedPanX = 0;
  #releasedPanY = 0;

  // the field name a key currently holds up, not the key that raised it — keys and keyCodes are
  // public and writable, and what a key held down gives back is the field it moved
  #keyedSpeeds = new Set<KeyedSpeedField>();

  // Assigned in the constructor through the `cursorPanStyle` setter.
  #cursorPanStyle!: string;
  #cursorPanClass?: string;
  // the rule this control currently holds at Stylesheets, given back when it moves on or is disposed
  #cursorPanRuleName?: string;
  // the root that rule was retained for, and the one it goes back to
  #cursorPanRuleRoot?: HTMLElement | ShadowRoot;
  #cursorStylesTarget?: HTMLElement;
  #styleSheetRoot: HTMLElement | ShadowRoot;
  #hideCursorState = HideCursorState.NO;

  mouseButton: number;

  /**
   * The `KeyboardEvent.code` of the keys for up, down, left and right.
   *
   * @see {@link PanControl2DOptions.keys}
   */
  keys: [string, string, string, string];

  /**
   * The key codes for up, down, left and right.
   *
   * @deprecated Use {@link PanControl2D.keys}. See {@link PanControl2DOptions.keyCodes} for when
   * these still decide.
   */
  keyCodes: [number, number, number, number];

  /**
   * The element pointer coordinates are measured against. Can be swapped at runtime; the next
   * pointer event is measured against the new one.
   *
   * @see {@link PanControl2DOptions.coordsTarget}
   */
  coordsTarget?: HTMLElement;

  #pointerDisabled = false;
  #keyboardDisabled = false;

  constructor(options?: PanControl2DOptions) {
    super();
    eventize(this);

    this.panView = options?.state;

    this.pixelsPerSecond = readOption(options, 'speed', 100);

    // before the cursorPanStyle below: the setter retains the rule, and it has to know by
    // then which root the rule belongs in
    this.#styleSheetRoot = readOption(options, 'styleSheetRoot', document.head);

    this.cursorPanStyle = readOption(options, 'cursorPanStyle', 'none');
    // an option the setter refuses leaves the default standing
    if (this.#cursorPanClass == null) this.cursorPanStyle = 'none';
    this.#cursorStylesTarget = readOption(options, 'cursorStylesTarget', document.body);
    this.coordsTarget = readOption(options, 'coordsTarget', this.#cursorStylesTarget);

    this.mouseButton = readOption(options, 'mouseButton', 1);
    this.keys = readOption(options, 'keys', [...DEFAULT_KEYS] as [string, string, string, string]);
    this.keyCodes = readOption(options, 'keyCodes', [...DEFAULT_KEY_CODES] as [number, number, number, number]);

    this.pointerDisabled = readOption(options, 'disablePointer', false);
    this.keyboardDisabled = readOption(options, 'disableKeyboard', false);
  }

  /** The cursor css style this control shows while panning. */
  get cursorPanStyle(): string {
    return this.#cursorPanStyle;
  }

  /**
   * Set the cursor css style shown while panning.
   *
   * Every cursor style has a rule of its own, which controls showing the same style share and
   * whose css never changes: a write moves only this control onto another rule. The control gives
   * the previous rule back, and a rule no living control shows any more leaves the stylesheet.
   * Written during a drag, the new cursor shows at once.
   *
   * A value the browser does not understand as a value of the CSS property `cursor` is refused
   * with a warning on the console, and the getter keeps its value.
   *
   * On a disposed control the write is refused and the getter keeps its last value: a disposed
   * control retains no more rules from a stylesheet that is not its own, and has no target
   * left to carry the class.
   */
  set cursorPanStyle(value: string) {
    // a disposed control writes no further rules into a stylesheet it does not own
    if (this.isDisposed) return;

    if (this.#cursorPanStyle === value) return;

    const cursor = value || 'auto';

    // the value goes into a rule as it is, so it has to be a cursor and nothing else: a further
    // declaration or a closing brace never passes. A value only another browser knows costs a
    // warning, not the app
    if (!CSS.supports('cursor', cursor)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[PanControl2D] cursorPanStyle "${value}" is not a value of the CSS property cursor in this browser; the write is refused`,
      );
      return;
    }

    const ruleName = cursorRuleName(cursor);
    const ruleRoot = pinnedRootOf(this.#styleSheetRoot);
    const cursorPanClass = Stylesheets.retainRule(ruleName, `cursor: ${cursor}`, ruleRoot);

    // the fields change only after retainRule(): one that throws leaves the control on the rule
    // it holds, and that rule is still the one dispose() gives back
    const prevClass = this.#cursorPanClass;
    const prevRuleName = this.#cursorPanRuleName;
    const prevRuleRoot = this.#cursorPanRuleRoot;
    this.#cursorPanStyle = value;
    this.#cursorPanRuleName = ruleName;
    this.#cursorPanRuleRoot = ruleRoot;
    this.#cursorPanClass = cursorPanClass;

    // the target carries the old class while the cursor is hidden; left there, the restore
    // would take off the new one and the old one would stay for good
    const target = this.#cursorStylesTarget;
    if (this.#hideCursorState === HideCursorState.YES && target && prevClass !== cursorPanClass) {
      if (prevClass) target.classList.remove(prevClass);
      target.classList.add(cursorPanClass);
    }

    // the new rule is taken before the old one is given back: '' and 'auto' share a rule, and
    // the other way round it would leave the sheet only to be put there again at once
    if (prevRuleName != null && prevRuleRoot != null) {
      Stylesheets.releaseRule(prevRuleName, prevRuleRoot);
    }
  }

  // Assigned in the constructor through the `panView` setter, which substitutes a default for a missing state.
  #panView!: PanViewState;
  #isFirstPanViewUpdate = true;

  /**
   * The view state this control moves: {@link update} shifts its `x` and `y` by the speed
   * fields, the keys and the pointer, and writes them into this very object. Assigning
   * `undefined` puts a fresh state at `0, 0` in its place.
   *
   * The first `update()` after a state is assigned — in the constructor through
   * `options.state`, or here — emits `update` even when nothing moved, so a listener learns
   * where the view starts. Assigning the state this control already holds changes nothing:
   * before that first `update()` the announcement stays due, after it none is added.
   */
  get panView(): PanViewState {
    return this.#panView;
  }

  set panView(panView: PanViewState | undefined) {
    const prevPanView = this.#panView;
    this.#panView = panView ?? {x: 0, y: 0, pixelRatio: globalThis.devicePixelRatio ?? 1};
    // a new state makes the next update() announce it; the state already held changes nothing —
    // assigned again before that update(), it still has to be announced, and only update()
    // takes the announcement back
    if (prevPanView !== this.#panView) {
      this.#isFirstPanViewUpdate = true;
    }
  }

  get keyboardDisabled(): boolean {
    return this.#keyboardDisabled;
  }

  set keyboardDisabled(value: boolean) {
    this.#keyboardDisabled = value;
    if (!value) {
      this.addEventListener(document, KEYDOWN, this.#onKeyDown);
      this.addEventListener(document, KEYUP, this.#onKeyUp);
    } else {
      this.removeEventListener(document, KEYDOWN, this.#onKeyDown);
      this.removeEventListener(document, KEYUP, this.#onKeyUp);

      // the keyup that would release a held key's speed field reaches this control no longer
      this.#releaseKeyedSpeeds();
    }
  }

  get pointerDisabled(): boolean {
    return this.#pointerDisabled;
  }

  set pointerDisabled(value: boolean) {
    this.#pointerDisabled = value;
    if (!value) {
      this.addEventListener(document, POINTERDOWN, this.#onPointerDown);
      this.addEventListener(document, POINTERUP, this.#onPointerUp);
      this.addEventListener(document, POINTERMOVE, this.#onPointerMove);
      this.addEventListener(document, POINTERCANCEL, this.#onPointerCancel);
    } else {
      this.removeEventListener(document, POINTERDOWN, this.#onPointerDown);
      this.removeEventListener(document, POINTERUP, this.#onPointerUp);
      this.removeEventListener(document, POINTERMOVE, this.#onPointerMove);
      this.removeEventListener(document, POINTERCANCEL, this.#onPointerCancel);

      // a pan that nobody may deliver is dropped here, not kept: without this it waits for the
      // next update() after the pointer is switched back on and lands in one jump
      this.#dropPointers();

      // the pointerup that would restore the cursor style reaches this control no longer
      this.#restoreCursorStyle();
    }
  }

  /**
   * Take every listener off `document` and give back what the input sources are holding:
   * the pan collected in a drag, the keys still down and a hidden cursor.
   *
   * None of it can come back through an event any more — a `pointerup` and a `keyup` reach a
   * control that is no longer listening, and without this the view would keep moving by a key
   * nobody is pressing. A speed field a caller wrote by hand is not touched: {@link update}
   * moves the view by those whether an input source reaches this control or not.
   */
  override unsubscribe(): void {
    // first: with the listeners off document, no event can refill what the lines below give up
    super.unsubscribe();

    this.#dropPointers();
    this.#releaseKeyedSpeeds();
    this.#restoreCursorStyle();
  }

  /**
   * Move {@link panView} by what the speed fields, the keys and the pointer collected since
   * the last call, and emit `update` with the new `x` and `y` when that moved the view — and
   * on the first call after a state was assigned to {@link panView}, whether it moved or not.
   *
   * @param t delta time since last `update()` call in seconds
   */
  update(t: number): void {
    const {x: prevX, y: prevY} = this.panView;

    this.panView.y -= this.speedNorth * t;
    this.panView.y += this.speedSouth * t;
    this.panView.x += this.speedEast * t;
    this.panView.x -= this.speedWest * t;

    if (!this.#pointerDisabled) {
      let {panX, panY} = mergePan(Array.from(this.#pointersDown.values()));

      panX += this.#releasedPanX;
      panY += this.#releasedPanY;
      this.#releasedPanX = 0;
      this.#releasedPanY = 0;

      const pixelRatio = this.panView.pixelRatio || 1;

      this.panView.x -= panX / pixelRatio;
      this.panView.y -= panY / pixelRatio;
    }

    // the movement decides, not the input source: the speed fields move the view whether a
    // pointer and a keyboard reach this control or not
    if (this.#isFirstPanViewUpdate || prevX !== this.panView.x || prevY !== this.panView.y) {
      emit(this, 'update', {x: this.panView.x, y: this.panView.y});
    }

    if (this.#isFirstPanViewUpdate) {
      this.#isFirstPanViewUpdate = false;
    }
  }

  #isPanPointer(event: PointerEvent) {
    if (event.isPrimary) {
      if (event.type !== POINTERUP && event.pointerType === MOUSE) {
        return event.buttons & this.mouseButton;
      }
      return true;
    }
    return false;
  }

  #onPointerDown = (event: PointerEvent): void => {
    if (this.#isPanPointer(event)) {
      // an id that is still down missed its end: its old position is no anchor, and whatever it
      // collected goes with it
      const {x: lastX, y: lastY} = this.#toRelativeCoords(event);
      this.#pointersDown.set(event.pointerId, {
        pointerType: event.pointerType,

        lastX,
        lastY,

        panX: 0,
        panY: 0,
      });
      if (event.pointerType === MOUSE) {
        if (this.#hideCursorState === HideCursorState.NO) {
          this.#hideCursorState = HideCursorState.MAYBE;
        }
      }
    }
  };

  #hideCursor() {
    this.#hideCursorState = HideCursorState.YES;
    if (this.#cursorPanClass && this.#cursorStylesTarget) {
      this.#cursorStylesTarget.classList.add(this.#cursorPanClass);
    }
    emit(this, 'hideCursor', this);
  }

  #onPointerUp = (event: PointerEvent): void => {
    if (this.#isPanPointer(event)) {
      const state = this.#pointersDown.get(event.pointerId);
      if (state) {
        this.#updatePanState(event, state);
        this.#endPointer(event.pointerId, true);
      }
    }
    if (event.pointerType === MOUSE) {
      this.#restoreCursorUnlessMouseDown();
    }
  };

  // the browser took the pointer away (a scroll or zoom gesture, a dialog): nobody let go, so
  // what the drag collected is dropped rather than delivered
  #onPointerCancel = (event: PointerEvent): void => {
    this.#endPointer(event.pointerId, false);
    if (event.pointerType === MOUSE) {
      this.#restoreCursorUnlessMouseDown();
    }
  };

  // a pointer that ends either hands its pan on to the next update() or drops it
  #endPointer(pointerId: number, keepPan: boolean): void {
    const state = this.#pointersDown.get(pointerId);
    if (state == null) return;

    if (keepPan) {
      this.#releasedPanX += state.panX;
      this.#releasedPanY += state.panY;
    }
    this.#pointersDown.delete(pointerId);
  }

  #dropPointers(): void {
    this.#pointersDown.clear();
    this.#releasedPanX = 0;
    this.#releasedPanY = 0;
  }

  #restoreCursorUnlessMouseDown(): void {
    if (!Array.from(this.#pointersDown.values()).some((state) => state.pointerType === MOUSE)) {
      this.#restoreCursorStyle();
    }
  }

  #restoreCursorStyle() {
    // Only YES has a cursor to restore: that is the one state in which the class went onto the
    // target and a hideCursor went out. From MAYBE the state is taken back and nothing else
    // happens, and from NO there is nothing to take back — every pointer move over the page
    // passes here, and each one would otherwise report a restore of a cursor nobody hid.
    const wasHidden = this.#hideCursorState === HideCursorState.YES;

    this.#hideCursorState = HideCursorState.NO;

    if (!wasHidden) return;

    if (this.#cursorPanClass && this.#cursorStylesTarget) {
      this.#cursorStylesTarget.classList.remove(this.#cursorPanClass);
    }
    emit(this, 'restoreCursor', this);
  }

  #onPointerMove = (event: PointerEvent): void => {
    if (this.#isPanPointer(event)) {
      const state = this.#pointersDown.get(event.pointerId);
      if (state) {
        this.#updatePanState(event, state);

        if (this.#hideCursorState === HideCursorState.MAYBE) {
          this.#hideCursor();
        }
      }
    }
    // the pan button went up without a pointerup: released outside the window, or let go while
    // another button stays down, where the browser reports a pointermove. It ends the pan where
    // it was let go, so the position of this move does not count. The cursor goes back with the
    // pan, as it does for a pointerup — and the case of no button at all runs through here too
    if (event.pointerType === MOUSE && (event.buttons & this.mouseButton) === 0) {
      this.#endPointer(event.pointerId, true);
      this.#restoreCursorUnlessMouseDown();
    }
  };

  #updatePanState(event: PointerEvent, state: PanInternalState) {
    const {x, y} = this.#toRelativeCoords(event);

    state.panX += x - state.lastX;
    state.panY += y - state.lastY;

    state.lastX = x;
    state.lastY = y;
  }

  #toRelativeCoords(event: PointerEvent): {x: number; y: number} {
    const {clientX, clientY} = event;

    // without a target the client coordinates are the reference, and they are as stable a one
    // as any rectangle: the pan is a difference, and the offset cancels out either way
    if (this.coordsTarget == null) {
      return {x: clientX, y: clientY};
    }

    const {left, top} = this.coordsTarget.getBoundingClientRect();

    return {
      x: clientX - left,
      y: clientY - top,
    };
  }

  #speedFieldFor(event: KeyboardEvent): KeyedSpeedField | undefined {
    // keyCodes is deprecated and only decides when a caller set it. That is read off the values,
    // not a flag: the field is public and holds an array of its own, so a keyCodes[0] = 38
    // rebinds in place and has to keep working. Whoever sets keys as well gets keys
    const index =
      holdsDefault(this.keys, DEFAULT_KEYS) && !holdsDefault(this.keyCodes, DEFAULT_KEY_CODES)
        ? this.keyCodes.indexOf(event.keyCode)
        : this.keys.indexOf(event.code);
    return KEYED_SPEED_FIELDS[index];
  }

  #releaseKeyedSpeeds(): void {
    for (const field of this.#keyedSpeeds) {
      this[field] = 0;
    }
    this.#keyedSpeeds.clear();
  }

  #onKeyDown = (event: KeyboardEvent): void => {
    const field = this.#speedFieldFor(event);
    if (field == null) return;
    this[field] = this.pixelsPerSecond;
    this.#keyedSpeeds.add(field);
  };

  #onKeyUp = (event: KeyboardEvent): void => {
    const field = this.#speedFieldFor(event);
    if (field == null) return;
    this[field] = 0;
    this.#keyedSpeeds.delete(field);
  };

  /**
   * Take every listener off `document`, give the cursor styles target back the way it was
   * found, give the cursor rule back to the stylesheet and drop the pan that was collected but
   * never delivered.
   *
   * The `state` object and the `cursorStylesTarget` element were handed in and stay the
   * caller's: the state keeps the values the last {@link update} wrote, and the element keeps
   * everything but the cursor class this control put on it. The cursor rule stays in the
   * stylesheet for as long as another control in the same root shows the same cursor style.
   *
   * Afterwards `isDisposed` is `true`, `isActive` is `false`, and neither a pointer nor a key
   * reaches this control any more. {@link update} still moves {@link panView} by the speed
   * fields a caller sets by hand, and by a key that was still held down when `dispose()` ran
   * gives its field back — what it no longer delivers is a pan from a drag before the call. A
   * write to {@link cursorPanStyle} is refused: a disposed control retains no more rules from
   * a stylesheet that is not its own. `pixelsPerSecond`, `mouseButton`, `keys`, `keyCodes`,
   * `keyboardDisabled`, `pointerDisabled`,
   * `panView` and the four `speed…` fields still take values, they just drive nothing. A
   * control that was hiding the cursor emits one last `restoreCursor` while its subscribers
   * can still hear it; after that every listener on this control goes with it, and a further
   * `dispose()` does nothing.
   */
  override dispose(): void {
    if (this.isDisposed) return;

    // super.dispose() takes the listeners off and, through unsubscribe(), hands back what the
    // input sources were holding — while the listeners of this control are still attached, so
    // the restoreCursor that goes out on the way still reaches them
    super.dispose();

    // after super.dispose(): the cursor class is off the target by then (unsubscribe() restores
    // the cursor), so no element points at a rule that may leave the sheet here. unsubscribe()
    // keeps the rule, because a control that subscribes again still needs it
    if (this.#cursorPanRuleName != null && this.#cursorPanRuleRoot != null) {
      Stylesheets.releaseRule(this.#cursorPanRuleName, this.#cursorPanRuleRoot);
      this.#cursorPanRuleName = undefined;
      this.#cursorPanRuleRoot = undefined;
    }

    // last: the restoreCursor above still has to reach the listeners that act on it
    off(this);
  }
}

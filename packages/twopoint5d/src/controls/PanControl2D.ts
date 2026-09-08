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

type KeyedSpeedField = 'speedNorth' | 'speedSouth' | 'speedEast' | 'speedWest';

export interface PanControl2DOptions {
  state?: PanViewState;

  /** Cursor css style while panning. Default is 'none' (hide cursor) */
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
   * Key codes in this order:
   * 1. top
   * 2. bottom
   * 3. left
   * 4. right
   *
   * Default is [87, 83, 65, 68] which is the well known _WASD_ layout.
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

  // the field name a key currently holds up, not the key that raised it — keyCodes is public
  // and writable, and what a key held down gives back is the field it moved
  #keyedSpeeds = new Set<KeyedSpeedField>();

  // Assigned in the constructor through the `cursorPanStyle` setter.
  #cursorPanStyle!: string;
  #cursorPanClass?: string;
  #cursorStylesTarget?: HTMLElement;
  #styleSheetRoot: HTMLElement | ShadowRoot;
  #hideCursorState = HideCursorState.NO;

  mouseButton: number;
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

    // before the cursorPanStyle below: the setter installs the rule, and it has to know by
    // then which root the rule belongs in
    this.#styleSheetRoot = readOption(options, 'styleSheetRoot', document.head);

    this.cursorPanStyle = readOption(options, 'cursorPanStyle', 'none');
    this.#cursorStylesTarget = readOption(options, 'cursorStylesTarget', document.body);
    this.coordsTarget = readOption(options, 'coordsTarget', this.#cursorStylesTarget);

    this.mouseButton = readOption(options, 'mouseButton', 1);
    this.keyCodes = readOption(options, 'keyCodes', [87, 83, 65, 68]);

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
   * On a disposed control the write is refused and the getter keeps its last value: the style
   * rule behind it is shared by every control that writes into the same
   * {@link PanControl2DOptions.styleSheetRoot}.
   */
  set cursorPanStyle(value: string) {
    // the rule is installed under one name per root and shared by every control writing into
    // that root — a disposed control does not get to rewrite what the living ones are showing
    if (this.isDisposed) return;

    if (this.#cursorPanStyle !== value) {
      this.#cursorPanStyle = value;
      this.#cursorPanClass = this.#installCursorPanStyleRules();
    }
  }

  #installCursorPanStyleRules = (): string =>
    Stylesheets.installRule('PanControl2D', `cursor: ${this.#cursorPanStyle || 'auto'}`, this.#styleSheetRoot);

  // Assigned in the constructor through the `panView` setter, which substitutes a default for a missing state.
  #panView!: PanViewState;
  #isFirstPanViewUpdate = true;

  get panView(): PanViewState {
    return this.#panView;
  }

  set panView(panView: PanViewState | undefined) {
    const prevPanView = this.#panView;
    this.#panView = panView ?? {x: 0, y: 0, pixelRatio: globalThis.devicePixelRatio ?? 1};
    this.#isFirstPanViewUpdate = prevPanView !== this.#panView;
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
    } else {
      this.removeEventListener(document, POINTERDOWN, this.#onPointerDown);
      this.removeEventListener(document, POINTERUP, this.#onPointerUp);
      this.removeEventListener(document, POINTERMOVE, this.#onPointerMove);

      // a pan that nobody may deliver is dropped here, not kept: without this it waits for the
      // next update() after the pointer is switched back on and lands in one jump
      this.#pointersDown.clear();

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

    this.#pointersDown.clear();
    this.#releaseKeyedSpeeds();
    this.#restoreCursorStyle();
  }

  /**
   * @param t delta time since last `update()` call in seconds
   */
  update(t: number): void {
    const {x: prevX, y: prevY} = this.panView;

    this.panView.y -= this.speedNorth * t;
    this.panView.y += this.speedSouth * t;
    this.panView.x += this.speedEast * t;
    this.panView.x -= this.speedWest * t;

    if (!this.#pointerDisabled) {
      const {panX, panY} = mergePan(Array.from(this.#pointersDown.values()));

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
      const pointersDown = this.#pointersDown;
      if (!pointersDown.has(event.pointerId)) {
        const {x: lastX, y: lastY} = this.#toRelativeCoords(event);
        pointersDown.set(event.pointerId, {
          pointerType: event.pointerType,

          lastX,
          lastY,

          panX: 0,
          panY: 0,
        });
      }
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
    const pointersDown = this.#pointersDown;
    if (this.#isPanPointer(event)) {
      const state = pointersDown.get(event.pointerId);
      if (state) {
        this.#updatePanState(event, state);
        pointersDown.delete(event.pointerId);
      }
    }
    if (event.pointerType === MOUSE) {
      if (!Array.from(pointersDown.values()).find((state) => state.pointerType === MOUSE)) {
        this.#restoreCursorStyle();
      }
    }
  };

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
    if (event.pointerType === MOUSE && event.buttons === 0) {
      this.#restoreCursorStyle();
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

  #speedFieldFor(keyCode: number): KeyedSpeedField | undefined {
    switch (keyCode) {
      case this.keyCodes[0]:
        return 'speedNorth';
      case this.keyCodes[1]:
        return 'speedSouth';
      case this.keyCodes[2]:
        return 'speedWest';
      case this.keyCodes[3]:
        return 'speedEast';
      default:
        return undefined;
    }
  }

  #releaseKeyedSpeeds(): void {
    for (const field of this.#keyedSpeeds) {
      this[field] = 0;
    }
    this.#keyedSpeeds.clear();
  }

  #onKeyDown = ({keyCode}: KeyboardEvent): void => {
    const field = this.#speedFieldFor(keyCode);
    if (field == null) return;
    this[field] = this.pixelsPerSecond;
    this.#keyedSpeeds.add(field);
  };

  #onKeyUp = ({keyCode}: KeyboardEvent): void => {
    const field = this.#speedFieldFor(keyCode);
    if (field == null) return;
    this[field] = 0;
    this.#keyedSpeeds.delete(field);
  };

  /**
   * Take every listener off `document`, give the cursor styles target back the way it was
   * found and drop the pan that was collected but never delivered.
   *
   * The `state` object and the `cursorStylesTarget` element were handed in and stay the
   * caller's: the state keeps the values the last {@link update} wrote, and the element keeps
   * everything but the cursor class this control put on it.
   *
   * Afterwards `isDisposed` is `true`, `isActive` is `false`, and neither a pointer nor a key
   * reaches this control any more. {@link update} still moves {@link panView} by the speed
   * fields a caller sets by hand, and by a key that was still held down when `dispose()` ran
   * gives its field back — what it no longer delivers is a pan from a drag before the call. A
   * write to {@link cursorPanStyle} is refused: it would rewrite a style rule every control
   * writing into the same {@link PanControl2DOptions.styleSheetRoot} shares.
   * `pixelsPerSecond`, `mouseButton`, `keyCodes`, `keyboardDisabled`, `pointerDisabled`,
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

    // last: the restoreCursor above still has to reach the listeners that act on it
    off(this);
  }
}

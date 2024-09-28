import {emit, eventize, off} from '@spearwolf/eventize';

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

export interface PanControl2DOptions {
  state?: PanViewState;

  /** Cursor css style while panning. Default is 'none' (hide cursor) */
  cursorPanStyle?: string;

  cursorStylesTarget?: HTMLElement;

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

export class PanControl2D extends InputControlBase {
  pixelsPerSecond = 0;

  speedNorth = 0;
  speedEast = 0;
  speedSouth = 0;
  speedWest = 0;

  #pointersDown: Map<number, PanInternalState> = new Map();

  #cursorPanStyle: string;
  #cursorPanClass?: string;
  #cursorStylesTarget?: HTMLElement;
  #hideCursorState = HideCursorState.NO;

  mouseButton: number;
  keyCodes: [number, number, number, number];

  #pointerDisabled = false;
  #keyboardDisabled = false;

  constructor(options?: PanControl2DOptions) {
    super();
    eventize(this);

    this.panView = options?.state;

    this.pixelsPerSecond = readOption(options, 'speed', 100);

    this.cursorPanStyle = readOption(options, 'cursorPanStyle', 'none');
    this.#cursorStylesTarget = readOption(options, 'cursorStylesTarget', document.body);

    this.mouseButton = readOption(options, 'mouseButton', 1);
    this.keyCodes = readOption(options, 'keyCodes', [87, 83, 65, 68]);

    this.pointerDisabled = readOption(options, 'disablePointer', false);
    this.keyboardDisabled = readOption(options, 'disableKeyboard', false);
  }

  get cursorPanStyle(): string {
    return this.#cursorPanStyle;
  }

  set cursorPanStyle(value: string) {
    if (this.#cursorPanStyle !== value) {
      this.#cursorPanStyle = value;
      this.#cursorPanClass = this.#installCursorPanStyleRules();
    }
  }

  #installCursorPanStyleRules = (): string =>
    Stylesheets.installRule('PanControl2D', `cursor: ${this.#cursorPanStyle || 'auto'}`);

  #panView: PanViewState;
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
    }
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

    if (!this.#keyboardDisabled || !this.#pointerDisabled) {
      if (this.#isFirstPanViewUpdate || prevX !== this.panView.x || prevY !== this.panView.y) {
        emit(this, 'update', {x: this.panView.x, y: this.panView.y});
      }

      if (this.#isFirstPanViewUpdate) {
        this.#isFirstPanViewUpdate = false;
      }
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
    this.#hideCursorState = HideCursorState.NO;
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
    const {left, top} = (event.target as HTMLElement).getBoundingClientRect();

    return {
      x: clientX - left,
      y: clientY - top,
    };
  }

  #onKeyDown = ({keyCode}: KeyboardEvent): void => {
    const {pixelsPerSecond} = this;

    switch (keyCode) {
      case this.keyCodes[0]: // 87: // W
        this.speedNorth = pixelsPerSecond;
        break;
      case this.keyCodes[1]: // 83: // S
        this.speedSouth = pixelsPerSecond;
        break;
      case this.keyCodes[2]: // 65: // A
        this.speedWest = pixelsPerSecond;
        break;
      case this.keyCodes[3]: // 68: // D
        this.speedEast = pixelsPerSecond;
        break;
    }
  };

  #onKeyUp = ({keyCode}: KeyboardEvent): void => {
    switch (keyCode) {
      case this.keyCodes[0]: // 87: // W
        this.speedNorth = 0;
        break;
      case this.keyCodes[1]: // 83: // S
        this.speedSouth = 0;
        break;
      case this.keyCodes[2]: // 65: // A
        this.speedWest = 0;
        break;
      case this.keyCodes[3]: // 68: // D
        this.speedEast = 0;
        break;
    }
  };

  dispose(): void {
    this.destroyAllListeners();
    off(this);
  }
}

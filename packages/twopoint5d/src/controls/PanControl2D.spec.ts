import {on} from '@spearwolf/eventize';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {OnPanControl2DUpdate, type PanControl2DUpdateProps} from '../events.js';
import {PanControl2D, type PanControl2DOptions} from './PanControl2D.js';

// Stylesheets writes into a real CSSStyleSheet, and there is no document here to hold one
vi.mock('../display/Stylesheets.js', () => ({
  Stylesheets: {retainRule: vi.fn(() => 'pan-cursor'), releaseRule: vi.fn()},
}));

// The suite runs under node without a DOM: `document` and `window` are plain EventTargets, so
// the listeners of the control are hooked up for real and an event reaches them through
// dispatchEvent(). What the control reads off the document besides is added by hand.
let doc: EventTarget & {head: object; body: object};
let win: EventTarget;

const controls: PanControl2D[] = [];

function makeControl(options?: PanControl2DOptions): PanControl2D {
  const control = new PanControl2D({state: {x: 0, y: 0, pixelRatio: 1}, ...options});
  controls.push(control);
  return control;
}

interface KeyInit {
  code?: string;
  keyCode?: number;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  // the first entry of composedPath(): the element the key went into
  origin?: object;
}

// KeyboardEvent and PointerEvent do not exist in node: a plain Event carries their fields
function keyEvent(type: 'keydown' | 'keyup', {origin, ...init}: KeyInit): Event {
  const event = new Event(type);
  Object.defineProperties(event, {
    code: {value: init.code ?? ''},
    keyCode: {value: init.keyCode ?? 0},
    ctrlKey: {value: init.ctrlKey ?? false},
    metaKey: {value: init.metaKey ?? false},
    altKey: {value: init.altKey ?? false},
    shiftKey: {value: init.shiftKey ?? false},
    composedPath: {value: () => (origin ? [origin] : [])},
  });
  return event;
}

function key(type: 'keydown' | 'keyup', init: KeyInit): void {
  doc.dispatchEvent(keyEvent(type, init));
}

interface PointerInit {
  buttons: number;
  clientX?: number;
  clientY?: number;
}

function pointer(type: 'pointerdown' | 'pointermove' | 'pointerup', {buttons, clientX = 0, clientY = 0}: PointerInit): void {
  const event = new Event(type);
  Object.defineProperties(event, {
    pointerId: {value: 1},
    isPrimary: {value: true},
    pointerType: {value: 'mouse'},
    buttons: {value: buttons},
    clientX: {value: clientX},
    clientY: {value: clientY},
    composedPath: {value: () => []},
  });
  doc.dispatchEvent(event);
}

function drag(buttons: number): void {
  pointer('pointerdown', {buttons, clientX: 0});
  pointer('pointermove', {buttons, clientX: 10});
}

describe('PanControl2D', () => {
  beforeEach(() => {
    const body = {
      classList: {add: vi.fn(), remove: vi.fn()},
      getBoundingClientRect: () => ({left: 0, top: 0}),
    };
    doc = Object.assign(new EventTarget(), {head: {}, body});
    // pinnedRootOf() asks the root for its root node and falls back to the head of its document
    Object.assign(doc.head, {getRootNode: () => doc, ownerDocument: {head: doc.head}});
    win = new EventTarget();

    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', win);
    vi.stubGlobal('CSS', {supports: () => true});
  });

  afterEach(() => {
    for (const control of controls.splice(0)) control.dispose();
    // the config restores spies, not globals
    vi.unstubAllGlobals();
  });

  describe('keys the page loses', () => {
    it('lets go of a held key when the window loses focus', () => {
      const control = makeControl();
      key('keydown', {code: 'KeyW'});
      expect(control.speedNorth).toBe(100);

      win.dispatchEvent(new Event('blur'));

      expect(control.speedNorth).toBe(0);
      control.update(1);
      expect(control.panView.y).toBe(0);
    });

    it('lets go of a held key when the visibility of the page changes', () => {
      const control = makeControl();
      key('keydown', {code: 'KeyD'});
      expect(control.speedEast).toBe(100);

      doc.dispatchEvent(new Event('visibilitychange'));

      expect(control.speedEast).toBe(0);
      control.update(1);
      expect(control.panView.x).toBe(0);
    });

    it('keeps a speed field a caller wrote by hand', () => {
      const control = makeControl();
      control.speedWest = 50;

      win.dispatchEvent(new Event('blur'));

      expect(control.speedWest).toBe(50);
    });

    it('still lets go on blur after the keyboard was switched off and on again', () => {
      const control = makeControl();
      control.keyboardDisabled = true;
      control.keyboardDisabled = false;

      key('keydown', {code: 'KeyW'});
      win.dispatchEvent(new Event('blur'));

      expect(control.speedNorth).toBe(0);
    });

    it('takes the blur and visibilitychange listeners off on dispose()', () => {
      const winAdd = vi.spyOn(win, 'addEventListener');
      const docAdd = vi.spyOn(doc, 'addEventListener');
      const winRemove = vi.spyOn(win, 'removeEventListener');
      const docRemove = vi.spyOn(doc, 'removeEventListener');

      const control = makeControl();
      const onBlur = winAdd.mock.calls.find(([type]) => type === 'blur')?.[1];
      const onVisibilityChange = docAdd.mock.calls.find(([type]) => type === 'visibilitychange')?.[1];
      expect(onBlur).toBeTypeOf('function');
      expect(onVisibilityChange).toBeTypeOf('function');

      control.dispose();

      expect(winRemove).toHaveBeenCalledWith('blur', onBlur);
      expect(docRemove).toHaveBeenCalledWith('visibilitychange', onVisibilityChange);
    });
  });

  describe('keys meant for something else', () => {
    it.each(['ctrlKey', 'metaKey', 'altKey'] as const)('does not pan by a key pressed with %s', (modifier) => {
      const control = makeControl();
      key('keydown', {code: 'KeyW', [modifier]: true});
      expect(control.speedNorth).toBe(0);
    });

    it.each([
      ['input', {localName: 'input'}],
      ['textarea', {localName: 'textarea'}],
      ['select', {localName: 'select'}],
      ['contenteditable', {localName: 'div', isContentEditable: true}],
    ])('does not pan by a key typed into %s', (_name, origin) => {
      const control = makeControl();
      key('keydown', {code: 'KeyW', origin});
      expect(control.speedNorth).toBe(0);
    });

    it('does not pan by a key typed into an input in an open shadow root', () => {
      const control = makeControl();
      let target: EventTarget | null = null;
      doc.addEventListener('keydown', (event) => {
        target = event.target;
      });

      key('keydown', {code: 'KeyW', origin: {localName: 'input'}});

      // the listener on document sees the shadow host, here the document stub itself
      expect(target).toBe(doc);
      expect(control.speedNorth).toBe(0);
    });

    it('pans by a key pressed with Shift', () => {
      const control = makeControl();
      key('keydown', {code: 'KeyW', shiftKey: true});
      expect(control.speedNorth).toBe(100);
    });

    it('pans by a key that goes into a canvas', () => {
      const control = makeControl();
      key('keydown', {code: 'KeyW', origin: {localName: 'canvas'}});
      expect(control.speedNorth).toBe(100);
    });

    it('lets go of a held key by a keyup from wherever it comes', () => {
      const control = makeControl();
      key('keydown', {code: 'KeyW'});
      expect(control.speedNorth).toBe(100);

      key('keyup', {code: 'KeyW', origin: {localName: 'input'}, ctrlKey: true});

      expect(control.speedNorth).toBe(0);
    });
  });

  describe('options', () => {
    it('speed sets the pixels per second a key moves the view by', () => {
      const control = makeControl({speed: 40});
      expect(control.pixelsPerSecond).toBe(40);

      key('keydown', {code: 'KeyS'});
      control.update(0.5);

      expect(control.panView.y).toBe(20);
    });

    it('keys rebinds the four directions', () => {
      const control = makeControl({keys: ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']});

      key('keydown', {code: 'KeyA'});
      expect(control.speedWest).toBe(0);

      key('keydown', {code: 'ArrowLeft'});
      expect(control.speedWest).toBe(100);
    });

    it('keyCodes decide while keys holds its default', () => {
      const control = makeControl({keyCodes: [38, 40, 37, 39]});

      key('keydown', {code: 'KeyW', keyCode: 87});
      expect(control.speedNorth).toBe(0);

      key('keydown', {code: 'ArrowUp', keyCode: 38});
      expect(control.speedNorth).toBe(100);
    });

    it('keys win over keyCodes when both are set', () => {
      const control = makeControl({keys: ['KeyI', 'KeyK', 'KeyJ', 'KeyL'], keyCodes: [38, 40, 37, 39]});

      key('keydown', {code: 'ArrowUp', keyCode: 38});
      expect(control.speedNorth).toBe(0);

      key('keydown', {code: 'KeyI', keyCode: 73});
      expect(control.speedNorth).toBe(100);
    });

    it('disableKeyboard keeps the keys out until keyboardDisabled is written false', () => {
      const control = makeControl({disableKeyboard: true});

      key('keydown', {code: 'KeyW'});
      expect(control.speedNorth).toBe(0);

      control.keyboardDisabled = false;
      key('keydown', {code: 'KeyW'});
      expect(control.speedNorth).toBe(100);
    });

    it('mouseButton picks the button that pans', () => {
      const control = makeControl({mouseButton: 2});

      drag(1);
      control.update(0);
      expect(control.panView.x, 'the left button').toBe(0);

      pointer('pointerup', {buttons: 0});
      drag(2);
      control.update(0);
      expect(control.panView.x, 'the right button').toBe(-10);
    });

    it('disablePointer keeps a drag from panning', () => {
      const control = makeControl({disablePointer: true});

      drag(1);
      control.update(0);

      expect(control.panView.x).toBe(0);
    });

    it('state is the panView the control writes into, announced by the first update()', () => {
      const state = {x: 3, y: 4, pixelRatio: 1};
      const control = makeControl({state});
      expect(control.panView).toBe(state);

      const updates: unknown[] = [];
      on(control, OnPanControl2DUpdate, (props: unknown) => updates.push(props));

      control.update(0);
      expect(updates).toEqual([{x: 3, y: 4}]);

      key('keydown', {code: 'KeyD'});
      control.update(1);
      expect(state.x).toBe(103);
    });
  });

  describe('on…() shorthands', () => {
    it('onUpdate() hears where update() moved the view, until the function it returns takes it off', () => {
      const control = makeControl();
      const seen: PanControl2DUpdateProps[] = [];
      const off = control.onUpdate((props) => seen.push(props));

      control.update(0);
      off();
      control.speedEast = 10;
      control.update(1);

      expect(seen).toEqual([{x: 0, y: 0}]);
    });

    it('onHideCursor() and onRestoreCursor() hear a drag that hides the cursor and gives it back, with the control', () => {
      const control = makeControl();
      const hidden = vi.fn();
      const restored = vi.fn();
      control.onHideCursor(hidden);
      control.onRestoreCursor(restored);

      drag(1);

      expect(hidden).toHaveBeenCalledExactlyOnceWith(control);
      expect(restored).not.toHaveBeenCalled();

      pointer('pointerup', {buttons: 0});

      expect(restored).toHaveBeenCalledExactlyOnceWith(control);
    });

    it('a listener added through onUpdate() after dispose() still hears update(), which keeps moving the view', () => {
      const control = makeControl();
      control.dispose();
      const spy = vi.fn();
      control.onUpdate(spy);

      control.panView = {x: 1, y: 1};
      control.update(0);

      expect(spy).toHaveBeenCalledExactlyOnceWith({x: 1, y: 1});
    });

    it('a listener added through onRestoreCursor() after dispose() hears nothing', () => {
      const control = makeControl();
      control.dispose();
      const spy = vi.fn();
      control.onRestoreCursor(spy);

      drag(1);
      pointer('pointerup', {buttons: 0});

      expect(spy).not.toHaveBeenCalled();
    });
  });
});

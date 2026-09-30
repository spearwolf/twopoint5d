import {afterEach, beforeEach, describe, expect, test, vi} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import {PanControl2D} from './PanControl2D.js';

// Stylesheets writes into a real CSSStyleSheet, and there is no document here to hold one
vi.mock('../display/Stylesheets.js', () => ({
  Stylesheets: {retainRule: () => 'pan-cursor', releaseRule: () => {}},
}));

// a call that allocates anything costs 16 B at least; the allocation-free paths below
// measure a small fraction of a byte per call, the noise of a round spread over its calls
const BYTES_PER_CALL_LIMIT = 1;
const CALLS = 1000;

// the fields PanControl2D reads off a pointer event, on a plain object built once: a
// round hands the listener the same few objects again and again
const pointerEvent = (type: string, init: Record<string, unknown> = {}) =>
  ({
    type,
    pointerId: 1,
    isPrimary: true,
    pointerType: 'mouse',
    buttons: 1,
    clientX: 0,
    clientY: 0,
    ...init,
  }) as unknown as PointerEvent;

describe('PanControl2D on the hot path', () => {
  let control: PanControl2D;
  let onPointerDown: (event: PointerEvent) => void;
  let onPointerMove: (event: PointerEvent) => void;

  beforeEach(() => {
    // the DOM stubs of PanControl2D.spec.ts, without spies on the paths a round runs
    // through
    const doc = Object.assign(new EventTarget(), {
      head: {},
      body: {classList: {add() {}, remove() {}}, getBoundingClientRect: () => ({left: 0, top: 0})},
    });
    Object.assign(doc.head, {getRootNode: () => doc, ownerDocument: {head: doc.head}});
    vi.stubGlobal('document', doc);
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('CSS', {supports: () => true});

    const add = vi.spyOn(doc, 'addEventListener');
    control = new PanControl2D({state: {x: 0, y: 0, pixelRatio: 1}});
    const listenerFor = (type: string) => add.mock.calls.find(([t]) => t === type)![1] as (event: PointerEvent) => void;
    onPointerDown = listenerFor('pointerdown');
    onPointerMove = listenerFor('pointermove');
  });

  afterEach(() => {
    control.dispose();
    // the config restores spies, not globals
    vi.unstubAllGlobals();
  });

  test('update() with a mouse and a touch down allocates nothing per call', async () => {
    const touch = {pointerId: 2, pointerType: 'touch'};
    onPointerDown(pointerEvent('pointerdown'));
    onPointerDown(pointerEvent('pointerdown', {...touch, clientX: 100}));
    onPointerMove(pointerEvent('pointermove', {clientX: 20}));
    onPointerMove(pointerEvent('pointermove', {...touch, clientX: 130}));
    // delivers the pan and the announcement of the first call
    control.update(0);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) control.update(0);
    });
    const bytesPerCall = bytesPerRound / CALLS;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('a pointermove of a drag allocates nothing per call', async () => {
    onPointerDown(pointerEvent('pointerdown'));
    const there = pointerEvent('pointermove', {clientX: 10});
    const back = pointerEvent('pointermove', {clientX: 0});

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) onPointerMove(i & 1 ? back : there);
    });
    const bytesPerCall = bytesPerRound / CALLS;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('a pointermove of a mouse with no button down allocates nothing per call', async () => {
    const hover = pointerEvent('pointermove', {buttons: 0, clientX: 10});

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) onPointerMove(hover);
    });
    const bytesPerCall = bytesPerRound / CALLS;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });
});

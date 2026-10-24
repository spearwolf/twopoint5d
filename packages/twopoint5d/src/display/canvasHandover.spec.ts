import type {WebGPURenderer} from 'three/webgpu';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {releaseRenderer, waitForCanvas} from './canvasHandover.js';

const settle = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

const makeCanvas = () => new EventTarget() as unknown as HTMLCanvasElement;

const makeRenderer = (canvas: HTMLCanvasElement, backend: object = {}, dispose = vi.fn()) =>
  ({domElement: canvas, backend, dispose}) as unknown as WebGPURenderer;

// the state of a promise without waiting for it
const stateOf = async (promise: Promise<void>): Promise<'pending' | 'settled'> => {
  let state: 'pending' | 'settled' = 'pending';
  void promise.then(() => {
    state = 'settled';
  });
  await settle();
  return state;
};

describe('canvasHandover', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('waitForCanvas() answers undefined for a canvas no release has seen', () => {
    expect(waitForCanvas(makeCanvas())).toBeUndefined();
  });

  it('a release that hands the canvas back holds it from the moment releaseRenderer() returns until renderer.dispose() has run', async () => {
    const canvas = makeCanvas();
    let finishDispose!: () => void;
    const dispose = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishDispose = resolve;
        }),
    );

    releaseRenderer(makeRenderer(canvas, {}, dispose), {init: Promise.resolve(), handBack: true});

    const taken = waitForCanvas(canvas);
    expect(taken).toBeInstanceOf(Promise);

    await settle();
    expect(dispose).toHaveBeenCalledTimes(1);
    expect(await stateOf(taken!)).toBe('pending');

    finishDispose();
    await settle();
    expect(await stateOf(taken!)).toBe('settled');
    expect(waitForCanvas(canvas)).toBeUndefined();
  });

  it('a release that does not hand the canvas back leaves no entry', async () => {
    const canvas = makeCanvas();
    const dispose = vi.fn();

    releaseRenderer(makeRenderer(canvas, {}, dispose), {init: Promise.resolve(), handBack: false});

    expect(waitForCanvas(canvas)).toBeUndefined();
    await settle();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('a failed init leaves renderer.dispose() uncalled, takes the webglcontextlost listener of three off the canvas and lets no rejection escape', async () => {
    const canvas = makeCanvas();
    const removeEventListener = vi.fn();
    canvas.removeEventListener = removeEventListener;
    const listener = () => {};
    const dispose = vi.fn();

    releaseRenderer(makeRenderer(canvas, {isWebGLBackend: true, _onContextLost: listener}, dispose), {
      init: Promise.reject(new Error('init fails on purpose')),
      handBack: true,
    });
    await settle();

    expect(dispose).not.toHaveBeenCalled();
    expect(removeEventListener).toHaveBeenCalledWith('webglcontextlost', listener);
  });

  describe('a WebGL context the release has lost', () => {
    const makeLosingRenderer = (restore: (canvas: HTMLCanvasElement, state: {lost: boolean}) => void) => {
      const canvas = makeCanvas();
      const state = {lost: false};
      const loseContext = vi.fn();
      const restoreContext = vi.fn(() => restore(canvas, state));
      const gl = {
        isContextLost: () => state.lost,
        getExtension: (name: string) => (name === 'WEBGL_lose_context' ? {loseContext, restoreContext} : null),
      };
      const dispose = vi.fn(async () => {
        state.lost = true;
        canvas.dispatchEvent(new Event('webglcontextlost', {cancelable: true}));
      });
      return {canvas, restoreContext, renderer: makeRenderer(canvas, {isWebGLBackend: true, gl}, dispose)};
    };

    it('keeps the WebGL context a release has lost restorable and brings it back for the next display on the canvas', async () => {
      vi.useFakeTimers();
      const {canvas, restoreContext, renderer} = makeLosingRenderer((c, state) => {
        state.lost = false;
        c.dispatchEvent(new Event('webglcontextrestored'));
      });
      const lostEvents: Event[] = [];
      canvas.addEventListener('webglcontextlost', (event) => lostEvents.push(event));

      releaseRenderer(renderer, {init: Promise.resolve(), handBack: true});
      const taken = waitForCanvas(canvas);
      expect(taken).toBeInstanceOf(Promise);
      await vi.advanceTimersByTimeAsync(0);

      expect(lostEvents[0]?.defaultPrevented).toBe(true);
      expect(restoreContext).toHaveBeenCalledTimes(1);
      expect(await stateOf(taken!)).toBe('settled');
      expect(waitForCanvas(canvas)).toBeUndefined();
    });

    it('a context that does not come back within 2000 ms ends the wait with one warning and stays restorable for the next display', async () => {
      vi.useFakeTimers();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const {canvas, renderer} = makeLosingRenderer(() => {});

      releaseRenderer(renderer, {init: Promise.resolve(), handBack: true});
      const taken = waitForCanvas(canvas)!;
      expect(taken).toBeInstanceOf(Promise);
      await vi.advanceTimersByTimeAsync(2000);

      expect(await stateOf(taken)).toBe('settled');
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]?.[0]).toMatch(/did not come back within 2000 ms/);
      expect(waitForCanvas(canvas)).toBeInstanceOf(Promise);
    });
  });
});

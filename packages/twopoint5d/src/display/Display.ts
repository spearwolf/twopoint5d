import {
  emit,
  type EventizedObject,
  eventize,
  off,
  on,
  once,
  retain,
  retainClear,
  type UnsubscribeFunc,
} from '@spearwolf/eventize';
import {WebGPURenderer} from 'three/webgpu';
import {
  OnDisplayDispose,
  OnDisplayError,
  OnDisplayInit,
  OnDisplayPause,
  OnDisplayRenderFrame,
  OnDisplayResize,
  OnDisplayRestart,
  OnDisplayStart,
} from '../events.js';
import {Chronometer} from './Chronometer.js';
import {DisplayStateMachine} from './DisplayStateMachine.js';
import {FrameLoop} from './FrameLoop.js';
import {isWebGLRenderer} from './isWebGLRenderer.js';
import {isWebGPURenderer} from './isWebGPURenderer.js';
import {Stylesheets} from './Stylesheets.js';
import {getContentAreaSize, getHorizontalInnerMargin, getIsContentBox, getVerticalInnerMargin} from './styleUtils.js';
import type {CreateRendererParameters, DisplayEventProps, DisplayParameters, ResizeDisplayToFn} from './types.js';

let canvasMaxResolutionWarningWasShown = false;

function showCanvasMaxResolutionWarning(w: number, h: number) {
  if (!canvasMaxResolutionWarningWasShown) {
    // eslint-disable-next-line no-console
    console.warn(
      `Oops, the canvas width or height should not be bigger than ${Display.MaxResolution} pixels (${w}x${h} was requested).`,
      'If you need more, please set Display.MaxResolution before you create a Display!',
    );
    canvasMaxResolutionWarningWasShown = true;
  }
}

// one message for every member that refuses to answer once the display is gone, so the class
// and the state are always in the text a caller reads out of a foreign stack
function disposedError(member: string): Error {
  return new Error(`Display#${member} is not available: this display has been disposed`);
}

// renderer.dispose() destroys the device (WebGPUBackend.dispose()). On Firefox 155 under WebGPU,
// destroying a device while submitted work is still in flight reports a GPUInternalError on the
// destroyed device, and the page gets no requestAnimationFrame callback after that — every
// animation on the page stands still. So the queue runs dry first
async function drainSubmittedWork(renderer: WebGPURenderer): Promise<void> {
  // the three.js typings leave the device off the backend, and the WebGL backend has none
  const device = (renderer.backend as {device?: {queue: {onSubmittedWorkDone(): Promise<unknown>}} | null} | undefined)?.device;
  if (device == null) return;
  try {
    await device.queue.onSubmittedWorkDone();
  } catch {
    // a device that is already lost has no work left to wait for; the release goes on anyway
  }
}

// A WebGL context the browser has not brought back after this long is not coming back for the
// display waiting for the canvas, and that display starts on it anyway: a failed init reaches its
// caller through start() and the error event, a wait without end reaches nobody
const CONTEXT_RESTORE_TIMEOUT_MS = 2000;

// The WebGL context a release has lost on a canvas handed to a display, kept restorable. The
// context stays lost until a display is built on the canvas: a live context that nobody draws
// to counts against the few the browser keeps alive, and it drops the oldest one — possibly
// that of a running display — once there are too many
interface LostContext {
  gl: WebGL2RenderingContext;
  extension: WEBGL_lose_context;
  // settles once the webglcontextlost event has had its default prevented; before that the
  // browser turns down a restoreContext()
  prevented: Promise<void>;
  // the restore a display built on the canvas has started, so a display built while it runs
  // waits for the same one; cleared once it has ended with the context still lost
  restoring?: Promise<void>;
}

// The release of a renderer runs on after dispose() has returned, and the canvas handed to
// that display is not free before the release is through: a renderer initialized on it in
// the meantime would share the WebGL context of the one being released and lose it with it.
// The entry settles once the release is through, never rejects, and goes with it. A WeakMap,
// like lostContexts below, so an entry does not hold on to a canvas its caller has let go
const canvasReleases = new WeakMap<HTMLCanvasElement, Promise<void>>();

// The context a release has lost on a canvas handed to a display, for as long as it stays
// lost: however long no display comes, and past a restore that ran out of time, so every
// display built on the canvas tries once more. The display that brings it back takes the
// entry out
const lostContexts = new WeakMap<HTMLCanvasElement, LostContext>();

// A canvas keeps its one WebGL context for good and answers every later getContext('webgl2')
// with it, and WebGLBackend.dispose() gives that context up with WEBGL_lose_context.loseContext().
// A context whose loss has its default prevented can be restored later, so the release of a
// canvas that goes back to its caller prevents it and hands the context on to the next display
async function disposeKeepingContextRestorable(renderer: WebGPURenderer): Promise<LostContext | undefined> {
  // the three.js typings leave gl off the backend, and the WebGPU backend has none
  const backend = renderer.backend as {isWebGLBackend?: boolean; gl?: WebGL2RenderingContext | null} | undefined;
  const gl = backend?.isWebGLBackend ? backend.gl : undefined;
  // fetched before renderer.dispose(): a lost context answers getExtension() with null. Without
  // the extension three calls no loseContext(), and there is nothing to restore
  const extension = gl != null && !gl.isContextLost() ? gl.getExtension('WEBGL_lose_context') : null;
  if (gl == null || extension == null) {
    renderer.dispose();
    return undefined;
  }

  const canvas = renderer.domElement;
  let markPrevented!: () => void;
  const prevented = new Promise<void>((resolve) => {
    markPrevented = resolve;
  });
  const onContextLost = (event: Event) => {
    // only a loss whose default was prevented may be restored
    event.preventDefault();
    markPrevented();
  };
  // once: the listener is meant for the loss renderer.dispose() causes and for no later one
  canvas.addEventListener('webglcontextlost', onContextLost, {once: true});
  try {
    renderer.dispose();
  } catch (error) {
    canvas.removeEventListener('webglcontextlost', onContextLost);
    throw error;
  }
  if (!gl.isContextLost()) {
    // no loss, no event, and nothing to restore
    canvas.removeEventListener('webglcontextlost', onContextLost);
    return undefined;
  }
  return {gl, extension, prevented};
}

// Restores the context a release has lost on the canvas, for a display that is about to be
// built on it. Settles once the context is back, or after CONTEXT_RESTORE_TIMEOUT_MS
function restoreContext(canvas: HTMLCanvasElement, lost: LostContext): Promise<void> {
  if (!lost.gl.isContextLost()) return Promise.resolve();

  return new Promise<void>((resolve) => {
    let waiting = true;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;

    const endWait = () => {
      if (!waiting) return;
      waiting = false;
      canvas.removeEventListener('webglcontextrestored', endWait);
      clearTimeout(timeout);
      clearTimeout(restoreTimer);
      resolve();
    };

    const timeout = setTimeout(() => {
      endWait();
      // eslint-disable-next-line no-console
      console.warn(
        `new Display(): the WebGL context of the canvas did not come back within ${CONTEXT_RESTORE_TIMEOUT_MS} ms; the display starts on it anyway`,
      );
    }, CONTEXT_RESTORE_TIMEOUT_MS);

    canvas.addEventListener('webglcontextrestored', endWait);

    void lost.prevented.then(() => {
      if (!waiting) return;
      // the browser decides whether the context may come back only after the webglcontextlost
      // event has been dispatched; a restoreContext() inside its handler is turned down
      restoreTimer = setTimeout(() => {
        if (waiting) lost.extension.restoreContext();
      }, 0);
    });
  });
}

// What a display built on a canvas waits for before the init of its renderer starts: the release
// of the display on that canvas before it, while one runs, and the context a release has lost on
// the canvas coming back
async function takeOverCanvas(canvas: HTMLCanvasElement, release: Promise<void> | undefined): Promise<void> {
  await release;
  const lost = lostContexts.get(canvas);
  if (lost == null) return;

  lost.restoring ??= restoreContext(canvas, lost);
  const restoring = lost.restoring;
  await restoring;

  if (!lost.gl.isContextLost()) {
    // only this entry goes: one the release of a later display has made in the meantime stays
    if (lostContexts.get(canvas) === lost) lostContexts.delete(canvas);
  } else if (lost.restoring === restoring) {
    // the wait has run out and the entry stays, so the next display built on the canvas tries
    // the restore again
    lost.restoring = undefined;
  }
}

export type DisplayEventListener<T = DisplayEventProps> = (props: T) => unknown;

/**
 * The `Display` is the entry point for rendering with twopoint5d. It owns the
 * three.js `WebGPURenderer`, drives the per-frame loop via {@link FrameLoop},
 * and keeps the canvas size in sync with its environment.
 *
 * ## Lifecycle
 *
 * 1. `new Display(target, options)` — creates (or adopts) the renderer and
 *    canvas, installs the required CSS rules, performs an initial
 *    {@link Display.resize} (no `OnDisplayResize` event yet — see below) and
 *    wires up `document.visibilitychange` so the loop pauses while the tab is
 *    hidden — and, with {@link DisplayParameters.pauseOutsideViewport}, an
 *    `IntersectionObserver` on the canvas so it pauses while the canvas is
 *    outside the viewport, from the first report of the observer on.
 * 2. `await display.start()` — awaits renderer init, fires `OnDisplayInit`
 *    (once), then `OnDisplayStart`, and begins emitting `OnDisplayRenderFrame`.
 *    The display stands on its {@link FrameLoop} only while it runs: it is
 *    subscribed when it starts and taken off again when it pauses. A
 *    listener of `OnDisplayInit` or `OnDisplayRestart` that pauses the
 *    display holds it in the pause: `OnDisplayPause` follows instead of
 *    `OnDisplayStart`. A renderer that fails to initialize fires
 *    `OnDisplayError` instead, and `start()` rejects with the same error.
 * 3. `display.dispose()` — stops the loop, fires `OnDisplayDispose` and
 *    gives up {@link Display.renderer} right away. A container this display
 *    created inside a host element comes out of the DOM with the canvas in
 *    it; a canvas or a renderer handed to the constructor keeps its place in
 *    the document. The renderer itself is released after `dispose()` has
 *    returned, once its init is through and the GPU has run the work
 *    submitted to it. A canvas handed to the constructor carries a new
 *    display afterwards; one built on it while the release runs waits for
 *    it. Under WebGL only a display brings the context of that canvas
 *    back — see {@link Display.dispose}.
 * 4. After `dispose()` the instance is unusable, and says so. {@link Display.renderer}
 *    answers `undefined` and {@link Display.isDisposed} answers `true`.
 *    {@link Display.canvas}, {@link Display.start}, {@link Display.getEventProps},
 *    {@link Display.isWebGPUBackend} and {@link Display.isWebGLBackend}
 *    throw. {@link Display.resize}, {@link Display.renderFrame},
 *    {@link Display.stop}, a write to {@link Display.pause} and a further
 *    `dispose()` do nothing.
 *    {@link Display.nextFrame} is rejected, and so is a promise it handed out
 *    earlier that is still pending. {@link Display.width},
 *    {@link Display.height}, {@link Display.frameNo}, {@link Display.now} and
 *    {@link Display.deltaTime} keep their last value, {@link Display.pixelRatio}
 *    keeps reading the window and {@link Display.isRunning} is `false`. No further
 *    event is emitted — no `OnDisplayRenderFrame`, no `OnDisplayResize`, no
 *    `OnDisplayError` — and a listener attached afterwards receives nothing, not
 *    even a retained value.
 *
 * ## Resize model
 *
 * **There is no `window.resize` listener.** {@link Display.resize} is invoked
 * at the beginning of every frame from {@link Display.renderFrame}, so the
 * canvas size, the `THREE` renderer size and the `pixelRatio` are always
 * re-evaluated against the current DOM/window state on the next frame. This
 * is a deliberate design decision: it covers window resizes, container
 * reflows, devicePixelRatio changes, `resize-to` attribute mutations and
 * `resizeToElement` swaps uniformly, without registering DOM listeners that
 * would have to be cleaned up. A `resize` is a no-op when nothing actually
 * changed (size + pixelRatio + pixelZoom are hashed in
 * `#lastResizeHash`).
 *
 * The size source is resolved in this priority order, evaluated each frame:
 *
 * 1. If {@link Display.resizeToAttributeEl} carries a `resize-to` attribute,
 *    its value selects the source:
 *    - `"window"` / `"fullscreen"` (with optional leading colon) →
 *      `window.innerWidth × window.innerHeight`. Adds the
 *      `twopoint5d-canvas--fullscreen` CSS class to the canvas
 *      (`position:fixed; top:0; left:0`). The class is removed when the
 *      attribute changes back to anything else.
 *    - `"self"` → uses the canvas (or {@link Display.resizeToElement}) itself.
 *    - any other non-empty string is a CSS selector, looked up in the root
 *      node of {@link Display.resizeToAttributeEl} — the document, or the
 *      shadow root it sits in; falls back to {@link Display.resizeToElement}
 *      or the canvas if the selector finds nothing. A value that is not a
 *      valid selector is reported once via `console.warn` and falls back the
 *      same way.
 * 2. If {@link Display.resizeToCallback} is set, it is called every frame and
 *    its `[width, height]` return value wins over any element-based size
 *    measurement (the `resize-to` attribute still controls the
 *    fullscreen-CSS toggle, but its measured size is discarded).
 * 3. Otherwise the content-area of {@link Display.resizeToElement} is
 *    measured via `getBoundingClientRect()` minus padding/border.
 *
 * The resolved pixel size is then clamped to `[0, Display.MaxResolution]`
 * (per axis), padded/unpadded depending on the canvas `box-sizing`, and
 * passed to `renderer.setPixelRatio()` / `renderer.setSize()`. CSS
 * `width`/`height` and `image-rendering` are written to the canvas inline
 * style. {@link Display.pixelZoom} divides the device pixel size to produce
 * the logical {@link Display.width} / {@link Display.height}, which is what
 * `OnDisplayResize` consumers see.
 *
 * `OnDisplayResize` is emitted **exactly once** per frame. On the first
 * rendered frame the event always fires (so listeners attached before
 * `start()` receive a guaranteed initial-size event); on subsequent frames
 * it fires only when the resize hash actually changed. The constructor's
 * initial `resize()` does **not** emit, because `frameNo` is still `0` and
 * listeners cannot be attached yet — `OnDisplayResize` is also `retain`ed
 * so subscribers attaching after the first frame still receive the latest
 * size on subscription.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Display extends EventizedObject {}

export class Display {
  /**
   * Hard upper bound (per axis, in device pixels) for the canvas size
   * computed by {@link Display.resize}. Sizes beyond this are clamped and a
   * one-time `console.warn` is emitted.
   *
   * Adjust this _before_ constructing a `Display` if you genuinely need a
   * larger canvas (and the GPU supports it).
   */
  static MaxResolution = 8192;

  static CssRulesPrefixContainer = 'twopoint5d-container';
  static CssRulesPrefixDisplay = 'twopoint5d-canvas';
  static CssRulesPrefixFullscreen = 'twopoint5d-canvas--fullscreen';

  /**
   * The internal {@link Chronometer} is seeded with `maxDeltaTime = 1/30`
   * (≈ 33ms) so individual frame outliers (background-tab rAF throttling,
   * GC pauses, debugger breakpoints) are capped and the overflow is
   * folded into the lost-time accumulator instead of producing a frame
   * spike. Set {@link Display.maxDeltaTime} = 0 to disable the cap.
   */
  #chronometer = new Chronometer(undefined, 1 / 30);

  #stateMachine = new DisplayStateMachine();

  // counts stop() and every pause = true. start() reads it before its first await: a pause
  // that came in while it waited for the renderer or for beforeStartCallback keeps the display
  // from starting, unless a pause = false has lifted it again since
  #pauseRequests = 0;

  #lastResizeHash = '';

  /**
   * Minimum interval (in milliseconds) between the DOM measurements inside
   * {@link Display.resize}. Defaults to `0` (no throttle — `resize()` runs
   * every frame, matching the legacy behavior).
   *
   * On high-refresh-rate displays the per-frame `getComputedStyle()` and
   * `getBoundingClientRect()` calls force a layout each frame and can
   * dominate the per-frame budget (240Hz = up to 240 forced reflows per
   * second). Set this to e.g. `1000 / 60` to cap the measurement rate at
   * 60Hz while keeping the size up-to-date for any resize event the user
   * can perceive. The cheap hash-based no-op short-circuit inside
   * `resize()` still applies on every poll.
   */
  resizePollIntervalMs = 0;

  #lastResizePollMs = Number.NEGATIVE_INFINITY;

  /**
   * Set by `resize()` to mark whether it emitted `OnDisplayResize` on its
   * most recent invocation. Read by `renderFrame()` to decide whether the
   * first-frame fallback emit is still needed — guarantees that
   * `OnDisplayResize` fires exactly once on the first frame and exactly once
   * per subsequent frame in which the resize hash actually changed.
   */
  #didEmitResize = false;

  #fullscreenCssRules?: string;
  #fullscreenCssRulesMustBeRemoved = false;

  // resize() runs every frame, and the resize-to value almost never changes: the element a
  // selector found is kept for as long as it still sits in the same root and still matches, so
  // a frame costs no DOM search. An invalid selector is kept too, so it is reported only once
  #resizeToSelector?: {value: string; root: Node; element: Element | null; invalid: boolean};

  /**
   * The pixelZoom factor is 0 by default and is therefore not used.
   *
   * If it is greater than 0, the _devicePixelRatio_ value is ignored and
   * _cssPixel * pixelZoom_ is used as the effective pixelRatio of the display.
   *
   * This is interesting for pixelart: a value of 2 means that each CSS pixel is rendered twice as large,
   * regardless of the devicePixelRatio.
   */
  pixelZoom = 0;

  /**
   * If set, will be used to set the `image-rendering` css style property on the canvas element.
   *
   * Otherwise will be set to `"pixelated"` if _pixelZoom_ greater than `0` or `"auto"` if pixelZoom is less or equal to `0`.
   *
   * If you want to explicitly specify a value here, set.
   *
   * see {@link https://developer.mozilla.org/en-US/docs/Web/CSS/image-rendering}
   * for more information.
   *
   * see {@link Display.pixelZoom}
   */
  styleImageRendering?: 'pixelated' | 'auto' = undefined;

  #disposed = false;

  #width = 0;
  #height = 0;

  /**
   * The width of the canvas is recalculated for each frame.
   */
  get width(): number {
    return this.#width;
  }

  /**
   * The height of the canvas is recalculated for each frame.
   */
  get height(): number {
    return this.#height;
  }

  /**
   * The current frame number. Starts at 1.
   */
  frameNo = 0;

  #isFirstFrame = true;

  get isFirstFrame(): boolean {
    return this.#isFirstFrame;
  }

  frameLoop: FrameLoop;

  /**
   * The HTML element whose content-area size drives the canvas size each
   * frame, when no `resize-to` attribute and no
   * {@link Display.resizeToCallback} take precedence.
   *
   * Defaults to:
   * - the renderer's `domElement`, if a `WebGPURenderer` was passed to the
   *   constructor;
   * - the canvas element itself, if a `<canvas>` was passed;
   * - the host element, if any other `HTMLElement` was passed (a `<div>`
   *   container is created inside it and the canvas is appended there).
   *
   * Can be overridden via {@link DisplayParameters.resizeToElement} in the
   * constructor or reassigned at runtime — the next frame's `resize()` picks
   * up the change.
   *
   * @see {@link DisplayParameters.resizeToElement}
   */
  resizeToElement?: HTMLElement;

  /**
   * Optional per-frame size provider. If set, it is invoked at the start of
   * each frame and its returned `[width, height]` (in CSS pixels) overrides
   * any element-based measurement. Use this for app-specific sizing logic
   * (e.g. fitting to a UI panel, applying min/max constraints, locking
   * aspect ratio).
   *
   * The `resize-to` attribute is still honored for its fullscreen-CSS
   * toggle, but the size it would compute is discarded in favor of the
   * callback's return value.
   *
   * @see {@link DisplayParameters.resizeTo}
   */
  resizeToCallback?: ResizeDisplayToFn;

  /**
   * The HTML element that {@link Display.resize} consults each frame for the
   * `resize-to` attribute. Defaults to the canvas element, but you can point
   * it at a wrapper if you prefer to control sizing declaratively from the
   * outside (see {@link DisplayParameters.resizeToAttributeEl}).
   *
   * @see {@link DisplayParameters.resizeToAttributeEl}
   */
  resizeToAttributeEl: HTMLElement;

  /**
   * see {@link DisplayParameters.styleSheetRoot}
   */
  styleSheetRoot: HTMLElement | ShadowRoot;

  renderer?: WebGPURenderer;

  /**
   * `true` once {@link Display.dispose} has run. Branch on this wherever a display
   * arrives from somewhere else and may already be gone.
   */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /**
   * The canvas element the renderer draws into.
   *
   * Throws after {@link Display.dispose}: the renderer that holds the canvas is gone,
   * and this type promises an element.
   */
  get canvas(): HTMLCanvasElement {
    if (this.renderer == null) {
      throw disposedError('canvas');
    }
    return this.renderer.domElement;
  }

  /**
   * `true` when the renderer draws through a WebGPU backend.
   *
   * Throws after {@link Display.dispose}: the renderer this asks about is gone, and this type
   * promises an answer about a backend. Branch on {@link Display.isDisposed} first where a
   * display may already be gone.
   */
  get isWebGPUBackend(): boolean {
    if (this.#disposed) {
      throw disposedError('isWebGPUBackend');
    }
    return (this.renderer?.backend as {isWebGPUBackend?: boolean} | undefined)?.isWebGPUBackend ?? false;
  }

  /**
   * `true` when the renderer draws through a WebGL backend.
   *
   * Throws after {@link Display.dispose}: the renderer this asks about is gone, and this type
   * promises an answer about a backend. Branch on {@link Display.isDisposed} first where a
   * display may already be gone.
   */
  get isWebGLBackend(): boolean {
    if (this.#disposed) {
      throw disposedError('isWebGLBackend');
    }
    return (this.renderer?.backend as {isWebGLBackend?: boolean} | undefined)?.isWebGLBackend ?? false;
  }

  readonly #waitForRenderer: Promise<WebGPURenderer>;

  // The container this display created inside a host element, and the canvas in it. Set only on
  // that construction path, because that is the only one on which they are this display's to give
  // back — see dispose().
  #ownContainer?: HTMLDivElement;

  // The canvas handed to the constructor as its first argument. It is the caller's, and the
  // release of the renderer hands it back able to carry the next display — see #releaseRenderer()
  #callersCanvas?: HTMLCanvasElement;

  /**
   * Create a display around a canvas, around a container element that gets a canvas of its own,
   * or around a `WebGPURenderer` that is already built.
   *
   * A canvas handed in here stays the caller's. If a display disposed before this one is still
   * releasing the renderer it had on that canvas, or left its WebGL context lost, the renderer of
   * this display starts its init once that release is through and the context is back, or once
   * the wait for the context has run out — see {@link Display.dispose}.
   *
   * A renderer handed in here is adopted, not borrowed: the display takes it and its
   * `domElement` as its own. {@link Display.dispose} releases it with `renderer.dispose()`, once
   * its init is through and the GPU has run the work submitted to it. A renderer that has to
   * outlive this display therefore does not belong in here.
   *
   * @param domElementOrRenderer a `<canvas>`, any other `HTMLElement` to host a canvas, or a
   *   ready-made `WebGPURenderer`
   */
  constructor(domElementOrRenderer: HTMLElement | WebGPURenderer, options?: DisplayParameters) {
    eventize(this);
    retain(this, [OnDisplayInit, OnDisplayStart, OnDisplayResize, OnDisplayError]);

    this.#chronometer.stop();

    // the display-owned keys come off the options here, so what is left is exactly what a
    // WebGPURenderer takes — everything below reads its options from these constants
    const {
      maxFps,
      pauseOutsideViewport,
      resizeTo,
      resizeToElement,
      resizeToAttributeEl,
      styleSheetRoot,
      createRenderer,
      ...rendererOptions
    } = options ?? {};

    this.resizeToCallback = resizeTo;
    this.styleSheetRoot = styleSheetRoot ?? document.head;

    if (isWebGLRenderer(domElementOrRenderer)) {
      // eslint-disable-next-line no-console
      console.warn(
        'The Display constructor expects a WebGPURenderer or an HTML element as the first argument.',
        'Since twopoint5d@0.13 a WebGLRenderer is not supported anymore.',
      );
      throw new TypeError('The Display constructor expects a WebGPURenderer or an HTML element as the first argument!');
    }

    if (isWebGPURenderer(domElementOrRenderer)) {
      this.renderer = domElementOrRenderer;
      this.resizeToElement = this.renderer.domElement;
    } else if (domElementOrRenderer instanceof HTMLElement) {
      let canvas: HTMLCanvasElement;
      if (domElementOrRenderer.tagName === 'CANVAS') {
        canvas = domElementOrRenderer as HTMLCanvasElement;
        this.#callersCanvas = canvas;
      } else {
        const container = document.createElement('div');
        Stylesheets.addRule(
          container,
          Display.CssRulesPrefixContainer,
          // we create another container div here to avoid the if container-has-no-discrete-size
          // then line-height-and-font-height-styles-give-weird-client-rect-behavior issue
          'display:block;width:100%;height:100%;margin:0;padding:0;border:0;line-height:0;font-size:0;',
          this.styleSheetRoot,
        );
        domElementOrRenderer.appendChild(container);

        canvas = document.createElement('canvas');
        container.appendChild(canvas);

        // only what was built here: a canvas that arrived as an argument belongs to the caller,
        // and the domElement of a renderer that arrived as one stays where the caller put it
        this.#ownContainer = container;
      }
      this.resizeToElement = domElementOrRenderer;

      const makeRenderer =
        createRenderer ??
        ((params: CreateRendererParameters) => {
          return new WebGPURenderer({
            // TODO check if this is still needed
            ...params,
          });
        });

      try {
        this.renderer = makeRenderer({
          canvas,
          stencil: false,
          alpha: true,
          antialias: true,
          powerPreference: 'high-performance',
          ...rendererOptions,
        } as CreateRendererParameters);
      } catch (error) {
        // the container went into the host a few lines up, and a constructor that throws leaves
        // no instance behind whose dispose() could take it back out again
        this.#ownContainer?.remove();
        this.#ownContainer = undefined;
        throw error;
      }
    } else {
      // every wrong first argument gets the same answer, whatever it is: without this a null
      // would die inside init() with a TypeError that names neither this constructor nor what
      // it takes
      throw new TypeError('The Display constructor expects a WebGPURenderer or an HTML element as the first argument!');
    }

    // Both construction paths end with a renderer and both have to wait for the same promise.
    // One assignment, so a path that gets added later cannot leave the field empty. A canvas whose
    // previous display is still releasing its renderer, or whose WebGL context a release has left
    // lost, is not free yet: the init starts once that release is through and the context is back,
    // or once the wait for the context has run out
    const renderer = this.renderer!;
    const previousRelease = canvasReleases.get(renderer.domElement);
    this.#waitForRenderer =
      previousRelease != null || lostContexts.has(renderer.domElement)
        ? takeOverCanvas(renderer.domElement, previousRelease).then(() => renderer.init())
        : renderer.init();

    this.frameLoop = new FrameLoop(maxFps ?? 0, this.renderer);

    const {domElement: canvas} = this.renderer!;
    Stylesheets.addRule(canvas, Display.CssRulesPrefixDisplay, 'touch-action: none;', this.styleSheetRoot);
    canvas.setAttribute('touch-action', 'none'); // => PEP polyfill

    this.resizeToElement = resizeToElement ?? this.resizeToElement;
    this.resizeToAttributeEl = resizeToAttributeEl ?? canvas;

    this.resize();

    on(this.#stateMachine, {
      [DisplayStateMachine.Init]: () => this.#emit(OnDisplayInit),

      [DisplayStateMachine.Restart]: () => this.#emit(OnDisplayRestart),

      [DisplayStateMachine.Start]: () => {
        const t = performance.now() / 1000;
        this.#chronometer.start(t);
        this.#chronometer.update(t);

        // on the loop before the event goes out: a start listener may set pause = true right
        // away, the pause handler takes the display off the loop then, and a subscription after
        // the emit would put a paused display back on it
        this.frameLoop.start(this);

        this.#emit(OnDisplayStart);
      },

      [DisplayStateMachine.Pause]: () => {
        this.#chronometer.stop(performance.now() / 1000);

        // off the loop before the event goes out, for the mirrored reason: a pause listener that
        // sets pause = false starts the display again right away, and an unsubscription after the
        // emit would take a running display off its loop
        this.frameLoop.stop(this);

        retainClear(this, OnDisplayStart);

        this.#emit(OnDisplayPause);
      },
    });

    if (typeof document !== 'undefined') {
      const onDocVisibilityChange = () => {
        this.#stateMachine.documentIsVisible = !document.hidden;
      };

      document.addEventListener('visibilitychange', onDocVisibilityChange, false);

      once(this, OnDisplayDispose, () => {
        document.removeEventListener('visibilitychange', onDocVisibilityChange, false);
      });

      onDocVisibilityChange();
    }

    if (pauseOutsideViewport && typeof IntersectionObserver !== 'undefined') {
      const observer = new IntersectionObserver((entries) => {
        // the entries of one callback arrive in time order, and the last one is where the
        // canvas is now
        const entry = entries[entries.length - 1];
        if (entry != null) {
          this.#stateMachine.elementIsInsideViewport = entry.isIntersecting;
        }
      });
      observer.observe(canvas);
      once(this, OnDisplayDispose, () => {
        observer.disconnect();
      });
    }

    this.#waitForRenderer.catch((error) => {
      // a renderer that never comes up is what the caller has to hear about; left here it
      // would be an unhandled rejection and the display would simply stay dark
      emit(this, OnDisplayError, error, this);
    });
  }

  /**
   * The current time in seconds. Starts at `0`.
   *
   * Time does not elapse until the display has been started with {@link start}.
   *
   * At the beginning of a frame the time is updated.
   * Within a frame the time remains unchanged.
   */
  get now(): number {
    return this.#chronometer.time;
  }

  get deltaTime(): number {
    return this.#chronometer.deltaTime;
  }

  /**
   * Upper bound on the per-frame `deltaTime` (in seconds). When a frame
   * delta exceeds this value the overflow is folded into the chronometer's
   * lost-time accumulator, so `now` stays continuous and `deltaTime` never
   * reports a spike. Useful against rAF throttling, GC pauses and
   * debugger breakpoints — a single hiccup no longer cascades into
   * physics jumps or animation glitches.
   *
   * Defaults to `1 / 30` (~33ms). Set to `0` to disable the cap entirely.
   */
  get maxDeltaTime(): number {
    return this.#chronometer.maxDeltaTime;
  }

  set maxDeltaTime(value: number) {
    this.#chronometer.maxDeltaTime = value;
  }

  /**
   * Whether the frame loop is paused.
   *
   * After {@link Display.dispose} a write does nothing, while the getter keeps reading the
   * state the display was left in — one that was running when it was disposed answers `true`,
   * whatever is written to it.
   */
  get pause(): boolean {
    return this.#stateMachine.state === DisplayStateMachine.PAUSED;
  }

  set pause(pause: boolean) {
    // un-pausing is a restart: the state machine would go back to RUNNING and the chronometer
    // with it. There is nothing left to run, so a disposed display stays where dispose() put it
    if (this.#disposed) return;

    if (pause) this.#pauseRequests += 1;
    this.#stateMachine.pausedByUser = pause;
  }

  get isRunning(): boolean {
    return this.#stateMachine.isRunning;
  }

  get pixelRatio(): number {
    if (this.pixelZoom > 0) {
      return 1.0;
    }
    return this.devicePixelRatio;
  }

  get devicePixelRatio(): number {
    return window.devicePixelRatio ?? 1;
  }

  /**
   * Recomputes the canvas pixel size, CSS size and renderer pixel ratio from
   * the current DOM/window state and applies them to the renderer and the
   * canvas inline style.
   *
   * Called automatically at the start of every frame from
   * {@link Display.renderFrame}, so user code rarely needs to invoke this.
   * It is safe to call manually (e.g. immediately after a layout-affecting
   * DOM mutation if you cannot wait for the next frame); the work is
   * short-circuited via an internal hash when nothing actually changed.
   *
   * Resolution order for the size source: the `resize-to` attribute on
   * {@link Display.resizeToAttributeEl} (if present), then
   * {@link Display.resizeToCallback} (if set, wins over element measurement),
   * then the content-area of {@link Display.resizeToElement}. The fallback
   * size when nothing else applies is `300 × 150` (HTML's intrinsic canvas
   * size). See the class-level docs for the full priority table.
   *
   * Emission of `OnDisplayResize` is deferred to
   * {@link Display.renderFrame}; this method only mutates state and returns.
   *
   * Does nothing after {@link Display.dispose} — there is no canvas left to measure.
   */
  resize(): void {
    if (this.#disposed) return;

    this.#didEmitResize = false;

    if (this.resizePollIntervalMs > 0) {
      const nowMs = performance.now();
      if (nowMs - this.#lastResizePollMs < this.resizePollIntervalMs) {
        return;
      }
      this.#lastResizePollMs = nowMs;
    }

    let wPx = 300;
    let hPx = 150;

    const canvasElement = this.canvas;

    let sizeRefElement: Element | undefined = this.resizeToElement;

    let fullscreenCssRulesMustBeRemoved = this.#fullscreenCssRulesMustBeRemoved;

    if (this.resizeToAttributeEl.hasAttribute('resize-to')) {
      const resizeTo = this.resizeToAttributeEl.getAttribute('resize-to')!.trim();
      if (resizeTo.match(/^:?(fullscreen|window)$/)) {
        wPx = window.innerWidth;
        hPx = window.innerHeight;
        sizeRefElement = undefined;

        let fullscreenCssRules = this.#fullscreenCssRules;
        if (!fullscreenCssRules) {
          fullscreenCssRules = Stylesheets.installRule(
            Display.CssRulesPrefixFullscreen,
            `position:fixed;top:0;left:0;`,
            this.styleSheetRoot,
          );
          this.#fullscreenCssRules = fullscreenCssRules;
        }
        if (fullscreenCssRulesMustBeRemoved) {
          fullscreenCssRulesMustBeRemoved = false;
        } else {
          canvasElement.classList.add(fullscreenCssRules);
          this.#fullscreenCssRulesMustBeRemoved = true;
        }
      } else if (resizeTo === 'self') {
        sizeRefElement = this.resizeToElement ?? canvasElement;
      } else if (resizeTo) {
        sizeRefElement = this.#resolveResizeToSelector(resizeTo) ?? this.resizeToElement ?? canvasElement;
      }
    }

    if (fullscreenCssRulesMustBeRemoved) {
      if (this.#fullscreenCssRules) {
        canvasElement.classList.remove(this.#fullscreenCssRules);
      }
      this.#fullscreenCssRulesMustBeRemoved = false;
    }

    if (this.resizeToCallback) {
      const size = this.resizeToCallback(this);
      if (size) {
        wPx = size[0];
        hPx = size[1];
      }
    } else if (sizeRefElement) {
      const area = getContentAreaSize(sizeRefElement);
      wPx = area.width;
      hPx = area.height;
    }

    let cssWidth = wPx;
    let cssHeight = hPx;

    const canvasStyle = getComputedStyle(canvasElement, null);
    const canvasIsContentBox = getIsContentBox(canvasStyle);
    const canvasHorizontalInnerMargin = getHorizontalInnerMargin(canvasStyle);
    const canvasVerticalInnerMargin = getVerticalInnerMargin(canvasStyle);

    if (canvasIsContentBox && canvasElement !== sizeRefElement) {
      wPx -= canvasHorizontalInnerMargin;
      hPx -= canvasVerticalInnerMargin;
      cssWidth -= canvasHorizontalInnerMargin;
      cssHeight -= canvasVerticalInnerMargin;
    } else if (!canvasIsContentBox && canvasElement === sizeRefElement) {
      cssWidth += canvasHorizontalInnerMargin;
      cssHeight += canvasVerticalInnerMargin;
    }

    if (wPx < 0) {
      wPx = 0;
    }
    if (hPx < 0) {
      hPx = 0;
    }

    if (cssWidth < 0) {
      cssWidth = 0;
    }
    if (cssHeight < 0) {
      cssHeight = 0;
    }

    if (wPx > Display.MaxResolution || hPx > Display.MaxResolution) {
      // the warning names the size that was asked for, so it goes out before the clamp
      showCanvasMaxResolutionWarning(wPx, hPx);
      wPx = Math.min(wPx, Display.MaxResolution);
      hPx = Math.min(hPx, Display.MaxResolution);
    }

    const {pixelRatio, pixelZoom} = this;
    const resizeHash = `${wPx}|${cssWidth}x${hPx}|${cssHeight}x${pixelRatio},${pixelZoom}`;

    if (resizeHash !== this.#lastResizeHash) {
      this.#lastResizeHash = resizeHash;

      if (pixelZoom > 0) {
        this.#width = wPx / pixelZoom;
        this.#height = hPx / pixelZoom;
      } else {
        this.#width = wPx;
        this.#height = hPx;
      }

      this.#width = Math.floor(this.#width);
      this.#height = Math.floor(this.#height);

      this.renderer!.setPixelRatio(pixelRatio);
      this.renderer!.setSize(this.width, this.height, false);

      canvasElement.style.width = `${cssWidth}px`;
      canvasElement.style.height = `${cssHeight}px`;
      canvasElement.style.imageRendering = this.styleImageRendering ?? (pixelZoom > 0 ? 'pixelated' : 'auto');

      const isConstructing = this.frameNo === 0;
      if (!isConstructing) {
        this.#emit(OnDisplayResize);
        this.#didEmitResize = true;
      }
    }
  }

  #resolveResizeToSelector(value: string): Element | undefined {
    // the document, the shadow root the attribute element sits in, or the topmost element of a
    // detached tree — all three can run querySelector
    const root = this.resizeToAttributeEl.getRootNode() as Node & ParentNode;

    const cached = this.#resizeToSelector;
    if (cached?.value === value && cached.root === root) {
      if (cached.invalid) return undefined;
      if (cached.element != null && cached.element.getRootNode() === root && cached.element.matches(value)) {
        return cached.element;
      }
    }

    let element: Element | null;
    try {
      element = root.querySelector(value);
    } catch {
      // eslint-disable-next-line no-console
      console.warn(
        `[Display] resize-to="${value}" is not a valid selector; the display falls back to its resizeToElement or the canvas`,
      );
      this.#resizeToSelector = {value, root, element: null, invalid: true};
      return undefined;
    }

    this.#resizeToSelector = {value, root, element, invalid: false};
    return element ?? undefined;
  }

  [FrameLoop.OnFrame](props: {now: number}): void {
    if (this.isRunning) {
      // FrameLoop emits `now` in seconds; renderFrame expects ms.
      this.renderFrame(props.now * 1000);
    }
  }

  /**
   * Renders one frame: advances the chronometer, runs {@link Display.resize}
   * to keep the canvas in sync with its environment, emits
   * `OnDisplayResize` (always on the first frame, otherwise only when the
   * size or pixelRatio actually changed), and finally emits
   * `OnDisplayRenderFrame` so listeners can draw.
   *
   * You normally do not call this yourself — the {@link FrameLoop} drives it
   * automatically once {@link Display.start} has resolved.
   *
   * Does nothing after {@link Display.dispose} — there is no renderer left to draw with.
   */
  renderFrame(now = window.performance.now()): void {
    if (this.#disposed) return;

    this.#isFirstFrame = this.frameNo === 0;
    this.frameNo += 1;

    this.#chronometer.update(now / 1000);

    this.resize();

    // Exactly one OnDisplayResize goes out on the first rendered frame: either
    // resize() above emitted it because the measured size differs from the
    // constructor measurement, or this line does. Listeners attached before
    // start() get their initial size either way.
    if (this.isFirstFrame && !this.#didEmitResize) this.#emit(OnDisplayResize);

    this.#emit(OnDisplayRenderFrame);
  }

  /**
   * Waits for the renderer initialization, runs `beforeStartCallback` and then starts the
   * display.
   *
   * The first start emits `OnDisplayInit`, then `OnDisplayStart`, both within this call and in
   * this order; a start after a pause emits `OnDisplayRestart`, then `OnDisplayStart`. A
   * listener of `OnDisplayInit` or `OnDisplayRestart` that calls {@link Display.stop} or sets
   * `pause = true` holds the display in the pause: `OnDisplayPause` follows instead of
   * `OnDisplayStart`.
   *
   * A {@link Display.stop} or a `pause = true` that comes in while `start()` waits wins: the
   * promise resolves with the display, which does not run. A `pause = false` after it lets the
   * start through.
   *
   * If the tab is hidden when the display starts, the display goes into the pause and emits
   * `OnDisplayPause`; `OnDisplayInit` and `OnDisplayStart` follow once the tab is visible. With
   * {@link DisplayParameters.pauseOutsideViewport}, the observer reports asynchronously, and a
   * canvas outside the viewport takes one of two ways: if the first report lands before the
   * display starts — often while this call still waits for the renderer —, the display goes
   * into the pause as with a hidden tab, and `OnDisplayInit` and `OnDisplayStart` follow once
   * the canvas comes into view; if it lands after the start, the display starts first and
   * pauses with that report.
   *
   * Throws after {@link Display.dispose}. A promise that resolves without a frame ever
   * following would be a dead end the caller cannot see, and the caller is waiting on
   * the effect, not on the value.
   */
  async start(beforeStartCallback?: (args: DisplayEventProps) => Promise<void> | void): Promise<Display> {
    if (this.#disposed) throw disposedError('start()');

    const pauseRequests = this.#pauseRequests;

    await this.#waitForRenderer;

    // dispose() can land inside the await above; without this the state machine
    // would report a display as running that has already given up its renderer
    if (this.#disposed) throw disposedError('start()');

    if (typeof beforeStartCallback === 'function') {
      await beforeStartCallback(this.getEventProps());

      // the callback is foreign code and holds the start for as long as it likes — a teardown
      // that runs while it loads its assets lands right here, and the two lines below would
      // hand a display that has given up its renderer back to the state machine as running
      if (this.#disposed) throw disposedError('start()');
    }

    // a stop() or a pause = true that came in while this call waited wins over it, unless a
    // pause = false has lifted it since — the last word the caller spoke is the one that counts
    if (this.#pauseRequests !== pauseRequests && this.#stateMachine.pausedByUser) {
      return this;
    }

    this.#stateMachine.pausedByUser = false;
    this.#stateMachine.start();

    return this;
  }

  /**
   * Pauses the display, as `pause = true` does. {@link Display.start} or `pause = false` let it
   * run again.
   *
   * Does nothing after {@link Display.dispose}.
   */
  stop(): void {
    this.#pauseRequests += 1;
    this.#stateMachine.pausedByUser = true;
  }

  /**
   * Tears the display down.
   *
   * Before it returns, `dispose()` stops the frame loop, fires `OnDisplayDispose`, drops every
   * listener, gives up {@link Display.renderer} and takes a container this display built out of
   * the DOM, with the canvas in it. The renderer itself is released after the return, with
   * `renderer.dispose()`: once its init is through and the GPU has run the work submitted to it.
   *
   * A canvas handed to the constructor goes back to the caller able to carry a new display.
   * Under the WebGL backend `renderer.dispose()` loses the context of that canvas, and a canvas
   * keeps its one WebGL context for good, so the release keeps that context restorable and
   * leaves it lost. Only a `Display` brings it back: a `WebGPURenderer` or a
   * `getContext('webgl2')` of your own on that canvas gets the lost context. The next `Display`
   * built on the same canvas — while the release runs or any time after — waits for the
   * release, restores the context and then starts the init of its renderer. A context the
   * browser has not brought back within two seconds ends the wait with a warning on the
   * console; it stays lost and restorable, and the next `Display` built on the canvas tries
   * again.
   *
   * A `dispose()` while the renderer is still initializing waits for that init instead of
   * cutting it short. An init that fails has built nothing to release, and its rejection does
   * not escape. A second call does nothing.
   */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    this.stop();
    this.frameLoop.stop(this);
    // the listeners are still attached here: this event is what tells them to let go,
    // and off(this) below is what makes it the last event this display ever emits
    emit(this, OnDisplayDispose, this);
    off(this);

    const renderer = this.renderer;
    delete this.renderer;
    if (renderer != null) this.#releaseRenderer(renderer);

    // the container and the canvas in it leave the document right away; the renderer holds on
    // to its canvas itself and does not need it in the document to release it
    this.#ownContainer?.remove();
    this.#ownContainer = undefined;
  }

  #releaseRenderer(renderer: WebGPURenderer): void {
    // read synchronously: the entry in canvasReleases has to stand before dispose() returns, so a
    // display built on the canvas in the same tick waits for this release. The comparison keeps a
    // createRenderer that ignores the canvas it was given from handing on a foreign canvas
    const canvas = this.#callersCanvas;
    const handBack = canvas != null && renderer.domElement === canvas;
    // the canvas stays the caller's, and a disposed display does not keep it reachable
    this.#callersCanvas = undefined;

    // dispose() can fall in the middle of the init (a mount and unmount under React StrictMode).
    // three does not release a renderer whose init is still running: the init would run to its
    // end and keep the device, the context and the animation loop of three for good. So the
    // release waits for the init, and then for the GPU. A canvas handed to the constructor goes
    // back to its caller at the end of it, with its WebGL context lost but restorable, so the
    // next display on it can bring the context back
    const released: Promise<void> = this.#waitForRenderer
      .then(
        async () => {
          await drainSubmittedWork(renderer);
          if (!handBack) {
            renderer.dispose();
            return;
          }
          const lost = await disposeKeepingContextRestorable(renderer);
          // set before the release settles, so a display that waits for the release finds it
          if (lost != null) lostContexts.set(canvas, lost);
        },
        () => {
          // a failed init has built nothing that renderer.dispose() would release, and its
          // setAnimationLoop(null) would wait on the rejected init once more — a rejection that
          // nobody could catch
        },
      )
      .catch((error: unknown) => {
        // eslint-disable-next-line no-console
        console.error('Display#dispose(): releasing the renderer failed after dispose() returned', error);
      });

    if (handBack) {
      // set before dispose() returns, so a display built on the canvas in the same tick sees it
      canvasReleases.set(canvas, released);
      void released.then(() => {
        // only this entry goes: one a display after this one has made in the meantime stays
        if (canvasReleases.get(canvas) === released) canvasReleases.delete(canvas);
      });
    }
  }

  /**
   * This is a public method so it's easy to override if you want
   *
   * Throws after {@link Display.dispose}: `DisplayEventProps` promises a `renderer`,
   * and there is none left to put in it.
   */
  getEventProps(): DisplayEventProps {
    if (this.renderer == null) {
      throw disposedError('getEventProps()');
    }
    return {
      display: this,
      renderer: this.renderer,

      width: this.width,
      height: this.height,
      pixelRatio: this.pixelRatio,

      now: this.now,
      deltaTime: this.deltaTime,

      frameNo: this.frameNo,
    };
  }

  #emit = (eventName: string): void => {
    if (this.renderer != null) {
      emit(this, eventName, this.getEventProps());
    }
  };

  readonly onResize = (listener: DisplayEventListener): UnsubscribeFunc => on(this, OnDisplayResize, listener);

  readonly onRenderFrame = (listener: DisplayEventListener): UnsubscribeFunc => on(this, OnDisplayRenderFrame, listener);
  readonly onNextFrame = (listener: DisplayEventListener): UnsubscribeFunc => once(this, OnDisplayRenderFrame, listener);

  /**
   * Resolves with the props of the next rendered frame.
   *
   * Rejects after {@link Display.dispose}, and a promise still pending when
   * `dispose()` runs is rejected as well — no frame is ever going to follow it.
   */
  readonly nextFrame = (): Promise<DisplayEventProps> =>
    new Promise<DisplayEventProps>((resolve, reject) => {
      if (this.#disposed) {
        reject(disposedError('nextFrame()'));
        return;
      }
      // dispose() emits before it drops its listeners, so this is the last moment
      // at which a caller waiting for a frame that will never come can be told
      const unsubscribeDispose = once(this, OnDisplayDispose, () => {
        reject(disposedError('nextFrame()'));
      });
      once(this, OnDisplayRenderFrame, (props: DisplayEventProps) => {
        unsubscribeDispose();
        resolve(props);
      });
    });

  /**
   * Subscribes `listener` to the `error` event: the renderer of this display did not come up,
   * and no frame is going to follow.
   *
   * The event is retained, so a listener attached after the failure is told about it too.
   */
  readonly onError = (listener: (error: unknown, display: Display) => unknown): UnsubscribeFunc =>
    on(this, OnDisplayError, listener);

  readonly onInit = (listener: DisplayEventListener): UnsubscribeFunc => on(this, OnDisplayInit, listener);
  readonly onStart = (listener: DisplayEventListener): UnsubscribeFunc => on(this, OnDisplayStart, listener);
  readonly onRestart = (listener: DisplayEventListener): UnsubscribeFunc => on(this, OnDisplayRestart, listener);
  readonly onPause = (listener: DisplayEventListener): UnsubscribeFunc => on(this, OnDisplayPause, listener);

  /**
   * Subscribes `listener` to the one `OnDisplayDispose` event this display emits.
   *
   * A listener attached after {@link Display.dispose} is never called: the event has
   * already gone out, and it is not replayed.
   */
  readonly onDispose = (listener: DisplayEventListener<Display>): UnsubscribeFunc => once(this, OnDisplayDispose, listener);
}

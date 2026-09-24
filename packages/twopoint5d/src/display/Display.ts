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
      `Oops, the canvas width or height should not be bigger than ${Display.MaxResolution} device pixels (${w}x${h} was requested).`,
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

// The rules a display installs through Stylesheets. The container rule is for the extra div
// a display builds inside a host element: without a discrete size of its own, the line height
// and font size of the host would give that div a weird client rect
const CONTAINER_RULE_CSS = 'display:block;width:100%;height:100%;margin:0;padding:0;border:0;line-height:0;font-size:0;';
const CANVAS_RULE_CSS = 'touch-action: none;';
const FULLSCREEN_RULE_CSS = 'position:fixed;top:0;left:0;';

// A GPU that has not reported the work submitted to it done after this long is not going to;
// the release goes on instead of holding every later display on the canvas. Generous against the
// reason for the wait below, short against a remount — the same as CONTEXT_RESTORE_TIMEOUT_MS
const SUBMITTED_WORK_TIMEOUT_MS = 2000;

// renderer.dispose() destroys the device (WebGPUBackend.dispose()), and WebGPU allows an
// implementation to drop the work still pending on a device that is destroyed
// (GPUDevice.destroy()). So the queue runs dry first, or the device reports itself lost, which
// leaves no work to wait for. The wait ends after SUBMITTED_WORK_TIMEOUT_MS at the latest, with a
// warning: an implementation that never answers must not hold the release forever
async function drainSubmittedWork(renderer: WebGPURenderer): Promise<void> {
  // the three.js typings leave the device off the backend, and the WebGL backend has none
  const device = (
    renderer.backend as {device?: {queue: {onSubmittedWorkDone(): Promise<unknown>}; lost?: Promise<unknown>} | null} | undefined
  )?.device;
  if (device == null) return;

  const drained = (async () => {
    try {
      await device.queue.onSubmittedWorkDone();
    } catch {
      // a device that is already lost has no work left to wait for; the release goes on anyway
    }
    return false;
  })();
  // a device without the promise has one way less to end the wait
  const lost = device.lost?.then(
    () => false,
    () => false,
  );

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(true), SUBMITTED_WORK_TIMEOUT_MS);
  });

  try {
    if (await Promise.race(lost != null ? [drained, lost, timedOut] : [drained, timedOut])) {
      // eslint-disable-next-line no-console
      console.warn(
        `Display#dispose(): the GPU did not report the work submitted to it done within ${SUBMITTED_WORK_TIMEOUT_MS} ms; the renderer is released anyway`,
      );
    }
  } finally {
    clearTimeout(timer);
  }
}

// A page that has not drawn two frames after this long is hidden, and a hidden page presents no
// canvas either; the release goes on. The same as SUBMITTED_WORK_TIMEOUT_MS
const ANIMATION_FRAMES_TIMEOUT_MS = 2000;

// On Firefox 155 under WebGPU, a renderer.dispose() on a canvas that is still in the document,
// before the page has presented what was drawn into it last, reports a GPUInternalError (`Buffer
// with '' label has been destroyed`), and the page gets no requestAnimationFrame callback after
// that — every animation on the page stands still. Whether the queue has run dry makes no
// difference; a canvas outside the document is not affected. A canvas handed to the constructor
// and the canvas of an adopted renderer stay where their caller put them, so the release waits
// for two animation frames of the page: the callbacks of the first run before the page presents
// the frame the canvas was drawn into last (the "update the rendering" steps of HTML run them
// before painting), those of the second after it. Under WebGL, and for a canvas without a
// window, there is nothing to wait for
async function waitForTwoAnimationFrames(renderer: WebGPURenderer): Promise<void> {
  // the three.js typings leave the device off the backend, and the WebGL backend has none
  const device = (renderer.backend as {device?: object | null} | undefined)?.device;
  // the window of the document the canvas sits in, which presents it — an iframe has its own
  const view = renderer.domElement.ownerDocument?.defaultView;
  if (device == null || view == null) return;

  await new Promise<void>((resolve) => {
    let request = 0;
    const timer = setTimeout(() => {
      view.cancelAnimationFrame(request);
      resolve();
    }, ANIMATION_FRAMES_TIMEOUT_MS);
    // the second frame is requested inside the callback of the first: two requests in the same
    // tick would come in the same frame
    request = view.requestAnimationFrame(() => {
      request = view.requestAnimationFrame(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  });
}

// WebGLBackend.init() puts a webglcontextlost listener on the canvas before the part of it that
// can fail. renderer.dispose() would take it off, but releases only a renderer whose init went
// through, and three makes the listener reachable only through this field, private by convention
function dropContextLostListener(renderer: WebGPURenderer): void {
  // the three.js typings leave the field off the backend
  const backend = renderer.backend as {isWebGLBackend?: boolean; _onContextLost?: EventListener} | undefined;
  if (backend?.isWebGLBackend && backend._onContextLost != null) {
    renderer.domElement.removeEventListener('webglcontextlost', backend._onContextLost);
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
// entry out. In one case the entry outlasts the loss: a context the browser brings back only
// after the wait has run out stays here, alive, until the next display built on the canvas
// finds it alive — restoreContext() answers at once then — and takes the entry out. That is
// harmless, and a listener for webglcontextrestored kept on the caller's canvas to clear it
// would be exactly the kind of leftover a release must not leave behind
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

// What a display writes on a canvas handed to its constructor, as it was before, so
// dispose() can give the canvas back as the display found it
interface CanvasState {
  // null where the attribute was absent. data-engine is the mark three puts on the canvas of
  // its renderer
  attributes: Record<CanvasStateAttribute, string | null>;
  style: Record<CanvasStateStyleProperty, {value: string; priority: string}>;
}

type CanvasStateAttribute = 'class' | 'style' | 'touch-action' | 'width' | 'height' | 'data-engine';
type CanvasStateStyleProperty = 'width' | 'height' | 'image-rendering';

const CANVAS_STATE_ATTRIBUTES: readonly CanvasStateAttribute[] = [
  'class',
  'style',
  'touch-action',
  'width',
  'height',
  'data-engine',
];
const CANVAS_STATE_STYLE_PROPERTIES: readonly CanvasStateStyleProperty[] = ['width', 'height', 'image-rendering'];

function readCanvasState(canvas: HTMLCanvasElement): CanvasState {
  const attributes = {} as CanvasState['attributes'];
  for (const name of CANVAS_STATE_ATTRIBUTES) {
    attributes[name] = canvas.getAttribute(name);
  }
  const style = {} as CanvasState['style'];
  for (const property of CANVAS_STATE_STYLE_PROPERTIES) {
    style[property] = {value: canvas.style.getPropertyValue(property), priority: canvas.style.getPropertyPriority(property)};
  }
  return {attributes, style};
}

// classNames are the classes the display has handed out; a class the caller has set in the
// meantime stays
function restoreCanvasState(canvas: HTMLCanvasElement, state: CanvasState, classNames: readonly string[]): void {
  canvas.classList.remove(...classNames);

  for (const property of CANVAS_STATE_STYLE_PROPERTIES) {
    const {value, priority} = state.style[property];
    if (value === '') {
      canvas.style.removeProperty(property);
    } else {
      canvas.style.setProperty(property, value, priority);
    }
  }

  // class and style go back through the classes and properties above, not as a whole
  for (const name of CANVAS_STATE_ATTRIBUTES) {
    if (name === 'class' || name === 'style') continue;
    const value = state.attributes[name];
    if (value == null) {
      canvas.removeAttribute(name);
    } else {
      canvas.setAttribute(name, value);
    }
  }

  // a bare <canvas> goes back as <canvas></canvas>, without the empty attributes left behind
  if (state.attributes.class == null && canvas.classList.length === 0) canvas.removeAttribute('class');
  if (state.attributes.style == null && canvas.style.length === 0) {
    // Chromium writes a change of the inline style into the attribute only once the attribute is
    // read, and a removeAttribute() before that read comes back as style="" at the next one
    canvas.getAttribute('style');
    canvas.removeAttribute('style');
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
 *    While the tab is hidden — or, with {@link DisplayParameters.pauseOutsideViewport},
 *    once the observer has reported the canvas out of view before the start,
 *    see {@link Display.start} — the display goes into the pause instead and
 *    fires `OnDisplayPause`; `OnDisplayInit` and `OnDisplayStart` follow once
 *    it can run. A {@link Display.stop} or a `pause = true` that comes in
 *    while `start()` waits keeps the display from starting.
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
 *    the document, and a canvas handed in gets back what the display wrote
 *    on it — its classes, attributes and inline styles. The renderer itself
 *    is released after `dispose()` has returned, once its init is through
 *    and the GPU has run the work submitted to it, or for two seconds at
 *    most, and goes on with a warning on the console after that; under
 *    WebGPU it also waits until the page has drawn two more animation
 *    frames, or for two more seconds while the page draws none. A canvas
 *    handed to the constructor carries a new display afterwards; one built on
 *    it while the release runs waits for it. Under WebGL only a display
 *    brings the context of that canvas back — see {@link Display.dispose}.
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
 *    keeps reading the window, {@link Display.isRunning} is `false` and
 *    {@link Display.pause} answers `true`. No further
 *    event is emitted — no `OnDisplayRenderFrame`, no `OnDisplayResize`, no
 *    `OnDisplayError` — and a listener attached afterwards receives nothing, not
 *    even a retained value.
 *
 * ## Resize model
 *
 * **There is no `window.resize` listener.** {@link Display.resize} is invoked
 * at the beginning of every frame from {@link Display.renderFrame} and measures
 * there, unless {@link Display.resizePollIntervalMs} holds the measurement back;
 * with every measurement the canvas size, the `THREE` renderer size and the
 * `pixelRatio` are re-evaluated against the current DOM/window state. This
 * is a deliberate design decision: it covers window resizes, container
 * reflows, devicePixelRatio changes, `resize-to` attribute mutations and
 * `resizeToElement` swaps uniformly, without registering DOM listeners that
 * would have to be cleaned up. As long as size, pixel ratio and pixel zoom
 * stay the same, a `resize()` changes nothing on the renderer and emits
 * nothing. Apart from that, every call compares `image-rendering` against
 * the inline style of the canvas.
 *
 * The size source is resolved in this priority order, with every measurement:
 *
 * 1. If {@link Display.resizeToAttributeEl} carries a `resize-to` attribute,
 *    its value selects the source:
 *    - `"window"` / `"fullscreen"` (with optional leading colon) →
 *      `window.innerWidth × window.innerHeight`. Adds the
 *      `twopoint5d-canvas--fullscreen` CSS class to the canvas
 *      (`position:fixed; top:0; left:0`). The class is removed when the
 *      attribute changes back to anything else.
 *    - `"self"` → measures {@link Display.resizeToElement} — by default the
 *      canvas, or the host element when the display built its own
 *      container —, just as without the attribute; with `resizeToElement`
 *      cleared, the canvas.
 *    - any other non-empty string is a CSS selector, looked up in the root
 *      node of {@link Display.resizeToAttributeEl} — the document, or the
 *      shadow root it sits in; falls back to {@link Display.resizeToElement}
 *      or the canvas if the selector finds nothing. A value that is not a
 *      valid selector is reported once via `console.warn` and falls back the
 *      same way. The element a selector has found stays the size source for
 *      as long as it sits in that root node and still matches the selector;
 *      an element inserted in front of it later that matches as well does
 *      not take over. Once the found element leaves the root or stops
 *      matching, the next `resize()` looks the selector up again.
 * 2. If {@link Display.resizeToCallback} is set, it is called with every measurement and
 *    its `[width, height]` return value wins over any element-based size
 *    measurement (the `resize-to` attribute still controls the
 *    fullscreen-CSS toggle, but its measured size is discarded). A result of
 *    `undefined`, or a pair with a value that is not a finite number, counts
 *    as no size: the display takes the window under `resize-to="window"` or
 *    `"fullscreen"`, and 300 × 150 otherwise.
 * 3. Otherwise the content-area of {@link Display.resizeToElement} is
 *    measured via `getBoundingClientRect()` minus padding/border.
 *
 * From the size of the source in CSS pixels, the pipeline goes on like this:
 * the canvas `box-sizing` decides whether its padding and border come off
 * the size or onto its CSS size; both are clamped to `>= 0`;
 * {@link Display.MaxResolution} bounds the drawing buffer — the CSS size times
 * {@link Display.pixelRatio}, per axis; then `renderer.setDrawingBufferSize()`
 * gets the size and the ratio, and the CSS `width`/`height` go into the inline
 * style of the canvas. {@link Display.pixelZoom} divides the size to produce
 * the logical {@link Display.width} / {@link Display.height}, which is what
 * `OnDisplayResize` consumers see. `image-rendering` is checked on every call
 * and written only where the inline style differs, see
 * {@link Display.styleImageRendering}.
 *
 * `OnDisplayResize` goes out from a {@link Display.resize} whose measurement
 * changes the size, the pixel ratio or the pixel zoom, once the first frame has
 * begun (`frameNo > 0`) — the call at the start of a frame, or one of your own
 * in between, which emits on its own. The first rendered frame emits it in any
 * case, exactly once: where its `resize()` has not, {@link Display.renderFrame}
 * does, so listeners attached before `start()` receive the initial size. The
 * constructor's initial `resize()` does **not** emit, because `frameNo` is
 * still `0` — `OnDisplayResize` is also `retain`ed, so subscribers attaching
 * after the first frame still receive the latest size on subscription.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface Display extends EventizedObject {}

export class Display {
  /**
   * Upper bound per axis, in device pixels, for the drawing buffer that
   * {@link Display.resize} gives the renderer: the CSS size times
   * {@link Display.pixelRatio}; while {@link Display.pixelZoom} is above `0`
   * the ratio is `1`, so the bound holds the CSS size itself. A larger size is
   * clamped, and a one-time `console.warn` names the requested size in device
   * pixels. The logical {@link Display.width} / {@link Display.height} is then
   * at most `Math.floor(MaxResolution / pixelRatio)`.
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
   * {@link Display.resize}. Defaults to `0`: no throttle, and `resize()`
   * measures on every frame. `image-rendering` is not subject to the
   * interval.
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
   * first frame still needs its fallback emit, so the first frame emits
   * `OnDisplayResize` exactly once.
   */
  #didEmitResize = false;

  // the class name of the fullscreen rule, installed with the first fullscreen resize()
  #fullscreenClassName?: string;
  // the fullscreen class sits on the canvas right now
  #fullscreenClassApplied = false;

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
   * This is interesting for pixelart: a value of 2 means that each CSS pixel is rendered twice as
   * large, regardless of the devicePixelRatio.
   */
  pixelZoom = 0;

  /**
   * The value of the CSS property `image-rendering` that the display writes into the inline
   * style of the canvas.
   *
   * `undefined` follows {@link Display.pixelZoom}: `"pixelated"` while it is above `0`,
   * `"auto"` otherwise. Set, it pins one of the two values.
   *
   * A change takes effect with the next {@link Display.resize} — at the start of the next
   * frame, or right away with a call of your own —, whether or not the size changes, and
   * regardless of {@link Display.resizePollIntervalMs}.
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
   * The width of the display in CSS pixels — divided by {@link Display.pixelZoom} while that is
   * above `0`, and rounded down —, as the last measurement of {@link Display.resize} left it. The
   * events of the display carry it as `width`. It follows the size source with every
   * measurement: at the start of every frame, or less often with
   * {@link Display.resizePollIntervalMs}.
   */
  get width(): number {
    return this.#width;
  }

  /**
   * The height of the display in CSS pixels — divided by {@link Display.pixelZoom} while that is
   * above `0`, and rounded down —, as the last measurement of {@link Display.resize} left it. The
   * events of the display carry it as `height`. It follows the size source with every
   * measurement: at the start of every frame, or less often with
   * {@link Display.resizePollIntervalMs}.
   */
  get height(): number {
    return this.#height;
  }

  #frameNo = 0;

  /**
   * The number of the frame being rendered: `0` until the first frame, `1` during the first
   * one, and one more with every frame after it.
   */
  get frameNo(): number {
    return this.#frameNo;
  }

  #isFirstFrame = true;

  get isFirstFrame(): boolean {
    return this.#isFirstFrame;
  }

  readonly #frameLoop: FrameLoop;

  /**
   * The {@link FrameLoop} this display runs on, built by the constructor with `maxFps`. The display
   * stands on it while it runs, and {@link Display.dispose} takes it off again.
   */
  get frameLoop(): FrameLoop {
    return this.#frameLoop;
  }

  /**
   * The HTML element whose content-area size drives the canvas size with
   * every measurement of {@link Display.resize}, when no `resize-to` attribute and no
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
   * constructor or reassigned at runtime — the next measurement of
   * {@link Display.resize} picks up the change.
   *
   * @see {@link DisplayParameters.resizeToElement}
   */
  resizeToElement?: HTMLElement;

  /**
   * Optional size provider. If set, it is invoked with every measurement of
   * {@link Display.resize} — at the start of each frame, unless
   * {@link Display.resizePollIntervalMs} spaces the measurements out — and
   * its returned `[width, height]` (in CSS pixels) overrides
   * any element-based measurement. Use this for app-specific sizing logic
   * (e.g. fitting to a UI panel, applying min/max constraints, locking
   * aspect ratio).
   *
   * The `resize-to` attribute is still honored for its fullscreen-CSS
   * toggle, but the size it would compute is discarded in favor of the
   * callback's return value. A result of `undefined`, or a pair with a value
   * that is not a finite number, counts as no size: the display takes the
   * window under `resize-to="window"` or `"fullscreen"`, and 300 × 150
   * otherwise — see {@link ResizeDisplayToFn}.
   *
   * @see {@link DisplayParameters.resizeTo}
   */
  resizeToCallback?: ResizeDisplayToFn;

  /**
   * The HTML element that {@link Display.resize} consults with every measurement for
   * the `resize-to` attribute. Defaults to the canvas element, but you can point
   * it at a wrapper if you prefer to control sizing declaratively from the
   * outside (see {@link DisplayParameters.resizeToAttributeEl}).
   *
   * @see {@link DisplayParameters.resizeToAttributeEl}
   */
  resizeToAttributeEl: HTMLElement;

  #styleSheetRoot: HTMLElement | ShadowRoot;

  /**
   * The root the display installs its CSS rules in, see {@link DisplayParameters.styleSheetRoot}.
   *
   * A write installs the rules of the display in the new root, under the same class names: a
   * canvas that moves into another shadow root keeps its rules that way. The rules in the
   * previous root stay where they are. After {@link Display.dispose} a write changes nothing.
   */
  get styleSheetRoot(): HTMLElement | ShadowRoot {
    return this.#styleSheetRoot;
  }

  set styleSheetRoot(root: HTMLElement | ShadowRoot) {
    if (this.#disposed || root === this.#styleSheetRoot) return;
    this.#styleSheetRoot = root;
    this.#installRules(root);
  }

  #renderer?: WebGPURenderer;

  /**
   * The `WebGPURenderer` this display draws with — the one it built, or the one handed to the
   * constructor. The display owns it and releases it in {@link Display.dispose}; afterwards this
   * answers `undefined`.
   */
  get renderer(): WebGPURenderer | undefined {
    return this.#renderer;
  }

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

  // What the canvas handed to the constructor looked like before this display wrote on it, kept
  // only when the renderer draws into that canvas — see #giveBackCallersCanvas()
  #callersCanvasBefore?: CanvasState;

  // the class of the rule Stylesheets.addRule() has put on the canvas
  #canvasClassName?: string;

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
   * its init is through and the GPU has run the work submitted to it, or for two seconds at most,
   * and goes on with a warning on the console after that; under WebGPU also once the page has
   * drawn two more animation frames, or two more seconds have passed without one. A renderer that
   * has to outlive this display therefore does not belong in here.
   *
   * A constructor that throws after it has built or taken over the renderer — from a `resizeTo`
   * callback, say — gives everything back as {@link Display.dispose} would: the renderer is
   * released, a canvas handed in goes back as the display found it, and a container the display
   * built comes out of the host.
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
    this.#styleSheetRoot = styleSheetRoot ?? document.head;

    if (isWebGLRenderer(domElementOrRenderer)) {
      // eslint-disable-next-line no-console
      console.warn(
        'The Display constructor expects a WebGPURenderer or an HTML element as the first argument.',
        'Since twopoint5d@0.13 a WebGLRenderer is not supported anymore.',
      );
      throw new TypeError('The Display constructor expects a WebGPURenderer or an HTML element as the first argument!');
    }

    if (isWebGPURenderer(domElementOrRenderer)) {
      this.#renderer = domElementOrRenderer;
      this.resizeToElement = domElementOrRenderer.domElement;
    } else if (domElementOrRenderer instanceof HTMLElement) {
      let canvas: HTMLCanvasElement;
      let callersCanvasBefore: CanvasState | undefined;
      if (domElementOrRenderer.tagName === 'CANVAS') {
        canvas = domElementOrRenderer as HTMLCanvasElement;
        this.#callersCanvas = canvas;
        // read before the renderer is built: three marks the canvas in its constructor already
        callersCanvasBefore = readCanvasState(canvas);
      } else {
        const container = document.createElement('div');
        Stylesheets.addRule(container, Display.CssRulesPrefixContainer, CONTAINER_RULE_CSS, this.#styleSheetRoot);
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
        // three writes its getFallback onto the options it is given; these are built
        // for this one call
        ((params: CreateRendererParameters) => new WebGPURenderer(params));

      try {
        this.#renderer = makeRenderer({
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

      // a createRenderer that ignores the canvas it was given leaves that canvas untouched, and
      // writing the state back would overwrite what its caller has done with it since
      if (callersCanvasBefore != null && this.#renderer.domElement === canvas) {
        this.#callersCanvasBefore = callersCanvasBefore;
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

    this.#frameLoop = new FrameLoop(maxFps ?? 0, this.#renderer);

    // From here on a throw takes down what the constructor has built, as dispose() does: it
    // releases the renderer, gives a canvas handed in back and takes its own container out.
    // dispose() needs #waitForRenderer and frameLoop, which is why both stand before the try
    try {
      const {domElement: canvas} = this.renderer!;
      this.#canvasClassName = Stylesheets.addRule(canvas, Display.CssRulesPrefixDisplay, CANVAS_RULE_CSS, this.#styleSheetRoot);
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

      const onDocVisibilityChange = () => {
        this.#stateMachine.documentIsVisible = !document.hidden;
      };

      document.addEventListener('visibilitychange', onDocVisibilityChange, false);

      once(this, OnDisplayDispose, () => {
        document.removeEventListener('visibilitychange', onDocVisibilityChange, false);
      });

      onDocVisibilityChange();

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
    } catch (error) {
      this.dispose();
      throw error;
    }
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
   * debugger breakpoints: a single long frame reaches physics and
   * animations as a step of at most `maxDeltaTime`.
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
   * Whether the display is paused: `true` while it holds in the pause — through `pause = true`,
   * {@link Display.stop}, a hidden tab or, with {@link DisplayParameters.pauseOutsideViewport}, a
   * canvas outside the viewport —, and before the first start once `stop()` or `pause = true`
   * has been called and no `pause = false` since. A write sets the pause the caller asks for; see
   * {@link Display.start} for how it meets a pending start.
   *
   * After {@link Display.dispose} a write does nothing, and the getter answers `true`.
   */
  get pause(): boolean {
    // in RUNNING the user pause is never set — a write of it pauses right away —, and in PAUSED
    // the answer is true anyway: only a display that has not started yet answers from it
    return this.#stateMachine.isPaused || this.#stateMachine.pausedByUser;
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
   * DOM mutation if you cannot wait for the next frame). As long as size,
   * pixel ratio and pixel zoom stay the same, a call changes nothing on the
   * renderer and emits nothing; `image-rendering` is checked against the
   * inline style of the canvas on every call regardless.
   *
   * Resolution order for the size source: the `resize-to` attribute on
   * {@link Display.resizeToAttributeEl} (if present), then
   * {@link Display.resizeToCallback} (if set, wins over element measurement),
   * then the content-area of {@link Display.resizeToElement}. The fallback
   * size when nothing else applies is `300 × 150` (HTML's intrinsic canvas
   * size). See the class-level docs for the full priority table.
   *
   * A call that changes the size emits `OnDisplayResize` once the first frame
   * has begun (`frameNo > 0`); the call inside the constructor emits nothing.
   * The first frame emits the event in any case: where its `resize()` has not,
   * {@link Display.renderFrame} does.
   *
   * Does nothing after {@link Display.dispose} — there is no canvas left to measure.
   */
  resize(): void {
    if (this.#disposed) return;

    this.#didEmitResize = false;

    const canvas = this.canvas;

    // image-rendering is not a size: it needs no measurement, so a change reaches the canvas
    // with this call, whatever the poll interval says
    this.#applyImageRendering(canvas);

    if (this.resizePollIntervalMs > 0) {
      const nowMs = performance.now();
      if (nowMs - this.#lastResizePollMs < this.resizePollIntervalMs) {
        return;
      }
      this.#lastResizePollMs = nowMs;
    }

    const source = this.#resolveSizeSource(canvas);
    this.#applyFullscreenClass(canvas, source.window);
    this.#applyMeasuredSize(canvas, this.#measureSizeSource(source), source.element);
  }

  // Outside the resize hash on purpose: in it, every change would run through
  // setDrawingBufferSize() and emit an OnDisplayResize without a change of size. Compared
  // against the inline style, which is a read of the attribute and forces no layout
  #applyImageRendering(canvas: HTMLCanvasElement): void {
    const imageRendering = this.styleImageRendering ?? (this.pixelZoom > 0 ? 'pixelated' : 'auto');
    if (canvas.style.imageRendering !== imageRendering) {
      canvas.style.imageRendering = imageRendering;
    }
  }

  // Where the size comes from, as the resize-to attribute says; reads the DOM and writes nothing
  #resolveSizeSource(canvas: HTMLCanvasElement): {window: boolean; element: Element | undefined} {
    const resizeTo = this.resizeToAttributeEl.getAttribute('resize-to')?.trim();

    if (!resizeTo) {
      return {window: false, element: this.resizeToElement};
    }
    if (/^:?(fullscreen|window)$/.test(resizeTo)) {
      return {window: true, element: undefined};
    }
    if (resizeTo === 'self') {
      return {window: false, element: this.resizeToElement ?? canvas};
    }
    return {window: false, element: this.#resolveResizeToSelector(resizeTo) ?? this.resizeToElement ?? canvas};
  }

  #applyFullscreenClass(canvas: HTMLCanvasElement, wantsFullscreen: boolean): void {
    if (wantsFullscreen === this.#fullscreenClassApplied) return;

    if (wantsFullscreen) {
      this.#fullscreenClassName ??= Stylesheets.installRule(
        Display.CssRulesPrefixFullscreen,
        FULLSCREEN_RULE_CSS,
        this.#styleSheetRoot,
      );
      canvas.classList.add(this.#fullscreenClassName);
    } else if (this.#fullscreenClassName != null) {
      canvas.classList.remove(this.#fullscreenClassName);
    }

    this.#fullscreenClassApplied = wantsFullscreen;
  }

  // The rules this display has installed so far, now in `root` as well. The class names do not
  // depend on the root, so the elements keep their classes. The rules in the previous root stay:
  // other displays may share them, and installRule() pins them there anyway
  #installRules(root: HTMLElement | ShadowRoot): void {
    if (this.#ownContainer != null) {
      Stylesheets.installRule(Display.CssRulesPrefixContainer, CONTAINER_RULE_CSS, root);
    }
    Stylesheets.installRule(Display.CssRulesPrefixDisplay, CANVAS_RULE_CSS, root);
    if (this.#fullscreenClassName != null) {
      Stylesheets.installRule(Display.CssRulesPrefixFullscreen, FULLSCREEN_RULE_CSS, root);
    }
  }

  // The size of the source in CSS pixels
  #measureSizeSource(source: {window: boolean; element: Element | undefined}): [width: number, height: number] {
    const fallback: [number, number] = source.window ? [window.innerWidth, window.innerHeight] : [300, 150];

    if (this.resizeToCallback) {
      // a callback that reports no size gets the fallback, and no element is measured in its place
      const size = this.resizeToCallback(this);
      return size != null && Number.isFinite(size[0]) && Number.isFinite(size[1]) ? [size[0], size[1]] : fallback;
    }

    if (source.element) {
      const area = getContentAreaSize(source.element);
      return [area.width, area.height];
    }

    return fallback;
  }

  #applyMeasuredSize(canvas: HTMLCanvasElement, [wPx, hPx]: [number, number], sizeRefElement: Element | undefined): void {
    let cssWidth = wPx;
    let cssHeight = hPx;

    const canvasStyle = getComputedStyle(canvas, null);
    const canvasIsContentBox = getIsContentBox(canvasStyle);
    const canvasHorizontalInnerMargin = getHorizontalInnerMargin(canvasStyle);
    const canvasVerticalInnerMargin = getVerticalInnerMargin(canvasStyle);

    if (canvasIsContentBox && canvas !== sizeRefElement) {
      wPx -= canvasHorizontalInnerMargin;
      hPx -= canvasVerticalInnerMargin;
      cssWidth -= canvasHorizontalInnerMargin;
      cssHeight -= canvasVerticalInnerMargin;
    } else if (!canvasIsContentBox && canvas === sizeRefElement) {
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

    // pixelRatio is 1 while pixelZoom is above 0, so the limit then holds the CSS size itself
    const {pixelRatio, pixelZoom} = this;

    if (wPx * pixelRatio > Display.MaxResolution || hPx * pixelRatio > Display.MaxResolution) {
      // the warning names the size that was asked for, so it goes out before the clamp
      showCanvasMaxResolutionWarning(Math.round(wPx * pixelRatio), Math.round(hPx * pixelRatio));
      wPx = Math.min(wPx, Display.MaxResolution / pixelRatio);
      hPx = Math.min(hPx, Display.MaxResolution / pixelRatio);
    }

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

      // rounded down, so the drawing buffer — Math.floor(width * pixelRatio) — stays within
      // MaxResolution at a fractional pixel ratio as well
      this.#width = Math.floor(this.#width);
      this.#height = Math.floor(this.#height);

      // one call for size and ratio: setPixelRatio() on its own resizes the drawing buffer to the
      // old size times the new ratio, and a change from a ratio of 1 to 2 at the limit would ask
      // for a buffer of twice MaxResolution before setSize() brings it back
      this.renderer!.setDrawingBufferSize(this.#width, this.#height, pixelRatio);

      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${cssHeight}px`;

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
   * size, pixelRatio or pixelZoom actually changed), and finally emits
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
    this.#frameNo += 1;

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
   * `OnDisplayStart`. A `pause = false` after it in the same listener lets the display start,
   * with one `OnDisplayRestart` and no second one.
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
   * `renderer.dispose()`: once its init is through and the GPU has run the work submitted to it,
   * or for two seconds at most, and goes on with a warning on the console after that. Under
   * WebGPU the release then waits until the page has drawn two more animation frames, or for two
   * more seconds while it draws none: under Firefox with WebGPU the page otherwise stops its
   * `requestAnimationFrame` when the canvas stays in the document — a canvas handed to the
   * constructor, or that of an adopted renderer.
   *
   * A canvas handed to the constructor goes back to the caller as the display found it: its
   * classes, the inline `width`, `height` and `image-rendering`, the `touch-action` attribute
   * and the `width` and `height` attributes of the drawing buffer return to what they were
   * before the constructor ran, and so does the `data-engine` attribute three marks it with.
   *
   * That canvas is able to carry a new display. Under the WebGL backend `renderer.dispose()`
   * loses the context of that canvas, and a canvas keeps its one WebGL context for good, so
   * the release keeps that context restorable and leaves it lost. Only a `Display` brings it
   * back: a `WebGPURenderer` or a `getContext('webgl2')` of your own on that canvas gets the
   * lost context. The next `Display` built on the same canvas — while the release runs or any
   * time after — waits for the release, restores the context and then starts the init of its
   * renderer. A context the browser has not brought back within two seconds ends the wait with
   * a warning on the console; it stays lost and restorable, and the next `Display` built on the
   * canvas tries again.
   *
   * A `dispose()` while the renderer is still initializing waits for that init instead of
   * cutting it short. An init that fails leaves nothing to release but the `webglcontextlost`
   * listener three has put on the canvas, which the release takes off, and its rejection does
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

    // before the release, which lets go of the canvas; and synchronously, so a display built on
    // the same canvas in this tick writes its values afterwards and nothing overwrites them
    this.#giveBackCallersCanvas();

    const renderer = this.renderer;
    this.#renderer = undefined;
    if (renderer != null) this.#releaseRenderer(renderer);

    // the container and the canvas in it leave the document right away; the renderer holds on
    // to its canvas itself and does not need it in the document to release it
    this.#ownContainer?.remove();
    this.#ownContainer = undefined;
  }

  #giveBackCallersCanvas(): void {
    if (this.#callersCanvasBefore == null) return;

    const classNames: string[] = [];
    if (this.#canvasClassName != null) classNames.push(this.#canvasClassName);
    if (this.#fullscreenClassName != null) classNames.push(this.#fullscreenClassName);

    restoreCanvasState(this.#callersCanvas!, this.#callersCanvasBefore, classNames);
    this.#callersCanvasBefore = undefined;
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
    // release waits for the init, then for the GPU, and under WebGPU for two animation frames of
    // the page — see waitForTwoAnimationFrames(). A canvas handed to the constructor goes back to
    // its caller at the end of it, with its WebGL context lost but restorable, so the next display
    // on it can bring the context back
    const released: Promise<void> = this.#waitForRenderer
      .then(
        async () => {
          await drainSubmittedWork(renderer);
          await waitForTwoAnimationFrames(renderer);
          if (!handBack) {
            renderer.dispose();
            return;
          }
          const lost = await disposeKeepingContextRestorable(renderer);
          // set before the release settles, so a display that waits for the release finds it
          if (lost != null) lostContexts.set(canvas, lost);
        },
        () => {
          // a failed init has built nothing that renderer.dispose() would release but the
          // webglcontextlost listener three put on the canvas before it failed, and that listener
          // goes here. renderer.dispose() itself stays uncalled: its setAnimationLoop(null) would
          // wait on the rejected init once more — a rejection that nobody could catch
          dropContextLostListener(renderer);
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

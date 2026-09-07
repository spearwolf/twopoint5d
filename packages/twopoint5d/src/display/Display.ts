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
      `Oops, the canvas width or height should not bigger than ${Display.MaxResolution} pixels (${w}x${h} was requested).`,
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
 *    hidden.
 * 2. `await display.start()` — awaits renderer init, fires `OnDisplayInit`
 *    (once), `OnDisplayStart` and begins emitting `OnDisplayRenderFrame`. A
 *    renderer that fails to initialize fires `OnDisplayError` instead, and
 *    `start()` rejects with the same error.
 * 3. `display.dispose()` — stops the loop, fires `OnDisplayDispose` and
 *    releases the renderer. A container this display created inside a host
 *    element comes out of the DOM with the canvas in it; a canvas or a
 *    renderer handed to the constructor keeps its place in the document.
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
 *    - any other non-empty string is treated as a `document.querySelector`
 *      selector; falls back to {@link Display.resizeToElement} or the canvas
 *      if the selector finds nothing.
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
    return (this.renderer?.backend as any)?.['isWebGPUBackend'] ?? false;
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
    return (this.renderer?.backend as any)?.['isWebGLBackend'] ?? false;
  }

  readonly #waitForRenderer: Promise<WebGPURenderer>;

  // The container this display created inside a host element, and the canvas in it. Set only on
  // that construction path, because that is the only one on which they are this display's to give
  // back — see dispose().
  #ownContainer?: HTMLDivElement;

  /**
   * Create a display around a canvas, around a container element that gets a canvas of its own,
   * or around a `WebGPURenderer` that is already built.
   *
   * A renderer handed in here is adopted, not borrowed: the display takes it and its
   * `domElement` as its own, and {@link Display.dispose} calls `renderer.dispose()` on the way
   * out. A renderer that has to outlive this display therefore does not belong in here.
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
    const {maxFps, resizeTo, resizeToElement, resizeToAttributeEl, styleSheetRoot, createRenderer, ...rendererOptions} =
      options ?? {};

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

        // only what was built here: a canvas that arrived as an argument, and the domElement of a
        // renderer that arrived as one, belong to the caller and stay where they are
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

      this.renderer = makeRenderer({
        canvas,
        stencil: false,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        ...rendererOptions,
      } as CreateRendererParameters);
    } else {
      // every wrong first argument gets the same answer, whatever it is: without this a null
      // would die inside init() with a TypeError that names neither this constructor nor what
      // it takes
      throw new TypeError('The Display constructor expects a WebGPURenderer or an HTML element as the first argument!');
    }

    // Both construction paths end with a renderer and both have to wait for the same promise.
    // One assignment, so a path that gets added later cannot leave the field empty.
    this.#waitForRenderer = this.renderer!.init();

    this.frameLoop = new FrameLoop(maxFps ?? 0, this.renderer);

    const {domElement: canvas} = this.renderer!;
    Stylesheets.addRule(canvas, Display.CssRulesPrefixDisplay, 'touch-action: none;', this.styleSheetRoot);
    canvas.setAttribute('touch-action', 'none'); // => PEP polyfill

    this.resizeToElement = resizeToElement ?? this.resizeToElement;
    this.resizeToAttributeEl = resizeToAttributeEl ?? canvas;

    this.resize();

    on(this.#stateMachine, {
      [DisplayStateMachine.Init]: async () => {
        // emit() discards the promise this callback returns, so a rejected initialization would
        // pass nobody on its way out of here
        try {
          await this.#waitForRenderer;
        } catch (error) {
          emit(this, OnDisplayError, error, this);
          return;
        }
        this.#emit(OnDisplayInit);
      },

      [DisplayStateMachine.Restart]: () => this.#emit(OnDisplayRestart),

      [DisplayStateMachine.Start]: () => {
        const t = performance.now() / 1000;
        this.#chronometer.start(t);
        this.#chronometer.update(t);

        this.#emit(OnDisplayStart);
      },

      [DisplayStateMachine.Pause]: () => {
        this.#chronometer.stop(performance.now() / 1000);

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

    this.#waitForRenderer
      .then(() => {
        // a dispose() inside this await would otherwise put the display back into the subscriber
        // list of the loop, where it stays until the page goes
        if (this.#disposed) return;

        this.frameLoop.start(this);
      })
      .catch((error) => {
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

    let sizeRefElement = this.resizeToElement;

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
        sizeRefElement = (document.querySelector(resizeTo) as HTMLElement) ?? this.resizeToElement ?? canvasElement;
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

    if (wPx > Display.MaxResolution) {
      wPx = Display.MaxResolution;
      showCanvasMaxResolutionWarning(wPx, hPx);
    }
    if (hPx > Display.MaxResolution) {
      hPx = Display.MaxResolution;
      showCanvasMaxResolutionWarning(wPx, hPx);
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
   * Awaits the renderer initialization, runs `beforeStartCallback` and starts the
   * frame loop.
   *
   * Throws after {@link Display.dispose}. A promise that resolves without a frame ever
   * following would be a dead end the caller cannot see, and the caller is waiting on
   * the effect, not on the value.
   */
  async start(beforeStartCallback?: (args: DisplayEventProps) => Promise<void> | void): Promise<Display> {
    if (this.#disposed) throw disposedError('start()');

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

    this.#stateMachine.pausedByUser = false;
    this.#stateMachine.start();

    return this;
  }

  stop(): void {
    this.#stateMachine.pausedByUser = true;
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;

    this.stop();
    this.frameLoop.stop(this);
    // the listeners are still attached here: this event is what tells them to let go,
    // and off(this) below is what makes it the last event this display ever emits
    emit(this, OnDisplayDispose, this);
    off(this);
    this.renderer?.dispose();
    delete this.renderer;
    // after renderer.dispose(), so the renderer still finds its canvas while it releases the
    // context; removing the container takes the canvas inside it along
    this.#ownContainer?.remove();
    this.#ownContainer = undefined;
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

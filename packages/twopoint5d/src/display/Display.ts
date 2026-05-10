import {emit, eventize, off, on, once, onceAsync, retain, retainClear} from '@spearwolf/eventize';
import {WebGPURenderer} from 'three/webgpu';
import {
  OnDisplayDispose,
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

type EventHandler = (handler: (props: DisplayEventProps) => any) => ReturnType<typeof on>;

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
 *    (once), `OnDisplayStart` and begins emitting `OnDisplayRenderFrame`.
 * 3. `display.dispose()` — stops the loop, fires `OnDisplayDispose` and
 *    releases the renderer.
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

  #chronometer = new Chronometer(0);

  #stateMachine = new DisplayStateMachine();

  #lastResizeHash = '';

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

  get canvas(): HTMLCanvasElement {
    return this.renderer!.domElement;
  }

  get isWebGPUBackend(): boolean {
    return (this.renderer?.backend as any)?.['isWebGPUBackend'] ?? false;
  }

  get isWebGLBackend(): boolean {
    return (this.renderer?.backend as any)?.['isWebGLBackend'] ?? false;
  }

  readonly #waitForRenderer!: Promise<WebGPURenderer>;

  constructor(domElementOrRenderer: HTMLElement | WebGPURenderer, options?: DisplayParameters) {
    eventize(this);
    retain(this, [OnDisplayInit, OnDisplayStart, OnDisplayResize]);

    this.#chronometer.stop();

    this.resizeToCallback = options?.resizeTo;
    this.styleSheetRoot = options?.styleSheetRoot ?? document.head;

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
      }
      this.resizeToElement = domElementOrRenderer;

      const createRenderer =
        options?.createRenderer ??
        ((params: CreateRendererParameters) => {
          return new WebGPURenderer({
            // TODO check if this is still needed
            ...params,
          });
        });

      this.renderer = createRenderer({
        canvas,
        stencil: false,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        ...options,
      } as CreateRendererParameters);

      this.#waitForRenderer = this.renderer.init();
    }

    this.frameLoop = new FrameLoop(options?.maxFps ?? 0, this.renderer);

    const {domElement: canvas} = this.renderer!;
    Stylesheets.addRule(canvas, Display.CssRulesPrefixDisplay, 'touch-action: none;', this.styleSheetRoot);
    canvas.setAttribute('touch-action', 'none'); // => PEP polyfill

    this.resizeToElement = options?.resizeToElement ?? this.resizeToElement;
    this.resizeToAttributeEl = options?.resizeToAttributeEl ?? canvas;

    this.resize();

    on(this.#stateMachine, {
      [DisplayStateMachine.Init]: async () => {
        await this.#waitForRenderer;
        this.#emit(OnDisplayInit);
      },

      [DisplayStateMachine.Restart]: () => this.#emit(OnDisplayRestart),

      [DisplayStateMachine.Start]: () => {
        this.#chronometer.start();
        this.#chronometer.update();

        this.#emit(OnDisplayStart);
      },

      [DisplayStateMachine.Pause]: () => {
        this.#chronometer.stop();

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

    this.#waitForRenderer.then(() => {
      this.frameLoop.start(this);
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

  get pause(): boolean {
    return this.#stateMachine.state === DisplayStateMachine.PAUSED;
  }

  set pause(pause: boolean) {
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
   */
  resize(): void {
    this.#didEmitResize = false;

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

  [FrameLoop.OnFrame](): void {
    if (this.isRunning) {
      this.renderFrame();
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
   */
  renderFrame(now = window.performance.now()): void {
    this.#isFirstFrame = this.frameNo === 0;
    this.frameNo += 1;

    this.#chronometer.update(now / 1000);

    this.resize();

    // Guarantee one OnDisplayResize event on the first rendered frame so
    // listeners attached before `start()` always receive an initial size,
    // even when nothing changed since the constructor's resize() call —
    // but skip it if resize() above already emitted, to avoid the
    // double-emit that previously happened on every first frame whose
    // measured size differed from the constructor measurement.
    if (this.isFirstFrame && !this.#didEmitResize) this.#emit(OnDisplayResize);

    this.#emit(OnDisplayRenderFrame);
  }

  async start(beforeStartCallback?: (args: DisplayEventProps) => Promise<void> | void): Promise<Display> {
    await this.#waitForRenderer;

    if (typeof beforeStartCallback === 'function') {
      await beforeStartCallback(this.getEventProps());
    }

    this.#stateMachine.pausedByUser = false;
    this.#stateMachine.start();

    return this;
  }

  stop(): void {
    this.#stateMachine.pausedByUser = true;
  }

  dispose(): void {
    this.stop();
    this.frameLoop.stop(this);
    emit(this, OnDisplayDispose, this);
    off(this);
    this.renderer?.dispose();
    delete this.renderer;
  }

  /**
   * This is a public method so it's easy to override if you want
   */
  getEventProps(): DisplayEventProps {
    return {
      display: this,
      renderer: this.renderer!,

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

  readonly onResize = on.bind(undefined, this, OnDisplayResize) as unknown as EventHandler;

  readonly onRenderFrame = on.bind(undefined, this, OnDisplayRenderFrame) as unknown as EventHandler;
  readonly onNextFrame = once.bind(undefined, this, OnDisplayRenderFrame) as unknown as EventHandler;
  readonly nextFrame = onceAsync.bind(undefined, this, OnDisplayRenderFrame) as unknown as Promise<DisplayEventProps>;

  readonly onInit = on.bind(undefined, this, OnDisplayInit) as unknown as EventHandler;
  readonly onStart = on.bind(undefined, this, OnDisplayStart) as unknown as EventHandler;
  readonly onRestart = on.bind(undefined, this, OnDisplayRestart) as unknown as EventHandler;
  readonly onPause = on.bind(undefined, this, OnDisplayPause) as unknown as EventHandler;

  readonly onDispose = once.bind(undefined, this, OnDisplayDispose) as unknown as EventHandler;
}

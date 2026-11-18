// Measures a display: the size watch, the resolution of the size source, the rule of a fullscreen
// around the canvas, the bookkeeping of a canvas that measures itself under a zoom, and the drawing
// buffer it applies. The display keeps the public options and members of the resize model, and asks
// the sizer at the start of each frame and in resize()

import {describeValue} from '../utils/describeValue.js';
import {isPositiveFinite} from '../utils/isPositiveFinite.js';
import type {Display} from './Display.js';
import {
  type DrawingBuffer,
  type DrawingBufferParams,
  pixelRatioFor,
  readsBackWrittenSize,
  resolveDrawingBuffer,
} from './resolveDrawingBuffer.js';
import {Stylesheets} from './Stylesheets.js';
import {contentAreaSide, getHorizontalInnerMargin, getIsContentBox, getVerticalInnerMargin} from './styleUtils.js';

let canvasMaxResolutionWarningWasShown = false;
let resizeToFullscreenWarningWasShown = false;

function showResizeToFullscreenWarning() {
  if (!resizeToFullscreenWarningWasShown) {
    // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
    console.warn(
      'Display: resize-to="fullscreen" is deprecated and means "window" — use resize-to="window", and display.fullscreen for the fullscreen of the browser.',
    );
    resizeToFullscreenWarningWasShown = true;
  }
}

function showCanvasMaxResolutionWarning(maxResolution: number, w: number, h: number) {
  if (!canvasMaxResolutionWarningWasShown) {
    // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
    console.warn(
      `Display: the canvas width or height should not be bigger than ${maxResolution} device pixels (${w}x${h} was requested).`,
      'If you need more, please set Display.MaxResolution before you create a Display!',
    );
    canvasMaxResolutionWarningWasShown = true;
  }
}

// An element apart from the document measures 0 × 0 and has no style to read, and the display
// leaves it unread. WebKit gets more out of such a read: once the style or the layout of an element
// in a shadow root has been worked out while its host is not in the document, that root leaves its
// adopted stylesheets out after the host goes in — the rules of Stylesheets with them — until its
// adoptedStyleSheets are written again. Only an element that says it is apart counts as apart
function isApart(element: Element): boolean {
  return element.isConnected === false;
}

// The parent of an element, through the host where it is the top of a shadow root
function parentAcrossShadow(node: Element): Element | undefined {
  if (node.parentElement != null) return node.parentElement;
  return (node.getRootNode?.() as Partial<ShadowRoot> | undefined)?.host ?? undefined;
}

// The nearest element from `node` up, through shadow hosts, that is in fullscreen: the
// fullscreenElement of its own root node — a shadow root names its element, where the document
// would name the host — or the pseudo target of the display. Read with optional calls, so a stub
// without getRootNode or parentElement ends the walk instead of throwing
function containingFullscreenOf(node: Element, pseudoTarget: Element | undefined): Element | undefined {
  for (let current: Element | undefined = node; current != null; current = parentAcrossShadow(current)) {
    if (current === pseudoTarget) return current;
    if ((current.getRootNode?.() as Partial<DocumentOrShadowRoot> | undefined)?.fullscreenElement === current) return current;
  }
  return undefined;
}

function containsAcrossShadow(ancestor: Element, node: Element): boolean {
  for (let current: Element | undefined = node; current != null; current = parentAcrossShadow(current)) {
    if (current === ancestor) return true;
  }
  return false;
}

// the rule of resize-to="window": the canvas covers the window
const WINDOW_RULE_CSS = 'position:fixed;top:0;left:0;';

// the resize-to values that take the window as the size source; a constant, because the source
// is resolved in every frame
const RESIZE_TO_WINDOW = /^:?(fullscreen|window)$/;

/**
 * What a {@link DisplaySizer} reads of its display beyond the public members. The display
 * fills it. Not exported from the package.
 * @internal
 */
export interface DisplaySizerHost {
  /** The document the canvas sits in. */
  readonly doc: Document;
  /** The window the canvas sits in. */
  readonly view: Window & typeof globalThis;
  /** `Display.MaxResolution`, read at every measurement. */
  maxResolution(): number;
  /** `Display.CssRulesPrefixFullscreen`, read when the rule of `resize-to="window"` is installed. */
  windowRulePrefix(): string;
  /** The `styleSheetRoot` of the display. */
  styleSheetRoot(): HTMLElement | ShadowRoot;
  /** Emits `OnDisplayResize` with the props of the display. */
  emitResize(): void;
}

/** @internal */
export class DisplaySizer {
  readonly #display: Display;
  readonly #host: DisplaySizerHost;

  // What the last measurement applied. NaN before the first one, so every comparison differs
  #appliedWidth = NaN;
  #appliedHeight = NaN;
  #appliedCssWidth = NaN;
  #appliedCssHeight = NaN;
  #appliedPixelRatio = NaN;
  #appliedPixelZoom = NaN;
  #appliedDevicePixelZoom = NaN;
  // compared by the frame alone: under a pixelZoom a new budget shows in no ratio
  #appliedMaxPixels = NaN;

  // The size watch: a ResizeObserver on the size source, a media query on the pixel ratio and the
  // resize event of the window. Each of them only marks the size dirty; the next frame measures.
  // A window without ResizeObserver or matchMedia gets none of them, and the display polls
  #sizeObserver?: ResizeObserver;
  #observedElement?: Element;
  #observedWindow = false;
  #pixelRatioQuery?: MediaQueryList;
  #sizeDirty = true;
  // whether the frame measured last on the poll path
  #pollingSize = false;

  readonly #onSizeChange = (): void => {
    this.#sizeDirty = true;
  };

  readonly #onPixelRatioChange = (): void => {
    this.#sizeDirty = true;
    this.#watchPixelRatio();
  };

  // The size source as #resolveSizeSource() found it last, and the size #measureSizeSource()
  // measured there in CSS pixels — fields, so a frame allocates nothing for them
  #sizeSourceIsWindow = false;
  #sizeSourceElement?: Element;
  #measuredWidth = 0;
  #measuredHeight = 0;

  // A canvas that is its own size source measures what the display has written into its inline
  // style. Under a zoom that is the size of the whole pixels, up to one pixel short of what the
  // canvas was, and measured as the base of the next zoom it would shrink with every change of
  // the zoom. So the size it had without the zoom stays the base for as long as the canvas reads
  // back the zoomed size; a size it reads back otherwise — one the user wrote — becomes the new
  // base. A user who writes exactly the zoomed size cannot be told apart, and the base stays
  #selfSizeBaseWidth = 0;
  #selfSizeBaseHeight = 0;
  // NaN while the last measurement wrote no zoomed size into a canvas that measures itself
  #selfSizeZoomedWidth = Number.NaN;
  #selfSizeZoomedHeight = Number.NaN;

  // The element in fullscreen that contains the canvas — native, by anyone, or the pseudo target of
  // this display's fullscreen — worked out on every fullscreenchange and every change of the pseudo
  // mode, not in every frame. While it is set, a size source outside it gives way to it
  #containingFullscreen?: Element;
  #pseudoTarget?: HTMLElement;
  // A canvas that measures itself writes the size of the screen into its inline style while it
  // is in fullscreen — the size of a parent it gives way to, or its own as the fullscreen element.
  // What the inline style and the zoom bookkeeping held before is kept here and written back when
  // the fullscreen is left, or the canvas would read back the size of the screen and keep it
  #selfSizeBeforeFullscreen?: {
    width: string;
    height: string;
    baseWidth: number;
    baseHeight: number;
    zoomedWidth: number;
    zoomedHeight: number;
  };

  readonly #onFullscreenChange = (): void => {
    this.updateContainingFullscreen();
  };

  // A computed style declaration is live and follows its element, so one per element is enough.
  // The canvas of a display never changes; the source is fetched again once it is another element
  #canvasStyle?: CSSStyleDeclaration;
  #sourceStyle?: CSSStyleDeclaration;
  #sourceStyleOf?: Element;

  #lastResizePollMs = Number.NEGATIVE_INFINITY;

  /**
   * Set by `resize()` to mark whether it emitted `OnDisplayResize`, and what it answers: the display
   * decides by it whether the first frame still needs its fallback emit.
   */
  #didEmitResize = false;

  // the class name of the rule of resize-to="window", installed with the first resize() under it
  #windowClassName?: string;
  // the class of resize-to="window" sits on the canvas right now
  #windowClassApplied = false;

  // resize() runs every frame, and the resize-to value almost never changes: the element a
  // selector found is kept for as long as it still sits in the same root and still matches, so
  // a frame costs no DOM search. An invalid selector is kept too, so it is reported only once
  #resizeToSelector?: {value: string; root: Node; element: Element | null; invalid: boolean};

  #width = 0;
  #height = 0;
  #devicePixelZoom = 0;

  // the size in CSS pixels the last measurement found, without padding and border: the area a
  // budget of pixels is spread over
  #contentWidth = 0;
  #contentHeight = 0;

  // what the resolution policy reads, in one object that every call fills anew: the ratio is
  // compared in every frame and read for the props of every event, and neither allocates for it
  readonly #drawingBufferParams: DrawingBufferParams = {
    contentWidth: 0,
    contentHeight: 0,
    cssWidth: 0,
    cssHeight: 0,
    devicePixelRatio: 0,
    maxPixelRatio: 0,
    maxPixels: 0,
    resolutionScale: 1,
    pixelZoom: 0,
    maxResolution: 0,
  };

  // what the resolution policy answers, in one object that every measurement fills anew: a
  // display on the poll path measures in every frame, and allocates nothing for it
  readonly #drawingBuffer: DrawingBuffer = {
    width: 0,
    height: 0,
    cssWidth: 0,
    cssHeight: 0,
    pixelRatio: 0,
    pixelZoom: 0,
    devicePixelZoom: 0,
    requestedWidth: 0,
    requestedHeight: 0,
  };

  constructor(display: Display, host: DisplaySizerHost) {
    this.#display = display;
    this.#host = host;
  }

  /** The width the last measurement left, see `Display#width`. */
  get width(): number {
    return this.#width;
  }

  /** The height the last measurement left, see `Display#height`. */
  get height(): number {
    return this.#height;
  }

  /** The device pixels of a pixel of the drawing buffer the last measurement left, see `Display#devicePixelZoom`. */
  get devicePixelZoom(): number {
    return this.#devicePixelZoom;
  }

  /** The class of the rule of `resize-to="window"`, once installed; undefined before. */
  get windowClassName(): string | undefined {
    return this.#windowClassName;
  }

  /** The pixel ratio with `resolutionScale`, at the size of the last measurement, see `Display#pixelRatioAt()`. */
  pixelRatioAt(resolutionScale: number): number {
    return pixelRatioFor(this.#pixelRatioParams(resolutionScale));
  }

  // writes every field pixelRatioFor() reads, into the one object the display keeps for it
  #pixelRatioParams(resolutionScale: number): DrawingBufferParams {
    const params = this.#drawingBufferParams;
    params.contentWidth = this.#contentWidth;
    params.contentHeight = this.#contentHeight;
    params.devicePixelRatio = this.#display.devicePixelRatio;
    params.maxPixelRatio = this.#display.maxPixelRatio;
    params.maxPixels = this.#display.maxPixels;
    params.resolutionScale = resolutionScale;
    params.pixelZoom = this.#display.pixelZoom;
    return params;
  }

  /**
   * Answers whether this call emitted `OnDisplayResize`. `fromFrame` is the call at the start of a
   * frame: that one measures only when the size watch has seen a change, or on the poll path within
   * `resizePollIntervalMs`. A call of your own always measures and leaves the timing of the frames
   * alone.
   */
  resize(fromFrame: boolean): boolean {
    this.#didEmitResize = false;

    const canvas = this.#display.canvas;

    // image-rendering is not a size: it needs no measurement, so a change reaches the canvas
    // with this call, whether it measures or not
    this.#applyImageRendering(canvas);

    this.#resolveSizeSource(canvas);
    this.#followFullscreen(canvas);
    this.#applyWindowClass(canvas, this.#sizeSourceIsWindow);
    this.#observeSizeSource();

    const maxPixels = isPositiveFinite(this.#display.maxPixels) ? this.#display.maxPixels : 0;

    if (fromFrame) {
      // no observer sees what a callback answers, and a window without ResizeObserver or
      // matchMedia has no size watch
      const polls = this.#display.resizeToCallback != null || this.#sizeObserver == null;
      if (polls !== this.#pollingSize) {
        // a display that goes from polling over to the size watch measures once
        this.#pollingSize = polls;
        this.#sizeDirty = true;
      }

      if (polls) {
        if (this.#display.resizePollIntervalMs > 0) {
          const nowMs = performance.now();
          if (nowMs - this.#lastResizePollMs < this.#display.resizePollIntervalMs) {
            return this.#didEmitResize;
          }
          this.#lastResizePollMs = nowMs;
        }
      } else {
        const zoom = isPositiveFinite(this.#display.pixelZoom) ? this.#display.pixelZoom : 0;
        // the first frame always measures: the observer reports in the rendering update, after
        // the animation frame callbacks, and would miss a change between the constructor and
        // the start. A new maxPixelRatio, maxPixels or resolutionScale is seen by no observer
        // either: it shows in the ratio, and a budget under a zoom in the budget itself
        if (
          !this.#display.isFirstFrame &&
          !this.#sizeDirty &&
          zoom === this.#appliedPixelZoom &&
          this.#display.pixelRatio === this.#appliedPixelRatio &&
          maxPixels === this.#appliedMaxPixels
        ) {
          return this.#didEmitResize;
        }
      }
    }

    this.#sizeDirty = false;
    this.#appliedMaxPixels = maxPixels;
    this.#measureSizeSource(canvas);
    this.#applyMeasuredSize(canvas);
    return this.#didEmitResize;
  }

  /** Puts the size watch up, where the window has ResizeObserver and matchMedia. */
  startWatch(): void {
    const view = this.#host.view;
    if (typeof view.ResizeObserver !== 'function' || typeof view.matchMedia !== 'function') return;

    this.#sizeObserver = new view.ResizeObserver(this.#onSizeChange);
    // no observer can watch a window, and document.documentElement does not follow the height of
    // the viewport: the resize event is what reports a change of the window
    view.addEventListener('resize', this.#onSizeChange);
    this.#watchPixelRatio();
  }

  // A query on the current ratio stops matching as soon as the ratio changes; after that the
  // watch moves on to a query on the new one
  #watchPixelRatio(): void {
    this.#pixelRatioQuery?.removeEventListener('change', this.#onPixelRatioChange);
    this.#pixelRatioQuery = this.#host.view.matchMedia(`(resolution: ${this.#display.devicePixelRatio}dppx)`);
    this.#pixelRatioQuery.addEventListener('change', this.#onPixelRatioChange);
  }

  // Keeps the observer on the size source #resolveSizeSource() found last. A new source is
  // measured with the next measurement, observer or not
  #observeSizeSource(): void {
    const element = this.#sizeSourceIsWindow ? undefined : this.#sizeSourceElement;
    if (element === this.#observedElement && this.#sizeSourceIsWindow === this.#observedWindow) return;

    const observer = this.#sizeObserver;
    if (observer != null) {
      if (this.#observedElement != null) observer.unobserve(this.#observedElement);
      if (element != null) {
        try {
          // the device pixel box reports a change of the device pixels as well
          observer.observe(element, {box: 'device-pixel-content-box'});
        } catch {
          // Safari does not know that box and throws a TypeError
          observer.observe(element);
        }
      }
    }

    this.#observedElement = element;
    this.#observedWindow = this.#sizeSourceIsWindow;
    this.#sizeDirty = true;
  }

  /**
   * Takes the size watch and the fullscreenchange listener of `watchFullscreen()` down. The display's
   * `dispose()` calls it directly, so a constructor that throws after `startWatch()` takes the watch
   * down as well.
   */
  stopWatch(): void {
    if (this.#sizeObserver != null) {
      this.#sizeObserver.disconnect();
      // startWatch() puts the resize listener on the window only together with the observer
      this.#host.view.removeEventListener('resize', this.#onSizeChange);
    }
    this.#pixelRatioQuery?.removeEventListener('change', this.#onPixelRatioChange);

    this.#sizeObserver = undefined;
    this.#pixelRatioQuery = undefined;
    this.#observedElement = undefined;
    this.#observedWindow = false;
    this.#host.doc.removeEventListener('fullscreenchange', this.#onFullscreenChange);
  }

  /** Makes the size source follow a fullscreen of the document, and reads the one that holds now. */
  watchFullscreen(): void {
    // the size source follows a fullscreen the app enters on its own as well
    this.#host.doc.addEventListener('fullscreenchange', this.#onFullscreenChange);
    this.updateContainingFullscreen();
  }

  // Outside the comparison of the measured values on purpose: in it, every change would run
  // through setDrawingBufferSize() and emit an OnDisplayResize without a change of size. Compared
  // against the inline style, which is a read of the attribute and forces no layout
  #applyImageRendering(canvas: HTMLCanvasElement): void {
    const imageRendering =
      this.#display.styleImageRendering ?? (isPositiveFinite(this.#display.pixelZoom) ? 'pixelated' : 'auto');
    if (canvas.style.imageRendering !== imageRendering) {
      canvas.style.imageRendering = imageRendering;
    }
  }

  // Where the size comes from, as the resize-to attribute says. Reads the DOM, forces no layout,
  // and writes the source into #sizeSourceIsWindow and #sizeSourceElement
  #resolveSizeSource(canvas: HTMLCanvasElement): void {
    const resizeTo = this.#display.resizeToAttributeEl.getAttribute('resize-to')?.trim();

    if (!resizeTo) {
      this.#sizeSourceIsWindow = false;
      this.#sizeSourceElement = this.#display.resizeToElement;
    } else if (RESIZE_TO_WINDOW.test(resizeTo)) {
      // the suffix only after the match: the attribute is resolved in every frame
      if (resizeTo.endsWith('fullscreen')) showResizeToFullscreenWarning();
      this.#sizeSourceIsWindow = true;
      this.#sizeSourceElement = undefined;
    } else if (resizeTo === 'self') {
      this.#sizeSourceIsWindow = false;
      this.#sizeSourceElement = this.#display.resizeToElement ?? canvas;
    } else {
      this.#sizeSourceIsWindow = false;
      this.#sizeSourceElement = this.#resolveResizeToSelector(resizeTo) ?? this.#display.resizeToElement ?? canvas;
    }
  }

  /** Works out the element in fullscreen that contains the canvas anew, and marks the size dirty. */
  updateContainingFullscreen(): void {
    const canvas = this.#display.renderer?.domElement;
    if (canvas == null) return;
    this.#containingFullscreen = containingFullscreenOf(canvas, this.#pseudoTarget);
    this.#sizeDirty = true;
  }

  /** The pseudo target of the fullscreen of the display entered (the element) or left (`undefined`). */
  setPseudoTarget(target: HTMLElement | undefined): void {
    this.#pseudoTarget = target;
    this.updateContainingFullscreen();
  }

  // While an element that contains the canvas is in fullscreen, a size source outside it — or the
  // canvas itself, while the fullscreen element is not the canvas — gives way to the fullscreen
  // element. The window and a resizeToCallback stay what they are, and the callback keeps the
  // inline size it makes
  #followFullscreen(canvas: HTMLCanvasElement): void {
    const fullscreen = this.#containingFullscreen;
    const source = this.#sizeSourceElement ?? canvas;
    const follows = fullscreen != null && !this.#sizeSourceIsWindow && this.#display.resizeToCallback == null;
    const givesWay = follows && (source === canvas ? fullscreen !== canvas : !containsAcrossShadow(fullscreen, source));
    // a canvas that measures itself writes the size of the screen into its inline style in
    // fullscreen — the one of a parent it gives way to, or its own, which the browser stretches
    // to the screen when the canvas is the fullscreen element
    const keepsSelfSize = follows && source === canvas;

    if (keepsSelfSize && this.#selfSizeBeforeFullscreen == null) {
      this.#selfSizeBeforeFullscreen = {
        width: canvas.style.width,
        height: canvas.style.height,
        baseWidth: this.#selfSizeBaseWidth,
        baseHeight: this.#selfSizeBaseHeight,
        zoomedWidth: this.#selfSizeZoomedWidth,
        zoomedHeight: this.#selfSizeZoomedHeight,
      };
    } else if (!keepsSelfSize && this.#selfSizeBeforeFullscreen != null) {
      const before = this.#selfSizeBeforeFullscreen;
      this.#selfSizeBeforeFullscreen = undefined;
      if (source === canvas) {
        canvas.style.width = before.width;
        canvas.style.height = before.height;
        this.#selfSizeBaseWidth = before.baseWidth;
        this.#selfSizeBaseHeight = before.baseHeight;
        this.#selfSizeZoomedWidth = before.zoomedWidth;
        this.#selfSizeZoomedHeight = before.zoomedHeight;
        this.#sizeDirty = true;
      }
    }

    if (givesWay) this.#sizeSourceElement = fullscreen;
  }

  #applyWindowClass(canvas: HTMLCanvasElement, wantsWindow: boolean): void {
    if (wantsWindow === this.#windowClassApplied) return;

    if (wantsWindow) {
      this.#windowClassName ??= Stylesheets.installRule(
        this.#host.windowRulePrefix(),
        WINDOW_RULE_CSS,
        this.#host.styleSheetRoot(),
      );
      canvas.classList.add(this.#windowClassName);
    } else if (this.#windowClassName != null) {
      canvas.classList.remove(this.#windowClassName);
    }

    this.#windowClassApplied = wantsWindow;
  }

  /** The rule of `resize-to="window"`, once installed, in `root` as well. */
  installRules(root: HTMLElement | ShadowRoot): void {
    if (this.#windowClassName != null) Stylesheets.installRule(this.#host.windowRulePrefix(), WINDOW_RULE_CSS, root);
  }

  // The size of the source in CSS pixels, into #measuredWidth and #measuredHeight
  #measureSizeSource(canvas: HTMLCanvasElement): void {
    if (this.#display.resizeToCallback) {
      // a callback that reports no size gets the fallback, and no element is measured in its place
      const size = this.#display.resizeToCallback(this.#display);
      if (size != null && Number.isFinite(size[0]) && Number.isFinite(size[1])) {
        this.#measuredWidth = size[0];
        this.#measuredHeight = size[1];
        return;
      }
    } else {
      const element = this.#sizeSourceElement;
      if (element != null) {
        if (isApart(element)) {
          this.#measuredWidth = 0;
          this.#measuredHeight = 0;
          return;
        }
        // the content area: the client rect minus padding and border, both in the scale the
        // transforms give the element
        const rect = element.getBoundingClientRect();
        const style = this.#getSourceStyle(element, canvas);
        this.#measuredWidth = contentAreaSide(rect.width, (element as HTMLElement).offsetWidth, getHorizontalInnerMargin(style));
        this.#measuredHeight = contentAreaSide(rect.height, (element as HTMLElement).offsetHeight, getVerticalInnerMargin(style));
        return;
      }
    }

    if (this.#sizeSourceIsWindow) {
      this.#measuredWidth = this.#host.view.innerWidth;
      this.#measuredHeight = this.#host.view.innerHeight;
    } else {
      this.#measuredWidth = 300;
      this.#measuredHeight = 150;
    }
  }

  #getCanvasStyle(canvas: HTMLCanvasElement): CSSStyleDeclaration {
    this.#canvasStyle ??= getComputedStyle(canvas, null);
    return this.#canvasStyle;
  }

  #getSourceStyle(element: Element, canvas: HTMLCanvasElement): CSSStyleDeclaration {
    if (element === canvas) return this.#getCanvasStyle(canvas);
    if (this.#sourceStyle == null || this.#sourceStyleOf !== element) {
      this.#sourceStyle = getComputedStyle(element, null);
      this.#sourceStyleOf = element;
    }
    return this.#sourceStyle;
  }

  #applyMeasuredSize(canvas: HTMLCanvasElement): void {
    let wPx = this.#measuredWidth;
    let hPx = this.#measuredHeight;

    const sizeRefElement = this.#sizeSourceElement;
    // a callback answers the size itself, and the window has no inline style to read back
    const measuresItself = this.#display.resizeToCallback == null && !this.#sizeSourceIsWindow && sizeRefElement === canvas;
    const devicePixelRatio = this.#display.devicePixelRatio;
    if (measuresItself) {
      if (readsBackWrittenSize(wPx, this.#selfSizeZoomedWidth, devicePixelRatio)) wPx = this.#selfSizeBaseWidth;
      else this.#selfSizeBaseWidth = wPx;
      if (readsBackWrittenSize(hPx, this.#selfSizeZoomedHeight, devicePixelRatio)) hPx = this.#selfSizeBaseHeight;
      else this.#selfSizeBaseHeight = hPx;
    }

    let cssWidth = wPx;
    let cssHeight = hPx;

    // a canvas apart from the document has neither borders nor padding to read
    const canvasStyle = isApart(canvas) ? undefined : this.#getCanvasStyle(canvas);
    const canvasIsContentBox = canvasStyle != null && getIsContentBox(canvasStyle);
    const canvasHorizontalInnerMargin = canvasStyle != null ? getHorizontalInnerMargin(canvasStyle) : 0;
    const canvasVerticalInnerMargin = canvasStyle != null ? getVerticalInnerMargin(canvasStyle) : 0;

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

    // the ratio spreads a budget of pixels over this size
    this.#contentWidth = wPx;
    this.#contentHeight = hPx;

    const params = this.#pixelRatioParams(this.#display.resolutionScale);
    params.cssWidth = cssWidth;
    params.cssHeight = cssHeight;
    params.maxResolution = this.#host.maxResolution();
    const buffer = resolveDrawingBuffer(params, this.#drawingBuffer);
    if (buffer.requestedWidth > 0 || buffer.requestedHeight > 0) {
      showCanvasMaxResolutionWarning(this.#host.maxResolution(), buffer.requestedWidth, buffer.requestedHeight);
    }

    // the CSS size of the whole pixels, the part of the inline size a canvas that measures itself
    // reads back with its next measurement
    const zoomedItself = measuresItself && buffer.pixelZoom > 0;
    this.#selfSizeZoomedWidth = zoomedItself ? (buffer.width * buffer.devicePixelZoom) / devicePixelRatio : Number.NaN;
    this.#selfSizeZoomedHeight = zoomedItself ? (buffer.height * buffer.devicePixelZoom) / devicePixelRatio : Number.NaN;

    const {width, height, pixelRatio, pixelZoom, devicePixelZoom} = buffer;

    if (
      width === this.#appliedWidth &&
      height === this.#appliedHeight &&
      buffer.cssWidth === this.#appliedCssWidth &&
      buffer.cssHeight === this.#appliedCssHeight &&
      pixelRatio === this.#appliedPixelRatio &&
      pixelZoom === this.#appliedPixelZoom &&
      devicePixelZoom === this.#appliedDevicePixelZoom
    ) {
      return;
    }

    this.#appliedWidth = width;
    this.#appliedHeight = height;
    this.#appliedCssWidth = buffer.cssWidth;
    this.#appliedCssHeight = buffer.cssHeight;
    this.#appliedPixelRatio = pixelRatio;
    this.#appliedPixelZoom = pixelZoom;
    this.#appliedDevicePixelZoom = devicePixelZoom;

    this.#width = width;
    this.#height = height;
    this.#devicePixelZoom = devicePixelZoom;

    // one call for size and ratio: setPixelRatio() on its own resizes the drawing buffer to the
    // old size times the new ratio, and a change from a ratio of 1 to 2 at the limit would ask
    // for a buffer of twice MaxResolution before setSize() brings it back
    this.#display.renderer!.setDrawingBufferSize(this.#width, this.#height, pixelRatio);

    canvas.style.width = `${buffer.cssWidth}px`;
    canvas.style.height = `${buffer.cssHeight}px`;

    const isConstructing = this.#display.frameNo === 0;
    if (!isConstructing) {
      this.#host.emitResize();
      this.#didEmitResize = true;
    }
  }

  #resolveResizeToSelector(value: string): Element | undefined {
    // the document, the shadow root the attribute element sits in, or the topmost element of a
    // detached tree — all three can run querySelector
    const root = this.#display.resizeToAttributeEl.getRootNode() as Node & ParentNode;

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
      // biome-ignore lint/suspicious/noConsole: the warning to the developer is the point
      console.warn(
        `Display: resize-to=${describeValue(value)} is not a valid selector; the display falls back to its resizeToElement or the canvas`,
      );
      this.#resizeToSelector = {value, root, element: null, invalid: true};
      return undefined;
    }

    this.#resizeToSelector = {value, root, element, invalid: false};
    return element ?? undefined;
  }
}

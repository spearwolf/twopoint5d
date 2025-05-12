import {emit, eventize, off, on, once, retain, retainClear} from '@spearwolf/eventize';
import {WebGLRenderer} from 'three';
import {
  OnDisposeDisplay,
  OnInitDisplay,
  OnPauseDisplay,
  OnRenderFrame,
  OnResize,
  OnRestartDisplay,
  OnStartDisplay,
} from '../events.js';
import {Chronometer} from './Chronometer.js';
import {DisplayStateMachine} from './DisplayStateMachine.js';
import {isWebGLRenderer} from './isWebGLRenderer.js';
import {isWebGPURenderer} from './isWebGPURenderer.js';
import {Stylesheets} from './Stylesheets.js';
import {getContentAreaSize, getHorizontalInnerMargin, getIsContentBox, getVerticalInnerMargin} from './styleUtils.js';
import type {DisplayEventArgs, DisplayParameters, ResizeToCallbackFn, ThreeRendererType} from './types.js';
import {FrameLoop} from './FrameLoop.js';

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

export class Display {
  /**
   * If the width or height determined from the display is greater than this value, an exception is thrown.
   * However, this value can also be adjusted if desired.
   */
  static MaxResolution = 8192;

  static CssRulesPrefixContainer = 'twopoint5d-container';
  static CssRulesPrefixDisplay = 'twopoint5d-canvas';
  static CssRulesPrefixFullscreen = 'twopoint5d-canvas--fullscreen';

  #chronometer = new Chronometer(0);

  #stateMachine = new DisplayStateMachine();

  #lastResizeHash = '';

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

  /**
   * The width of the canvas is recalculated for each frame.
   */
  width = 0;

  /**
   * The height of the canvas is recalculated for each frame.
   */
  height = 0;

  /**
   * The current frame number. Starts at 0.
   */
  frameNo = 0;

  get isFirstFrame(): boolean {
    return this.frameNo === 0;
  }

  readonly frameLoop: FrameLoop;

  /**
   * see {@link DisplayParameters.maxFps}
   */
  resizeToElement?: HTMLElement;

  /**
   * see {@link DisplayParameters.resizeTo}
   */
  resizeToCallback?: ResizeToCallbackFn;

  /**
   * see {@link DisplayParameters.resizeToElement}
   */
  resizeToAttributeEl: HTMLElement;

  /**
   * see {@link DisplayParameters.styleSheetRoot}
   */
  styleSheetRoot: HTMLElement | ShadowRoot;

  renderer?: ThreeRendererType;

  constructor(domElementOrRenderer: HTMLElement | ThreeRendererType, options?: DisplayParameters) {
    eventize(this);

    retain(this, [OnInitDisplay, OnStartDisplay, OnResize]);

    this.#chronometer.stop();

    this.frameLoop = new FrameLoop(options?.maxFps ?? 0);

    this.resizeToCallback = options?.resizeTo;
    this.styleSheetRoot = options?.styleSheetRoot ?? document.head;

    if (isWebGLRenderer(domElementOrRenderer) || isWebGPURenderer(domElementOrRenderer)) {
      this.renderer = domElementOrRenderer as ThreeRendererType;
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
      if (options?.webgpu) {
        // eslint-disable-next-line no-console
        console.warn(
          'WebGPU is not supported yet. If you want to use WebGPU, please create a WebGPURenderer instance and pass it to the :renderer option!',
        );
      }
      this.renderer = new WebGLRenderer({
        canvas,
        precision: 'highp',
        preserveDrawingBuffer: false,
        stencil: false,
        alpha: true,
        antialias: true,
        powerPreference: 'high-performance',
        ...options,
      });
      // this.renderer = options?.webgpu
      //   ? new WebGPURenderer({
      //     canvas,
      //     stencil: false,
      //     alpha: true,
      //     antialias: true,
      //     powerPreference: 'high-performance',
      //     ...options,
      //   })
      //   : new WebGLRenderer({
      //     canvas,
      //     precision: 'highp',
      //     preserveDrawingBuffer: false,
      //     stencil: false,
      //     alpha: true,
      //     antialias: true,
      //     powerPreference: 'high-performance',
      //     ...options,
      //   });
    }

    const {domElement: canvas} = this.renderer!;
    Stylesheets.addRule(canvas, Display.CssRulesPrefixDisplay, 'touch-action: none;', this.styleSheetRoot);
    canvas.setAttribute('touch-action', 'none'); // => PEP polyfill

    this.resizeToElement = options?.resizeToElement ?? this.resizeToElement;
    this.resizeToAttributeEl = options?.resizeToAttributeEl ?? canvas;

    this.resize();

    on(this.#stateMachine, {
      [DisplayStateMachine.Init]: async () => {
        if (isWebGPURenderer(this.renderer)) {
          await this.renderer.init();
        }
        this.#emit(OnInitDisplay);
      },

      [DisplayStateMachine.Restart]: () => this.#emit(OnRestartDisplay),

      [DisplayStateMachine.Start]: () => {
        this.#chronometer.start();
        this.#chronometer.update();

        this.#emit(OnStartDisplay);
      },

      [DisplayStateMachine.Pause]: () => {
        this.#chronometer.stop();

        retainClear(this, OnStartDisplay);

        this.#emit(OnPauseDisplay);
      },
    });

    if (typeof document !== 'undefined') {
      const onDocVisibilityChange = () => {
        this.#stateMachine.documentIsVisible = !document.hidden;
      };

      document.addEventListener('visibilitychange', onDocVisibilityChange, false);

      once(this, OnDisposeDisplay, () => {
        document.removeEventListener('visibilitychange', onDocVisibilityChange, false);
      });

      onDocVisibilityChange();
    }

    this.frameLoop.start(this);
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

  get pixelRatio(): number {
    if (this.pixelZoom > 0) {
      return 1.0;
    }
    return this.devicePixelRatio;
  }

  get devicePixelRatio(): number {
    return window.devicePixelRatio ?? 1;
  }

  resize(): void {
    let wPx = 300;
    let hPx = 150;

    const canvasElement = this.renderer!.domElement;

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
        this.width = wPx / pixelZoom;
        this.height = hPx / pixelZoom;
      } else {
        this.width = wPx;
        this.height = hPx;
      }

      this.width = Math.floor(this.width);
      this.height = Math.floor(this.height);

      this.renderer!.setPixelRatio(pixelRatio);
      this.renderer!.setSize(this.width, this.height, false);

      canvasElement.style.width = `${cssWidth}px`;
      canvasElement.style.height = `${cssHeight}px`;
      canvasElement.style.imageRendering = this.styleImageRendering ?? (pixelZoom > 0 ? 'pixelated' : 'auto');

      const isConstructing = this.frameNo === 0;
      if (!isConstructing) this.#emit(OnResize);
    }
  }

  [FrameLoop.OnFrame](): void {
    if (!this.pause) {
      this.renderFrame();
    }
  }

  /**
   * You don't need to call this up yourself.
   * It happens automatically after you call {@link start}.
   */
  renderFrame(now = window.performance.now()): void {
    this.#chronometer.update(now / 1000);

    this.resize();

    if (this.isFirstFrame) this.#emit(OnResize);

    this.#emit(OnRenderFrame);

    ++this.frameNo;
  }

  async start(beforeStartCallback?: (args: DisplayEventArgs) => Promise<void> | void): Promise<Display> {
    if (typeof beforeStartCallback === 'function') {
      await beforeStartCallback(this.getEventArgs());
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
    emit(this, OnDisposeDisplay, this);
    off(this);
    this.renderer?.dispose();
    delete this.renderer;
  }

  /**
   * This is a public method so it's easy to override if you want
   */
  getEventArgs(): DisplayEventArgs {
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
      emit(this, eventName, this.getEventArgs());
    }
  };
}

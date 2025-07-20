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

  readonly frameLoop: FrameLoop;

  /**
   * see {@link DisplayParameters.maxFps}
   */
  resizeToElement?: HTMLElement;

  /**
   * see {@link DisplayParameters.resizeTo}
   */
  resizeToCallback?: ResizeDisplayToFn;

  /**
   * see {@link DisplayParameters.resizeToElement}
   */
  resizeToAttributeEl: HTMLElement;

  /**
   * see {@link DisplayParameters.styleSheetRoot}
   */
  styleSheetRoot: HTMLElement | ShadowRoot;

  renderer?: WebGPURenderer;

  readonly #waitForRendererInit!: Promise<WebGPURenderer>;

  constructor(domElementOrRenderer: HTMLElement | WebGPURenderer, options?: DisplayParameters) {
    eventize(this);

    retain(this, [OnDisplayInit, OnDisplayStart, OnDisplayResize]);

    this.#chronometer.stop();

    this.frameLoop = new FrameLoop(options?.maxFps ?? 0);

    this.resizeToCallback = options?.resizeTo;
    this.styleSheetRoot = options?.styleSheetRoot ?? document.head;

    if (isWebGLRenderer(domElementOrRenderer)) {
      // eslint-disable-next-line no-console
      console.warn(
        'The Display constructor expects a WebGPURenderer or an HTML element as the first argument.',
        'Since twopoint5d@0.13 a WebGLRenderer is not supported anymore.',
      );
      throw new TypeError('The Display constructor expects a WebGPURenderer or an HTML element as the first argument.');
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

      this.#waitForRendererInit = this.renderer.init();
    }

    const {domElement: canvas} = this.renderer!;
    Stylesheets.addRule(canvas, Display.CssRulesPrefixDisplay, 'touch-action: none;', this.styleSheetRoot);
    canvas.setAttribute('touch-action', 'none'); // => PEP polyfill

    this.resizeToElement = options?.resizeToElement ?? this.resizeToElement;
    this.resizeToAttributeEl = options?.resizeToAttributeEl ?? canvas;

    this.resize();

    on(this.#stateMachine, {
      [DisplayStateMachine.Init]: async () => {
        await this.#waitForRendererInit;
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
      if (!isConstructing) this.#emit(OnDisplayResize);
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
    this.#isFirstFrame = this.frameNo === 0;
    this.frameNo += 1;

    this.#chronometer.update(now / 1000);

    this.resize();

    if (this.isFirstFrame) this.#emit(OnDisplayResize);

    this.#emit(OnDisplayRenderFrame);
  }

  async start(beforeStartCallback?: (args: DisplayEventProps) => Promise<void> | void): Promise<Display> {
    await this.#waitForRendererInit;

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

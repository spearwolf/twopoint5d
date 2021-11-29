/* eslint-disable no-lonely-if */
import eventize, {Eventize} from '@spearwolf/eventize';
import {WebGLRenderer, WebGLRendererParameters} from 'three';
import {Stylesheets} from './Stylesheets';
import {getHorizontalInnerMargin, getIsContentBox, getVerticalInnerMargin} from './styleUtils';

const CANVAS_MAX_RESOLUTION = 8192;
let canvasMaxResolutionWarningWasShown = false;

function showCanvasMaxResolutionWarning(w: number, h: number) {
  if (!canvasMaxResolutionWarningWasShown) {
    // eslint-disable-next-line no-console
    console.warn(
      `Oops, the canvas width or height should not bigger than ${CANVAS_MAX_RESOLUTION} pixels (${w}x${h} was requested).`,
      'If you need more, please create a PR ;) https://github.com/spearwolf/three-vertex-objects',
    );
    canvasMaxResolutionWarningWasShown = true;
  }
}

export interface DisplayEventArgs {
  display: Display;
  renderer: WebGLRenderer;
  width: number;
  height: number;
  now: number;
  deltaTime: number;
  frameNo: number;
}

export type ResizeCallbackFn = (display: Display) => [width: number, height: number];

export type DisplayParameters = Partial<Omit<WebGLRendererParameters, 'canvas'>> & {
  resizeTo?: ResizeCallbackFn;
};

export interface Display extends Eventize {}

export class Display {
  #pause = false;
  #initialized = false;

  #rafID = -1;
  #lastResizeHash = '';

  #fullscreenCssRules: string = undefined;
  #fullscreenCssRulesMustBeRemoved = false;

  width = 0;
  height = 0;

  now = 0;
  lastNow = 0;
  deltaTime = 0;
  frameNo = 0;

  resizeToElement: HTMLElement = undefined;
  resizeToCallback: ResizeCallbackFn = undefined;

  renderer: WebGLRenderer;

  constructor(domElementOrRenderer: HTMLElement | WebGLRenderer, options?: DisplayParameters) {
    eventize(this);

    this.resizeToCallback = options?.resizeTo;

    if (domElementOrRenderer instanceof WebGLRenderer) {
      this.renderer = domElementOrRenderer;
      this.resizeToElement = domElementOrRenderer.domElement;
    } else if (domElementOrRenderer instanceof HTMLElement) {
      let canvas;
      if (domElementOrRenderer.tagName === 'CANVAS') {
        canvas = domElementOrRenderer;
      } else {
        const container = document.createElement('div');
        Stylesheets.addRule(
          container,
          'three-display__Container',
          // we create another container div here to avoid the if container-has-no-discrete-size
          // then line-height-and-font-height-styles-give-weird-client-rect-behaviour issue
          'display:block;width:100%;height:100%;margin:0;padding:0;border:0;line-height:0;font-size:0;',
        );
        domElementOrRenderer.appendChild(container);

        canvas = document.createElement('canvas');
        container.appendChild(canvas);
      }
      this.resizeToElement = domElementOrRenderer;
      this.renderer = new WebGLRenderer({
        canvas,
        precision: 'highp',
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
        stencil: false,
        alpha: true,
        antialias: true,
        ...options,
      });
    }

    const {domElement: canvas} = this.renderer;
    Stylesheets.addRule(canvas, 'three-display__Display', 'touch-action: none;');
    canvas.setAttribute('touch-action', 'none'); // => PEP polyfill

    this.resize();
  }

  get pause(): boolean {
    return this.#pause;
  }

  set pause(pause: boolean) {
    if (this.#initialized) {
      if (pause && !this.#pause) {
        this.stop();
      } else if (!pause && this.#pause) {
        this.start();
      }
    } else {
      this.#pause = pause;
    }
  }

  get pixelRatio(): number {
    return window.devicePixelRatio ?? 0;
  }

  resize(): void {
    let wPx = 300;
    let hPx = 150;

    const canvasElement = this.renderer.domElement;

    let sizeRefElement = this.resizeToElement;

    let fullscreenCssRulesMustBeRemoved = this.#fullscreenCssRulesMustBeRemoved;

    if (canvasElement.hasAttribute('resize-to')) {
      const resizeTo = canvasElement.getAttribute('resize-to').trim();
      if (resizeTo.match(/^:?(fullscreen|window)$/)) {
        wPx = window.innerWidth;
        hPx = window.innerHeight;
        sizeRefElement = undefined;

        let fullscreenCssRules = this.#fullscreenCssRules;
        if (!fullscreenCssRules) {
          fullscreenCssRules = Stylesheets.installRule(
            'three-display__fullscreen',
            `
              position: fixed;
              top: 0;
              left: 0;
            `,
          );
          this.#fullscreenCssRules = fullscreenCssRules;
        }
        if (fullscreenCssRulesMustBeRemoved) {
          fullscreenCssRulesMustBeRemoved = false;
        } else {
          canvasElement.classList.add(fullscreenCssRules);
          this.#fullscreenCssRulesMustBeRemoved = true;
        }
      } else if (resizeTo) {
        sizeRefElement = document.querySelector(resizeTo) ?? canvasElement;
      }
    }

    if (fullscreenCssRulesMustBeRemoved) {
      canvasElement.classList.remove(this.#fullscreenCssRules);
      this.#fullscreenCssRulesMustBeRemoved = false;
    }

    if (this.resizeToCallback) {
      const size = this.resizeToCallback(this);
      if (size) {
        wPx = size[0];
        hPx = size[1];
      }
    } else if (sizeRefElement) {
      const sizeRefStyle = getComputedStyle(sizeRefElement, null);
      const resizeToHorizontalInnerMargin = getHorizontalInnerMargin(sizeRefStyle);
      const resizeToVerticalInnerMargin = getVerticalInnerMargin(sizeRefStyle);

      const elementSize = sizeRefElement.getBoundingClientRect();

      wPx = elementSize.width - resizeToHorizontalInnerMargin;
      hPx = elementSize.height - resizeToVerticalInnerMargin;
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

    wPx = Math.floor(wPx);
    hPx = Math.floor(hPx);
    cssWidth = Math.floor(cssWidth);
    cssHeight = Math.floor(cssHeight);

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

    if (wPx > CANVAS_MAX_RESOLUTION) {
      wPx = CANVAS_MAX_RESOLUTION;
      showCanvasMaxResolutionWarning(wPx, hPx);
    }
    if (hPx > CANVAS_MAX_RESOLUTION) {
      hPx = CANVAS_MAX_RESOLUTION;
      showCanvasMaxResolutionWarning(wPx, hPx);
    }

    const {pixelRatio} = this;
    const resizeHash = `${wPx}|${cssWidth}x${hPx}|${cssHeight}x${pixelRatio}`;

    if (resizeHash !== this.#lastResizeHash) {
      this.#lastResizeHash = resizeHash;

      this.width = wPx;
      this.height = hPx;

      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(wPx, hPx, false);

      canvasElement.style.width = `${cssWidth}px`;
      canvasElement.style.height = `${cssHeight}px`;

      if (this.frameNo > 0) {
        // no need to emit this inside construction phase
        this.emit('resize', this.getEmitArgs());
      }
    }
  }

  renderFrame(now = window.performance.now()): void {
    if (this.#pause) return;

    if (this.frameNo === 0 || this.lastNow === 0) {
      this.now = now / 1000.0;
      this.lastNow = this.now;
      this.deltaTime = 0;
    } else if (this.frameNo > 0) {
      this.lastNow = this.now;
      this.now = now / 1000.0;
      this.deltaTime = this.now - this.lastNow;
    }

    this.resize();

    if (this.frameNo === 0) {
      this.emit('resize', this.getEmitArgs()); // always emit resize event before render the first frame!
    }

    this.emit('frame', this.getEmitArgs());

    ++this.frameNo;
  }

  async start(beforeStartCallback?: (args: DisplayEventArgs) => Promise<void> | void): Promise<Display> {
    this.#pause = false;

    if (!this.#initialized) {
      this.emit('init', this.getEmitArgs());
      document?.addEventListener(
        'visibilitychange',
        () => {
          this.pause = document.hidden;
          this.lastNow = 0;
          this.emit(this.pause ? 'hide' : 'show', this.getEmitArgs());
        },
        false,
      );
      this.#initialized = true;
    }

    if (typeof beforeStartCallback === 'function') {
      await beforeStartCallback(this.getEmitArgs());
    }

    this.emit('start', this.getEmitArgs());

    const renderFrame = (now: number) => {
      if (!this.#pause) {
        this.renderFrame(now);
      }
      this.#rafID = window.requestAnimationFrame(renderFrame);
    };

    this.#rafID = window.requestAnimationFrame(renderFrame);

    return this;
  }

  stop(): void {
    window.cancelAnimationFrame(this.#rafID);
    this.#pause = true;
    this.lastNow = 0;
    this.deltaTime = 0;
  }

  getEmitArgs(): DisplayEventArgs {
    return {
      display: this,
      renderer: this.renderer,
      width: this.width,
      height: this.height,
      now: this.now,
      deltaTime: this.deltaTime,
      frameNo: this.frameNo,
    };
  }
}

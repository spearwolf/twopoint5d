import {WebGLRenderer, WebGLRendererParameters} from 'three';
import eventize, {Eventize} from '@spearwolf/eventize';

import {Stylesheets} from './Stylesheets';

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
  #lastPixelRatio = -1;

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
        canvas = document.createElement('canvas');
        domElementOrRenderer.appendChild(canvas);
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
    let wPx = 320;
    let hPx = 200;

    let domElement = this.resizeToElement;

    const canvasElement = this.renderer.domElement;

    let fullscreenCssRulesMustBeRemoved = this.#fullscreenCssRulesMustBeRemoved;

    if (canvasElement.hasAttribute('resize-to')) {
      const resizeTo = canvasElement.getAttribute('resize-to').trim();
      if (resizeTo.match(/^:?(fullscreen|window)$/)) {
        wPx = window.innerWidth;
        hPx = window.innerHeight;
        domElement = undefined;

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
        domElement = document.querySelector(resizeTo) ?? canvasElement;
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
    } else if (domElement) {
      const {width, height} = domElement.getBoundingClientRect();

      const styles = getComputedStyle(domElement, null);
      const verticalMargin =
        parseInt(styles.getPropertyValue('border-top-width') || '0', 10) +
        parseInt(styles.getPropertyValue('border-bottom-width') || '0', 10) +
        parseInt(styles.getPropertyValue('padding-top') || '0', 10) +
        parseInt(styles.getPropertyValue('padding-bottom') || '0', 10);
      const horizontalMargin =
        parseInt(styles.getPropertyValue('border-right-width') || '0', 10) +
        parseInt(styles.getPropertyValue('border-left-width') || '0', 10) +
        parseInt(styles.getPropertyValue('padding-left') || '0', 10) +
        parseInt(styles.getPropertyValue('padding-right') || '0', 10);

      wPx = Math.floor(width - horizontalMargin);
      hPx = Math.floor(height - verticalMargin);
    }

    const {pixelRatio} = this;

    if (pixelRatio !== this.#lastPixelRatio || wPx !== this.width || hPx !== this.height) {
      this.width = wPx;
      this.height = hPx;
      this.#lastPixelRatio = pixelRatio;

      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(wPx, hPx);

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

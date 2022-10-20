import eventize, {Eventize} from '@spearwolf/eventize';
import {WebGLRenderer} from 'three';

import {Chronometer} from './Chronometer';
import {DisplayStateMachine} from './DisplayStateMachine';
import {Stylesheets} from './Stylesheets';
import {getContentAreaSize, getHorizontalInnerMargin, getIsContentBox, getVerticalInnerMargin} from './styleUtils';
import {DisplayEventArgs, DisplayParameters, ResizeCallback} from './types';

let canvasMaxResolutionWarningWasShown = false;

function showCanvasMaxResolutionWarning(w: number, h: number) {
  if (!canvasMaxResolutionWarningWasShown) {
    // eslint-disable-next-line no-console
    console.warn(
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      `Oops, the canvas width or height should not bigger than ${Display.MaxResolution} pixels (${w}x${h} was requested).`,
      'If you need more, please set Display.MaxResolution before you create a Display!',
    );
    canvasMaxResolutionWarningWasShown = true;
  }
}

export interface Display extends Eventize {}

export class Display {
  static MaxResolution = 8192;

  #chronometer = new Chronometer(0);

  #stateMachine = new DisplayStateMachine();

  #rafID = -1;
  #lastResizeHash = '';

  #fullscreenCssRules: string = undefined;
  #fullscreenCssRulesMustBeRemoved = false;

  width = 0;
  height = 0;

  frameNo = 0;

  resizeToElement: HTMLElement = undefined;
  resizeToCallback: ResizeCallback = undefined;

  renderer: WebGLRenderer;

  constructor(domElementOrRenderer: HTMLElement | WebGLRenderer, options?: DisplayParameters) {
    eventize(this);

    this.#chronometer.stop();

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
          'display3__Container',
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
    Stylesheets.addRule(canvas, 'display3__Display', 'touch-action: none;');
    canvas.setAttribute('touch-action', 'none'); // => PEP polyfill

    this.resize();

    this.#stateMachine.on({
      [DisplayStateMachine.Init]: () => this.#emitEvent('init'),
      [DisplayStateMachine.Restart]: () => this.#emitEvent('restart'),

      [DisplayStateMachine.Start]: () => {
        this.#chronometer.start();
        this.#chronometer.update();

        const renderFrame = (now: number) => {
          if (!this.pause) {
            this.renderFrame(now);
          }

          this.#rafID = window.requestAnimationFrame(renderFrame);
        };

        this.#rafID = window.requestAnimationFrame(renderFrame);

        this.#emitEvent('start');
      },

      [DisplayStateMachine.Pause]: () => {
        window.cancelAnimationFrame(this.#rafID);

        this.#chronometer.stop();

        this.#emitEvent('pause');
      },
    });

    if (typeof document !== 'undefined') {
      const onDocVisibilityChange = () => {
        this.#stateMachine.documentIsVisible = !document.hidden;
      };

      document.addEventListener('visibilitychange', onDocVisibilityChange, false);
      this.once('dispose', () => {
        document.removeEventListener('visibilitychange', onDocVisibilityChange, false);
      });

      onDocVisibilityChange();
    }
  }

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
            'display3__fullscreen',
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

    if (wPx > Display.MaxResolution) {
      wPx = Display.MaxResolution;
      showCanvasMaxResolutionWarning(wPx, hPx);
    }
    if (hPx > Display.MaxResolution) {
      hPx = Display.MaxResolution;
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
        this.#emitEvent('resize');
      }
    }
  }

  renderFrame(now = window.performance.now()): void {
    this.#chronometer.update(now / 1000);

    this.resize();

    if (this.frameNo === 0) {
      this.#emitEvent('resize'); // always emit resize event before render the first frame!
    }

    this.#emitEvent('frame');

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
    this.emit('dispose');
    this.off();
    this.renderer.dispose();
    delete this.renderer;
  }

  /** this is a public method so it's easy to override if you want */
  getEventArgs(): DisplayEventArgs {
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

  #emitEvent = (eventName: string): void => {
    this.emit(eventName, this.getEventArgs());
  };
}

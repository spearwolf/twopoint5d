/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {WebGLRenderer} from 'three';

import eventize from '../../libs/eventize.js';

import {Stylesheets} from '../utils/Stylesheets.js';

export class Display {
  #lastPixelRatio = -1;
  #rafID = -1;
  #initialized = false;

  width = 0;
  height = 0;

  now = 0;
  deltaTime = 0;
  frameNo = 0;

  pause = false;

  constructor(canvasOrRenderer, options) {
    eventize(this);

    this.renderer =
      canvasOrRenderer instanceof WebGLRenderer
        ? canvasOrRenderer
        : new WebGLRenderer({
            canvas: canvasOrRenderer,
            precision: 'highp',
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance',
            stencil: false,
            alpha: true,
            antialias: true,
            ...options,
          });

    const {domElement} = this.renderer;
    Stylesheets.addRule(
      domElement,
      'three-vertex-objects__Display',
      'touch-action: none;',
    );
    domElement.setAttribute('touch-action', 'none'); // => PEP polyfill

    this.resize();
  }

  get pixelRatio() {
    return window.devicePixelRatio ?? 0;
  }

  resize() {
    let wPx = 320;
    let hPx = 200;

    const {domElement} = this.renderer;
    const {width, height} = domElement.getBoundingClientRect();

    const styles = getComputedStyle(domElement, null);
    const verticalMargin =
      parseInt(styles.getPropertyValue('border-top-width') || 0, 10) +
      parseInt(styles.getPropertyValue('border-bottom-width') || 0, 10) +
      parseInt(styles.getPropertyValue('padding-top') || 0, 10) +
      parseInt(styles.getPropertyValue('padding-bottom') || 0, 10);
    const horizontalMargin =
      parseInt(styles.getPropertyValue('border-right-width') || 0, 10) +
      parseInt(styles.getPropertyValue('border-left-width') || 0, 10) +
      parseInt(styles.getPropertyValue('padding-left') || 0, 10) +
      parseInt(styles.getPropertyValue('padding-right') || 0, 10);

    wPx = Math.floor(width - horizontalMargin);
    hPx = Math.floor(height - verticalMargin);

    const {pixelRatio} = this;

    if (
      pixelRatio !== this.#lastPixelRatio ||
      wPx !== this.width ||
      hPx !== this.height
    ) {
      this.width = wPx;
      this.height = hPx;
      this.#lastPixelRatio = pixelRatio;

      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.setSize(wPx, hPx);

      if (this.frameNo > 0) {
        // no need to emit this inside construction phase
        this.#emitResize();
      }
    }
  }

  renderFrame(now = window.performance.now()) {
    this.lastNow = this.now;
    this.now = now / 1000.0;

    if (this.frameNo > 0) {
      this.deltaTime = this.now - this.lastNow;
    }

    this.resize();

    if (this.frameNo === 0) {
      this.#emitResize(); // always emit resize event before render the first frame!
    }

    // if (this.autoClear) {
    //   this.renderer.clear();
    // }

    this.#emitFrame();

    ++this.frameNo;
  }

  start() {
    this.pause = false;
    this.#emitInit();
    this.#emitStart();

    const renderFrame = (now) => {
      if (!this.pause) {
        this.renderFrame(now);
      }
      this.#rafID = window.requestAnimationFrame(renderFrame);
    };

    this.#rafID = window.requestAnimationFrame(renderFrame);

    return this;
  }

  stop() {
    window.cancelAnimationFrame(this.#rafID);
  }

  #emitInit = () => {
    if (!this.#initialized) {
      this.#emit('init');
      this.#initialized = true;
    }
  };

  #emitStart = () => {
    this.#emit('start');
  };

  #emitResize = () => {
    this.#emit('resize');
  };

  #emitFrame = () => {
    this.#emit('frame');
  };

  #emit = (eventName) => {
    this.emit(eventName, {
      display: this,
      renderer: this.renderer,
      width: this.width,
      height: this.height,
      now: this.now,
      deltaTime: this.deltaTime,
      frameNo: this.frameNo,
    });
  };
}

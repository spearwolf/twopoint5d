/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
import {WebGLRenderer} from 'three';

import eventize from '../../libs/eventize.js';

import {Stylesheets} from '../utils/Stylesheets.js';

export class Display {
  #lastPixelRatio = -1;
  #rafID = -1;
  #initialized = false;
  #fullscreenCssRules = undefined;
  #fullscreenCssRulesMustBeRemoved = false;

  width = 0;
  height = 0;

  now = 0;
  deltaTime = 0;
  frameNo = 0;

  pause = false;

  resizeToElement = undefined;

  constructor(domElementOrRenderer, options) {
    eventize(this);

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
    Stylesheets.addRule(
      canvas,
      'three-vertex-objects__Display',
      'touch-action: none;',
    );
    canvas.setAttribute('touch-action', 'none'); // => PEP polyfill

    this.resize();
  }

  get pixelRatio() {
    return window.devicePixelRatio ?? 0;
  }

  resize() {
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
            'three-vertex-objects__fullscreen',
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

    if (domElement) {
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
    }

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
        this.#emit('resize');
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
      this.#emit('resize'); // always emit resize event before render the first frame!
    }

    this.#emit('frame');

    ++this.frameNo;
  }

  start() {
    this.pause = false;
    if (!this.#initialized) {
      this.#emit('init');
      this.#initialized = true;
    }
    this.#emit('start');

    this.renderer.clear();

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

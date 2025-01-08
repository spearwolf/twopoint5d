import type {ContextProvider} from '@lit/context';
import {provide} from '@lit/context';
import {on, Priority} from '@spearwolf/eventize';
import {Display, StageRenderer, type DisplayParameters} from '@spearwolf/twopoint5d';
import {css, html} from 'lit';
import {displayContext} from '../context/display-context.js';
import {stageRendererContext, type IStageRendererContext, type StageElement} from '../context/stage-renderer-context.js';
import type {DisplayDisposeEventDetail, DisplayEventDetail} from '../events.js';
import {readBooleanAttribute} from '../utils/readBooleanAttribute.js';
import {readStringAttribute} from '../utils/readStringAttribute.js';
import {whenDefined} from '../utils/whenDefined.js';
import {TwoPoint5DElement} from './TwoPoint5DElement.js';

export class DisplayElement extends TwoPoint5DElement implements IStageRendererContext {
  static async whenDefined(el: any): Promise<DisplayElement> {
    await whenDefined(el);
    if (el instanceof DisplayElement) {
      return el;
    }
    throw new Error('not a DisplayElement');
  }

  static override styles = css`
    :host {
      display: block;
    }
    .layout {
      position: relative;
    }
    .overlay-content {
      display: block;
      position: absolute;
      overflow: hidden;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
    }
    .top-right {
      position: absolute;
      top: 0;
      right: 0;
    }
    .top-left {
      position: absolute;
      top: 0;
      left: 0;
    }
    .bottom-right {
      position: absolute;
      bottom: 0;
      right: 0;
    }
    .bottom-left {
      position: absolute;
      bottom: 0;
      left: 0;
    }
  `;

  @provide({context: displayContext})
  accessor display: Display | undefined;

  readonly stageRenderer = new StageRenderer();

  readonly stageRendererProvider: ContextProvider<typeof stageRendererContext, typeof this>;

  get container(): HTMLElement | undefined {
    return this.renderRoot?.querySelector('.canvas-container') ?? undefined;
  }

  get canvas(): HTMLCanvasElement | undefined {
    return this.renderRoot?.querySelector('canvas') ?? undefined;
  }

  constructor() {
    super();

    this.loggerNS = 'two5-display';

    this.stageRendererProvider = this.createContextProvider(stageRendererContext);

    // TODO fullscreen - go fullscreen should include overlay-content
    // TODO mobile fullscreen - go fullscreen on rotation to landscape (as attribute)
  }

  override render() {
    return html`<div class="layout">
      <div class="canvas-container"></div>
      <div class="overlay-content">
        <slot></slot>
        <div class="top-right"><slot name="top-right"></slot></div>
        <div class="top-left"><slot name="top-left"></slot></div>
        <div class="bottom-right"><slot name="bottom-right"></slot></div>
        <div class="bottom-left"><slot name="bottom-left"></slot></div>
      </div>
    </div>`;
  }

  override firstUpdated(): void {
    this.#createDisplay();
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this.updateContextProvider(this.stageRendererProvider);

    if (this.display) {
      this.display.start();
      this.logger?.log('display started', this.display);
    }
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();

    if (this.display) {
      this.display.stop();
      this.logger?.log('display stopped', this.display);
    }

    this.clearContextProvider(this.stageRendererProvider);
  }

  addStageElement(el: StageElement): void {
    this.stageRenderer.addStage(el.getStage());
  }

  removeStageElement(el: StageElement): void {
    this.stageRenderer.removeStage(el.getStage());
  }

  #createDisplay(): void {
    if (this.display) {
      this.logger?.warn('display already created');
      return;
    }

    const options: DisplayParameters = {
      precision: readStringAttribute(this, 'precision', ['highp', 'mediump', 'lowp'], 'highp'),
      powerPreference: readStringAttribute(
        this,
        'power-preference',
        ['default', 'high-performance', 'low-power'],
        'high-performance',
      ) as WebGLPowerPreference,
      preserveDrawingBuffer: readBooleanAttribute(this, 'preserve-drawing-buffer'),
      premultipliedAlpha: readBooleanAttribute(this, 'premultiplied-alpha', true),
      stencil: readBooleanAttribute(this, 'stencil'),
      alpha: readBooleanAttribute(this, 'alpha', true),
      depth: readBooleanAttribute(this, 'depth', true),
      antialias: readBooleanAttribute(this, 'antialias', true),
      // desynchronized: readBooleanAttribute(this, 'desynchronized'),
      failIfMajorPerformanceCaveat: readBooleanAttribute(this, 'fail-if-major-performance-caveat'),
      styleSheetRoot: this.renderRoot as any,
      resizeToElement: this,
      resizeToAttributeEl: this,
    };

    this.logger?.log('webgl context attributes:', options);

    this.display = new Display(this.container!, options);

    on(this.display, this);

    this.#connectCustomEvents();

    this.stageRenderer.attach(this.display);

    this.display.start();

    this.logger?.log('display created', {display: this.display, stageRenderer: this.stageRenderer});
  }

  #connectCustomEvents(): void {
    on(this.display, 'start', Priority.Low, (args) => {
      this.dispatchEvent(
        new CustomEvent<DisplayEventDetail>('displayStart', {bubbles: true, detail: {...args, displayElement: this}}),
      );
    });

    on(this.display, 'resize', Priority.Low, (args) => {
      this.dispatchEvent(
        new CustomEvent<DisplayEventDetail>('displayResize', {bubbles: true, detail: {...args, displayElement: this}}),
      );
    });

    on(this.display, 'pause', Priority.Low, (args) => {
      this.dispatchEvent(
        new CustomEvent<DisplayEventDetail>('displayPause', {bubbles: true, detail: {...args, displayElement: this}}),
      );
    });

    on(this.display, 'restart', Priority.Low, (args) => {
      this.dispatchEvent(
        new CustomEvent<DisplayEventDetail>('displayRestart', {bubbles: true, detail: {...args, displayElement: this}}),
      );
    });

    on(this.display, 'dispose', Priority.Low, () => {
      this.dispatchEvent(
        new CustomEvent<DisplayDisposeEventDetail>('displayDispose', {
          bubbles: true,
          detail: {display: this.display, displayElement: this},
        }),
      );
    });

    // TODO DisplayElement: dispose!
  }
}

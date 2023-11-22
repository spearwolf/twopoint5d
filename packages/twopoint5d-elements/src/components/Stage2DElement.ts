import {consume} from '@lit/context';
import {eventize, type Eventize} from '@spearwolf/eventize';
import {createEffect, type SignalReader} from '@spearwolf/signalize';
import {signal, signalReader} from '@spearwolf/signalize/decorators';
import {
  OrthographicProjection,
  ParallaxProjection,
  Stage2D,
  type IProjection,
  type IStageRenderer,
  type OrthographicProjectionSpecs,
  type ParallaxProjectionSpecs,
  type ProjectionPlaneDescription,
} from '@spearwolf/twopoint5d';
import {
  FirstFrame,
  StageRenderFrame,
  StageResize,
  type FirstFrameProps,
  type Stage2DResizeProps,
  type StageRenderFrameProps,
} from '@spearwolf/twopoint5d/events.js';
import {css, html} from 'lit';
import {property} from 'lit/decorators.js';
import type {Scene} from 'three';
import {stageRendererContext} from '../context/stage-renderer-context.js';
import {SignalMap} from '../utils/SignalMap.js';
import {whenDefined} from '../utils/whenDefined.js';
import {TwoPoint5DElement} from './TwoPoint5DElement.js';

const isValidSize = ({width, height}: {width: number; height: number}): boolean => !(isNaN(width) || isNaN(height));

export interface Stage2DElement extends Eventize {}

export class Stage2DElement extends TwoPoint5DElement {
  static async whenDefined(el: any): Promise<Stage2DElement> {
    await whenDefined(el);
    if (el instanceof Stage2DElement) {
      return el;
    }
    throw new Error('not a Stage2DElement');
  }

  static override styles = css`
    :host {
      display: inline;
    }
  `;

  @consume({context: stageRendererContext, subscribe: true})
  @property({attribute: false})
  @signal({readAsValue: true})
  accessor stageRenderer: IStageRenderer | undefined;

  @signalReader() accessor stageRenderer$: SignalReader<IStageRenderer | undefined>;

  @property({type: String, reflect: true})
  @signal({readAsValue: true})
  accessor name: string | undefined;

  @signalReader() accessor name$: SignalReader<string | undefined>;

  @property({type: String, reflect: true})
  accessor fit: 'contain' | 'cover' | 'fill' | undefined;

  @property({type: Number, reflect: true})
  accessor width: number | undefined;

  @property({type: Number, reflect: true})
  accessor height: number | undefined;

  @property({type: Number, reflect: true, attribute: 'pixel-zoom'})
  accessor pixelZoom: number | undefined;

  @property({type: Number, reflect: true, attribute: 'min-pixel-zoom'})
  accessor minPixelZoom: number | undefined;

  @property({type: Number, reflect: true, attribute: 'max-pixel-zoom'})
  accessor maxPixelZoom: number | undefined;

  @property({type: Number, reflect: true})
  accessor near: number | undefined;

  @property({type: Number, reflect: true})
  accessor far: number | undefined;

  @property({type: Number, reflect: true, attribute: 'distance-to-projection-plane'})
  accessor distanceToProjectionPlane: number | undefined;

  @property({type: String, reflect: true, attribute: 'projection-plane'})
  accessor projectionPlane: 'xy' | 'xz' | undefined;

  @property({type: String, reflect: true, attribute: 'projection-origin'})
  accessor projectionOrigin: 'bottom-left' | 'top-left' | undefined;

  @property({type: String, reflect: true, attribute: 'projection-type'})
  accessor projectionType: 'parallax' | 'ortho' | 'orthographic' | undefined;

  // TODO add autoClear property

  readonly #projSignals: SignalMap;
  readonly #viewSpecsSignals: SignalMap;

  private getViewSpecs(): ParallaxProjectionSpecs | OrthographicProjectionSpecs {
    return this.#viewSpecsSignals.getValueObject() as ParallaxProjectionSpecs | OrthographicProjectionSpecs;
  }

  @signal({readAsValue: true}) accessor projection: IProjection | undefined;
  @signalReader() accessor projection$: SignalReader<IProjection | undefined>;

  readonly stage2d = new Stage2D();

  firstFrame(): Promise<FirstFrameProps> {
    return new Promise((resolve) => this.stage2d.once(FirstFrame, resolve));
  }

  sceneReady(): Promise<Scene> {
    return Promise.resolve(this.stage2d.scene);
  }

  constructor() {
    super();
    eventize(this);

    this.loggerNS = 'two5-stage2d';

    this.fit = 'contain';

    this.projectionPlane = 'xy';
    this.projectionOrigin = 'bottom-left';

    this.retain([FirstFrame, StageResize]);

    this.name$((name) => {
      this.stage2d.name = name;
    });

    this.stageRenderer$((stageRenderer) => {
      this.logger?.log('requested stage-renderer context', stageRenderer);

      stageRenderer.addStage(this.stage2d);
      return () => stageRenderer.removeStage(this.stage2d);
    });

    this.projection$((proj) => {
      this.stage2d.projection = proj;
    });

    this.#projSignals = SignalMap.fromProps(this, ['projectionPlane', 'projectionOrigin', 'projectionType']);

    this.#viewSpecsSignals = SignalMap.fromProps(this, [
      'fit',
      'width',
      'height',
      'pixelZoom',
      'minPixelZoom',
      'maxPixelZoom',
      'near',
      'far',
      'distanceToProjectionPlane',
    ]);

    createEffect(() => {
      this.onProjectionPropsUpdate();
    }, this.#projSignals.getSignals());

    createEffect(() => {
      this.onViewSpecsPropsUpdate();
    }, this.#viewSpecsSignals.getSignals());

    this.stage2d.on(StageResize, (props: Stage2DResizeProps) => {
      if (isValidSize(props)) {
        this.emit(StageResize, props);
        this.dispatchEvent(new CustomEvent<Stage2DResizeProps>(StageResize, {bubbles: false, detail: props}));
      }
    });

    this.stage2d.once(FirstFrame, (props: FirstFrameProps) => {
      if (isValidSize(props)) {
        this.emit(FirstFrame, props);
        this.dispatchEvent(new CustomEvent<FirstFrameProps>(FirstFrame, {bubbles: false, detail: props}));
      }
    });

    this.stage2d.on(StageRenderFrame, (props: StageRenderFrameProps) => {
      if (isValidSize(props)) {
        this.emit(StageRenderFrame, props);
        this.dispatchEvent(new CustomEvent<StageRenderFrameProps>(StageRenderFrame, {bubbles: false, detail: props}));
      }
    });
  }

  override willUpdate(changedProperties: Map<keyof this, unknown>) {
    super.willUpdate(changedProperties);

    const propKeys = Array.from(changedProperties.keys());

    this.#projSignals.updateFromProps(this, propKeys);
    this.#viewSpecsSignals.updateFromProps(this, propKeys);
  }

  override render() {
    // if (this.name) {
    //   this.stage2d.name = this.name;
    // }

    return html`<slot></slot>`;
  }

  private onProjectionPropsUpdate(): void {
    const {projectionPlane, projectionOrigin, projectionType} = this.#projSignals.getValueObject();

    if ([projectionPlane, projectionOrigin, projectionType].some((val) => val == null)) return;

    const planeDescription = `${projectionPlane}|${projectionOrigin}` as ProjectionPlaneDescription;

    if (projectionType === 'parallax') {
      this.projection = new ParallaxProjection(planeDescription, this.getViewSpecs() as ParallaxProjectionSpecs);
    } else if ((projectionType as string)?.startsWith('ortho')) {
      this.projection = new OrthographicProjection(planeDescription, this.getViewSpecs() as OrthographicProjectionSpecs);
    } else {
      this.projection = undefined;

      if (projectionType != null) {
        this.logger.warn('projection-type not supported:', projectionType);
      }
    }
  }

  private onViewSpecsPropsUpdate(): void {
    const {projection} = this.stage2d;
    if (projection == null) return;

    if (projection instanceof ParallaxProjection) {
      const viewSpecs = this.getViewSpecs() as ParallaxProjectionSpecs;
      this.logger?.log('parallax viewSpecs', viewSpecs);
      projection.viewSpecs = viewSpecs;
    } else if (projection instanceof OrthographicProjection) {
      const viewSpecs = this.getViewSpecs() as OrthographicProjectionSpecs;
      this.logger?.log('orthographic viewSpecs', viewSpecs);
      projection.viewSpecs = viewSpecs;
    }

    this.stage2d.update(true);
  }
}

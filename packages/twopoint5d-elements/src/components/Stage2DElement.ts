import {consume} from '@lit/context';
import {emit, eventize, on, once, retain} from '@spearwolf/eventize';
import {createEffect, SignalAutoMap} from '@spearwolf/signalize';
import {signal} from '@spearwolf/signalize/decorators';
import {
  OrthographicProjection,
  ParallaxProjection,
  Stage2D,
  type IProjection,
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
import {css} from 'lit';
import {property} from 'lit/decorators.js';
import type {Scene} from 'three';
import {stageRendererContext, type IStageRendererContext, type StageElement} from '../context/stage-renderer-context.js';
import {asValueObject} from '../utils/asValueObject.js';
import {whenDefined} from '../utils/whenDefined.js';
import {TwoPoint5DElement} from './TwoPoint5DElement.js';

const isValidSize = ({width, height}: {width: number; height: number}): boolean => !(isNaN(width) || isNaN(height));

export class Stage2DElement extends TwoPoint5DElement implements StageElement {
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
  @signal({readAsValue: true})
  accessor stageRendererCtx: IStageRendererContext | undefined;

  @property({type: String, reflect: true})
  @signal({readAsValue: true})
  accessor name: string | undefined;

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

  readonly #projSignals: SignalAutoMap;
  readonly #viewSpecsSignals: SignalAutoMap;

  private getViewSpecs(): ParallaxProjectionSpecs | OrthographicProjectionSpecs {
    return asValueObject(this.#viewSpecsSignals) as ParallaxProjectionSpecs | OrthographicProjectionSpecs;
  }

  @signal({readAsValue: true}) accessor projection: IProjection | undefined;

  readonly stage2d = new Stage2D();

  firstFrame(): Promise<FirstFrameProps> {
    return new Promise((resolve) => once(this.stage2d, FirstFrame, resolve));
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

    retain(this, [FirstFrame, StageResize]);

    this.signal('name').onChange((name) => {
      this.stage2d.name = name;
    });

    this.signal('stageRendererCtx').onChange((stageRendererCtx) => {
      this.logger?.log('requested stage-renderer context', stageRendererCtx);
      if (stageRendererCtx == null) return;
      stageRendererCtx.addStageElement(this);
      return () => stageRendererCtx.removeStageElement(this);
    });

    this.signal('projection').onChange((proj) => {
      this.stage2d.projection = proj;
    });

    this.#projSignals = SignalAutoMap.fromProps(this, ['projectionPlane', 'projectionOrigin', 'projectionType']);
    this.#viewSpecsSignals = SignalAutoMap.fromProps(this, [
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
    }, Array.from(this.#projSignals.signals()));

    createEffect(() => {
      this.onViewSpecsPropsUpdate();
    }, Array.from(this.#viewSpecsSignals.signals()));

    on(this.stage2d, StageResize, (props: Stage2DResizeProps) => {
      if (isValidSize(props)) {
        emit(this, StageResize, props);
        this.dispatchEvent(new CustomEvent<Stage2DResizeProps>(StageResize, {bubbles: false, detail: props}));
      }
    });

    once(this.stage2d, FirstFrame, (props: FirstFrameProps) => {
      if (isValidSize(props)) {
        emit(this, FirstFrame, props);
        this.dispatchEvent(new CustomEvent<FirstFrameProps>(FirstFrame, {bubbles: false, detail: props}));
      }
    });

    on(this.stage2d, StageRenderFrame, (props: StageRenderFrameProps) => {
      if (isValidSize(props)) {
        emit(this, StageRenderFrame, props);
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

  override createRenderRoot() {
    return this;
  }

  override disconnectedCallback(): void {
    this.stageRendererCtx = undefined;
    super.disconnectedCallback();
  }

  getStage(): Stage2D {
    return this.stage2d;
  }

  private onProjectionPropsUpdate(): void {
    const {projectionPlane, projectionOrigin, projectionType} = asValueObject(this.#projSignals);

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

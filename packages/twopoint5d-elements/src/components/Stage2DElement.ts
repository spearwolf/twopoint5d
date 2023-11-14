import {consume} from '@lit/context';
import {eventize, type Eventize} from '@spearwolf/eventize';
import {createEffect, createSignal, value, type SignalFuncs, type SignalReader} from '@spearwolf/signalize';
import {
  OrthographicProjection,
  ParallaxProjection,
  Stage2D,
  type IProjection,
  type OrthographicProjectionSpecs,
  type ParallaxProjectionSpecs,
  type ProjectionPlaneDescription,
} from '@spearwolf/twopoint5d';
import {css, html} from 'lit';
import {property} from 'lit/decorators.js';
import type {Scene} from 'three';
import {stageRendererContext} from '../context/stage-renderer-context.js';
import {
  StageFirstFrame,
  StageRenderFrame,
  StageResize,
  type StageFirstFrameProps,
  type StageRenderFrameProps,
  type StageResizeProps,
} from '../events.js';
import type {IStageRenderer} from '../twopoint5d/IStageRenderer.js';
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

  @property({type: String, reflect: true})
  accessor name: string | undefined;

  @consume({context: stageRendererContext, subscribe: true})
  @property({attribute: false})
  accessor stageRendererCtx: IStageRenderer | undefined;

  readonly #stageRenderer: SignalFuncs<IStageRenderer | undefined> = createSignal();

  get stageRenderer(): IStageRenderer | undefined {
    return value(this.#stageRenderer[0]);
  }

  get stageRenderer$(): SignalReader<IStageRenderer | undefined> {
    return this.#stageRenderer[0];
  }

  set stageRenderer(value: IStageRenderer | undefined) {
    this.#stageRenderer[1](value);
  }

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

  readonly #projSignals: SignalMap;
  readonly #viewSpecsSignals: SignalMap;

  private getViewSpecs(): ParallaxProjectionSpecs | OrthographicProjectionSpecs {
    return this.#viewSpecsSignals.getValueObject() as ParallaxProjectionSpecs | OrthographicProjectionSpecs;
  }

  readonly #projection = createSignal<IProjection | undefined>();

  get projection(): IProjection | undefined {
    return value(this.#projection[0]);
  }

  get projection$(): SignalReader<IProjection | undefined> {
    return this.#projection[0];
  }

  set projection(value: IProjection | undefined) {
    this.#projection[1](value);
  }

  readonly stage2d = new Stage2D();

  readonly #firstFrame: Promise<StageFirstFrameProps>;

  firstFrame(): Promise<StageFirstFrameProps> {
    return this.#firstFrame;
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

    this.retain([StageFirstFrame, StageResize]);

    this.#firstFrame = new Promise((resolve) => {
      this.once(StageResize, (stageResizeProps: StageResizeProps) => {
        this.once(StageRenderFrame, (stageRenderFrame: StageRenderFrameProps) => {
          const firstFrameProps: StageFirstFrameProps = {...stageRenderFrame, stage: stageResizeProps.stage};
          this.emit(StageFirstFrame, firstFrameProps);
          resolve(firstFrameProps);
        });
      });
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

    this.stage2d.on(Stage2D.Resize, (stage2d: Stage2D) => {
      const detail: StageResizeProps = {
        name: stage2d.name,
        width: stage2d.width,
        height: stage2d.height,
        containerWidth: stage2d.containerWidth,
        containerHeight: stage2d.containerHeight,
        stage: stage2d,
      };
      if (isValidSize(detail)) {
        this.emit(StageResize, detail);
        this.dispatchEvent(new CustomEvent<StageResizeProps>(StageResize, {bubbles: false, detail}));
      }
    });

    this.stage2d.on(StageRenderFrame, (detail: StageRenderFrameProps) => {
      if (isValidSize(detail)) {
        this.emit(StageRenderFrame, detail);
        this.dispatchEvent(new CustomEvent<StageRenderFrameProps>(StageRenderFrame, {bubbles: false, detail}));
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
    this.stageRenderer = this.stageRendererCtx;

    if (this.name) {
      this.stage2d.name = this.name;
    }

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

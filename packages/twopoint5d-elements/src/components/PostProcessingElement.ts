import {ContextProvider, consume} from '@lit/context';
import {createEffect, findObjectSignalByName} from '@spearwolf/signalize';
import {signal} from '@spearwolf/signalize/decorators';
import {PostProcessingRenderer} from '@spearwolf/twopoint5d';
import {css} from 'lit';
import {
  postProcessingContext,
  type IPostProcessingContext,
  type PostProcessingPassElement,
} from '../context/post-processing-context.js';
import {stageRendererContext, type IStageRendererContext, type StageElement} from '../context/stage-renderer-context.js';
import {sortElementsByHtmlOrder} from '../utils/sortElementsByHtmlOrder.js';
import {whenDefined} from '../utils/whenDefined.js';
import {TwoPoint5DElement} from './TwoPoint5DElement.js';

const isPostPass = (el: any): el is PostProcessingPassElement =>
  !!(typeof (el as PostProcessingPassElement)?.getPass === 'function');

export class PostProcessingElement extends TwoPoint5DElement implements IPostProcessingContext, IStageRendererContext {
  static async whenDefined(el: any): Promise<PostProcessingElement> {
    await whenDefined(el);
    if (el instanceof PostProcessingElement) {
      return el;
    }
    throw new Error('not a PostProcessingElement');
  }

  static override styles = css`
    :host {
      display: inline;
    }
  `;

  @consume({context: stageRendererContext, subscribe: true})
  @signal()
  accessor parentRendererCtx: IStageRendererContext | undefined;

  readonly renderer = new PostProcessingRenderer();

  onParentRendererChange() {
    const parent = this.parentRendererCtx;
    if (parent) {
      parent.addStageElement(this);
      this.logger?.log('added renderer to parent', this);
      return () => {
        parent.removeStageElement(this);
        this.logger?.log('removed renderer from parent', {parent, self: this});
      };
    }
  }

  readonly postProcessingProvider: ContextProvider<typeof postProcessingContext, typeof this>;
  readonly stageRendererProvider: ContextProvider<typeof stageRendererContext, typeof this>;

  constructor() {
    super();
    this.loggerNS = 'two5-post-processing';

    this.postProcessingProvider = this.createContextProvider(postProcessingContext);
    this.stageRendererProvider = this.createContextProvider(stageRendererContext);

    createEffect(() => this.onParentRendererChange(), [findObjectSignalByName(this, 'parentRendererCtx')]);
  }

  override createRenderRoot() {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this.updateContextProvider(this.stageRendererProvider);
    this.updateContextProvider(this.postProcessingProvider);
  }

  override disconnectedCallback(): void {
    this.parentRendererCtx = undefined;

    this.clearContextProvider(this.stageRendererProvider);
    this.clearContextProvider(this.postProcessingProvider);

    super.disconnectedCallback();
  }

  getStage(): PostProcessingRenderer {
    return this.renderer;
  }

  #children = new Set<StageElement | PostProcessingPassElement>();

  addStageElement(el: StageElement): void {
    this.renderer.addStage(el.getStage());
    this.addPostPassChild(el);
  }

  removeStageElement(el: StageElement): void {
    this.removePostPassChild(el);
    this.renderer.removeStage(el.getStage());
  }

  addPassElement(el: PostProcessingPassElement) {
    this.renderer.addPass(el.getPass());
    this.addPostPassChild(el);
  }

  removePassElement(el: PostProcessingPassElement) {
    this.removePostPassChild(el);
    this.renderer.removePass(el.getPass());
  }

  protected addPostPassChild(el: StageElement | PostProcessingPassElement) {
    this.#children.add(el);

    const sortedChildren = sortElementsByHtmlOrder(this, Array.from(this.#children)).map((el) =>
      isPostPass(el) ? el.getPass() : (el as StageElement).getStage(),
    );

    this.renderer.reorderPasses(sortedChildren);
  }

  protected removePostPassChild(el: StageElement | PostProcessingPassElement) {
    this.#children.delete(el);
  }
}

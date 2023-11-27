import {ContextProvider, consume} from '@lit/context';
import {effect, signal} from '@spearwolf/signalize/decorators';
import {PostProcessingRenderer} from '@spearwolf/twopoint5d';
import {css, html} from 'lit';
import {property} from 'lit/decorators.js';
import {
  postProcessingContext,
  type IPostProcessingContext,
  type PostProcessingPassElement,
} from '../context/post-processing-context.js';
import {stageRendererContext, type IStageRendererContext, type StageElement} from '../context/stage-renderer-context.js';
import {whenDefined} from '../utils/whenDefined.js';
import {TwoPoint5DElement} from './TwoPoint5DElement.js';

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
  @property({attribute: false})
  @signal()
  accessor parentRendererCtx: IStageRendererContext | undefined;

  readonly renderer = new PostProcessingRenderer();

  @effect({signal: 'parentRendererCtx'})
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

    this.onParentRendererChange();
  }

  override render() {
    return html`<slot></slot>`;
  }

  getStage(): PostProcessingRenderer {
    return this.renderer;
  }

  addStageElement(el: StageElement): void {
    // TODO sort elements by dom order
    this.renderer.addStage(el.getStage());
  }

  removeStageElement(el: StageElement): void {
    this.renderer.removeStage(el.getStage());
  }

  addPassElement(el: PostProcessingPassElement) {
    // TODO sort elements by dom order
    this.renderer.addPass(el.getPass());
  }

  removePassElement(el: PostProcessingPassElement) {
    this.renderer.removePass(el.getPass());
  }
}

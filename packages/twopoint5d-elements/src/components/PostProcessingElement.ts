import {consume, provide} from '@lit/context';
import {effect, signal} from '@spearwolf/signalize/decorators';
import {PostProcessingRenderer, type IStageRenderer} from '@spearwolf/twopoint5d';
import {css, html} from 'lit';
import {property} from 'lit/decorators.js';
import {stageRendererContext} from '../index.js';
import {whenDefined} from '../utils/whenDefined.js';
import {TwoPoint5DElement} from './TwoPoint5DElement.js';

export class PostProcessingElement extends TwoPoint5DElement {
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
  accessor parentRenderer: IStageRenderer | undefined;

  @provide({context: stageRendererContext})
  accessor renderer = new PostProcessingRenderer();

  @effect()
  onParentRendererChange() {
    const parent = this.parentRenderer;
    if (parent) {
      parent.addStage(this.renderer);
      this.logger?.log('added renderer to parent', this);
      return () => {
        parent.removeStage(this.renderer);
        this.logger?.log('removed renderer from parent', {parent, self: this});
      };
    }
  }

  constructor() {
    super();
    this.loggerNS = 'two5-post-processing';
    this.onParentRendererChange();
  }

  override render() {
    return html`<slot></slot>`;
  }
}

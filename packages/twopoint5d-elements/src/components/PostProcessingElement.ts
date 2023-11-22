import {consume, provide} from '@lit/context';
import {createEffect, type SignalReader} from '@spearwolf/signalize';
import {signal, signalReader} from '@spearwolf/signalize/decorators';
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
  @signal({readAsValue: true})
  accessor parentRenderer: IStageRenderer | undefined;

  @signalReader() accessor parentRenderer$: SignalReader<IStageRenderer | undefined>;

  @provide({context: stageRendererContext})
  accessor renderer = new PostProcessingRenderer();

  constructor() {
    super();

    this.loggerNS = 'two5-post-processing';

    createEffect(() => {
      const parent = this.parentRenderer;
      if (parent) {
        parent.addStage(this.renderer);
        this.logger?.log('added renderer to parent', this);
        return () => {
          parent.removeStage(this.renderer);
          this.logger?.log('removed renderer from parent', {parent, self: this});
        };
      }
    }, [this.parentRenderer$]);
  }

  override render() {
    return html`<slot></slot>`;
  }
}

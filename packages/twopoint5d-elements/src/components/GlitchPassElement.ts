import {consume} from '@lit/context';
import {effect, signal} from '@spearwolf/signalize/decorators';
import {css, html} from 'lit';
import {property} from 'lit/decorators.js';
import {GlitchPass} from 'three/addons/postprocessing/GlitchPass.js';
import {
  postProcessingContext,
  type IPostProcessingContext,
  type PostProcessingPassElement,
} from '../context/post-processing-context.js';
import {TwoPoint5DElement} from './TwoPoint5DElement.js';

export class GlitchPassElement extends TwoPoint5DElement implements PostProcessingPassElement {
  static override styles = css`
    :host {
      display: inline;
    }
  `;

  @consume({context: postProcessingContext, subscribe: true})
  @property({attribute: false})
  @signal({readAsValue: true})
  accessor postProcessingCtx: IPostProcessingContext | undefined;

  @signal({readAsValue: true})
  accessor glitchPass = new GlitchPass();

  getPass(): GlitchPass {
    return this.glitchPass;
  }

  @effect({deps: ['postProcessingCtx', 'glitchPass']})
  onPostProcessingUpdate() {
    const pp = this.postProcessingCtx;
    if (pp != null) {
      this.logger?.log('add glitchPass to postProcessing', {postProcessing: pp, self: this});
      pp.addPassElement(this);
      return () => {
        this.logger?.log('remove glitchPass from postProcessing', {postProcessing: pp, self: this});
        pp.removePassElement(this);
      };
    }
  }

  constructor() {
    super();
    this.loggerNS = 'two5-glitch-pass';
    this.onPostProcessingUpdate();
  }

  override render() {
    return html`<slot></slot>`;
  }
}

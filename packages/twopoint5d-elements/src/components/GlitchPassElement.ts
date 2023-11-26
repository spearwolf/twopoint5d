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
import {whenDefined} from '../utils/whenDefined.js';
import {TwoPoint5DElement} from './TwoPoint5DElement.js';

export class GlitchPassElement extends TwoPoint5DElement implements PostProcessingPassElement {
  static async whenDefined(el: any): Promise<GlitchPassElement> {
    await whenDefined(el);
    if (el instanceof GlitchPassElement) {
      return el;
    }
    throw new Error('not a GlitchPassElement');
  }

  static override styles = css`
    :host {
      display: inline;
    }
  `;

  @consume({context: postProcessingContext, subscribe: true})
  @property({attribute: false})
  @signal({readAsValue: true})
  accessor postProcessing: IPostProcessingContext | undefined;

  @signal({readAsValue: true})
  accessor pass = new GlitchPass();

  @effect({deps: ['postProcessing', 'glitchPass']})
  onPostProcessingUpdate() {
    const postProcessing = this.postProcessing;
    if (postProcessing != null) {
      this.logger?.log('add glitchPass to postProcessing', {postProcessing, self: this});
      // postProcessing.renderer.addPass(this.pass);
      postProcessing.addPassElement(this);
      return () => {
        this.logger?.log('remove glitchPass from postProcessing', {postProcessing, self: this});
        // postProcessing.renderer.removePass(this.pass);
        postProcessing.removePassElement(this);
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

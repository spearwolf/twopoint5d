import {consume} from '@lit/context';
import {createEffect, findObjectSignalByName} from '@spearwolf/signalize';
import {signal} from '@spearwolf/signalize/decorators';
import {css} from 'lit';
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

  @property({type: Boolean, reflect: true})
  @signal({readAsValue: true})
  accessor disabled: boolean = false;

  @property({type: Boolean, reflect: true})
  @signal({readAsValue: true})
  accessor clear: boolean = false;

  @consume({context: postProcessingContext, subscribe: true})
  @property({attribute: false})
  @signal({readAsValue: true})
  accessor postProcessingCtx: IPostProcessingContext | undefined;

  @signal({readAsValue: true})
  accessor glitchPass = new GlitchPass();

  getPass(): GlitchPass {
    return this.glitchPass;
  }

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

  onPassUpdate() {
    if (this.glitchPass != null) {
      this.glitchPass.enabled = !this.disabled;
      this.glitchPass.clear = this.clear;
    }
  }

  constructor() {
    super();

    this.loggerNS = 'two5-glitch-pass';

    createEffect(
      () => this.onPostProcessingUpdate(),
      [findObjectSignalByName(this, 'postProcessingCtx'), findObjectSignalByName(this, 'glitchPass')],
    );
    createEffect(
      () => this.onPassUpdate(),
      [
        findObjectSignalByName(this, 'glitchPass'),
        findObjectSignalByName(this, 'disabled'),
        findObjectSignalByName(this, 'clear'),
      ],
    );
  }

  override createRenderRoot() {
    return this;
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.postProcessingCtx = undefined;
  }
}

import {consume} from '@lit/context';
import {createEffect, findObjectSignalByName} from '@spearwolf/signalize';
import {signal} from '@spearwolf/signalize/decorators';
import {css} from 'lit';
import {property} from 'lit/decorators.js';
import {AfterimagePass} from 'three/addons/postprocessing/AfterimagePass.js';
import {
  postProcessingContext,
  type IPostProcessingContext,
  type PostProcessingPassElement,
} from '../context/post-processing-context.js';
import {TwoPoint5DElement} from './TwoPoint5DElement.js';

export class AfterimagePassElement extends TwoPoint5DElement implements PostProcessingPassElement {
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

  @property({type: Number, reflect: true})
  @signal({readAsValue: true})
  accessor damp: number = 0.8;

  @consume({context: postProcessingContext, subscribe: true})
  @property({attribute: false})
  @signal({readAsValue: true})
  accessor postProcessingCtx: IPostProcessingContext | undefined;

  @signal({readAsValue: true})
  accessor afterimagePass = new AfterimagePass(this.damp);

  getPass(): AfterimagePass {
    return this.afterimagePass;
  }

  onPostProcessingUpdate() {
    const pp = this.postProcessingCtx;
    if (pp != null) {
      this.logger?.log('add afterimagePass to postProcessing', {postProcessing: pp, self: this});
      pp.addPassElement(this);
      return () => {
        this.logger?.log('remove afterimagePass from postProcessing', {postProcessing: pp, self: this});
        pp.removePassElement(this);
      };
    }
  }

  onPassUpdate() {
    this.afterimagePass.enabled = !this.disabled;
    this.afterimagePass.clear = this.clear;
    (this.afterimagePass.uniforms as {damp: {value: number}}).damp.value = this.damp;
  }

  constructor() {
    super();

    this.loggerNS = 'two5-afterimage-pass';

    createEffect(
      () => this.onPostProcessingUpdate(),
      [findObjectSignalByName(this, 'postProcessingCtx'), findObjectSignalByName(this, 'afterimagePass')],
    );

    createEffect(
      () => this.onPassUpdate(),
      [findObjectSignalByName(this, 'disabled'), findObjectSignalByName(this, 'clear'), findObjectSignalByName(this, 'damp')],
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

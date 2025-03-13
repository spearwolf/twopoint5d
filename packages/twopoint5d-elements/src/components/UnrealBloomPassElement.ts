import {consume} from '@lit/context';
import {on} from '@spearwolf/eventize';
import {batch} from '@spearwolf/signalize';
import {signal} from '@spearwolf/signalize/decorators';
import type {Display} from '@spearwolf/twopoint5d';
import {css} from 'lit';
import {property} from 'lit/decorators.js';
import {Vector2} from 'three';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {
  postProcessingContext,
  type IPostProcessingContext,
  type PostProcessingPassElement,
} from '../context/post-processing-context.js';
import {displayContext} from '../index.js';
import {TwoPoint5DElement} from './TwoPoint5DElement.js';

export class UnrealBloomPassElement extends TwoPoint5DElement implements PostProcessingPassElement {
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
  accessor strength: number = 1.5;

  @property({type: Number, reflect: true})
  @signal({readAsValue: true})
  accessor radius: number = 0.4;

  @property({type: Number, reflect: true})
  @signal({readAsValue: true})
  accessor threshold: number = 0.85;

  @consume({context: postProcessingContext, subscribe: true})
  @signal({readAsValue: true})
  accessor postProcessingCtx: IPostProcessingContext | undefined;

  @consume({context: displayContext, subscribe: true})
  @signal({readAsValue: true})
  accessor display: Display | undefined;

  @signal()
  accessor bloomPass: UnrealBloomPass | undefined;

  getPass(): UnrealBloomPass {
    return this.bloomPass;
  }

  constructor() {
    super();
    this.loggerNS = 'two5-unreal-bloom-pass';
  }

  override createRenderRoot() {
    return this;
  }

  override connectedCallback(): void {
    super.connectedCallback();

    this.createEffect(() => this.onDisplayUpdate(), ['display']);
    this.createEffect(() => this.onPostProcessingUpdate(), ['postProcessingCtx', 'bloomPass']);
    this.createEffect(() => this.onPassUpdate(), ['bloomPass', 'disabled', 'clear', 'strength', 'radius', 'threshold']);
  }

  override disconnectedCallback(): void {
    batch(() => {
      this.postProcessingCtx = undefined;
      this.display = undefined;
    });

    super.disconnectedCallback();
  }

  private onPostProcessingUpdate() {
    const pp = this.postProcessingCtx;
    const bloomPass = this.bloomPass;
    if (pp != null && bloomPass != null) {
      this.logger?.log('add bloomPass to postProcessing', {postProcessing: pp, bloomPass, self: this});
      pp.addPassElement(this);
      return () => {
        this.logger?.log('remove bloomPass from postProcessing', {postProcessing: pp, bloomPass, self: this});
        pp.removePassElement(this);
      };
    }
  }

  private onPassUpdate() {
    if (this.bloomPass != null) {
      this.bloomPass.enabled = !this.disabled;
      this.bloomPass.clear = this.clear;
      this.bloomPass.strength = this.strength;
      this.bloomPass.radius = this.radius;
      this.bloomPass.threshold = this.threshold;
    }
  }

  private onDisplayUpdate() {
    if (this.display != null) {
      const resolution = new Vector2(this.display.width, this.display.height);
      if (this.bloomPass != null && !resolution.equals(this.bloomPass.resolution)) {
        this.bloomPass.resolution.copy(resolution);
        this.logger?.log('display changed but bloomPass can be reused', this.bloomPass);
      } else if (this.bloomPass == null) {
        this.bloomPass = new UnrealBloomPass(resolution, this.strength, this.radius, this.threshold);
        this.bloomPass.enabled = !this.disabled;
        this.bloomPass.clear = this.clear;
        this.logger?.log('created bloomPass', this.bloomPass);
        return on(this.display, 'resize', ({width, height}) => {
          this.bloomPass?.resolution.set(width, height);
        });
      }
    } else if (this.bloomPass != null) {
      this.logger?.log('dispose bloomPass', this.bloomPass);
      this.bloomPass.dispose();
      this.bloomPass = undefined;
    }
  }
}

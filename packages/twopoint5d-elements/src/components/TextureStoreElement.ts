import {consume} from '@lit/context';
import {eventize, type Eventize} from '@spearwolf/eventize';
import {type SignalReader} from '@spearwolf/signalize';
import {signal, signalReader} from '@spearwolf/signalize/decorators';
import {Display, TextureStore} from '@spearwolf/twopoint5d';
import {css, html} from 'lit';
import {property} from 'lit/decorators.js';
import {displayContext} from '../index.js';
import {whenDefined} from '../utils/whenDefined.js';
import {TwoPoint5DElement} from './TwoPoint5DElement.js';

export interface TextureStoreElement extends Eventize {}

export class TextureStoreElement extends TwoPoint5DElement {
  static async whenDefined(el: any): Promise<TextureStoreElement> {
    await whenDefined(el);
    if (el instanceof TextureStoreElement) {
      return el;
    }
    throw new Error('not a TextureStoreElement');
  }

  static override styles = css`
    :host {
      display: inline;
    }
  `;

  @property({type: String, reflect: true})
  accessor src: string | undefined;

  @consume({context: displayContext, subscribe: true})
  @property({attribute: false})
  accessor displayCtx: Display | undefined;

  @signal({readAsValue: true}) accessor display: Display | undefined;
  @signalReader() accessor display$: SignalReader<Display | undefined>;

  @signal({readAsValue: true}) accessor href: string | undefined;
  @signalReader() accessor href$: SignalReader<string | undefined>;

  readonly store = new TextureStore();

  constructor() {
    super();
    eventize(this);

    this.loggerNS = 'two5-texture-store';

    this.display$((display) => {
      this.store.renderer = display?.renderer;
      this.logger?.log('received display', {display, el: this});
    });

    this.href$((href) => {
      if (href?.trim()) {
        const url = new URL(href, window.location.href).href;
        this.logger?.log('load texture-store from', {url, el: this});
        this.store.load(url);
      }
    });
  }

  override render() {
    this.display = this.displayCtx;
    this.href = this.src;

    return html`<slot></slot>`;
  }
}

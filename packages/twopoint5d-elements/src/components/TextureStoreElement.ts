import {consume} from '@lit/context';
import {type SignalReader} from '@spearwolf/signalize';
import {signal, signalReader} from '@spearwolf/signalize/decorators';
import {Display, TextureStore} from '@spearwolf/twopoint5d';
import {css} from 'lit';
import {property} from 'lit/decorators.js';
import {displayContext} from '../index.js';
import {whenDefined} from '../utils/whenDefined.js';
import {TwoPoint5DElement} from './TwoPoint5DElement.js';

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
  @signal({readAsValue: true})
  accessor src: string | undefined;

  @signalReader() accessor src$: SignalReader<string | undefined>;

  @consume({context: displayContext, subscribe: true})
  @property({attribute: false})
  @signal({readAsValue: true})
  accessor display: Display | undefined;

  @signalReader() accessor display$: SignalReader<Display | undefined>;

  readonly store = new TextureStore();

  constructor() {
    super();

    this.loggerNS = 'two5-texture-store';

    this.display$((display) => {
      this.store.renderer = display?.renderer;
      this.logger?.log('received display', {display, el: this});
    });

    this.src$((src) => {
      if (src?.trim()) {
        const url = new URL(src, window.location.href).href;
        this.logger?.log('load texture-store from', {url, el: this});
        this.store.load(url);
      }
    });
  }

  override createRenderRoot() {
    return this;
  }
}

import {createEffect} from '@spearwolf/signalize';
import {signal} from '@spearwolf/signalize/decorators';
import {LitElement, css, html} from 'lit';
import {property} from 'lit/decorators.js';

export class SimpleGreeting extends LitElement {
  // static override properties: {
  //   name: {type: String};
  // };

  // declare name: string;

  static override styles = css`
    p {
      color: blue;
    }
  `;

  @property() accessor name = 'Somebody';

  @signal() accessor foo = 'bar';

  constructor() {
    super();

    // this.name = 'Somebody';

    createEffect(() => {
      console.log('foo changed to', this.foo);
    });
  }

  override render() {
    return html`<p>Hello, ${this.name}!</p>`;
  }
}

import {expect} from '@esm-bundle/chai';
import {PanControl2D} from '@spearwolf/twopoint5d';
import {makeState, pointer} from './helpers/fixtures.js';

/**
 * @template {HTMLElement} E
 * @param {E} el
 * @param {number} left
 * @returns {E}
 */
function place(el, left) {
  el.style.position = 'absolute';
  el.style.top = '0';
  el.style.left = `${left}px`;
  el.style.width = '200px';
  el.style.height = '200px';
  document.body.appendChild(el);
  return el;
}

describe('PanControl2D — where a press starts a pan', () => {
  /** @type {PanControl2D | undefined} */
  let control;
  /** @type {HTMLElement[]} */
  let elements = [];

  afterEach(() => {
    if (control) {
      control.dispose();
    }
    control = undefined;
    for (const el of elements) {
      el.remove();
    }
    elements = [];
  });

  it('a press beside the pointer target starts no pan, a drag from it follows the pointer beyond it', () => {
    const canvas = place(document.createElement('canvas'), 0);
    const beside = place(document.createElement('div'), 300);
    elements = [canvas, beside];

    control = new PanControl2D({state: makeState(), pointerTarget: canvas});

    pointer('pointerdown', {target: beside, x: 310, y: 10});
    pointer('pointermove', {target: beside, x: 330, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x after a drag from the div').to.equal(0);

    pointer('pointerup', {target: beside, x: 330, y: 10, buttons: 0});

    // the moves of a drag are heard on the document, so it goes on over the div
    pointer('pointerdown', {target: canvas, x: 10, y: 10});
    pointer('pointermove', {target: beside, x: 330, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x after a drag from the canvas over the div').to.equal(-320);

    pointer('pointerup', {target: beside, x: 330, y: 10, buttons: 0});
  });

  it('a press on the label of a button starts no pan', () => {
    const button = place(document.createElement('button'), 0);
    const label = button.appendChild(document.createElement('span'));
    label.textContent = 'OK';
    elements = [button];

    control = new PanControl2D({state: makeState()});

    pointer('pointerdown', {target: label, x: 10, y: 10});
    pointer('pointermove', {target: label, x: 30, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x after a drag from the label').to.equal(0);

    pointer('pointerup', {target: label, x: 30, y: 10, buttons: 0});
  });

  it('a press on an input in an open shadow root starts no pan, one beside it in the same root does', () => {
    const host = place(document.createElement('div'), 0);
    const root = host.attachShadow({mode: 'open'});
    const input = root.appendChild(document.createElement('input'));
    const text = root.appendChild(document.createElement('span'));
    text.textContent = 'text';
    elements = [host];

    control = new PanControl2D({state: makeState()});

    pointer('pointerdown', {target: input, x: 10, y: 10});
    pointer('pointermove', {target: input, x: 30, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x after a drag from the input').to.equal(0);

    pointer('pointerup', {target: input, x: 30, y: 10, buttons: 0});

    // the press reaches the document out of the shadow root: it is the input that stops it
    pointer('pointerdown', {target: text, x: 10, y: 10});
    pointer('pointermove', {target: text, x: 30, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x after a drag from the span').to.equal(-20);

    pointer('pointerup', {target: text, x: 30, y: 10, buttons: 0});
  });
});

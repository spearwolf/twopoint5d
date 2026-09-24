import {on} from '@spearwolf/eventize';
import {expect} from '@esm-bundle/chai';
import {PanControl2D} from '@spearwolf/twopoint5d';
import {pointer, key, makeState} from './helpers/fixtures.js';

// the default keys of PanControl2D, in the order the class reads them: up, down, left, right —
// each as the init of a key event, naming the KeyboardEvent.code of the keys at the W, S, A and D positions
const KEY_NORTH = {code: 'KeyW'};

describe('PanControl2D — what it gives back when an input source is switched off', () => {
  /** @type {PanControl2D | undefined} */
  let control;

  afterEach(() => {
    if (control) {
      control.dispose();
    }
    control = undefined;
  });

  it('releases a key still held when the keyboard is switched off', () => {
    control = new PanControl2D({state: makeState()});

    key('keydown', KEY_NORTH);
    control.keyboardDisabled = true;
    control.update(1 / 60);

    expect(control.speedNorth, 'speedNorth').to.equal(0);
    expect(control.panView.y, 'panView.y').to.equal(0);
  });

  it('keeps a speed a caller set by hand when the keyboard is switched off', () => {
    control = new PanControl2D({state: makeState()});

    control.speedNorth = 100;
    control.keyboardDisabled = true;
    control.update(1 / 60);

    expect(control.panView.y, 'panView.y').to.be.lessThan(0);
  });

  it('restores the cursor when the pointer is switched off mid-drag', () => {
    const target = document.createElement('div');
    control = new PanControl2D({state: makeState(), cursorStylesTarget: target});

    let restores = 0;
    on(control, 'restoreCursor', () => {
      restores += 1;
    });

    pointer('pointerdown', {x: 10, y: 10});
    pointer('pointermove', {x: 30, y: 10});

    control.pointerDisabled = true;

    expect(target.classList.length, 'the cursor class after the pointer is switched off').to.equal(0);
    expect(restores, 'restoreCursor events').to.equal(1);
  });

  it('hands back pan, keys and cursor when it is switched inactive', () => {
    const target = document.createElement('div');
    control = new PanControl2D({state: makeState(), cursorStylesTarget: target});

    key('keydown', KEY_NORTH);

    pointer('pointerdown', {x: 10, y: 10});
    pointer('pointermove', {x: 30, y: 10});

    control.isActive = false;
    control.update(1 / 60);

    expect(control.speedNorth, 'speedNorth').to.equal(0);
    expect(target.classList.length, 'the cursor class after isActive = false').to.equal(0);
    expect(control.panView.x, 'panView.x').to.equal(0);
    expect(control.panView.y, 'panView.y').to.equal(0);
  });
});

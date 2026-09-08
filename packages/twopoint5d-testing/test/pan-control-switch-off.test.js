import {on} from '@spearwolf/eventize';
import {expect} from '@esm-bundle/chai';
import {PanControl2D} from '@spearwolf/twopoint5d';

// the default keyCodes of PanControl2D, in the order the class reads them: W A S D
const KEY_NORTH = 87;

// the control listens on `document`, so a pointer event dispatched on `document.body` bubbles up
// to it
function pointer(type, {x = 0, y = 0, buttons = 1} = {}) {
  document.body.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      pointerId: 1,
      isPrimary: true,
      pointerType: 'mouse',
      buttons,
      clientX: x,
      clientY: y,
    }),
  );
}

function key(type, keyCode) {
  document.dispatchEvent(new KeyboardEvent(type, {keyCode, bubbles: true}));
}

function makeState() {
  return {x: 0, y: 0, pixelRatio: 1};
}

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

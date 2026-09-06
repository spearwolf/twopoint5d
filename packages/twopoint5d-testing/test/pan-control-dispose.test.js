import {on} from '@spearwolf/eventize';
import {expect} from '@esm-bundle/chai';
import {PanControl2D} from '@spearwolf/twopoint5d';

// the default keyCodes of PanControl2D, in the order the class reads them: W A S D
const KEY_NORTH = 87;
const KEY_SOUTH = 83;
const KEY_WEST = 65;
const KEY_EAST = 68;

// the control listens on `document`; a pointer event is dispatched on `document.body` so that
// `event.target` is an element the class can measure against
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

describe('PanControl2D — the contract after dispose()', () => {
  /** @type {PanControl2D | undefined} */
  let control;

  // every test disposes in its own body; the teardown only catches the ones that did not get
  // that far, and a second dispose() is part of the contract anyway
  afterEach(() => {
    if (control) {
      control.dispose();
    }
    control = undefined;
  });

  // Assertion (a) of the dispose test pattern — "releases what it built itself" — has no
  // subject here. The control allocates a map of pointer states and a set of DOM listeners;
  // neither is a resource with a dispose() to spy on, and the listeners are what the cases
  // below observe through their effect.

  // Assertion (b) — "does not touch what was handed in" — is about the cursor styles target:
  // the element belongs to the caller, and the case below checks it is left as it was found.

  // Assertion (e) — "leaks no signals and no effects" — has no subject: the control creates
  // neither. Its events run through eventize, and the case about a listener from before
  // dispose() is what covers their teardown.

  // Assertion (f) — "gives every slot it took back" — has no subject: the control takes no
  // slot from a pool or a factory, the pointer states in `#pointersDown` are its own objects.

  it('reacts to keyboard and pointer while it is alive', () => {
    control = new PanControl2D({state: makeState()});

    expect(control.isActive, 'isActive').to.equal(true);

    key('keydown', KEY_NORTH);
    expect(control.speedNorth, 'speedNorth on keydown').to.equal(control.pixelsPerSecond);
    key('keyup', KEY_NORTH);
    expect(control.speedNorth, 'speedNorth on keyup').to.equal(0);

    pointer('pointerdown', {x: 10, y: 10});
    pointer('pointermove', {x: 30, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x after a 20px drag').to.equal(-20);
  });

  it('ignores keyboard and pointer after dispose()', () => {
    control = new PanControl2D({state: makeState()});

    control.dispose();

    expect(control.isActive, 'isActive').to.equal(false);

    key('keydown', KEY_NORTH);
    key('keydown', KEY_SOUTH);
    key('keydown', KEY_WEST);
    key('keydown', KEY_EAST);

    expect(control.speedNorth, 'speedNorth').to.equal(0);
    expect(control.speedSouth, 'speedSouth').to.equal(0);
    expect(control.speedWest, 'speedWest').to.equal(0);
    expect(control.speedEast, 'speedEast').to.equal(0);

    pointer('pointerdown', {x: 10, y: 10});
    pointer('pointermove', {x: 30, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x').to.equal(0);
    expect(control.panView.y, 'panView.y').to.equal(0);

    // the keys are still held down as far as the browser is concerned
    key('keyup', KEY_NORTH);
    pointer('pointerup', {x: 30, y: 10, buttons: 0});
  });

  it('subscribe() after dispose() hooks nothing up again', () => {
    control = new PanControl2D({state: makeState()});

    control.dispose();
    control.subscribe();

    expect(control.isActive, 'isActive').to.equal(false);

    key('keydown', KEY_EAST);
    expect(control.speedEast, 'speedEast').to.equal(0);
    key('keyup', KEY_EAST);
  });

  it('a listener subscribed before dispose() is never called again', () => {
    control = new PanControl2D({state: makeState()});

    let updates = 0;
    on(control, 'update', () => {
      updates += 1;
    });

    control.update(1 / 60);
    expect(updates, 'while alive').to.equal(1);

    control.dispose();

    // a speed set by hand is the one way left to make update() move the view, so the emit
    // this case is about does happen — what is gone is the listener
    control.speedNorth = 100;
    control.update(1 / 60);

    expect(control.panView.y, 'panView.y still moves').to.be.lessThan(0);
    expect(updates, 'after dispose()').to.equal(1);
  });

  it('leaves the cursor styles target as it found it', () => {
    const target = document.createElement('div');
    control = new PanControl2D({state: makeState(), cursorStylesTarget: target});

    pointer('pointerdown', {x: 10, y: 10});
    pointer('pointermove', {x: 30, y: 10});
    expect(target.classList.length, 'the cursor class while panning').to.equal(1);

    control.dispose();

    expect(target.classList.length, 'after dispose()').to.equal(0);
  });

  it('delivers no pan collected before dispose()', () => {
    control = new PanControl2D({state: makeState()});

    pointer('pointerdown', {x: 10, y: 10});
    pointer('pointermove', {x: 30, y: 10});
    control.dispose();
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x').to.equal(0);
    expect(control.panView.y, 'panView.y').to.equal(0);
  });

  it('cannot be brought back through its public setters', () => {
    control = new PanControl2D({state: makeState()});

    control.dispose();

    // the way that needs no subscribe() call at all: both setters re-register, and a write
    // to isActive is what would hook the list back onto document
    control.pointerDisabled = false;
    control.keyboardDisabled = false;
    control.isActive = true;

    expect(control.isDisposed, 'isDisposed').to.equal(true);
    expect(control.isActive, 'isActive').to.equal(false);

    pointer('pointerdown', {x: 10, y: 10});
    pointer('pointermove', {x: 30, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x').to.equal(0);

    key('keydown', KEY_EAST);
    expect(control.speedEast, 'speedEast').to.equal(0);
    key('keyup', KEY_EAST);
  });

  it('is safe to call twice', () => {
    control = new PanControl2D({state: makeState()});

    expect(() => {
      control.dispose();
      control.dispose();
    }, 'the second call').to.not.throw();

    expect(control.isActive, 'isActive').to.equal(false);
  });
});

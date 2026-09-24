import {expect} from '@esm-bundle/chai';
import {PanControl2D} from '@spearwolf/twopoint5d';
import {key} from './helpers/fixtures.js';

// every keydown a test sends is followed by its keyup, so no key stays held for the next control
function press(init) {
  key('keydown', init);
}

function release(init) {
  key('keyup', init);
}

function speeds(control) {
  return {
    speedNorth: control.speedNorth,
    speedSouth: control.speedSouth,
    speedWest: control.speedWest,
    speedEast: control.speedEast,
  };
}

const STILL = {speedNorth: 0, speedSouth: 0, speedWest: 0, speedEast: 0};

const ARROWS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

describe('PanControl2D — which keys it pans by', () => {
  /** @type {PanControl2D | undefined} */
  let control;

  function makeControl(options) {
    control = new PanControl2D({state: {x: 0, y: 0, pixelRatio: 1}, disablePointer: true, ...options});
    return control;
  }

  afterEach(() => {
    control?.dispose();
    control = undefined;
  });

  it('moves north by the key at the W position whatever the layout calls it', () => {
    makeControl();

    // AZERTY: the key at the W position is labelled Z
    const azertyZ = {code: 'KeyW', keyCode: 90, key: 'z'};
    press(azertyZ);
    const held = speeds(control);
    release(azertyZ);

    expect(held).to.deep.equal({...STILL, speedNorth: control.pixelsPerSecond});
  });

  it('ignores the key labelled W where the layout moved it', () => {
    makeControl();

    // AZERTY: the key labelled W sits at the Z position
    const azertyW = {code: 'KeyZ', keyCode: 87, key: 'w'};
    press(azertyW);
    const held = speeds(control);
    release(azertyW);

    expect(held).to.deep.equal(STILL);
  });

  it('pans by the keys it is given', () => {
    makeControl({keys: [...ARROWS]});

    const left = {code: 'ArrowLeft', keyCode: 37};
    press(left);
    const held = speeds(control);
    release(left);

    expect(held).to.deep.equal({...STILL, speedWest: control.pixelsPerSecond});
  });

  it('keeps honouring keyCodes a caller sets', () => {
    makeControl({keyCodes: [38, 40, 37, 39]});

    const up = {code: 'ArrowUp', keyCode: 38};
    press(up);
    const heldUp = speeds(control);
    release(up);

    const w = {code: 'KeyW', keyCode: 87};
    press(w);
    const heldW = speeds(control);
    release(w);

    expect(heldUp, 'the arrow up key').to.deep.equal({...STILL, speedNorth: control.pixelsPerSecond});
    expect(heldW, 'the key at the W position').to.deep.equal(STILL);
  });

  it('keeps honouring keyCodes rebound in place', () => {
    makeControl();
    control.keyCodes[0] = 38;

    const up = {code: 'ArrowUp', keyCode: 38};
    press(up);
    const held = speeds(control);
    release(up);

    expect(held).to.deep.equal({...STILL, speedNorth: control.pixelsPerSecond});
  });

  it('prefers keys over keyCodes when both are set', () => {
    makeControl({keys: [...ARROWS], keyCodes: [73, 75, 74, 76]});

    const up = {code: 'ArrowUp', keyCode: 38};
    press(up);
    const heldUp = speeds(control);
    release(up);

    const i = {code: 'KeyI', keyCode: 73};
    press(i);
    const heldI = speeds(control);
    release(i);

    expect(heldUp, 'the arrow up key').to.deep.equal({...STILL, speedNorth: control.pixelsPerSecond});
    expect(heldI, 'the key named by keyCodes').to.deep.equal(STILL);
  });
});

import {expect} from '@esm-bundle/chai';
import {PanControl2D} from '@spearwolf/twopoint5d';

// both controls listen on `document`, so one drag over `document.body` reaches them both
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

function makeTarget() {
  const el = document.createElement('div');
  el.style.width = '100px';
  el.style.height = '100px';
  document.body.appendChild(el);
  return el;
}

function makeState() {
  return {x: 0, y: 0, pixelRatio: 1};
}

describe('PanControl2D — the cursor each control shows while panning', () => {
  /** @type {PanControl2D[]} */
  let controls = [];
  /** @type {HTMLElement[]} */
  let targets = [];

  function makeControl(cursorPanStyle) {
    const target = makeTarget();
    targets.push(target);
    const control = new PanControl2D({state: makeState(), cursorStylesTarget: target, coordsTarget: target, cursorPanStyle});
    controls.push(control);
    return {control, target};
  }

  afterEach(() => {
    // a drag a test left open ends here, so no hidden cursor outlives it
    pointer('pointerup', {buttons: 0});
    for (const control of controls) control.dispose();
    for (const target of targets) target.remove();
    controls = [];
    targets = [];
  });

  it('two controls with different cursor styles show their own', () => {
    const {target: a} = makeControl('grabbing');
    const {target: b} = makeControl('crosshair');

    pointer('pointerdown', {x: 10, y: 10});
    pointer('pointermove', {x: 20, y: 10});

    expect(getComputedStyle(a).cursor, 'the cursor of the first control').to.equal('grabbing');
    expect(getComputedStyle(b).cursor, 'the cursor of the second control').to.equal('crosshair');
  });

  it("a write to one control's cursorPanStyle leaves the other one's cursor alone", () => {
    const {target: a} = makeControl('grabbing');
    const {control: controlB, target: b} = makeControl('crosshair');

    pointer('pointerdown', {x: 10, y: 10});
    pointer('pointermove', {x: 20, y: 10});

    controlB.cursorPanStyle = 'move';

    expect(getComputedStyle(a).cursor, 'the cursor of the first control').to.equal('grabbing');
    expect(getComputedStyle(b).cursor, 'the cursor of the second control').to.equal('move');
  });

  it('a cursorPanStyle written during a drag moves the target onto the new rule', () => {
    const {control, target} = makeControl('grabbing');

    pointer('pointerdown', {x: 10, y: 10});
    pointer('pointermove', {x: 20, y: 10});

    control.cursorPanStyle = 'move';

    expect(getComputedStyle(target).cursor, 'the cursor during the drag').to.equal('move');
    expect(target.classList.length, 'cursor classes during the drag').to.equal(1);

    pointer('pointerup', {x: 20, y: 10, buttons: 0});

    expect(target.classList.length, 'cursor classes after the drag').to.equal(0);
  });
});

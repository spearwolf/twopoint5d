import {on} from '@spearwolf/eventize';
import {expect} from '@esm-bundle/chai';
import {PanControl2D, Stylesheets} from '@spearwolf/twopoint5d';

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

  it('a pan that ends in a mouse chord gives the cursor back at once', () => {
    const {control, target} = makeControl('grabbing');

    let restores = 0;
    on(control, 'restoreCursor', () => {
      restores += 1;
    });

    pointer('pointerdown', {x: 10, y: 10, buttons: 1});
    pointer('pointermove', {x: 30, y: 10, buttons: 1});

    expect(target.classList.length, 'cursor classes during the drag').to.equal(1);

    // the right button came down and the left one went up: the browser reports it as a pointermove
    pointer('pointermove', {x: 60, y: 10, buttons: 2});

    expect(target.classList.length, 'cursor classes once the pan button is up').to.equal(0);
    expect(restores, 'restoreCursor events once the pan button is up').to.equal(1);

    // the pan button goes down again within the chord, which raises no pointerdown: the pan stays over
    pointer('pointermove', {x: 70, y: 10, buttons: 3});

    expect(target.classList.length, 'cursor classes after the pan button went down again').to.equal(0);

    pointer('pointerup', {x: 90, y: 10, buttons: 0});

    expect(restores, 'restoreCursor events after the last button is up').to.equal(1);
  });
});

describe('PanControl2D — the cursor rules it keeps in the stylesheet', () => {
  /** @type {PanControl2D[]} */
  let controls = [];
  /** @type {HTMLElement[]} */
  let hosts = [];

  function makeRoot() {
    const host = document.createElement('div');
    document.body.appendChild(host);
    hosts.push(host);
    return host.attachShadow({mode: 'open'});
  }

  function makeControl(root, cursorPanStyle) {
    const target = document.createElement('div');
    target.style.width = '100px';
    target.style.height = '100px';
    root.appendChild(target);
    const control = new PanControl2D({
      state: makeState(),
      cursorStylesTarget: target,
      coordsTarget: target,
      styleSheetRoot: root,
      cursorPanStyle,
    });
    controls.push(control);
    return {control, target};
  }

  function cursorRules(root) {
    return Array.from(Stylesheets.getGlobalSheet(root).cssRules).filter((rule) =>
      rule.selectorText?.startsWith('.PanControl2D-'),
    );
  }

  afterEach(() => {
    // a drag a test left open ends here, so no hidden cursor outlives it
    pointer('pointerup', {buttons: 0});
    for (const control of controls) control.dispose();
    for (const host of hosts) host.remove();
    controls = [];
    hosts = [];
  });

  it('a control that writes one cursor style after another keeps only the rule of the current one', () => {
    const root = makeRoot();
    const {control} = makeControl(root, 'grab');

    control.cursorPanStyle = 'move';
    control.cursorPanStyle = 'crosshair';

    expect(cursorRules(root).length, 'cursor rules in the sheet').to.equal(1);
    expect(cursorRules(root)[0].style.cursor, 'the cursor of the rule').to.equal('crosshair');
  });

  it('a rule two controls show stays until the last of them is disposed', () => {
    const root = makeRoot();
    const {control: a} = makeControl(root, 'grabbing');
    const {control: b} = makeControl(root, 'grabbing');

    expect(cursorRules(root).length, 'cursor rules while both are alive').to.equal(1);

    a.dispose();

    expect(cursorRules(root).length, 'cursor rules after the first dispose()').to.equal(1);

    b.dispose();

    expect(cursorRules(root).length, 'cursor rules after the second dispose()').to.equal(0);
  });

  it('a control that moves off a style leaves the rule to the control still showing it', () => {
    const root = makeRoot();
    const {target: a} = makeControl(root, 'grabbing');
    const {control: controlB, target: b} = makeControl(root, 'grabbing');

    pointer('pointerdown', {x: 10, y: 10});
    pointer('pointermove', {x: 20, y: 10});

    controlB.cursorPanStyle = 'move';

    expect(getComputedStyle(a).cursor, 'the cursor of the first control').to.equal('grabbing');
    expect(getComputedStyle(b).cursor, 'the cursor of the second control').to.equal('move');
    expect(cursorRules(root).length, 'cursor rules in the sheet').to.equal(2);
  });
});

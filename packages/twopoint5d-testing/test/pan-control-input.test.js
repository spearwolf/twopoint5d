import {on} from '@spearwolf/eventize';
import {expect} from '@esm-bundle/chai';
import {PanControl2D} from '@spearwolf/twopoint5d';
import {pointer, makeState} from './helpers/fixtures.js';

function makeBox({left = 0, width = 200, height = 200} = {}) {
  const el = document.createElement('div');
  el.style.position = 'absolute';
  el.style.top = '0';
  el.style.left = `${left}px`;
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.margin = '0';
  el.style.padding = '0';
  el.style.border = '0';
  document.body.appendChild(el);
  return el;
}

describe('PanControl2D — what it measures and what it reports', () => {
  /** @type {PanControl2D | undefined} */
  let control;
  /** @type {HTMLElement[]} */
  let boxes = [];

  afterEach(() => {
    if (control) {
      control.dispose();
    }
    control = undefined;
    for (const box of boxes) {
      if (box.parentNode) {
        box.parentNode.removeChild(box);
      }
    }
    boxes = [];
  });

  it('measures against its coordsTarget while the pointer crosses other elements', () => {
    const near = makeBox({left: 0});
    const far = makeBox({left: 300});
    boxes = [near, far];

    control = new PanControl2D({state: makeState(), coordsTarget: near});

    // a drag that starts over one element and ends over another: the pointer moves 320px, and
    // that is what the view has to follow — whatever lies under the pointer on the way
    pointer('pointerdown', {target: near, x: 10, y: 10});
    pointer('pointermove', {target: far, x: 330, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x after a 320px drag').to.equal(-320);
  });

  it('drops the pan collected while the pointer is switched off', () => {
    const box = makeBox();
    boxes = [box];

    control = new PanControl2D({state: makeState(), coordsTarget: box});

    pointer('pointerdown', {target: box, x: 10, y: 10});
    pointer('pointermove', {target: box, x: 30, y: 10});

    control.pointerDisabled = true;
    control.pointerDisabled = false;

    control.update(1 / 60);

    expect(control.panView.x, 'panView.x').to.equal(0);
    expect(control.panView.y, 'panView.y').to.equal(0);
  });

  it('reports an update when only the speed fields moved the view', () => {
    control = new PanControl2D({state: makeState(), disablePointer: true, disableKeyboard: true});

    let updates = 0;
    on(control, 'update', () => {
      updates += 1;
    });

    control.speedNorth = 100;
    control.update(1 / 60);

    expect(control.panView.y, 'panView.y').to.be.lessThan(0);
    expect(updates, 'update events on the first update()').to.equal(1);

    // the first update() reports whatever happens, so the event it carries proves nothing about
    // the input sources — a second one, moved by the same field, is where the promise is kept
    const afterFirstUpdate = control.panView.y;

    control.speedNorth = 100;
    control.update(1 / 60);

    expect(control.panView.y, 'panView.y on the second update()').to.be.lessThan(afterFirstUpdate);
    expect(updates, 'update events after a second move').to.equal(2);

    // and the counter-check: no movement, no event
    control.speedNorth = 0;
    control.update(1 / 60);

    expect(updates, 'update events after an update() that moved nothing').to.equal(2);
  });

  it('reports the first update() after a state that is assigned again before it', () => {
    const state = makeState();
    control = new PanControl2D({state, disablePointer: true, disableKeyboard: true});

    let updates = 0;
    let last;
    on(control, 'update', (props) => {
      updates += 1;
      last = props;
    });

    control.panView = state;
    control.update(1 / 60);

    expect(updates, 'update events on the first update()').to.equal(1);
    expect(last).to.deep.equal({x: 0, y: 0});

    control.update(1 / 60);

    expect(updates, 'update events after an update() that moved nothing').to.equal(1);
  });

  it('reports the first update() after a new state that is assigned twice before it', () => {
    control = new PanControl2D({state: makeState(), disablePointer: true, disableKeyboard: true});

    let updates = 0;
    let last;
    on(control, 'update', (props) => {
      updates += 1;
      last = props;
    });

    control.update(1 / 60);
    expect(updates, 'update events on the first update()').to.equal(1);

    const next = {x: 5, y: 7, pixelRatio: 1};
    control.panView = next;
    control.panView = next;
    control.update(1 / 60);

    expect(updates, 'update events after the new state').to.equal(2);
    expect(last).to.deep.equal({x: 5, y: 7});
  });

  it('reports nothing for the state it holds assigned again after its first update()', () => {
    const state = makeState();
    control = new PanControl2D({state, disablePointer: true, disableKeyboard: true});

    let updates = 0;
    on(control, 'update', () => {
      updates += 1;
    });

    control.update(1 / 60);
    expect(updates, 'update events on the first update()').to.equal(1);

    control.panView = state;
    control.update(1 / 60);

    expect(updates, 'update events after the same state was assigned again').to.equal(1);
  });

  it('reports restoreCursor only for a cursor it hid', () => {
    const box = makeBox();
    boxes = [box];

    control = new PanControl2D({state: makeState(), coordsTarget: box, cursorStylesTarget: box});

    let restores = 0;
    on(control, 'restoreCursor', () => {
      restores += 1;
    });

    // a pointer moving over the page with no button down: nothing was ever hidden here
    pointer('pointermove', {target: box, x: 10, y: 10, buttons: 0});
    pointer('pointermove', {target: box, x: 20, y: 10, buttons: 0});

    expect(restores, 'restoreCursor events without a drag').to.equal(0);

    pointer('pointerdown', {target: box, x: 10, y: 10});
    pointer('pointermove', {target: box, x: 30, y: 10});

    expect(box.classList.length, 'the cursor class while panning').to.equal(1);

    pointer('pointerup', {target: box, x: 30, y: 10, buttons: 0});

    expect(restores, 'restoreCursor events after a drag that hid the cursor').to.equal(1);
    expect(box.classList.length, 'the cursor class after the drag').to.equal(0);
  });

  it('a pointer the browser cancels gives the next drag no head start', () => {
    const box = makeBox();
    boxes = [box];

    control = new PanControl2D({state: makeState(), coordsTarget: box});

    const touch = {pointerId: 7, pointerType: 'touch'};
    pointer('pointerdown', {...touch, target: box, x: 10, y: 10});
    pointer('pointermove', {...touch, target: box, x: 30, y: 10});
    pointer('pointercancel', {...touch, target: box, x: 30, y: 10});

    pointer('pointerdown', {...touch, target: box, x: 100, y: 10});
    pointer('pointermove', {...touch, target: box, x: 110, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x').to.equal(-10);
  });

  it('a pointerdown on a pointer that never came up starts where it is', () => {
    const box = makeBox();
    boxes = [box];

    control = new PanControl2D({state: makeState(), coordsTarget: box});

    pointer('pointerdown', {target: box, x: 10, y: 10});
    pointer('pointermove', {target: box, x: 30, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x after the first drag').to.equal(-20);

    // the pointerup of the first drag never arrived
    pointer('pointerdown', {target: box, x: 100, y: 10});
    pointer('pointermove', {target: box, x: 110, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x after the second drag').to.equal(-30);
  });

  it('a drag released between two updates delivers its last movement', () => {
    const box = makeBox();
    boxes = [box];

    control = new PanControl2D({state: makeState(), coordsTarget: box});

    pointer('pointerdown', {target: box, x: 10, y: 10});
    pointer('pointermove', {target: box, x: 30, y: 10});
    pointer('pointerup', {target: box, x: 30, y: 10, buttons: 0});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x').to.equal(-20);
  });

  it('a pan button let go during a drag ends the pan where it was let go', () => {
    const box = makeBox();
    boxes = [box];

    control = new PanControl2D({state: makeState(), coordsTarget: box});

    // the left button pans, the right one joins, the left one lets go: the browser reports the
    // last step as a pointermove, and the pointerup only comes with the right button
    pointer('pointerdown', {target: box, x: 10, y: 10, buttons: 1});
    pointer('pointermove', {target: box, x: 30, y: 10, buttons: 1});
    pointer('pointermove', {target: box, x: 60, y: 10, buttons: 2});
    pointer('pointerup', {target: box, x: 90, y: 10, buttons: 0});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x').to.equal(-20);
  });
});

import {on} from '@spearwolf/eventize';
import {expect} from '@esm-bundle/chai';
import {PanControl2D} from '@spearwolf/twopoint5d';

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

// the control listens on `document`, so an event dispatched anywhere in the document reaches it;
// the element it is dispatched on decides what `event.target` is
function pointer(target, type, {x = 0, y = 0, buttons = 1} = {}) {
  target.dispatchEvent(
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

function makeState() {
  return {x: 0, y: 0, pixelRatio: 1};
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
    pointer(near, 'pointerdown', {x: 10, y: 10});
    pointer(far, 'pointermove', {x: 330, y: 10});
    control.update(1 / 60);

    expect(control.panView.x, 'panView.x after a 320px drag').to.equal(-320);
  });

  it('drops the pan collected while the pointer is switched off', () => {
    const box = makeBox();
    boxes = [box];

    control = new PanControl2D({state: makeState(), coordsTarget: box});

    pointer(box, 'pointerdown', {x: 10, y: 10});
    pointer(box, 'pointermove', {x: 30, y: 10});

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

  it('reports restoreCursor only for a cursor it hid', () => {
    const box = makeBox();
    boxes = [box];

    control = new PanControl2D({state: makeState(), coordsTarget: box, cursorStylesTarget: box});

    let restores = 0;
    on(control, 'restoreCursor', () => {
      restores += 1;
    });

    // a pointer moving over the page with no button down: nothing was ever hidden here
    pointer(box, 'pointermove', {x: 10, y: 10, buttons: 0});
    pointer(box, 'pointermove', {x: 20, y: 10, buttons: 0});

    expect(restores, 'restoreCursor events without a drag').to.equal(0);

    pointer(box, 'pointerdown', {x: 10, y: 10});
    pointer(box, 'pointermove', {x: 30, y: 10});

    expect(box.classList.length, 'the cursor class while panning').to.equal(1);

    pointer(box, 'pointerup', {x: 30, y: 10, buttons: 0});

    expect(restores, 'restoreCursor events after a drag that hid the cursor').to.equal(1);
    expect(box.classList.length, 'the cursor class after the drag').to.equal(0);
  });
});

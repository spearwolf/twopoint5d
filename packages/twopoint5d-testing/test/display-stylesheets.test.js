import {expect} from '@esm-bundle/chai';
import {Display} from '@spearwolf/twopoint5d';
import {disposeDisplay, makeContainer} from './helpers/fixtures.js';

// The rules a display installs reach the canvas only from the document or shadow root the canvas
// sits in. What the canvas carries is read through getComputedStyle(): the touch-action="none"
// attribute the display also writes is not CSS and does not count.
describe('Display — where the rules of a display live', function () {
  // a cold webgpu start — adapter plus device — happens inside the constructor, and it is slow
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement[]} */
  let hosts = [];

  afterEach(() => {
    disposeDisplay(display);
    display = undefined;
    for (const host of hosts) host.remove();
    hosts = [];
  });

  /** A container in the document with a shadow root, and a canvas in that root. */
  function makeShadowHost({connected = true} = {}) {
    const host = makeContainer();
    if (!connected) host.remove();
    hosts.push(host);
    const shadowRoot = host.attachShadow({mode: 'open'});
    const canvas = document.createElement('canvas');
    shadowRoot.appendChild(canvas);
    return {host, shadowRoot, canvas};
  }

  it('builds on a canvas in a shadow root whose host is not in the document yet', async () => {
    // a web component that builds its display in its constructor, before it is connected
    const {host, shadowRoot, canvas} = makeShadowHost({connected: false});

    expect(() => {
      display = new Display(canvas, {styleSheetRoot: shadowRoot});
    }, 'the constructor').to.not.throw();

    document.body.appendChild(host);
    await display.start();
    await display.nextFrame();

    expect(getComputedStyle(canvas).touchAction, 'the touch-action of the canvas').to.equal('none');
  });

  it('keeps the rule of its canvas when the shadow host moves', async () => {
    const {host, shadowRoot, canvas} = makeShadowHost();
    display = new Display(canvas, {styleSheetRoot: shadowRoot});
    await display.start();
    await display.nextFrame();

    const other = makeContainer();
    hosts.push(other);
    other.appendChild(host);
    await display.nextFrame();

    expect(getComputedStyle(canvas).touchAction, 'the touch-action of the canvas after the move').to.equal('none');
  });

  it('installs its rules in a styleSheetRoot written after construction', () => {
    const container = makeContainer();
    hosts.push(container);
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    display = new Display(canvas);

    const {shadowRoot} = makeShadowHost();
    shadowRoot.appendChild(canvas);
    display.styleSheetRoot = shadowRoot;

    expect(getComputedStyle(canvas).touchAction, 'the touch-action of the canvas in the new root').to.equal('none');
    // compared by identity: a failed comparison of two roots has the whole DOM to print
    expect(display.styleSheetRoot === shadowRoot, 'styleSheetRoot is the root written to it').to.equal(true);
  });

  it('takes the fullscreen rule along to a styleSheetRoot written after the first fullscreen frame', async () => {
    const container = makeContainer();
    hosts.push(container);
    const canvas = document.createElement('canvas');
    canvas.setAttribute('resize-to', 'window');
    container.appendChild(canvas);
    display = new Display(canvas);
    await display.start();
    // the fullscreen rule is in the document from this frame on
    await display.nextFrame();

    const {shadowRoot} = makeShadowHost();
    shadowRoot.appendChild(canvas);
    display.styleSheetRoot = shadowRoot;
    await display.nextFrame();

    expect(getComputedStyle(canvas).position, 'the position of the canvas in the new root').to.equal('fixed');
  });

  it('a write to styleSheetRoot after dispose() changes nothing', () => {
    const container = makeContainer();
    hosts.push(container);
    const canvas = document.createElement('canvas');
    container.appendChild(canvas);
    display = new Display(canvas);
    const rootBefore = display.styleSheetRoot;

    display.dispose();

    const {shadowRoot} = makeShadowHost();
    display.styleSheetRoot = shadowRoot;

    expect(display.styleSheetRoot === rootBefore, 'styleSheetRoot is the root from before dispose()').to.equal(true);
    expect(shadowRoot.adoptedStyleSheets.length, 'the sheets of the root written after dispose()').to.equal(0);
  });
});

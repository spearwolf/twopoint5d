import {on} from '@spearwolf/eventize';
import {expect} from '@esm-bundle/chai';
import {Display, OnDisplayDispose} from '@spearwolf/twopoint5d';
import {WebGPURenderer} from 'three/webgpu';

const FIXTURE_ID = 'display-dispose-fixture';

function makeContainer({width = 320, height = 200} = {}) {
  const el = document.createElement('div');
  el.id = `${FIXTURE_ID}-${Math.random().toString(36).slice(2, 8)}`;
  el.style.position = 'absolute';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  el.style.boxSizing = 'border-box';
  el.style.padding = '0';
  el.style.margin = '0';
  el.style.border = '0';
  document.body.appendChild(el);
  return el;
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('Display — the contract after dispose()', function () {
  // a cold webgpu start — adapter plus device — happens inside the constructor, and it is slow
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;

  // every test disposes in its own body; the teardown only has to catch the ones that did not get
  // that far, and it must not call start() — that is one of the calls a disposed display refuses
  afterEach(() => {
    if (display) {
      display.dispose();
    }
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  // Assertion (a) of the dispose test pattern — "releases what it built itself" — has no subject
  // here. A Display does build its own renderer, but spying on renderer.dispose() only watches
  // three.js clean up after itself; what proves the release are the backend resources, and this
  // test cannot see them. What it can see, and what this file is about, is the contract afterwards.

  // Assertion (b) — "does not touch what was handed in" — has no subject either. A WebGPURenderer
  // passed to the constructor is the second construction path, but who owns it is not what these
  // tests answer.

  // Assertion (c) — "every public member behaves after dispose() as its TSDoc says" — is
  // what most of the cases below are: canvas, start(), getEventProps(), isWebGPUBackend
  // and isWebGLBackend throw, resize(), renderFrame() and stop() are silent, and the
  // disposed state with the last values it kept stays readable.

  // Assertion (d) — "the second call throws nothing and releases nothing a second time" —
  // is the case "a second dispose() throws nothing and emits nothing" below.

  // Assertion (e) — "leaks no signals and no effects" — has no subject: Display creates neither.
  // Its events run through eventize, and their teardown is covered by the second-dispose case below.

  // Assertion (f) — "gives every slot it took back" — has no subject: a Display takes no
  // slot from a pool and no tile from a factory.

  it('canvas throws after dispose()', () => {
    host = makeContainer();
    display = new Display(host);

    display.dispose();

    const readCanvas = () => display.canvas;

    expect(readCanvas, 'the message names the class').to.throw(/Display/);
    expect(readCanvas, 'the message names the member').to.throw(/canvas/);
    expect(readCanvas, 'the message names the state').to.throw(/disposed/);
  });

  it('start() throws after dispose()', async () => {
    host = makeContainer();
    display = new Display(host);

    display.dispose();

    let error;
    try {
      await display.start();
    } catch (err) {
      error = err;
    }

    expect(error, 'start() fails').to.be.an.instanceOf(Error);
    expect(error.message).to.contain('Display#start()');
    expect(error.message).to.contain('disposed');
  });

  it('getEventProps() throws after dispose()', () => {
    host = makeContainer();
    display = new Display(host);

    display.dispose();

    const readEventProps = () => display.getEventProps();

    expect(readEventProps, 'the message names the class and the member').to.throw(/Display#getEventProps\(\)/);
    expect(readEventProps, 'the message names the state').to.throw(/disposed/);
  });

  it('resize(), renderFrame() and stop() are silent no-ops after dispose()', () => {
    host = makeContainer();
    display = new Display(host);

    display.dispose();

    expect(() => display.resize(), 'resize()').to.not.throw();
    expect(() => display.renderFrame(), 'renderFrame()').to.not.throw();
    expect(() => display.stop(), 'stop()').to.not.throw();
  });

  it('reports the disposed state and keeps its last values', () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);

    // one frame by hand, so frameNo carries something other than its initial value
    display.renderFrame();

    expect(display.isDisposed, 'isDisposed while alive').to.equal(false);

    const {width, height, frameNo} = display;
    expect(width, 'width while alive').to.be.greaterThan(0);
    expect(height, 'height while alive').to.be.greaterThan(0);
    expect(frameNo, 'frameNo while alive').to.equal(1);

    display.dispose();

    expect(display.isDisposed, 'isDisposed').to.equal(true);
    expect(display.renderer, 'renderer').to.equal(undefined);
    expect(display.isRunning, 'isRunning').to.equal(false);
    expect(display.width, 'width').to.equal(width);
    expect(display.height, 'height').to.equal(height);
    expect(display.frameNo, 'frameNo').to.equal(frameNo);
  });

  it('isWebGPUBackend and isWebGLBackend throw after dispose()', () => {
    host = makeContainer();
    display = new Display(host);

    expect(display.isWebGPUBackend, 'isWebGPUBackend while alive').to.be.a('boolean');
    expect(display.isWebGLBackend, 'isWebGLBackend while alive').to.be.a('boolean');

    display.dispose();

    const readWebGPUBackend = () => display.isWebGPUBackend;
    const readWebGLBackend = () => display.isWebGLBackend;

    expect(readWebGPUBackend, 'the message names the class and the member').to.throw(/Display#isWebGPUBackend/);
    expect(readWebGPUBackend, 'the message names the state').to.throw(/disposed/);

    expect(readWebGLBackend, 'the message names the class and the member').to.throw(/Display#isWebGLBackend/);
    expect(readWebGLBackend, 'the message names the state').to.throw(/disposed/);
  });

  it('a dispose() before the renderer is ready leaves the frame loop empty', async () => {
    let rendererIsUp;
    const rendererUp = new Promise((resolve) => {
      rendererIsUp = resolve;
    });

    let releaseInit;
    const initReleased = new Promise((resolve) => {
      releaseInit = resolve;
    });

    host = makeContainer();
    display = new Display(host, {
      createRenderer: (params) => {
        const renderer = new WebGPURenderer({...params});
        const realInit = renderer.init.bind(renderer);
        // the display waits on a promise that outlives the real init, so the test can land its
        // dispose() inside the window the constructor waits in
        renderer.init = () =>
          realInit()
            .then(rendererIsUp)
            .then(() => initReleased);
        return renderer;
      },
    });

    // the real init has to be through before dispose() falls, or renderer.dispose() would meet a
    // half-built renderer and this case would prove something other than its name
    await rendererUp;

    expect(display.frameLoop.subscriptionCount, 'before the display is up').to.equal(0);

    display.dispose();
    releaseInit();
    await wait(50);

    expect(display.frameLoop.subscriptionCount, 'after the init promise settles').to.equal(0);
  });

  it('a second dispose() throws nothing and emits nothing', () => {
    host = makeContainer();
    display = new Display(host);

    display.dispose();

    let disposeEvents = 0;
    on(display, OnDisplayDispose, () => {
      disposeEvents += 1;
    });

    expect(() => display.dispose(), 'the second call').to.not.throw();
    expect(disposeEvents, 'OnDisplayDispose after the first dispose()').to.equal(0);
  });

  it('stays stopped after dispose(), whatever a caller does to it', async () => {
    host = makeContainer();
    display = new Display(host);

    // the only case in this file that runs the loop: without a started display the state machine
    // never reaches RUNNING, and a display that never ran is no evidence that dispose() stops one
    await display.start();
    await display.nextFrame();

    expect(display.isRunning, 'isRunning while alive').to.equal(true);

    display.dispose();

    expect(display.isRunning, 'isRunning').to.equal(false);

    const timeAtDispose = display.now;
    const deltaTimeAtDispose = display.deltaTime;

    // the pause setter is the way left into the state machine, and un-pausing is what would
    // restart it — a display that answers this call is running again, and its clock with it
    display.pause = false;

    expect(display.isRunning, 'isRunning after pause = false').to.equal(false);
    expect(display.now, 'now after pause = false').to.equal(timeAtDispose);
    expect(display.deltaTime, 'deltaTime after pause = false').to.equal(deltaTimeAtDispose);
  });

  it('start() is refused when dispose() lands inside beforeStartCallback', async () => {
    host = makeContainer();
    display = new Display(host);

    let enterCallback;
    const callbackEntered = new Promise((resolve) => {
      enterCallback = resolve;
    });

    let releaseCallback;
    const callbackReleased = new Promise((resolve) => {
      releaseCallback = resolve;
    });

    // the rejection handler is attached in the same turn as the call: this case means to be
    // rejected, and an unhandled rejection would take the whole suite down with it
    let outcome = 'pending';
    let rejection;
    const started = display
      .start(() => {
        enterCallback();
        return callbackReleased;
      })
      .then(
        () => {
          outcome = 'resolved';
        },
        (err) => {
          outcome = 'rejected';
          rejection = err;
        },
      );

    await callbackEntered;

    // start() is suspended in foreign code here, which is exactly where a component teardown
    // reaches a display that is still loading its assets
    display.dispose();
    releaseCallback();

    await started;

    expect(outcome, 'start() with a dispose() inside its callback').to.equal('rejected');
    expect(rejection.message).to.contain('Display#start()');
    expect(rejection.message).to.contain('disposed');
    expect(display.isRunning, 'isRunning').to.equal(false);
  });

  it('nextFrame() is rejected by dispose(), and refused after it', async () => {
    host = makeContainer();
    display = new Display(host);

    // no start(): without a running loop no frame arrives, so the only thing that can
    // settle this promise is dispose() itself
    let outcome = 'pending';
    let rejection;
    display.nextFrame().then(
      () => {
        outcome = 'resolved';
      },
      (err) => {
        outcome = 'rejected';
        rejection = err;
      },
    );

    display.dispose();

    await wait(100);

    expect(outcome, 'a nextFrame() promise open at dispose()').to.equal('rejected');
    expect(rejection.message).to.contain('Display#nextFrame()');
    expect(rejection.message).to.contain('disposed');

    let error;
    try {
      await display.nextFrame();
    } catch (err) {
      error = err;
    }

    expect(error, 'nextFrame() called after dispose()').to.be.an.instanceOf(Error);
    expect(error.message).to.contain('Display#nextFrame()');
    expect(error.message).to.contain('disposed');
  });
});

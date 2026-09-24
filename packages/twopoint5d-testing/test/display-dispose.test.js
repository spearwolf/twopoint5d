import {on} from '@spearwolf/eventize';
import {expect} from '@esm-bundle/chai';
import {Display, OnDisplayDispose} from '@spearwolf/twopoint5d';
import {PerspectiveCamera, Scene, WebGPURenderer} from 'three/webgpu';
import {disposeDisplay, makeContainer, whenPageAnimates, whenReleased} from './helpers/fixtures.js';

/**
 * The backend of a renderer, read only now: three can fall back to the WebGL backend during
 * the init and swap the backend then. The three.js typings leave device and gl off the backend.
 *
 * @param {WebGPURenderer} renderer
 */
function backendOf(renderer) {
  return /** @type {{isWebGPUBackend?: boolean, isWebGLBackend?: boolean, device?: {lost: Promise<{reason: string}>}, gl?: WebGL2RenderingContext}} */ (
    renderer.backend
  );
}

/**
 * Fails unless the backend of the display still draws: a WebGL context that is not lost, or a
 * WebGPU device that delivers a frame before it reports itself lost.
 *
 * @param {Display} display
 */
async function expectLiveBackend(display) {
  const backend = backendOf(display.renderer);
  if (backend.isWebGPUBackend) {
    const outcome = await Promise.race([backend.device.lost.then(() => 'lost'), display.nextFrame().then(() => 'frame')]);
    expect(outcome, 'the device of the second display').to.equal('frame');
  } else {
    expect(backend.gl.isContextLost(), 'the context of the second display').to.equal(false);
  }
}

describe('Display — the contract after dispose()', function () {
  // a cold webgpu start — adapter plus device — happens inside the constructor, and it is slow
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {Display | undefined} */
  let previous;
  /** @type {HTMLElement | undefined} */
  let host;

  // every test disposes in its own body; the teardown only has to catch the ones that did not get
  // that far, and it must not call start() — that is one of the calls a disposed display refuses
  afterEach(() => {
    disposeDisplay(previous);
    previous = undefined;
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  // Assertion (a) of the dispose test pattern — "releases what it built itself" — has two sides
  // here. The DOM side: the first two cases below watch the container the display built come out of
  // the host again, and the canvas it was handed stay where the caller put it. The GPU side: the
  // six cases after "a start() that dispose() lands in while it waits for the renderer rejects and
  // leaves the frame loop empty" watch when renderer.dispose() runs — after an init that dispose()
  // landed in, not at all after a failed one, whose webglcontextlost listener comes off the canvas
  // all the same, only once the queue has run dry, and late enough that the page keeps its
  // animation frames, for a display in a host element and one on a canvas that was handed in (the
  // case of an adopted renderer lives in display-adopt-renderer.test.js) — and what the backend
  // reports afterwards: a destroyed device, or a lost WebGL context. The six cases after those
  // follow a canvas that was handed in: it is the caller's, and after the display on it has been
  // disposed it carries the next one — built while the release runs, built once the release is
  // through, built after a dispose() inside the init, bounded in time when the WebGL context does
  // not come back, and with that context back once the display after the one that waited in vain is
  // built — while its WebGL context stays lost as long as no display follows. The rest of this file
  // is about the contract afterwards.

  // Assertion (b) — "does not touch what was handed in" — holds word for word for a canvas passed
  // to the constructor: the four cases after "leaves a canvas that was handed in where it stands"
  // watch dispose() give it back as the display found it — a bare canvas, one with classes, styles
  // and attributes of its caller, and a bare canvas again that carries no data-engine once the
  // release is through, after a frame and after a dispose() inside the init. It is turned around
  // for a WebGPURenderer passed to the constructor: that one is adopted and released with the
  // display. That case needs a renderer of its own and lives in display-adopt-renderer.test.js.

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

  it('takes the container it built out of the host', () => {
    host = makeContainer();
    display = new Display(host);

    expect(host.children.length, 'the host while the display is alive').to.equal(1);

    display.dispose();

    expect(host.children.length, 'the host after dispose()').to.equal(0);
  });

  it('leaves a canvas that was handed in where it stands', () => {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    display = new Display(canvas);
    display.dispose();

    expect(canvas.parentNode, 'the canvas the caller put into the document').to.equal(host);
  });

  it('gives a canvas that was handed in back as it found it', async () => {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    const before = canvas.outerHTML;

    display = new Display(canvas);
    await display.start();
    await display.nextFrame();

    // proves that the display has written on the canvas, so the comparison below means something
    expect(canvas.outerHTML, 'the canvas while the display is alive').not.to.equal(before);

    display.dispose();

    expect(canvas.outerHTML, 'the canvas after dispose()').to.equal(before);
  });

  it('gives a canvas that was handed in its own classes, styles and attributes back, the fullscreen class included', async () => {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    canvas.className = 'caller';
    canvas.setAttribute('style', 'display: block; width: 50%');
    canvas.setAttribute('width', '64');
    canvas.setAttribute('height', '32');
    canvas.setAttribute('touch-action', 'pan-y');
    canvas.setAttribute('resize-to', 'window');
    host.appendChild(canvas);

    display = new Display(canvas);
    await display.start();
    await display.nextFrame();

    expect(
      [...canvas.classList].some((c) => c.startsWith(Display.CssRulesPrefixFullscreen)),
      'the fullscreen class while the display is alive',
    ).to.equal(true);

    display.dispose();

    expect([...canvas.classList], 'classes').to.deep.equal(['caller']);
    expect(canvas.style.getPropertyValue('display'), 'style display').to.equal('block');
    expect(canvas.style.getPropertyValue('width'), 'style width').to.equal('50%');
    expect(canvas.style.getPropertyValue('height'), 'style height').to.equal('');
    expect(canvas.style.getPropertyValue('image-rendering'), 'style image-rendering').to.equal('');
    expect(canvas.getAttribute('width'), 'attribute width').to.equal('64');
    expect(canvas.getAttribute('height'), 'attribute height').to.equal('32');
    expect(canvas.getAttribute('touch-action'), 'attribute touch-action').to.equal('pan-y');
    expect(canvas.getAttribute('resize-to'), 'attribute resize-to').to.equal('window');
  });

  it('leaves no data-engine on a canvas that was handed in once the release is through', async () => {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    display = new Display(canvas);
    await display.start();
    await display.nextFrame();
    // under WebGPU the getter of the backend's context writes data-engine, and a render reads it
    display.renderer.render(new Scene(), new PerspectiveCamera());
    if (display.isWebGPUBackend) {
      expect(canvas.hasAttribute('data-engine'), 'attribute data-engine while the display is alive').to.equal(true);
    }

    const released = whenReleased(display.renderer);
    display.dispose();
    await released;

    expect(canvas.hasAttribute('data-engine'), 'attribute data-engine').to.equal(false);
  });

  it('leaves no data-engine on a canvas that was handed in once the release is through, also when dispose() lands in the init', async () => {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    display = new Display(canvas);
    const released = whenReleased(display.renderer);
    display.dispose();
    await released;

    expect(canvas.hasAttribute('data-engine'), 'attribute data-engine').to.equal(false);
  });

  it('canvas throws after dispose()', () => {
    host = makeContainer();
    display = new Display(host);

    display.dispose();

    const readCanvas = () => display.canvas;

    expect(readCanvas, 'the message names the class').to.throw(/Display/);
    expect(readCanvas, 'the message names the member').to.throw(/canvas/);
    expect(readCanvas, 'the message names the state').to.throw(/disposed/);
  });

  it('start() rejects after dispose()', async () => {
    host = makeContainer();
    display = new Display(host);

    display.dispose();

    /** @type {Promise<Display> | undefined} */
    let pending;
    expect(() => {
      pending = display.start();
    }, 'start() throws nothing synchronously').to.not.throw();

    /** @type {Error | undefined} */
    let error;
    try {
      await pending;
    } catch (err) {
      error = /** @type {Error} */ (err);
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

  it('a start() that dispose() lands in while it waits for the renderer rejects and leaves the frame loop empty', async () => {
    /** @type {(value?: unknown) => void} */
    let releaseInit;
    const initReleased = new Promise((resolve) => {
      releaseInit = resolve;
    });

    let initSettled;

    host = makeContainer();
    display = new Display(host, {
      createRenderer: (params) => {
        const renderer = new WebGPURenderer({...params});
        const realInit = renderer.init.bind(renderer);
        // the display waits on a promise that outlives the real init, so the test can land its
        // dispose() inside the window the constructor waits in
        renderer.init = () => {
          // three hands out one init promise for every call; the wrapper does the same
          initSettled ??= realInit().then(() => initReleased);
          return initSettled;
        };
        return renderer;
      },
    });

    expect(display.frameLoop.subscriptionCount, 'before the display is up').to.equal(0);

    const started = display.start();

    display.dispose();
    releaseInit();

    // start() comes back once the renderer is ready, after the display has given it up
    /** @type {Error | undefined} */
    let error;
    try {
      await started;
    } catch (err) {
      error = /** @type {Error} */ (err);
    }

    expect(error, 'start() with a dispose() while it waits').to.be.an.instanceOf(Error);
    expect(error.message).to.contain('Display#start()');
    expect(error.message).to.contain('disposed');
    expect(display.frameLoop.subscriptionCount, 'after start() has come back').to.equal(0);
    expect(display.isRunning, 'isRunning').to.equal(false);
  });

  it('releases the renderer once an init that dispose() landed in is through', async () => {
    host = makeContainer();
    display = new Display(host);

    const renderer = display.renderer;
    // three always initializes asynchronously, so the init has not finished at this point
    expect(renderer.hasInitialized(), 'the init is still running').to.equal(false);

    let initializedAtRelease;
    /** @type {(value?: unknown) => void} */
    let markReleased;
    const released = new Promise((resolve) => {
      markReleased = resolve;
    });
    const realDispose = renderer.dispose.bind(renderer);
    renderer.dispose = () => {
      initializedAtRelease = renderer.hasInitialized();
      realDispose();
      markReleased();
    };

    display.dispose();
    // a renderer that is never released leaves this promise open and runs into the timeout of
    // this suite
    await released;

    expect(initializedAtRelease, 'renderer.dispose() ran after the init').to.equal(true);

    const backend = backendOf(renderer);
    if (backend.isWebGPUBackend) {
      const info = await backend.device.lost;
      expect(info.reason, 'the reason the device was lost').to.equal('destroyed');
    } else {
      expect(backend.isWebGLBackend, 'the backend is WebGL when it is not WebGPU').to.equal(true);
      // WebGLBackend.dispose() releases the context through WEBGL_lose_context.loseContext()
      expect(backend.gl.isContextLost(), 'the context is lost').to.equal(true);
    }
  });

  it('lets no rejection escape when the init that dispose() landed in fails', async () => {
    const initFailure = new Error('the init of this renderer fails on purpose');

    /** @type {Promise<WebGPURenderer> | undefined} */
    let initPromise;
    /** @type {(reason?: unknown) => void} */
    let failInit;

    host = makeContainer();
    display = new Display(host, {
      createRenderer: (params) => {
        const renderer = new WebGPURenderer({...params});
        // three hands out one init promise for every call, and renderer.dispose() asks for it
        // again through setAnimationLoop(null); the wrapper has to do the same, or this case
        // proves something other than its name
        renderer.init = () =>
          (initPromise ??= new Promise((_, reject) => {
            failInit = reject;
          }));
        return renderer;
      },
    });

    /** @type {unknown[]} */
    const escaped = [];
    /** @param {PromiseRejectionEvent} event */
    const onUnhandledRejection = (event) => {
      if (event.reason !== initFailure) return;
      escaped.push(event.reason);
      // an escaped rejection is what this case reports; left alone it would fail the whole suite
      event.preventDefault();
    };
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    try {
      display.dispose();
      failInit(initFailure);
      await initPromise.catch(() => {});
      // the browser reports an unhandled rejection in a task of its own, after the microtasks
      // have run, so the listener gets a moment to hear about it
      await new Promise((resolve) => setTimeout(resolve, 100));
    } finally {
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    }

    expect(escaped, 'rejections of the failed init that nobody handled').to.have.length(0);
  });

  it('takes the webglcontextlost listener of a failed WebGL init off the canvas', async () => {
    const initFailure = new Error('the init of this renderer fails on purpose');

    host = makeContainer();
    display = new Display(host, {
      createRenderer: (params) => {
        const renderer = new WebGPURenderer({...params, forceWebGL: true});
        const {backend} = renderer;
        const realInit = backend.init.bind(backend);
        // the real init runs first and puts the listener of three on the canvas; what fails after
        // it stands for a WebGLState that cannot be built
        backend.init = async (...args) => {
          await realInit(...args);
          throw initFailure;
        };
        return renderer;
      },
    });
    const canvas = display.canvas;

    await new Promise((resolve) => {
      display.onError(resolve);
    });
    display.dispose();
    // the release runs after dispose() has returned
    await new Promise((resolve) => setTimeout(resolve, 0));

    const event = new Event('webglcontextlost', {cancelable: true});
    canvas.dispatchEvent(event);

    // the handler of three prevents the default of every loss it hears about
    expect(event.defaultPrevented, 'a loss that a listener of three has heard about').to.equal(false);
  });

  it('releases the renderer only after the GPU has run the work submitted to it', async function () {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    await display.nextFrame();

    // the WebGL2 backend has no queue to wait for
    if (!display.isWebGPUBackend) this.skip();

    const renderer = display.renderer;
    // one piece of real work on the queue, submitted right before the release
    renderer.render(new Scene(), new PerspectiveCamera());

    /** @type {string[]} */
    const steps = [];

    // the three.js typings leave the device off WebGPUBackend
    const {queue} = /** @type {{device?: {queue: {onSubmittedWorkDone(): Promise<unknown>}}}} */ (renderer.backend).device;
    const realOnSubmittedWorkDone = queue.onSubmittedWorkDone.bind(queue);
    queue.onSubmittedWorkDone = () => {
      steps.push('queue asked');
      return realOnSubmittedWorkDone().then((value) => {
        steps.push('queue drained');
        return value;
      });
    };

    /** @type {(value?: unknown) => void} */
    let markReleased;
    const released = new Promise((resolve) => {
      markReleased = resolve;
    });
    const realDispose = renderer.dispose.bind(renderer);
    renderer.dispose = () => {
      steps.push('renderer.dispose()');
      realDispose();
      markReleased();
    };

    display.dispose();
    await released;

    expect(steps).to.deep.equal(['queue asked', 'queue drained', 'renderer.dispose()']);
  });

  it('the page keeps its animation frames when a display built in a host element is disposed right after a render()', async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();
    await display.nextFrame();

    // one piece of work outside the frame loop, right before dispose(): the page has not presented it yet
    display.renderer.render(new Scene(), new PerspectiveCamera());

    const released = whenReleased(display.renderer);
    display.dispose();
    await released;

    expect(await whenPageAnimates(), 'the animation frames of the page after the release').to.equal('frames');
  });

  it('the page keeps its animation frames when a display on a canvas that was handed in is disposed right after a render()', async () => {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);
    display = new Display(canvas);
    await display.start();
    await display.nextFrame();

    // one piece of work outside the frame loop, right before dispose(): the page has not presented it yet
    display.renderer.render(new Scene(), new PerspectiveCamera());

    const released = whenReleased(display.renderer);
    display.dispose();
    await released;

    expect(await whenPageAnimates(), 'the animation frames of the page after the release').to.equal('frames');
  });

  it('a canvas that was handed in carries a second display built while the first one is being released', async () => {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    previous = new Display(canvas);
    await previous.start();
    await previous.nextFrame();

    const released = whenReleased(previous.renderer);
    previous.dispose();

    display = new Display(canvas);
    await display.start();
    await released;
    await display.nextFrame();

    await expectLiveBackend(display);
  });

  it('a canvas that was handed in carries a second display built after the first one has been released', async () => {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    previous = new Display(canvas);
    await previous.start();
    await previous.nextFrame();

    const released = whenReleased(previous.renderer);
    previous.dispose();
    await released;
    // the release is through and the canvas has sat without a display for 100 ms. Under WebGL
    // only the display built now can bring the context back; under WebGPU there is nothing to
    // restore, and the case checks that the second display draws
    await new Promise((resolve) => setTimeout(resolve, 100));

    display = new Display(canvas);
    await display.start();
    await display.nextFrame();

    await expectLiveBackend(display);
  });

  it('a canvas that was handed in carries a second display when dispose() lands in the init of the first one', async () => {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    // a mount, an unmount and a mount again in one tick, as React StrictMode does it
    previous = new Display(canvas);
    const released = whenReleased(previous.renderer);
    previous.dispose();

    display = new Display(canvas);
    await display.start();
    await released;
    await display.nextFrame();

    await expectLiveBackend(display);
  });

  it('a WebGL context that does not come back holds the next display on its canvas up for a bounded time', async function () {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    previous = new Display(canvas);
    await previous.start();

    // only a WebGL context is lost on release and has to be restored
    if (!previous.isWebGLBackend) this.skip();

    // the three.js typings leave gl off the backend
    const {gl} = /** @type {{gl?: WebGL2RenderingContext}} */ (previous.renderer.backend);
    // the browser keeps the context lost: restoreContext() on this extension object does nothing
    gl.getExtension('WEBGL_lose_context').restoreContext = () => {};

    /** @type {string[]} */
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...args) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      previous.dispose();
      display = new Display(canvas);
      // either is an outcome: the second display starts on a lost context, and what counts is
      // that start() comes back at all — without a bound this case runs into the suite timeout
      await display.start().then(
        () => 'resolved',
        () => 'rejected',
      );
    } finally {
      console.warn = realWarn;
    }

    expect(
      warnings.some((w) => w.includes('new Display()')),
      'a warning names the display that waited',
    ).to.equal(true);
  });

  it('a WebGL context that did not come back in time gets another restore from the next display on its canvas', async function () {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    previous = new Display(canvas);
    await previous.start();

    // only a WebGL context is lost on release and has to be restored
    if (!previous.isWebGLBackend) this.skip();

    // the three.js typings leave gl off the backend
    const {gl} = /** @type {{gl?: WebGL2RenderingContext}} */ (previous.renderer.backend);
    // the same object for as long as the context lives, and the one the release keeps
    const extension = gl.getExtension('WEBGL_lose_context');
    // the browser keeps the context lost while the display after the first one waits for it
    extension.restoreContext = () => {};

    /** @type {string[]} */
    const warnings = [];
    const realWarn = console.warn;
    console.warn = (...args) => {
      warnings.push(args.map(String).join(' '));
    };

    try {
      previous.dispose();
      previous = new Display(canvas);
      // it starts on the lost context once its wait has run out, or fails to; either will do
      await previous.start().then(
        () => 'resolved',
        () => 'rejected',
      );

      // from here on the browser lets the context come back
      delete extension.restoreContext;

      previous.dispose();
      display = new Display(canvas);
      await display.start();
      await display.nextFrame();
    } finally {
      console.warn = realWarn;
    }

    await expectLiveBackend(display);
    expect(
      warnings.filter((w) => w.includes('new Display()')),
      'warnings of a display that waited for the context in vain',
    ).to.have.length(1);
  });

  it('a canvas that was handed in keeps its WebGL context lost while no display follows', async function () {
    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    display = new Display(canvas);
    await display.start();

    // only a WebGL context is lost on release
    if (!display.isWebGLBackend) this.skip();

    // the three.js typings leave gl off the backend
    const {gl} = /** @type {{gl?: WebGL2RenderingContext}} */ (display.renderer.backend);

    const released = whenReleased(display.renderer);
    display.dispose();
    await released;
    // a restore would land in a task of its own after the release, so a few of them pass first
    await new Promise((resolve) => setTimeout(resolve, 100));

    // a live context on a canvas nobody draws to counts against the few the browser keeps alive
    expect(gl.isContextLost(), 'the context of a canvas with no display on it').to.equal(true);
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

    /** @type {(value?: unknown) => void} */
    let releaseCallback;
    const callbackReleased = new Promise((resolve) => {
      releaseCallback = resolve;
    });

    // the rejection handler is attached in the same turn as the call: this case means to be
    // rejected, and an unhandled rejection would take the whole suite down with it
    let outcome = 'pending';
    /** @type {Error | undefined} */
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
          rejection = /** @type {Error} */ (err);
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
    const settled = display.nextFrame().then(
      () => ({outcome: 'resolved', rejection: undefined}),
      (err) => ({outcome: 'rejected', rejection: err}),
    );

    display.dispose();

    // dispose() rejects the open promise before it returns; one that stays open runs into the
    // timeout of this suite instead
    const {outcome, rejection} = await settled;

    expect(outcome, 'a nextFrame() promise open at dispose()').to.equal('rejected');
    expect(rejection.message).to.contain('Display#nextFrame()');
    expect(rejection.message).to.contain('disposed');

    /** @type {Error | undefined} */
    let error;
    try {
      await display.nextFrame();
    } catch (err) {
      error = /** @type {Error} */ (err);
    }

    expect(error, 'nextFrame() called after dispose()').to.be.an.instanceOf(Error);
    expect(error.message).to.contain('Display#nextFrame()');
    expect(error.message).to.contain('disposed');
  });
});

import {expect} from '@esm-bundle/chai';
import {on, once} from '@spearwolf/eventize';
import {
  Display,
  OnDisplayInit,
  OnDisplayPause,
  OnDisplayRenderFrame,
  OnDisplayRestart,
  OnDisplayStart,
} from '@spearwolf/twopoint5d';
import {WebGPURenderer} from 'three/webgpu';

const FIXTURE_ID = 'display-lifecycle-fixture';

/** @param {{width?: number, height?: number, id?: string}} [options] */
function makeContainer({width = 320, height = 200, id} = {}) {
  const el = document.createElement('div');
  el.id = id ?? `${FIXTURE_ID}-${Math.random().toString(36).slice(2, 8)}`;
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

/** Teardown must not mask the failure that got it here: no display, or a display that fails to go down. */
function disposeDisplay(display) {
  if (!display) return;
  try {
    display.dispose();
  } catch {
    // ignore — the fixture still has to leave the dom
  }
}

async function animationFrames(count) {
  for (let i = 0; i < count; i++) {
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}

/** Writes the name of every lifecycle event and of every rendered frame into one list. */
function recordEvents(display) {
  const events = [];
  for (const name of [OnDisplayInit, OnDisplayStart, OnDisplayPause, OnDisplayRestart, OnDisplayRenderFrame]) {
    on(display, name, () => {
      events.push(name);
    });
  }
  return events;
}

// OnDisplayStart is retained until the next pause clears it: a promise made before a pause would
// resolve on the spot with the start before it, one made after the pause waits for the next start
function nextEvent(display, name) {
  return new Promise((resolve) => {
    once(display, name, resolve);
  });
}

describe('Display — lifecycle', function () {
  // a cold webgpu start — adapter plus device — happens inside the constructor, and it is slow
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;

  afterEach(() => {
    // the own property shadows the getter of Document.prototype; without it that getter applies
    Reflect.deleteProperty(document, 'hidden');
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  it('a fresh display emits init, start and then renders frames, standing on its frame loop', async () => {
    host = makeContainer();
    display = new Display(host);
    const events = recordEvents(display);

    await display.start();
    await display.nextFrame();

    expect(events.slice(0, 3)).to.deep.equal([OnDisplayInit, OnDisplayStart, OnDisplayRenderFrame]);
    expect(display.frameLoop.subscriptionCount).to.equal(1);
  });

  it('pause = true takes the display off its frame loop, pause = false puts it back without a second init', async () => {
    host = makeContainer();
    display = new Display(host);
    const events = recordEvents(display);
    await display.start();
    await display.nextFrame();
    events.length = 0;

    display.pause = true;

    expect(events).to.deep.equal([OnDisplayPause]);
    expect(display.frameLoop.subscriptionCount).to.equal(0);

    await animationFrames(3);

    expect(events, 'no frame while paused').to.deep.equal([OnDisplayPause]);

    display.pause = false;
    await display.nextFrame();

    expect(events.slice(0, 4)).to.deep.equal([OnDisplayPause, OnDisplayRestart, OnDisplayStart, OnDisplayRenderFrame]);
    expect(events).to.not.include(OnDisplayInit);
    expect(display.frameLoop.subscriptionCount).to.equal(1);
  });

  it('stop() takes the display off its frame loop, start() puts it back without a second init', async () => {
    host = makeContainer();
    display = new Display(host);
    const events = recordEvents(display);
    await display.start();
    await display.nextFrame();
    events.length = 0;

    display.stop();

    expect(events).to.deep.equal([OnDisplayPause]);
    expect(display.frameLoop.subscriptionCount).to.equal(0);

    await animationFrames(3);

    expect(events, 'no frame while stopped').to.deep.equal([OnDisplayPause]);

    await display.start();
    await display.nextFrame();

    expect(events.slice(0, 4)).to.deep.equal([OnDisplayPause, OnDisplayRestart, OnDisplayStart, OnDisplayRenderFrame]);
    expect(events).to.not.include(OnDisplayInit);
    expect(display.frameLoop.subscriptionCount).to.equal(1);
  });

  it('pauses while the tab is hidden and runs again once it is visible', async () => {
    host = makeContainer();
    display = new Display(host);
    const events = recordEvents(display);
    await display.start();
    await display.nextFrame();
    events.length = 0;

    Object.defineProperty(document, 'hidden', {configurable: true, get: () => true});
    document.dispatchEvent(new Event('visibilitychange'));

    expect(events).to.deep.equal([OnDisplayPause]);
    expect(display.pause).to.equal(true);

    Reflect.deleteProperty(document, 'hidden');
    document.dispatchEvent(new Event('visibilitychange'));
    await display.nextFrame();

    expect(events.slice(0, 4)).to.deep.equal([OnDisplayPause, OnDisplayRestart, OnDisplayStart, OnDisplayRenderFrame]);
  });

  it('a stop() while start() waits for a real init keeps the display from starting, and the next start() runs', async () => {
    host = makeContainer();
    display = new Display(host);
    const events = recordEvents(display);

    const started = display.start();
    display.stop();

    expect(await started).to.equal(display);
    expect(display.isRunning).to.equal(false);
    expect(events).to.deep.equal([]);
    expect(display.frameLoop.subscriptionCount).to.equal(0);

    await display.start();

    expect(events).to.deep.equal([OnDisplayInit, OnDisplayStart]);
    expect(display.isRunning).to.equal(true);
  });

  it('pauseOutsideViewport pauses the display while its canvas is out of view and runs it again once it is back', async () => {
    host = makeContainer();
    display = new Display(host, {pauseOutsideViewport: true});
    await display.start();
    await display.nextFrame();

    const paused = nextEvent(display, OnDisplayPause);
    host.style.top = '-10000px';
    await paused;

    expect(display.pause).to.equal(true);
    expect(display.frameLoop.subscriptionCount).to.equal(0);

    const restarted = nextEvent(display, OnDisplayStart);
    host.style.top = '0';
    await restarted;

    expect(display.isRunning).to.equal(true);
    expect(display.frameLoop.subscriptionCount).to.equal(1);
  });

  it('without pauseOutsideViewport a display out of view keeps running', async () => {
    host = makeContainer();
    display = new Display(host);
    const events = recordEvents(display);
    await display.start();
    await display.nextFrame();
    events.length = 0;

    host.style.top = '-10000px';
    await animationFrames(3);

    expect(display.isRunning).to.equal(true);
    expect(events).to.not.include(OnDisplayPause);
    expect(events).to.include(OnDisplayRenderFrame);
  });

  it('pauseOutsideViewport does not reach the renderer', () => {
    let seen;
    host = makeContainer();
    display = new Display(host, {
      pauseOutsideViewport: true,
      createRenderer: (params) => {
        seen = params;
        return new WebGPURenderer(params);
      },
    });

    expect(seen).to.not.have.property('pauseOutsideViewport');
  });
});

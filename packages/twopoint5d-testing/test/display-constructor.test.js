import {on} from '@spearwolf/eventize';
import {expect} from '@esm-bundle/chai';
import {Display, OnDisplayError} from '@spearwolf/twopoint5d';

const FIXTURE_ID = 'display-constructor-fixture';

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

// The members the display touches on its renderer before the first frame. The result of
// createRenderer is never checked against WebGPURenderer, so a failing init needs no real one —
// and a real one cannot be made to fail on demand.
function makeRendererStub(canvas, initResult) {
  return {
    domElement: canvas,
    init: () => initResult,
    setPixelRatio() {},
    setSize() {},
    setAnimationLoop() {},
    dispose() {},
  };
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

describe('Display — what the constructor accepts and what it reports', function () {
  // a cold webgpu start — adapter plus device — happens inside the constructor, and it is slow
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;

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

  it('refuses a first argument that is neither an element nor a renderer', () => {
    const withNull = () => new Display(null);
    const withPlainObject = () => new Display({});

    expect(withNull, 'null names what the constructor takes').to.throw(TypeError, /WebGPURenderer or an HTML element/);
    expect(withPlainObject, 'a plain object names what the constructor takes').to.throw(
      TypeError,
      /WebGPURenderer or an HTML element/,
    );
  });

  it('reports a renderer that fails to initialize as an error event', async () => {
    const initFailed = new Error('the renderer did not come up');

    host = makeContainer();
    display = new Display(host, {
      createRenderer: ({canvas}) => makeRendererStub(canvas, Promise.reject(initFailed)),
    });

    let reported;
    on(display, OnDisplayError, (error) => {
      reported = error;
    });

    await wait(50);

    expect(reported, 'the error the subscriber is told about').to.equal(initFailed);

    // the constructor returns before the renderer is up, so a subscriber attaching afterwards is
    // the normal case — a renderer that failed is an end state and is still there to be read
    let reportedLate;
    on(display, OnDisplayError, (error) => {
      reportedLate = error;
    });

    expect(reportedLate, 'the error a subscriber attaching after the failure is told about').to.equal(initFailed);
  });
});

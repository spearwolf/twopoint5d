import {on} from '@spearwolf/eventize';
import {expect} from '@esm-bundle/chai';
import {Display, OnDisplayError} from '@spearwolf/twopoint5d';
import {WebGPURenderer} from 'three/webgpu';
import {disposeDisplay, makeContainer} from './helpers/fixtures.js';

// The members the display touches on its renderer before the first frame. The result of
// createRenderer is never checked against WebGPURenderer, so a failing init needs no real one —
// and a real one cannot be made to fail on demand. The stub carries what `Display` calls on the
// renderer and nothing else, so it goes through `unknown` to be handed out as a WebGPURenderer.
/** @returns {WebGPURenderer} */
function makeRendererStub(canvas, initResult) {
  return /** @type {WebGPURenderer} */ (
    /** @type {unknown} */ ({
      domElement: canvas,
      init: () => initResult,
      setDrawingBufferSize() {},
      setAnimationLoop() {},
      dispose() {},
    })
  );
}

describe('Display — what the constructor accepts and what it reports', function () {
  // a cold webgpu start — adapter plus device — happens inside the constructor, and it is slow
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;

  afterEach(() => {
    disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  it('refuses a first argument that is neither an element nor a renderer', () => {
    const withNull = () => new Display(null);
    // @ts-expect-error — the case hands the constructor what it refuses
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

    const reported = new Promise((resolve) => {
      on(display, OnDisplayError, resolve);
    });

    expect(await reported, 'the error the subscriber is told about').to.equal(initFailed);

    // the constructor returns before the renderer is up, so a subscriber attaching afterwards is
    // the normal case — a renderer that failed is an end state and is still there to be read
    let reportedLate;
    on(display, OnDisplayError, (error) => {
      reportedLate = error;
    });

    expect(reportedLate, 'the error a subscriber attaching after the failure is told about').to.equal(initFailed);
  });

  it('takes the container it built back out of the host when the renderer cannot be built', () => {
    const rendererFailed = new Error('the renderer could not be built');

    host = makeContainer();

    expect(() => {
      display = new Display(host, {
        createRenderer: () => {
          throw rendererFailed;
        },
      });
    }, 'the constructor').to.throw(rendererFailed.constructor, rendererFailed.message);
    display = undefined;

    expect(host.children.length, 'children left in the host').to.equal(0);
  });

  it('takes the container it built out of the host and releases the renderer when the constructor fails after building it', async () => {
    const failure = new Error('the resizeTo callback fails on purpose');

    /** @type {(value?: unknown) => void} */
    let markReleased;
    const released = new Promise((resolve) => {
      markReleased = resolve;
    });

    host = makeContainer();

    expect(() => {
      display = new Display(host, {
        resizeTo: () => {
          throw failure;
        },
        createRenderer: (params) => {
          const renderer = new WebGPURenderer({...params});
          const realDispose = renderer.dispose.bind(renderer);
          renderer.dispose = () => {
            realDispose();
            markReleased();
          };
          return renderer;
        },
      });
    }, 'the constructor').to.throw(failure);
    display = undefined;

    expect(host.children.length, 'children left in the host').to.equal(0);

    // a renderer that is never released leaves this promise open and runs into the timeout of
    // this suite
    await released;
  });

  it('gives a canvas that was handed in back as it found it when the constructor fails after building the renderer', () => {
    const failure = new Error('the resizeTo callback fails on purpose');

    host = makeContainer();
    const canvas = document.createElement('canvas');
    host.appendChild(canvas);

    expect(() => {
      display = new Display(canvas, {
        resizeTo: () => {
          throw failure;
        },
      });
    }, 'the constructor').to.throw(failure);
    display = undefined;

    expect(canvas.getAttribute('class'), 'attribute class').to.equal(null);
    expect(canvas.hasAttribute('touch-action'), 'attribute touch-action').to.equal(false);
    expect(canvas.hasAttribute('data-engine'), 'attribute data-engine').to.equal(false);
    expect(canvas.getAttribute('style'), 'attribute style').to.equal(null);
  });
});

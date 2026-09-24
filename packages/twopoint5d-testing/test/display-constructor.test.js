import {on} from '@spearwolf/eventize';
import {expect} from '@esm-bundle/chai';
import {Display, OnDisplayError} from '@spearwolf/twopoint5d';
import {disposeDisplay, makeContainer} from './helpers/fixtures.js';

/** @import {WebGPURenderer} from 'three/webgpu' */

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
      setPixelRatio() {},
      setSize() {},
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
});

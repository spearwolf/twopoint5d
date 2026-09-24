import {expect} from '@esm-bundle/chai';
import {Display} from '@spearwolf/twopoint5d';
import {disposeDisplay, makeContainer} from './helpers/fixtures.js';

describe('renderer backend', function () {
  // a cold webgpu start — adapter plus device — happens inside the constructor, and it is slow
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;

  afterEach(() => {
    disposeDisplay(display);
    display = undefined;
    host?.remove();
    host = undefined;
  });

  it('names the renderer backend three picked in this browser', async () => {
    host = makeContainer();
    display = new Display(host);
    await display.start();

    // the browser is named in the line itself: the reporter merges identical lines of both
    // browsers into one block that carries no browser name; console.debug because the runner
    // collects log, debug, warn and error into its report and drops console.info
    const backend = display.isWebGPUBackend ? 'WebGPU' : display.isWebGLBackend ? 'WebGL2' : 'no backend';
    const browser = navigator.userAgent.match(/(Firefox|Chrome)\/[\d.]+/)?.[0] ?? navigator.userAgent;
    console.debug(`[renderer-backend] ${backend} on ${browser}`);

    expect([display.isWebGPUBackend, display.isWebGLBackend].filter(Boolean), 'exactly one backend').to.have.lengthOf(1);
  });
});

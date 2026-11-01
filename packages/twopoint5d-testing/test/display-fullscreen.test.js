import {expect} from 'chai';
import {Display} from '@spearwolf/twopoint5d';
import {sendMouse} from '@web/test-runner-commands';
import {disposeDisplay, makeContainer} from './helpers/fixtures.js';

/**
 * A trusted click at the top left of the page — a user gesture, which a script cannot make — and
 * the request `display.fullscreen.request()` makes in its handler.
 *
 * @param {Display} display
 * @returns {Promise<boolean>}
 */
async function requestWithClick(display) {
  /** @type {Promise<boolean> | undefined} */
  let requested;
  document.addEventListener(
    'click',
    () => {
      requested = display.fullscreen.request();
    },
    {once: true},
  );
  await sendMouse({type: 'click', position: [10, 10]});
  expect(requested, 'the click reached the handler').to.not.equal(undefined);
  return /** @type {Promise<boolean>} */ (requested);
}

/**
 * Resolves on the first `fullscreenchange` of the document after which `element` is the
 * fullscreen element, or rejects after two seconds. An event still queued from an earlier change
 * arrives first and is passed over.
 *
 * @param {Element | null} element
 * @returns {Promise<void>}
 */
function whenFullscreenElementIs(element) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      document.removeEventListener('fullscreenchange', onChange);
      reject(new Error(`the fullscreen element did not become ${element == null ? 'null' : element.nodeName} within 2 s`));
    }, 2000);
    function onChange() {
      if (document.fullscreenElement !== element) return;
      clearTimeout(timeout);
      document.removeEventListener('fullscreenchange', onChange);
      resolve();
    }
    document.addEventListener('fullscreenchange', onChange);
  });
}

/**
 * Resolves on the next `OnDisplayFullscreenChange` of `display` that reports `isActive`, or
 * rejects after two seconds. The event goes out once the controller has read a `fullscreenchange`,
 * so it shows what the controller saw — `isActive` of the controller reads the document anew at
 * every call and shows nothing of that. The retained event a new listener hears at once is passed
 * over.
 *
 * @param {Display} display
 * @param {boolean} isActive
 * @returns {Promise<void>}
 */
function whenControllerReports(display, isActive) {
  return new Promise((resolve, reject) => {
    let live = false;
    /** @type {() => void} */
    let unsubscribe = () => {};
    const timeout = setTimeout(() => {
      unsubscribe();
      reject(new Error(`the controller did not report isActive: ${isActive} within 2 s`));
    }, 2000);
    unsubscribe = display.onFullscreenChange((props) => {
      if (!live || props.isActive !== isActive) return;
      clearTimeout(timeout);
      unsubscribe();
      resolve();
    });
    live = true;
  });
}

describe('Display#fullscreen', () => {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement[]} */
  let elements;

  beforeEach(() => {
    elements = [];
  });

  afterEach(async () => {
    disposeDisplay(display);
    display = undefined;
    if (document.fullscreenElement != null) await document.exitFullscreen().catch(() => {});
    for (const element of elements.splice(0)) element.remove();
  });

  describe('native', () => {
    beforeEach(() => {
      // every launcher of web-test-runner.config.js offers the Fullscreen API, and one that does
      // not fails here instead of passing the native path by unseen
      expect(document.fullscreenEnabled, 'document.fullscreenEnabled under this launcher').to.equal(true);
    });

    it('a click requests fullscreen on the default target, the host element', async () => {
      const host = makeContainer();
      elements.push(host);
      display = new Display(host);
      /** @type {unknown[]} */
      const events = [];
      display.onFullscreenChange((props) => {
        events.push(props);
      });

      expect(await requestWithClick(display)).to.equal(true);

      expect(document.fullscreenElement, 'the host is in fullscreen').to.equal(host);
      expect(display.fullscreen.isActive).to.equal(true);
      expect(display.fullscreen.mode).to.equal('native');
      expect(events.at(-1)).to.include({isActive: true, mode: 'native', element: host});

      display.resize();
      expect(display.width).to.be.closeTo(host.getBoundingClientRect().width, 1);
      expect(display.width, 'larger than the box of 320').to.be.above(320);
    });

    it('the canvas as target with its parent as size source: the buffer follows the canvas', async () => {
      const container = makeContainer();
      const canvas = document.createElement('canvas');
      container.appendChild(canvas);
      elements.push(container);
      display = new Display(canvas, {resizeToElement: container, fullscreen: {element: canvas}});
      expect(display.width).to.equal(320);

      expect(await requestWithClick(display)).to.equal(true);
      display.resize();

      expect(document.fullscreenElement).to.equal(canvas);
      expect(display.width).to.be.closeTo(canvas.getBoundingClientRect().width, 1);
      expect(display.width).to.be.above(320);
    });

    it('a canvas that measures itself in a fullscreen parent follows it, and returns to its size after exit()', async () => {
      const container = makeContainer();
      const canvas = document.createElement('canvas');
      canvas.style.width = '160px';
      canvas.style.height = '100px';
      container.appendChild(canvas);
      elements.push(container);
      display = new Display(canvas);
      expect(display.width).to.equal(160);

      expect(await requestWithClick(display)).to.equal(true);
      display.resize();

      expect(document.fullscreenElement, 'the parent is the default target').to.equal(container);
      expect(display.width).to.be.closeTo(container.getBoundingClientRect().width, 1);

      expect(await display.fullscreen.exit()).to.equal(false);
      display.resize();

      expect(display.width).to.equal(160);
      expect(display.height).to.equal(100);
    });

    it('a canvas that measures itself as the target follows the screen, and returns to its size after exit()', async () => {
      const container = makeContainer();
      const canvas = document.createElement('canvas');
      canvas.style.width = '160px';
      canvas.style.height = '100px';
      container.appendChild(canvas);
      elements.push(container);
      display = new Display(canvas, {fullscreen: {element: canvas}});

      expect(await requestWithClick(display)).to.equal(true);
      display.resize();
      expect(document.fullscreenElement).to.equal(canvas);
      expect(display.width).to.be.above(160);

      expect(await display.fullscreen.exit()).to.equal(false);
      display.resize();

      expect(display.width).to.equal(160);
      expect(display.height).to.equal(100);
    });

    it('exit() leaves and emits', async () => {
      const host = makeContainer();
      elements.push(host);
      display = new Display(host);
      await requestWithClick(display);
      /** @type {{isActive: boolean}[]} */
      const events = [];
      display.onFullscreenChange((props) => {
        events.push(props);
      });

      expect(await display.fullscreen.exit()).to.equal(false);

      expect(document.fullscreenElement).to.equal(null);
      expect(display.fullscreen.isActive).to.equal(false);
      expect(events.at(-1)).to.include({isActive: false});
    });

    it('a fullscreen an element inside the target stacks on it: isActive is false while it holds, and dispose() leaves the target once it is on top again', async () => {
      const host = makeContainer();
      const inner = document.createElement('div');
      host.appendChild(inner);
      elements.push(host);
      display = new Display(host);
      expect(await requestWithClick(display)).to.equal(true);

      // a second trusted click: the video or the dialog of the app goes fullscreen inside the target.
      // The controller has to have read the stack before the dispose below, and its event says so
      const stackSeen = whenControllerReports(display, false);
      /** @type {Promise<void> | undefined} */
      let stacked;
      document.addEventListener(
        'click',
        () => {
          stacked = inner.requestFullscreen();
        },
        {once: true},
      );
      await sendMouse({type: 'click', position: [10, 10]});
      expect(stacked, 'the click reached the handler').to.not.equal(undefined);
      await stacked;
      await stackSeen;

      expect(document.fullscreenElement, 'the inner element lies on top').to.equal(inner);
      expect(display.fullscreen.isActive).to.equal(false);

      const backSeen = whenControllerReports(display, true);
      await document.exitFullscreen();
      await backSeen;
      expect(document.fullscreenElement, 'the target is on top again').to.equal(host);
      expect(display.fullscreen.isActive).to.equal(true);

      const left = whenFullscreenElementIs(null);
      display.dispose();
      display = undefined;
      await left;

      expect(document.fullscreenElement).to.equal(null);
    });
  });

  describe('pseudo', () => {
    it('the pseudo mode in an iframe that may not use fullscreen covers the viewport of the iframe', async () => {
      const iframe = document.createElement('iframe');
      // set before the iframe goes in, so its document starts with the policy
      iframe.setAttribute('allow', "fullscreen 'none'");
      iframe.style.border = '0';
      iframe.style.width = '300px';
      iframe.style.height = '200px';
      document.body.appendChild(iframe);
      elements.push(iframe);
      const iframeDocument = /** @type {Document} */ (iframe.contentDocument);
      const iframeWindow = /** @type {Window} */ (iframeDocument.defaultView);
      const canvas = iframeDocument.createElement('canvas');
      canvas.style.width = '100px';
      canvas.style.height = '50px';
      iframeDocument.body.appendChild(canvas);

      display = new Display(canvas, {fullscreen: {fallback: 'pseudo'}});

      expect(display.fullscreen.isSupported, 'native fullscreen in the iframe').to.equal(false);
      expect(display.fullscreen.isAvailable).to.equal(true);
      expect(display.width).to.equal(100);

      expect(await display.fullscreen.request()).to.equal(true);
      display.resize();

      expect(display.fullscreen.mode).to.equal('pseudo');
      expect(display.width).to.equal(iframeWindow.innerWidth);
      expect(display.height).to.equal(iframeWindow.innerHeight);

      expect(await display.fullscreen.exit()).to.equal(false);
      display.resize();

      expect(display.width).to.equal(100);
    });

    it('the pseudo mode covers the viewport with a target whose size is written inline', async () => {
      const iframe = document.createElement('iframe');
      iframe.setAttribute('allow', "fullscreen 'none'");
      iframe.style.border = '0';
      iframe.style.width = '300px';
      iframe.style.height = '200px';
      document.body.appendChild(iframe);
      elements.push(iframe);
      const iframeDocument = /** @type {Document} */ (iframe.contentDocument);
      const iframeWindow = /** @type {Window} */ (iframeDocument.defaultView);
      const canvas = iframeDocument.createElement('canvas');
      canvas.style.width = '100px';
      canvas.style.height = '50px';
      iframeDocument.body.appendChild(canvas);

      // the canvas as target: the display writes its inline size on every measurement
      display = new Display(canvas, {fullscreen: {element: canvas, fallback: 'pseudo'}});

      expect(await display.fullscreen.request()).to.equal(true);
      display.resize();

      const rect = canvas.getBoundingClientRect();
      expect(rect.width, 'the box of the canvas').to.equal(iframeWindow.innerWidth);
      expect(display.width).to.equal(iframeWindow.innerWidth);
      expect(display.height).to.equal(iframeWindow.innerHeight);

      expect(await display.fullscreen.exit()).to.equal(false);
      display.resize();

      expect(display.width).to.equal(100);
    });
  });
});

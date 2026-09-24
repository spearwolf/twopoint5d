import {expect} from '@esm-bundle/chai';
import {Display, OnDisplayResize} from '@spearwolf/twopoint5d';
import {on, off} from '@spearwolf/eventize';
import {makeContainer, disposeDisplay} from './helpers/fixtures.js';

function nextFrame(display) {
  return display.nextFrame();
}

// console.warn is swapped for a collector around the code under test; only warnings about
// resize-to or the resolution limit count, three.js warns on its own in some engines
function collectWarnings(match) {
  const original = console.warn;
  const warnings = [];
  console.warn = (...args) => {
    if (typeof args[0] === 'string' && args[0].includes(match)) {
      warnings.push(args);
    }
  };
  return {warnings, restore: () => (console.warn = original)};
}

function makeSizeRef(root, {id, width, height}) {
  const el = document.createElement('div');
  el.id = id;
  el.style.position = 'absolute';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
  root.appendChild(el);
  return el;
}

describe('Display — resize behavior', () => {
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

  it('resize() is called from the constructor and sets initial width/height (no event yet)', () => {
    host = makeContainer({width: 400, height: 250});

    let resizeEmittedDuringConstruction = 0;
    const onResize = () => {
      resizeEmittedDuringConstruction += 1;
    };

    display = new Display(host);
    on(display, OnDisplayResize, onResize);

    // The constructor's resize() must NOT emit OnDisplayResize (frameNo === 0).
    // But: OnDisplayResize is retained, so a subscriber attached after the
    // initial resize is invoked synchronously with the retained value. We
    // cannot probe "no emit" from this side; instead we assert that width
    // and height are non-zero, proving resize() ran.
    expect(display.width, 'width after constructor').to.be.greaterThan(0);
    expect(display.height, 'height after constructor').to.be.greaterThan(0);

    // The subscriber may have been called once via `retain` replay — that's
    // expected. We just want to make sure the constructor itself doesn't
    // schedule extra emissions.
    expect(resizeEmittedDuringConstruction).to.be.at.most(1);

    off(display, OnDisplayResize, onResize);
  });

  it('uses the host element size when constructed with an HTMLElement', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);

    await display.start();
    await nextFrame(display);

    expect(display.width).to.equal(320);
    expect(display.height).to.equal(200);
  });

  it('uses resizeToElement option as the size source', async () => {
    host = makeContainer({width: 800, height: 600});
    const sizeRef = makeContainer({width: 256, height: 128, id: 'size-ref'});

    display = new Display(host, {resizeToElement: sizeRef});

    await display.start();
    await nextFrame(display);

    expect(display.width).to.equal(256);
    expect(display.height).to.equal(128);

    sizeRef.parentNode.removeChild(sizeRef);
  });

  it('resizeToCallback overrides element-based measurement', async () => {
    host = makeContainer({width: 800, height: 600});

    let cbW = 123;
    let cbH = 77;
    let callCount = 0;
    display = new Display(host, {
      resizeTo: () => {
        callCount += 1;
        return [cbW, cbH];
      },
    });

    await display.start();
    await nextFrame(display);

    expect(display.width).to.equal(123);
    expect(display.height).to.equal(77);
    expect(callCount, 'callback runs at least once').to.be.greaterThan(0);

    // Mutate the closure values, advance one frame, expect new dimensions.
    cbW = 256;
    cbH = 192;
    await nextFrame(display);

    expect(display.width).to.equal(256);
    expect(display.height).to.equal(192);
  });

  it('reacts to host element resizes on the next frame (no DOM listener required)', async () => {
    host = makeContainer({width: 200, height: 200});
    display = new Display(host);

    await display.start();
    await nextFrame(display);
    expect(display.width).to.equal(200);
    expect(display.height).to.equal(200);

    host.style.width = '500px';
    host.style.height = '350px';

    // Skip one frame to allow layout to settle, then read.
    await nextFrame(display);
    await nextFrame(display);

    expect(display.width).to.equal(500);
    expect(display.height).to.equal(350);
  });

  it('emits OnDisplayResize when the size actually changes', async () => {
    host = makeContainer({width: 240, height: 180});
    display = new Display(host);

    await display.start();
    await nextFrame(display); // settle initial frame

    const observed = [];
    const onResize = (props) => {
      observed.push({width: props.width, height: props.height, frameNo: props.frameNo});
    };
    on(display, OnDisplayResize, onResize);

    // No size change → no further emissions.
    const baseline = observed.length;
    await nextFrame(display);
    await nextFrame(display);
    expect(observed.length, 'no emit when nothing changed').to.equal(baseline);

    // Size change → exactly one new emission with the new size.
    host.style.width = '320px';
    host.style.height = '240px';
    await nextFrame(display);
    await nextFrame(display);

    const fresh = observed.slice(baseline);
    expect(fresh.length, 'one emit after size change').to.equal(1);
    expect(fresh[0].width).to.equal(320);
    expect(fresh[0].height).to.equal(240);

    off(display, OnDisplayResize, onResize);
  });

  it('resize-to="self" on the canvas measures the canvas itself', async () => {
    host = makeContainer({width: 320, height: 200});
    const canvas = document.createElement('canvas');
    canvas.style.width = '160px';
    canvas.style.height = '90px';
    canvas.style.display = 'block';
    canvas.setAttribute('resize-to', 'self');
    host.appendChild(canvas);

    display = new Display(canvas);
    await display.start();
    await nextFrame(display);

    expect(display.width).to.equal(160);
    expect(display.height).to.equal(90);
  });

  it('resize-to=CSS-selector resolves the target element', async () => {
    host = makeContainer({width: 800, height: 600});

    const sizeRef = document.createElement('div');
    sizeRef.id = 'display-resize-selector-ref';
    sizeRef.style.width = '128px';
    sizeRef.style.height = '64px';
    sizeRef.style.position = 'absolute';
    sizeRef.style.left = '0';
    sizeRef.style.top = '0';
    document.body.appendChild(sizeRef);

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.setAttribute('resize-to', '#display-resize-selector-ref');
    host.appendChild(canvas);

    display = new Display(canvas);

    try {
      await display.start();
      await nextFrame(display);

      expect(display.width).to.equal(128);
      expect(display.height).to.equal(64);
    } finally {
      sizeRef.parentNode.removeChild(sizeRef);
    }
  });

  it('resize-to="window" matches window.innerWidth/innerHeight and toggles fullscreen CSS class', async () => {
    host = makeContainer({width: 100, height: 100});
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.setAttribute('resize-to', 'window');
    host.appendChild(canvas);

    display = new Display(canvas);
    await display.start();
    await nextFrame(display);

    expect(display.width).to.equal(window.innerWidth);
    expect(display.height).to.equal(window.innerHeight);

    const fullscreenClass = Array.from(canvas.classList).find((c) => c.startsWith(Display.CssRulesPrefixFullscreen));
    expect(fullscreenClass, 'fullscreen CSS class is added').to.exist;

    // Switch back to "self" — the fullscreen class must be removed.
    canvas.style.width = '100px';
    canvas.style.height = '50px';
    canvas.setAttribute('resize-to', 'self');
    await nextFrame(display);
    await nextFrame(display);

    const stillHasFullscreen = Array.from(canvas.classList).some((c) => c.startsWith(Display.CssRulesPrefixFullscreen));
    expect(stillHasFullscreen, 'fullscreen CSS class is removed').to.equal(false);
    expect(display.width).to.equal(100);
    expect(display.height).to.equal(50);
  });

  it('pixelZoom > 0 scales logical width/height and forces pixelRatio = 1', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);
    display.pixelZoom = 2;

    await display.start();
    await nextFrame(display);
    await nextFrame(display); // pixelZoom change participates in resize hash

    expect(display.pixelRatio, 'pixelRatio forced to 1').to.equal(1);
    expect(display.width).to.equal(160);
    expect(display.height).to.equal(100);
    expect(display.canvas.style.imageRendering).to.equal('pixelated');
  });

  it('clamps oversized dimensions to Display.MaxResolution', async () => {
    host = makeContainer({width: 100, height: 100});
    const oversized = Display.MaxResolution + 4096;

    // the warning goes out once per page, and the constructor's resize() is already the first
    // one past the limit — so the collector is in place before it runs
    const {warnings, restore} = collectWarnings(String(Display.MaxResolution));
    try {
      display = new Display(host, {
        resizeTo: () => [oversized, oversized],
      });

      await display.start();
      await nextFrame(display);
    } finally {
      restore();
    }

    expect(display.width).to.equal(Display.MaxResolution);
    expect(display.height).to.equal(Display.MaxResolution);

    expect(warnings.length, 'warnings about the resolution limit').to.equal(1);
    expect(warnings[0][0]).to.contain(`(${oversized}x${oversized} was requested)`);
  });

  it('a canvas with a border on top only keeps the full width of its host', async () => {
    host = makeContainer({width: 320, height: 200});
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.style.boxSizing = 'content-box';
    canvas.style.padding = '0';
    canvas.style.border = '0';
    canvas.style.borderTop = '4px solid black';
    host.appendChild(canvas);

    display = new Display(canvas, {resizeToElement: host});
    await display.start();
    await nextFrame(display);

    expect(display.width).to.equal(320);
    expect(display.height).to.equal(196);
  });

  it('an invalid resize-to selector warns once and measures the resizeToElement', async () => {
    host = makeContainer({width: 320, height: 200});
    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.setAttribute('resize-to', '!not-a-selector');
    host.appendChild(canvas);

    const {warnings, restore} = collectWarnings('resize-to');
    try {
      display = new Display(canvas, {resizeToElement: host});
      await display.start();
      await nextFrame(display);
      await nextFrame(display);
    } finally {
      restore();
    }

    expect(display.width).to.equal(320);
    expect(display.height).to.equal(200);
    expect(warnings.length, 'warnings about resize-to').to.equal(1);
  });

  it('a resize-to selector finds its element inside the shadow root the display lives in', async () => {
    host = makeContainer({width: 800, height: 600});
    const shadowRoot = host.attachShadow({mode: 'open'});

    const id = `display-resize-shadow-ref-${Math.random().toString(36).slice(2, 8)}`;
    makeSizeRef(shadowRoot, {id, width: 128, height: 64});

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.setAttribute('resize-to', `#${id}`);
    shadowRoot.appendChild(canvas);

    display = new Display(canvas, {styleSheetRoot: shadowRoot});
    await display.start();
    await nextFrame(display);

    expect(display.width).to.equal(128);
    expect(display.height).to.equal(64);
  });

  it('a resize-to selector follows its element when it is replaced', async () => {
    host = makeContainer({width: 800, height: 600});

    const id = `display-resize-replaced-ref-${Math.random().toString(36).slice(2, 8)}`;
    const first = makeSizeRef(document.body, {id, width: 128, height: 64});

    const canvas = document.createElement('canvas');
    canvas.style.display = 'block';
    canvas.setAttribute('resize-to', `#${id}`);
    host.appendChild(canvas);

    display = new Display(canvas);

    let second;
    try {
      await display.start();
      await nextFrame(display);

      expect(display.width).to.equal(128);
      expect(display.height).to.equal(64);

      first.remove();
      second = makeSizeRef(document.body, {id, width: 256, height: 32});
      await nextFrame(display);

      expect(display.width).to.equal(256);
      expect(display.height).to.equal(32);
    } finally {
      first.remove();
      second?.remove();
    }
  });

  it('runtime swap of resizeToElement is picked up on the next frame', async () => {
    host = makeContainer({width: 320, height: 200});
    const altRef = makeContainer({width: 96, height: 48, id: 'alt-ref'});

    display = new Display(host);
    await display.start();
    await nextFrame(display);

    expect(display.width).to.equal(320);
    expect(display.height).to.equal(200);

    display.resizeToElement = altRef;
    await nextFrame(display);
    await nextFrame(display);

    expect(display.width).to.equal(96);
    expect(display.height).to.equal(48);

    altRef.parentNode.removeChild(altRef);
  });

  it('emits OnDisplayResize exactly once on the first frame', async () => {
    host = makeContainer({width: 256, height: 128});
    display = new Display(host);

    const emitsByFrame = new Map();
    const onResize = (props) => {
      emitsByFrame.set(props.frameNo, (emitsByFrame.get(props.frameNo) ?? 0) + 1);
    };
    on(display, OnDisplayResize, onResize);

    await display.start();
    await nextFrame(display);
    await nextFrame(display);

    expect(emitsByFrame.get(1), 'frame 1 emits exactly once').to.equal(1);
    // Frame 2 may emit if the host element size settled differently between
    // frame 1 and frame 2, but it MUST NOT emit more than once.
    expect(emitsByFrame.get(2) ?? 0, 'frame 2 emits at most once').to.be.at.most(1);

    off(display, OnDisplayResize, onResize);
  });

  it('does not double-emit OnDisplayResize on the first frame when the size differs from construction', async () => {
    // The host CSS changes after construction and before start(), so the first frame measures a
    // size the constructor never saw — frame 1 nonetheless emits OnDisplayResize exactly once, with that size.
    host = makeContainer({width: 100, height: 100});
    display = new Display(host);

    host.style.width = '480px';
    host.style.height = '320px';

    const emits = [];
    on(display, OnDisplayResize, (props) => {
      emits.push({frameNo: props.frameNo, width: props.width, height: props.height});
    });

    await display.start();
    await nextFrame(display);

    const frame1Emits = emits.filter((e) => e.frameNo === 1);
    expect(frame1Emits.length, 'exactly one OnDisplayResize on frame 1').to.equal(1);
    expect(frame1Emits[0].width).to.equal(480);
    expect(frame1Emits[0].height).to.equal(320);
  });
});

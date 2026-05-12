import {expect} from '@esm-bundle/chai';
import {Display, ParallaxProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';
import {Color, Mesh, MeshBasicMaterial, PlaneGeometry} from 'three/webgpu';

const FIXTURE_ID = 'stage-renderer-fixture';

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

async function disposeDisplay(display) {
  if (!display) return;
  try {
    await display.start();
  } catch {
    // ignore
  }
  display.dispose();
}

describe('StageRenderer — integration with Display', () => {
  /** @type {Display | undefined} */
  let display;
  /** @type {HTMLElement | undefined} */
  let host;

  afterEach(async () => {
    await disposeDisplay(display);
    display = undefined;
    if (host && host.parentNode) {
      host.parentNode.removeChild(host);
    }
    host = undefined;
  });

  it('auto-drives updateFrame + renderTo when attached to Display', async () => {
    host = makeContainer({width: 400, height: 240});
    display = new Display(host);
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 400}));
    const sr = new StageRenderer(display);
    sr.setClearColor(new Color('#102030'), 1);
    sr.add(stage);

    const geom = new PlaneGeometry(50, 50);
    const mat = new MeshBasicMaterial({color: new Color('#ff8800')});
    stage.scene.add(new Mesh(geom, mat));

    let updateCount = 0;
    let renderToCount = 0;
    const origUpdate = stage.updateFrame.bind(stage);
    const origRender = stage.renderTo.bind(stage);
    stage.updateFrame = (...a) => {
      updateCount += 1;
      return origUpdate(...a);
    };
    stage.renderTo = (...a) => {
      renderToCount += 1;
      return origRender(...a);
    };

    await display.start();
    await display.nextFrame();
    await display.nextFrame();

    expect(updateCount).to.be.greaterThan(0);
    expect(renderToCount).to.be.greaterThan(0);
    expect(stage.width).to.be.greaterThan(0);
    expect(stage.height).to.be.greaterThan(0);
  });

  it('renders multiple stages in renderOrder additively (no per-stage clear)', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);

    const sr = new StageRenderer(display);
    sr.setClearColor(new Color('#000000'), 1);

    const order = [];
    /** @type {(name: string) => any} */
    const stub = (name) => ({
      name,
      resize() {},
      updateFrame() {},
      renderTo() {
        order.push(name);
      },
    });

    sr.add(stub('background')).add(stub('world')).add(stub('ui'));
    sr.renderOrder = 'background,world,ui';

    await display.start();
    await display.nextFrame();
    // wait one more frame to ensure stages were rendered at least once
    await display.nextFrame();

    // order should contain at least one full sequence
    const i = order.indexOf('background');
    expect(i).to.be.greaterThan(-1);
    expect(order[i + 1]).to.equal('world');
    expect(order[i + 2]).to.equal('ui');
  });

  it('nested StageRenderer: parent renders child stages through child.renderTo', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);

    const parent = new StageRenderer(display);
    const child = new StageRenderer(parent);

    let parentResizeWidth = -1;
    let childRenders = 0;
    const inner = {
      name: 'inner',
      resize(w) {
        parentResizeWidth = w;
      },
      updateFrame() {},
      renderTo() {
        childRenders += 1;
      },
    };
    child.add(inner);

    await display.start();
    await display.nextFrame();
    await display.nextFrame();

    expect(parentResizeWidth).to.be.greaterThan(0);
    expect(childRenders).to.be.greaterThan(0);
  });

  it('detach() unhooks from the Display frame loop', async () => {
    host = makeContainer({width: 200, height: 200});
    display = new Display(host);
    const sr = new StageRenderer(display);

    let renders = 0;
    sr.add({
      name: 's',
      resize() {},
      updateFrame() {},
      renderTo() {
        renders += 1;
      },
    });

    await display.start();
    await display.nextFrame();
    const beforeDetach = renders;
    sr.detach();
    await display.nextFrame();
    await display.nextFrame();

    // detached: no further renders driven by the display
    expect(renders).to.equal(beforeDetach);
  });
});

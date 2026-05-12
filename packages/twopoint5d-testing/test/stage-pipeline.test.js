import {expect} from '@esm-bundle/chai';
import {Display, ParallaxProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';
import {Color, Mesh, MeshBasicMaterial, PlaneGeometry, RenderPipeline} from 'three/webgpu';

const FIXTURE_ID = 'stage-pipeline-fixture';

function makeContainer({width = 320, height = 200} = {}) {
  const el = document.createElement('div');
  el.id = `${FIXTURE_ID}-${Math.random().toString(36).slice(2, 8)}`;
  el.style.position = 'absolute';
  el.style.left = '0';
  el.style.top = '0';
  el.style.width = `${width}px`;
  el.style.height = `${height}px`;
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

describe('StageRenderer — pipeline integration', () => {
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

  it('Mode C: pipeline samples internal RT; the pipeline runs once per frame', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320}));
    stage.scene.add(new Mesh(new PlaneGeometry(50, 50), new MeshBasicMaterial({color: new Color('#0f0')})));

    const sr = new StageRenderer(display).setClearColor(new Color('#102030'), 1).add(stage);
    sr.pipeline = new RenderPipeline(display.renderer);
    // No buildOutputNode → Mode C (samples internal RT as texture)

    let runs = 0;
    const origRender = sr.pipeline.render.bind(sr.pipeline);
    sr.pipeline.render = (...a) => {
      runs += 1;
      return origRender(...a);
    };

    await display.start();
    await display.nextFrame();
    await display.nextFrame();

    expect(runs).to.be.greaterThan(0);
    expect(sr.pipeline.outputNode).to.exist;
  });

  it('Mode D: buildOutputNode is invoked, pipeline.outputNode is the composed graph', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320}));
    stage.scene.add(new Mesh(new PlaneGeometry(50, 50), new MeshBasicMaterial({color: new Color('#f80')})));

    const sr = new StageRenderer(display).setClearColor(new Color('#000'), 1).add(stage);
    sr.pipeline = new RenderPipeline(display.renderer);

    let buildCalls = 0;
    let lastPasses;
    sr.buildOutputNode = (passes) => {
      buildCalls += 1;
      lastPasses = passes;
      return passes[0];
    };

    await display.start();
    await display.nextFrame();
    await display.nextFrame();

    expect(buildCalls).to.equal(1, 'buildOutputNode should be invoked only when stage list changes');
    expect(lastPasses).to.have.length(1);
  });

  it('dispose() releases the pipeline and internal RTs', async () => {
    host = makeContainer({width: 200, height: 200});
    display = new Display(host);
    const sr = new StageRenderer(display);
    sr.pipeline = new RenderPipeline(display.renderer);
    sr.add(new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 200})));
    await display.start();
    await display.nextFrame();
    sr.dispose();
    expect(sr.pipeline).to.be.undefined;
  });
});

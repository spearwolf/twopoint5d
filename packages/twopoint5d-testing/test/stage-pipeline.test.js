import {expect} from '@esm-bundle/chai';
import {Display, ParallaxProjection, Stage2D, StageRenderer} from '@spearwolf/twopoint5d';
import {Color, Mesh, MeshBasicMaterial, PlaneGeometry, RenderPipeline} from 'three/webgpu';
import {stopAndDrain} from './support/stopAndDrain.js';

/** @import {PassNode} from 'three/webgpu' */

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
  await stopAndDrain(display);
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
    /** @type {PassNode[] | undefined} */
    let lastPasses;
    sr.buildOutputNode = (passes) => {
      buildCalls += 1;
      lastPasses = /** @type {PassNode[]} */ (passes);
      return passes[0];
    };

    await display.start();
    await display.nextFrame();
    await display.nextFrame();

    expect(buildCalls).to.equal(1, 'buildOutputNode runs once while nothing it composes changes');
    expect(lastPasses).to.have.length(1);
  });

  it('Mode D: swapping the stage projection after the first frame rebuilds the output node through the new camera', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320}));
    stage.scene.add(new Mesh(new PlaneGeometry(50, 50), new MeshBasicMaterial({color: new Color('#f80')})));

    const sr = new StageRenderer(display).setClearColor(new Color('#000'), 1).add(stage);
    sr.pipeline = new RenderPipeline(display.renderer);

    let buildCalls = 0;
    /** @type {PassNode[] | undefined} */
    let lastPasses;
    sr.buildOutputNode = (passes) => {
      buildCalls += 1;
      lastPasses = /** @type {PassNode[]} */ (passes);
      return passes[0];
    };

    await display.start();
    await display.nextFrame();
    await display.nextFrame();

    expect(buildCalls).to.equal(1);

    stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 160});
    await display.nextFrame();

    expect(buildCalls, 'the new camera needs a new pass node').to.equal(2);
    expect(lastPasses[0].camera, 'the pass node renders through the camera of the new projection').to.equal(stage.camera);
  });

  it('Mode D: a rebuild without a camera change keeps the pass node and its render target', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320}));
    stage.scene.add(new Mesh(new PlaneGeometry(50, 50), new MeshBasicMaterial({color: new Color('#f80')})));

    const sr = new StageRenderer(display).setClearColor(new Color('#000'), 1).add(stage);
    sr.pipeline = new RenderPipeline(display.renderer);

    let buildCalls = 0;
    /** @type {PassNode[] | undefined} */
    let lastPasses;
    sr.buildOutputNode = (passes) => {
      buildCalls += 1;
      lastPasses = /** @type {PassNode[]} */ (passes);
      return passes[0];
    };

    await display.start();
    await display.nextFrame();
    await display.nextFrame();

    expect(buildCalls).to.equal(1);
    const passNode = lastPasses[0];
    const renderTarget = passNode.renderTarget;

    sr.invalidateOutputNode();
    await display.nextFrame();

    expect(buildCalls, 'the output node is composed again').to.equal(2);
    expect(lastPasses[0], 'the same scene through the same camera is the same pass node').to.equal(passNode);
    expect(lastPasses[0].renderTarget, 'and so no second render target was allocated').to.equal(renderTarget);
  });

  it('stage.dispose() releases the render target of its pass node and closes the stage', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320}));
    stage.scene.add(new Mesh(new PlaneGeometry(50, 50), new MeshBasicMaterial({color: new Color('#08f')})));

    const sr = new StageRenderer(display).setClearColor(new Color('#000'), 1).add(stage);
    const pipeline = new RenderPipeline(display.renderer);
    sr.pipeline = pipeline;
    sr.buildOutputNode = (passes) => passes[0];

    await display.start();
    await display.nextFrame();

    const renderTarget = /** @type {PassNode} */ (stage.asPassNode(display.renderer)).renderTarget;
    let disposeCalls = 0;
    const origDispose = renderTarget.dispose.bind(renderTarget);
    renderTarget.dispose = (...a) => {
      disposeCalls += 1;
      return origDispose(...a);
    };

    // the renderer composed the pass node into its output and is driven by the display: it lets go
    // of the stage before the stage gives the node up, so no frame reaches a released render target
    sr.dispose();
    stage.dispose();

    expect(disposeCalls, 'the stage gives up the render target it allocated').to.equal(1);
    expect(() => stage.asPassNode(display.renderer), 'and builds no further pass node').to.throw();

    // the pipeline was handed to the renderer and belongs to this test
    pipeline.dispose();
  });

  it('Mode C: a replaced pipeline takes over the output', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);
    const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320}));
    stage.scene.add(new Mesh(new PlaneGeometry(50, 50), new MeshBasicMaterial({color: new Color('#0f0')})));

    const sr = new StageRenderer(display).setClearColor(new Color('#102030'), 1).add(stage);
    const first = new RenderPipeline(display.renderer);
    sr.pipeline = first;

    await display.start();
    await display.nextFrame();
    await display.nextFrame();

    const next = new RenderPipeline(display.renderer);
    // a fresh pipeline carries a placeholder output of its own
    const placeholder = next.outputNode;
    let runs = 0;
    const origRender = next.render.bind(next);
    next.render = (...a) => {
      runs += 1;
      return origRender(...a);
    };
    sr.pipeline = next;

    await display.nextFrame();

    expect(next.outputNode).to.exist;
    expect(next.outputNode, 'the replaced pipeline carries the output node of the renderer').to.not.equal(placeholder);
    expect(runs).to.be.greaterThan(0);

    // both pipelines belong to this test: the renderer lets go first, then they are released
    sr.dispose();
    first.dispose();
    next.dispose();
  });

  it('dispose() drops the pipeline reference and leaves the pipeline itself to its owner', async () => {
    host = makeContainer({width: 200, height: 200});
    display = new Display(host);
    const sr = new StageRenderer(display);
    const pipeline = new RenderPipeline(display.renderer);
    sr.pipeline = pipeline;
    sr.add(new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 200})));
    await display.start();
    await display.nextFrame();

    let disposeCalls = 0;
    const origDispose = pipeline.dispose.bind(pipeline);
    pipeline.dispose = (...a) => {
      disposeCalls += 1;
      return origDispose(...a);
    };

    sr.dispose();

    expect(sr.pipeline).to.be.undefined;
    expect(disposeCalls, 'the renderer does not dispose a pipeline it was handed').to.equal(0);

    // the owner disposes it, and the pipeline is still there to take the call
    pipeline.dispose();
    expect(disposeCalls).to.equal(1);
  });
});

import {expect} from '@esm-bundle/chai';
import {
  Display,
  OrthographicProjection,
  ParallaxProjection,
  RootRenderPipeline,
  Stage2D,
  StageRenderer,
} from '@spearwolf/twopoint5d';
import {Color, Mesh, MeshBasicMaterial, PlaneGeometry, RenderPipeline, RenderTarget} from 'three/webgpu';
import {makeContainer, disposeDisplay, isNearColor, rgbAt} from './helpers/fixtures.js';

/** @import {PassNode} from 'three/webgpu' */

describe('StageRenderer — pipeline integration', () => {
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

  it('a nested StageRenderer without a pipeline shows only the content of the current frame', async () => {
    host = makeContainer({width: 64, height: 64});
    display = new Display(host);
    await display.start();

    // 64 pixels wide: rgbAt() reads the rows at that length
    const target = new RenderTarget(64, 64);
    // no specs: 64 x 64 units on 64 x 64 pixels, the camera centred on the origin
    const stage = new Stage2D(new OrthographicProjection('xy|bottom-left'));
    const geometry = new PlaneGeometry(16, 16);
    const material = new MeshBasicMaterial({color: new Color('#0f0')});
    const mesh = new Mesh(geometry, material);
    mesh.position.x = -16;
    stage.scene.add(mesh);

    // driven by hand, no host: the child keeps clear = false and has no pipeline of its own
    const child = new StageRenderer().add(stage);
    const root = new StageRenderer().add(child);
    const pipeline = new RootRenderPipeline(display.renderer);
    root.pipeline = pipeline;
    root.outputRenderTarget = target;
    root.resize(64, 64);

    root.renderTo(display.renderer);
    const first = await display.renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);

    mesh.position.x = 16;
    root.renderTo(display.renderer);
    const second = await display.renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);

    // pure green and black, so the color transform of the pipeline does not shift the result
    expect(isNearColor(rgbAt(first, 64, 16, 32), [0, 255, 0]), 'the content in the first frame').to.be.true;
    expect(isNearColor(rgbAt(second, 64, 16, 32), [0, 0, 0]), 'where the content stood a frame before').to.be.true;
    expect(isNearColor(rgbAt(second, 64, 48, 32), [0, 255, 0]), 'the content in the second frame').to.be.true;

    // the pipeline and the target belong to this test: the renderers let go first
    root.dispose();
    child.dispose();
    stage.dispose();
    pipeline.dispose();
    target.dispose();
    geometry.dispose();
    material.dispose();
  });

  /**
   * Draws a mid-gray square through a child with a pipeline of its own under `root`, into a
   * 64 x 64 target, and answers the pixel in its middle. The gray is linear 0.216: encoded to
   * sRGB once it reads 128, encoded twice about 187.
   *
   * @param {(renderer: import('three/webgpu').WebGPURenderer) => RenderPipeline} makeRootPipeline
   * @param {boolean} childComposes whether the child composes its pass through `buildOutputNode`
   */
  async function grayThroughNestedPipeline(makeRootPipeline, childComposes) {
    host = makeContainer({width: 64, height: 64});
    display = new Display(host);
    await display.start();
    const renderer = display.renderer;

    const target = new RenderTarget(64, 64);
    const stage = new Stage2D(new OrthographicProjection('xy|bottom-left'));
    const geometry = new PlaneGeometry(32, 32);
    const material = new MeshBasicMaterial({color: new Color('#808080')});
    stage.scene.add(new Mesh(geometry, material));

    const child = new StageRenderer().add(stage);
    const childPipeline = new RenderPipeline(renderer);
    child.pipeline = childPipeline;
    if (childComposes) child.buildOutputNode = ([p]) => p;

    const root = new StageRenderer().add(child);
    const rootPipeline = makeRootPipeline(renderer);
    root.pipeline = rootPipeline;
    root.outputRenderTarget = target;
    root.resize(64, 64);

    root.renderTo(renderer);
    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);

    root.dispose();
    child.dispose();
    stage.dispose();
    rootPipeline.dispose();
    childPipeline.dispose();
    target.dispose();
    geometry.dispose();
    material.dispose();

    return rgbAt(pixels, 64, 32, 32);
  }

  it('Mode E: a nested pipeline under a composing root applies the output transform once', async () => {
    const rgb = await grayThroughNestedPipeline((renderer) => new RootRenderPipeline(renderer), true);
    expect(isNearColor(rgb, [128, 128, 128], 3), `mid-gray encoded once, got ${rgb}`).to.be.true;
  });

  it('Mode C: a nested pipeline under a pipeline-only root applies the output transform once', async () => {
    const rgb = await grayThroughNestedPipeline((renderer) => new RenderPipeline(renderer), false);
    expect(isNearColor(rgb, [128, 128, 128], 3), `mid-gray encoded once, got ${rgb}`).to.be.true;
  });

  it('Mode C without clear leaves no tint of the renderer clear color in its internal target', async () => {
    host = makeContainer({width: 64, height: 64});
    // a WebGPU clear premultiplies its color only for a renderer with alpha: without it, a clear
    // at alpha 0 keeps the RGB of the clear color. The WebGL2 backend premultiplies always.
    display = new Display(host, {alpha: false});
    await display.start();
    const renderer = display.renderer;
    renderer.setClearColor(new Color('#f00'), 1);

    const target = new RenderTarget(64, 64);
    const stage = new Stage2D(new OrthographicProjection('xy|bottom-left'));
    const geometry = new PlaneGeometry(16, 16);
    const material = new MeshBasicMaterial({color: new Color('#0f0')});
    const mesh = new Mesh(geometry, material);
    mesh.position.x = -16;
    stage.scene.add(mesh);

    const root = new StageRenderer().add(stage);
    const pipeline = new RenderPipeline(renderer);
    // without the output transform the pipeline hands the RGB of the internal target through as
    // it is, whatever its alpha
    pipeline.outputColorTransform = false;
    root.pipeline = pipeline;
    root.outputRenderTarget = target;
    root.resize(64, 64);

    root.renderTo(renderer);
    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);

    const rgb = rgbAt(pixels, 64, 48, 32);
    expect(isNearColor(rgb, [0, 0, 0]), `where no stage draws, got ${rgb}`).to.be.true;

    root.dispose();
    stage.dispose();
    pipeline.dispose();
    target.dispose();
    geometry.dispose();
    material.dispose();
  });

  it('Mode C with a clear that leaves out the color buffer shows only the content of the current frame', async () => {
    host = makeContainer({width: 64, height: 64});
    display = new Display(host);
    await display.start();
    const renderer = display.renderer;

    const target = new RenderTarget(64, 64);
    const stage = new Stage2D(new OrthographicProjection('xy|bottom-left'));
    const geometry = new PlaneGeometry(16, 16);
    const material = new MeshBasicMaterial({color: new Color('#0f0')});
    const mesh = new Mesh(geometry, material);
    mesh.position.x = -16;
    stage.scene.add(mesh);

    const root = new StageRenderer().setClearColor(new Color('#000'), 1).add(stage);
    root.clearColorBuffer = false;
    const pipeline = new RenderPipeline(renderer);
    root.pipeline = pipeline;
    root.outputRenderTarget = target;
    root.resize(64, 64);

    root.renderTo(renderer);
    const first = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);

    mesh.position.x = 16;
    root.renderTo(renderer);
    const second = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);

    // pure green and black, so the color transform of the pipeline does not shift the result
    expect(isNearColor(rgbAt(first, 64, 16, 32), [0, 255, 0]), 'the content in the first frame').to.be.true;
    expect(isNearColor(rgbAt(second, 64, 16, 32), [0, 0, 0]), 'where the content stood a frame before').to.be.true;
    expect(isNearColor(rgbAt(second, 64, 48, 32), [0, 255, 0]), 'the content in the second frame').to.be.true;

    root.dispose();
    stage.dispose();
    pipeline.dispose();
    target.dispose();
    geometry.dispose();
    material.dispose();
  });

  it('the internal targets have the output buffer type and the samples of the renderer', async () => {
    host = makeContainer({width: 64, height: 64});
    display = new Display(host);
    await display.start();
    const renderer = display.renderer;

    /** @type {RenderTarget | null} */
    let captured = null;
    const stage = {
      name: 'capture',
      resize() {},
      updateFrame() {},
      /** @param {import('three/webgpu').WebGPURenderer} r */
      renderTo(r) {
        captured = r.getRenderTarget();
      },
    };

    const sr = new StageRenderer().add(stage);
    const pipeline = new RenderPipeline(renderer);
    sr.pipeline = pipeline;
    sr.resize(64, 64);
    sr.renderTo(renderer);

    const internalRT = /** @type {RenderTarget} */ (/** @type {unknown} */ (captured));
    expect(internalRT, 'the stage draws into the internal target').to.exist;
    expect(internalRT.samples, 'internal target samples').to.equal(renderer.samples);
    expect(internalRT.texture.type, 'internal target type').to.equal(renderer.getOutputBufferType());

    const passRT = /** @type {any} */ (sr.asPassNode(renderer)).value.renderTarget;
    expect(passRT.samples, 'pass target samples').to.equal(renderer.samples);
    expect(passRT.texture.type, 'pass target type').to.equal(renderer.getOutputBufferType());

    sr.dispose();
    pipeline.dispose();
  });
});

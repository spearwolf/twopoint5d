import {expect} from '@esm-bundle/chai';
import {
  createBloomOutputNodeBuilder,
  Display,
  OrthographicProjection,
  ParallaxProjection,
  RootRenderPipeline,
  Stage2D,
  StageRenderer,
  StageRenderTargetPool,
} from '@spearwolf/twopoint5d';
import {Color, Mesh, MeshBasicMaterial, PlaneGeometry, RenderPipeline, RenderTarget, Scene} from 'three/webgpu';
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

  it('Mode D: swapping the stage scene after the first frame rebuilds the output node for the new scene', async () => {
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

    const scene = new Scene();
    scene.add(new Mesh(new PlaneGeometry(50, 50), new MeshBasicMaterial({color: new Color('#08f')})));
    stage.scene = scene;
    await display.nextFrame();

    expect(buildCalls, 'the new scene needs a new pass node').to.equal(2);
    expect(lastPasses[0].scene, 'the pass node renders the new scene').to.equal(stage.scene);
  });

  it('Mode D: a stage disposed while the renderer holds it leaves the renderer, and the next frame composes the stages that are left', async () => {
    host = makeContainer({width: 320, height: 200});
    display = new Display(host);
    const first = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320}));
    first.name = 'first';
    first.scene.add(new Mesh(new PlaneGeometry(50, 50), new MeshBasicMaterial({color: new Color('#f80')})));
    const second = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 320}));
    second.name = 'second';
    second.scene.add(new Mesh(new PlaneGeometry(50, 50), new MeshBasicMaterial({color: new Color('#08f')})));

    const sr = new StageRenderer(display).setClearColor(new Color('#000'), 1).add(first).add(second);
    const pipeline = new RenderPipeline(display.renderer);
    sr.pipeline = pipeline;

    /** @type {PassNode[][]} */
    const calls = [];
    sr.buildOutputNode = (passes) => {
      calls.push(/** @type {PassNode[]} */ (passes));
      return passes[0];
    };

    await display.start();
    await display.nextFrame();
    await display.nextFrame();

    expect(calls).to.have.length(1);
    expect(calls[0]).to.have.length(2);

    second.dispose();

    expect(sr.hasStage(second), 'the renderer let go of the disposed stage').to.be.false;

    await display.nextFrame();

    expect(calls, 'the output node is composed again').to.have.length(2);
    expect(calls[1], 'from the stage that is left').to.have.length(1);
    expect(calls[1][0], 'the pass node of the first stage').to.equal(first.asPassNode(display.renderer));

    // the pipeline and the stages belong to this test: the renderer lets go first
    sr.dispose();
    first.dispose();
    pipeline.dispose();
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
   * A 16 x 16 square on black in a 64 x 64 target, drawn by a renderer without a host through
   * a `RenderPipeline` and the `buildOutputNode` `makeBuild` answers.
   *
   * @param {() => import('@spearwolf/twopoint5d').StageRendererBuildOutputNode & {dispose?: () => void}} makeBuild
   * @param {(ctx: {sr: StageRenderer, target: RenderTarget, renderer: import('three/webgpu').WebGPURenderer}) => Promise<void>} run
   * @param {string} [color] the color of the square, white by default
   */
  async function withSquare(makeBuild, run, color = '#fff') {
    // a display of its own, released here: a test that calls this twice must not leave the first one to
    // the afterEach of the suite, which knows only the last one
    const squareHost = makeContainer({width: 64, height: 64});
    const squareDisplay = new Display(squareHost);
    await squareDisplay.start();
    const renderer = squareDisplay.renderer;

    const target = new RenderTarget(64, 64);
    const stage = new Stage2D(new OrthographicProjection('xy|bottom-left'));
    const geometry = new PlaneGeometry(16, 16);
    const material = new MeshBasicMaterial({color: new Color(color)});
    stage.scene.add(new Mesh(geometry, material));

    const sr = new StageRenderer().setClearColor(new Color('#000'), 1).add(stage);
    const pipeline = new RenderPipeline(renderer);
    const build = makeBuild();
    sr.pipeline = pipeline;
    sr.buildOutputNode = build;
    sr.outputRenderTarget = target;
    sr.resize(64, 64);

    try {
      await run({sr, target, renderer});
    } finally {
      // the renderer lets go first, then the builder, the stage, the pipeline and the rest, the display last
      sr.dispose();
      build.dispose?.();
      stage.dispose();
      pipeline.dispose();
      target.dispose();
      geometry.dispose();
      material.dispose();
      disposeDisplay(squareDisplay);
      squareHost.remove();
    }
  }

  it('Mode D: createBloomOutputNodeBuilder() keeps the stage and lays a glow around what is bright', async () => {
    const readProbe = async () => {
      let pixels;
      await withSquare(
        () => createBloomOutputNodeBuilder({strength: 1, radius: 0, threshold: 0}),
        async ({sr, target, renderer}) => {
          sr.renderTo(renderer);
          pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);
        },
      );
      return pixels;
    };
    const withBloom = await readProbe();

    let control;
    await withSquare(
      () =>
        ([pass]) =>
          pass,
      async ({sr, target, renderer}) => {
        sr.renderTo(renderer);
        control = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);
      },
    );

    const center = rgbAt(withBloom, 64, 32, 32);
    const probe = rgbAt(withBloom, 64, 46, 32);
    const controlProbe = rgbAt(control, 64, 46, 32);

    // measured under Chromium and Firefox, both on the WebGL2 backend: center 255, probe 116, control 0 —
    // the threshold sits well below the glow and far above the control
    expect(isNearColor(center, [255, 255, 255], 8), 'the stage stands in the output').to.be.true;
    expect(probe[0], 'a glow 6 px outside the edge of the square').to.be.above(60);
    expect(isNearColor(controlProbe, [0, 0, 0]), 'the same point without the builder').to.be.true;
  });

  it('Mode D: createBloomOutputNodeBuilder() draws what stays below its threshold as the stage draws it', async () => {
    let pixels;
    await withSquare(
      () => createBloomOutputNodeBuilder({strength: 1, radius: 0, threshold: 0.9}),
      async ({sr, target, renderer}) => {
        sr.renderTo(renderer);
        pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);
      },
      '#808080',
    );

    // linear 0.216 is far below the threshold, so no glow is added and the composition alone stands
    // in the output: encoded to sRGB once it reads 128
    expect(isNearColor(rgbAt(pixels, 64, 32, 32), [128, 128, 128], 4), 'the middle of the square').to.be.true;
    expect(isNearColor(rgbAt(pixels, 64, 46, 32), [0, 0, 0]), 'six pixels outside its edge').to.be.true;
  });

  it('Mode D: a rebuild through createBloomOutputNodeBuilder() leaves the texture count of the renderer where the first build left it', async () => {
    await withSquare(
      () => createBloomOutputNodeBuilder({strength: 1, radius: 0, threshold: 0}),
      async ({sr, renderer}) => {
        sr.renderTo(renderer);
        const texturesAfterFirstBuild = renderer.info.memory.textures;

        sr.invalidateOutputNode();
        sr.renderTo(renderer);

        expect(renderer.info.memory.textures).to.equal(texturesAfterFirstBuild);
      },
    );
  });

  /**
   * Draws a mid-gray square through a child with a pipeline of its own under `root`, into a
   * 64 x 64 target, and answers the pixel in its middle. The gray is linear 0.216: encoded to
   * sRGB once it reads 128, encoded twice about 187.
   *
   * @param {(renderer: import('three/webgpu').WebGPURenderer) => RenderPipeline} makeRootPipeline
   * @param {boolean} childComposes whether the child composes its pass through `buildOutputNode`
   * @param {StageRenderTargetPool} [pool] set as `internalTargetPool` on the child and the root
   */
  async function grayThroughNestedPipeline(makeRootPipeline, childComposes, pool) {
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
    if (pool) {
      child.internalTargetPool = pool;
      root.internalTargetPool = pool;
    }

    root.renderTo(renderer);
    const pixels = await renderer.readRenderTargetPixelsAsync(target, 0, 0, 64, 64);

    root.dispose();
    child.dispose();
    pool?.dispose();
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

  it('Mode C: a nested pipeline under a pipeline-only root, both on one StageRenderTargetPool, applies the output transform once', async () => {
    const rgb = await grayThroughNestedPipeline((renderer) => new RenderPipeline(renderer), false, new StageRenderTargetPool());
    expect(isNearColor(rgb, [128, 128, 128], 3), `mid-gray encoded once, got ${rgb}`).to.be.true;
  });

  it('Mode C: two renderers of the same size on one StageRenderTargetPool draw through one internal target, each only its own stages', async () => {
    host = makeContainer({width: 64, height: 64});
    display = new Display(host);
    await display.start();
    const renderer = display.renderer;

    const geometry = new PlaneGeometry(16, 16);
    const material = new MeshBasicMaterial({color: new Color('#0f0')});
    const pool = new StageRenderTargetPool();

    /**
     * A renderer with a pipeline of its own and a green square at `x`, and the targets its stages
     * were drawn into.
     *
     * @param {number} x
     */
    const makeRenderer = (x) => {
      const stage = new Stage2D(new OrthographicProjection('xy|bottom-left'));
      const mesh = new Mesh(geometry, material);
      mesh.position.x = x;
      stage.scene.add(mesh);

      /** @type {unknown[]} */
      const seen = [];
      const capture = {
        name: 'capture',
        resize() {},
        updateFrame() {},
        /** @param {import('three/webgpu').WebGPURenderer} r */
        renderTo(r) {
          seen.push(r.getRenderTarget());
        },
      };

      const target = new RenderTarget(64, 64);
      const pipeline = new RenderPipeline(renderer);
      const sr = new StageRenderer().add(stage).add(capture);
      sr.pipeline = pipeline;
      sr.outputRenderTarget = target;
      sr.internalTargetPool = pool;
      sr.resize(64, 64);
      return {sr, stage, pipeline, target, seen};
    };

    const a = makeRenderer(-16);
    const b = makeRenderer(16);

    // two frames by hand, the renderers one after another
    a.sr.renderTo(renderer);
    b.sr.renderTo(renderer);
    a.sr.renderTo(renderer);
    b.sr.renderTo(renderer);

    const pixelsA = await renderer.readRenderTargetPixelsAsync(a.target, 0, 0, 64, 64);
    const pixelsB = await renderer.readRenderTargetPixelsAsync(b.target, 0, 0, 64, 64);

    const internalRT = a.seen[0];
    expect(internalRT, 'the stages draw into an internal target').to.exist;
    expect(a.seen, 'a draws once per frame').to.have.length(2);
    expect(b.seen, 'b draws once per frame').to.have.length(2);
    // by identity: a deep comparison would take two targets of the same size for one
    for (const [who, seen] of /** @type {const} */ ([
      ['a', a.seen],
      ['b', b.seen],
    ])) {
      seen.forEach((rt, frame) => expect(rt === internalRT, `${who} in frame ${frame + 1}`).to.be.true);
    }

    // pure green and black, so the color transform of the pipeline does not shift the result
    expect(isNearColor(rgbAt(pixelsA, 64, 16, 32), [0, 255, 0]), 'the square of a in a').to.be.true;
    expect(isNearColor(rgbAt(pixelsA, 64, 48, 32), [0, 0, 0]), 'nothing of b in a').to.be.true;
    expect(isNearColor(rgbAt(pixelsB, 64, 16, 32), [0, 0, 0]), 'nothing of a in b').to.be.true;
    expect(isNearColor(rgbAt(pixelsB, 64, 48, 32), [0, 255, 0]), 'the square of b in b').to.be.true;

    // the renderers let go first, then the pool and what else belongs to this test
    a.sr.dispose();
    b.sr.dispose();
    pool.dispose();
    for (const {stage, pipeline, target} of [a, b]) {
      stage.dispose();
      pipeline.dispose();
      target.dispose();
    }
    geometry.dispose();
    material.dispose();
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

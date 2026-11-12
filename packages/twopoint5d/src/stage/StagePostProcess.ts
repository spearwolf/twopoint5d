import {pass} from 'three/tsl';
import {
  type Camera,
  Color,
  ColorManagement,
  type Node,
  NoToneMapping,
  type PassNode,
  RenderPipeline,
  type Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import {describeValue} from '../utils/describeValue.js';
import {throwCollected} from '../utils/throwCollected.js';
import type {Stage2D} from './Stage2D.js';

/** What a `Stage2D` hands the `build()` of its post-process. */
export interface StagePostProcessInput {
  /** The stage the node is built for. */
  stage: Stage2D;

  /**
   * The scene pass of the stage: a `PassNode` over its scene and its camera, made for this build
   * alone. `build()` may configure it — `setMRT()`, `setLayers()`, `setResolutionScale()` —, and
   * nothing of that reaches the pass node the stage hands out without a post-process. A new scene
   * or camera of the stage goes into it as it is assigned.
   */
  pass: PassNode;

  /**
   * Registers a function that releases what the build made on the GPU — a `bloom()` and every
   * other node that owns render targets. The stage calls every registered function once, in the
   * order they were registered, as soon as it lets go of the node: on an assignment to
   * `postProcess`, and in its `dispose()`. A function registered after that runs at once. Throws
   * a `TypeError` for anything that is no function.
   */
  onDispose(release: () => void): void;
}

/**
 * A post-process of a `Stage2D`, assigned to `Stage2D#postProcess`: a TSL function from the scene
 * pass of the stage to the picture the stage draws. See "An effect on one stage" in
 * `docs/stages.md`.
 *
 * It is a description: `build()` makes new nodes on every call, and the object keeps nothing of a
 * build. So one object serves every stage it is assigned to, and it belongs to the caller — a
 * stage never disposes it, and releases what a build made through
 * {@link StagePostProcessInput.onDispose}.
 */
export interface StagePostProcess {
  /**
   * Answers the output node of the stage: a color with premultiplied alpha, as the pass gives it.
   * A stage calls it once per assignment, before the first draw that needs the node.
   */
  build(input: StagePostProcessInput): Node;
}

const TRANSPARENT_BLACK = new Color(0x000000);

/**
 * What a `Stage2D` holds for the post-process assigned to it: the pass and the output node of its
 * build, the releases the build registered and the pipeline `Stage2D#renderTo()` runs. Made with
 * the assignment, filled by the first draw, released whole by the next assignment or by the
 * dispose of the stage. Internal to the stage module.
 */
export class StagePostProcessRun {
  readonly postProcess: StagePostProcess;

  #pass?: PassNode;
  #node?: Node;
  #pipeline?: RenderPipeline;
  #releases: (() => void)[] = [];
  #released = false;

  // the clear color of the caller during a draw, so that no frame allocates one
  readonly #callerClearColor = new Color();

  constructor(postProcess: StagePostProcess) {
    this.postProcess = postProcess;
  }

  readonly #onDispose = (release: () => void): void => {
    if (typeof release !== 'function') {
      throw new TypeError(`StagePostProcessInput#onDispose(): release must be a function, got ${describeValue(release)}`);
    }
    if (this.#released) release();
    else this.#releases.push(release);
  };

  /**
   * The output node of the build, built on the first call. A build that throws, answers no node,
   * or has the stage let go of this run while it runs, leaves nothing behind — what it registered
   * is released, its pass disposed — and the next call builds again.
   */
  outputNode(stage: Stage2D, scene: Scene, camera: Camera): Node {
    if (this.#node !== undefined) return this.#node;

    const scenePass = pass(scene, camera);
    let node: Node;
    try {
      node = this.postProcess.build({stage, pass: scenePass, onDispose: this.#onDispose});
      // a build() that assigned postProcess, or disposed the stage, has had this run released under
      // it: the node it answers is one nobody would release again
      if (this.#released) {
        throw new Error(
          'Stage2D#postProcess: the stage let go of this post-process while its build() ran: a build() neither assigns postProcess nor disposes the stage',
        );
      }
      if ((node as Partial<Node> | null | undefined)?.isNode !== true) {
        throw new TypeError(`Stage2D#postProcess: build() must answer a node, got ${describeValue(node)}`);
      }
    } catch (error) {
      const errors: unknown[] = [error];
      this.#runReleases(errors);
      try {
        scenePass.dispose();
      } catch (disposeError) {
        errors.push(disposeError);
      }
      throwCollected(errors, 'Stage2D#postProcess: build() failed, and so did the release of what it had made');
      throw error;
    }

    this.#pass = scenePass;
    this.#node = node;
    return node;
  }

  /** A new scene of the stage, for the pass of a build that stands. */
  setScene(scene: Scene): void {
    if (this.#pass !== undefined) this.#pass.scene = scene;
  }

  /** A new camera of the stage, for the pass of a build that stands. */
  setCamera(camera: Camera): void {
    if (this.#pass !== undefined) this.#pass.camera = camera;
  }

  /**
   * Draws the stage with its post-process into the current target of `renderer`, through a
   * pipeline built for that renderer.
   *
   * three.js' RenderPipeline bakes the tone mapping and the output color space of the renderer
   * into its quad whatever target it draws into, while a plain renderer.render() writes linear
   * into a render target: with a render target set, the renderer is switched to linear output for
   * the draw, so the stage writes there what it writes without a post-process. On the canvas, and
   * into the output render target of the renderer, the pipeline applies the transform of the
   * renderer, as three.js does for a plain draw there.
   *
   * The pass clears its target with the clear color of the renderer, which is transparent black
   * for the draw: where the scene of the stage draws nothing, its picture is transparent.
   *
   * The quad of the pipeline covers every pixel of the current target, and it clears color and
   * depth of that target first — `renderer.autoClear` is on for the draw, whatever the caller
   * set: against a depth an earlier draw left there, the quad would fail its depth test under
   * WebGL 2 and leave that draw standing.
   */
  render(renderer: WebGPURenderer, stage: Stage2D, scene: Scene, camera: Camera): void {
    const node = this.outputNode(stage, scene, camera);

    let pipeline = this.#pipeline;
    if (pipeline === undefined || pipeline.renderer !== renderer) {
      pipeline?.dispose();
      pipeline = new RenderPipeline(renderer, node);
      this.#pipeline = pipeline;
    }

    const toneMapping = renderer.toneMapping;
    const outputColorSpace = renderer.outputColorSpace;
    const clearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(this.#callerClearColor);
    const autoClear = renderer.autoClear;
    const autoClearColor = renderer.autoClearColor;
    const autoClearDepth = renderer.autoClearDepth;

    const target = renderer.getRenderTarget();
    if (target !== null && target !== renderer.getOutputRenderTarget()) {
      renderer.toneMapping = NoToneMapping;
      renderer.outputColorSpace = ColorManagement.workingColorSpace;
    }
    renderer.setClearColor(TRANSPARENT_BLACK, 0);
    renderer.autoClear = true;
    renderer.autoClearColor = true;
    renderer.autoClearDepth = true;
    try {
      pipeline.render();
    } finally {
      renderer.autoClear = autoClear;
      renderer.autoClearColor = autoClearColor;
      renderer.autoClearDepth = autoClearDepth;
      renderer.setClearColor(this.#callerClearColor, clearAlpha);
      renderer.toneMapping = toneMapping;
      renderer.outputColorSpace = outputColorSpace;
    }
  }

  /** Releases the GPU memory of the render target of the pass; three.js allocates it again on the next draw. */
  releaseMemory(): void {
    this.#pass?.renderTarget.dispose();
  }

  /**
   * Lets go of the build: the releases it registered, then the pipeline and the pass. A call that
   * throws holds up none of the others; what they threw goes into `errors`.
   */
  dispose(errors: unknown[]): void {
    if (this.#released) return;
    this.#released = true;

    this.#runReleases(errors);
    try {
      this.#pipeline?.dispose();
    } catch (error) {
      errors.push(error);
    }
    this.#pipeline = undefined;
    try {
      this.#pass?.dispose();
    } catch (error) {
      errors.push(error);
    }
    this.#pass = undefined;
    this.#node = undefined;
  }

  #runReleases(errors: unknown[]): void {
    const releases = this.#releases;
    this.#releases = [];
    for (const release of releases) {
      try {
        release();
      } catch (error) {
        errors.push(error);
      }
    }
  }
}

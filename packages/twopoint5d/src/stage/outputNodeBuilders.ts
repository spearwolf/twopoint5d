import {bloom} from 'three/examples/jsm/tsl/display/BloomNode.js';
import type {Node} from 'three/webgpu';
import {RootRenderPipeline} from './RootRenderPipeline.js';

/**
 * A `buildOutputNode` callback that owns the effect nodes it builds and releases them itself.
 * Assign it to `StageRenderer#buildOutputNode` as it is, no adapter needed.
 *
 * After {@link dispose} a call throws an error naming the factory that built the builder and the
 * state, `isDisposed` is `true`, and a further `dispose()` does nothing.
 */
export interface OutputNodeBuilder {
  (stagePasses: Node[]): Node;

  /** `true` once {@link dispose} has run. */
  readonly isDisposed: boolean;

  /** Releases the effect node the builder built last. Calling it again does nothing. */
  dispose(): void;
}

/**
 * The options of {@link createBloomOutputNodeBuilder}. Each one goes to `bloom()` of three.js
 * unchanged, three.js validates none of them and neither does the builder.
 */
export interface BloomOutputNodeBuilderOptions {
  /** How strong the glow is added to the image. Default `1`. */
  strength?: number;

  /** How far the glow spreads, in the range `[0, 1]`. Default `0`. */
  radius?: number;

  /** The luminance from which an area contributes to the bloom. Default `0`. */
  threshold?: number;
}

/**
 * Builds a ready-made `StageRenderer#buildOutputNode`: the passes of the stages composed
 * additively, as `RootRenderPipeline.buildOutputNode` does, and the bloom of that composition
 * added on top — `composed.add(bloom(composed, strength, radius, threshold))`; with one stage
 * `pass.add(bloom(pass, …))`. The options are read once, when this function is called.
 *
 * `StageRenderer` calls the builder on every rebuild of the output node, and neither the
 * renderer nor `RenderPipeline` releases the output node a rebuild replaces. Every call of the
 * builder therefore releases the bloom node of the call before, as soon as the new graph
 * stands, and {@link OutputNodeBuilder.dispose} releases the last one. The pass nodes belong to
 * the stages and stay.
 *
 * The builder belongs to the caller: `StageRenderer#dispose()` leaves it alone. Give every
 * renderer a builder of its own — the callback cannot tell who calls it, so one builder that two
 * renderers share releases the bloom of one of them whenever the other rebuilds. Take the
 * builder off the renderer before you dispose it (`buildOutputNode = undefined`, or dispose the
 * renderer): a renderer that still holds a disposed builder throws on its next rebuild, and a
 * `StageRenderer` does not take a disposed builder. An empty list of passes throws; a `StageRenderer` without stages does not call the builder.
 *
 * ```ts
 * const pipeline = new RenderPipeline(display.renderer!);
 * const withBloom = createBloomOutputNodeBuilder({strength: 1.2, radius: 0.6});
 * stageRenderer.pipeline = pipeline;
 * stageRenderer.buildOutputNode = withBloom;
 *
 * // teardown: the renderer lets go first, then the builder and the pipeline go
 * stageRenderer.dispose();
 * withBloom.dispose();
 * pipeline.dispose();
 * ```
 */
export function createBloomOutputNodeBuilder(options?: BloomOutputNodeBuilderOptions): OutputNodeBuilder {
  const strength = options?.strength ?? 1;
  const radius = options?.radius ?? 0;
  const threshold = options?.threshold ?? 0;

  let lastGlow: ReturnType<typeof bloom> | undefined;
  let disposed = false;

  const builder = ((stagePasses: Node[]): Node => {
    if (disposed) {
      throw new Error('The builder of createBloomOutputNodeBuilder() is not available: this builder has been disposed');
    }
    if (stagePasses.length === 0) {
      throw new Error('The builder of createBloomOutputNodeBuilder() has no passes to compose');
    }

    // bloom() asks for a `Node<'vec4'>`, and `.add()` is attached at runtime by the
    // ShaderNodeProxy, which the static `Node` type does not show (as in RootRenderPipeline)
    const composed = RootRenderPipeline.buildOutputNode(stagePasses) as Node<'vec4'> & {add(other: Node): Node};
    const glow = bloom(composed, strength, radius, threshold);
    const output = composed.add(glow);

    // released only now, once the new graph stands: a call that throws above leaves the output
    // node of the call before intact
    lastGlow?.dispose();
    lastGlow = glow;

    return output;
  }) as OutputNodeBuilder;

  Object.defineProperties(builder, {
    isDisposed: {get: () => disposed, enumerable: true},
    dispose: {
      value: () => {
        if (disposed) return;
        disposed = true;
        lastGlow?.dispose();
        lastGlow = undefined;
      },
    },
  });

  return builder;
}

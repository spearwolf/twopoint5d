import type {Node, WebGPURenderer} from 'three/webgpu';

/**
 * Contributes a TSL node that represents this object's rendered contribution
 * to a parent `RenderPipeline`. Implemented by `Stage2D` (returns a `pass()`
 * node) and `StageRenderer` (returns a `texture()` node sampling the
 * renderer's pass-target).
 *
 * The node belongs to the provider, not to the caller. A provider that builds a resource for
 * the node keeps it and releases it in its own `dispose()` — `Stage2D` its `PassNode`,
 * `StageRenderer` the render target its `texture()` node samples — so a caller composes the
 * node into a pipeline and never disposes it. An implementation of this interface owns what it
 * builds here in the same way.
 *
 * A composing `StageRenderer` asks an eventized provider for its node again after it announced
 * `OnStageAfterCameraChanged` or `OnStageAfterSceneChanged`, and rebuilds its output node only for
 * a node that differs from the one it composed.
 */
export interface IPassProvider {
  asPassNode(renderer: WebGPURenderer): Node;
}

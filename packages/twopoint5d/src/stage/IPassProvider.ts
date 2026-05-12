import type {Node, WebGPURenderer} from 'three/webgpu';

/**
 * Contributes a TSL node that represents this object's rendered contribution
 * to a parent `RenderPipeline`. Implemented by `Stage2D` (returns a `pass()`
 * node) and `StageRenderer` (returns a `texture()` node sampling the
 * renderer's internal pass-target).
 */
export interface IPassProvider {
  asPassNode(renderer: WebGPURenderer): Node;
}

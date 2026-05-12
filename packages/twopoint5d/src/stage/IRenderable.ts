import type {WebGPURenderer} from 'three/webgpu';

/**
 * Renders itself into the given renderer.
 *
 * Implemented by `Stage2D` (renders its scene+camera) and `StageRenderer`
 * (renders its child stages). Decoupled from {@link IStage} so an object can
 * be a stage without being renderable and vice versa.
 */
export interface IRenderable {
  renderTo(renderer: WebGPURenderer): void;
}

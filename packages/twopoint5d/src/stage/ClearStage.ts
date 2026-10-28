import type {WebGPURenderer} from 'three/webgpu';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';

export interface ClearStageOptions {
  color?: boolean;
  depth?: boolean;
  stencil?: boolean;
}

/**
 * Stage that issues a `renderer.clear(...)` between sibling stages.
 *
 * Useful for layered rendering when you want to clear specific buffers
 * mid-frame — e.g. drop the depth buffer before drawing UI on top of the
 * world. Defaults: only `depth` is cleared.
 *
 * ```ts
 * root.add(world).add(new ClearStage({depth: true})).add(ui);
 * ```
 *
 * It works without a pipeline and in the whole-picture mode (a pipeline without `buildOutputNode`
 * that is not a `RootRenderPipeline`), where all stages draw into one target. Under a composing pipeline every
 * stage draws into a target with a depth buffer of its own (the `pass()` node of a `Stage2D`, the
 * pass target of a nested renderer) and the composition lays them over each other: there is
 * nothing to clear between them. `StageRenderer#add()` refuses a `ClearStage` there, and so do the
 * `pipeline` and the `buildOutputNode` setter while one is among the stages.
 */
export class ClearStage implements IStage, IRenderable {
  name: string;

  color: boolean;
  depth: boolean;
  stencil: boolean;

  constructor(opts: ClearStageOptions = {}, name = 'clear') {
    this.color = opts.color ?? false;
    this.depth = opts.depth ?? true;
    this.stencil = opts.stencil ?? false;
    this.name = name;
  }

  resize(_width: number, _height: number): void {
    // intentionally empty
  }

  updateFrame(_now: number, _deltaTime: number, _frameNo: number): void {
    // intentionally empty
  }

  renderTo(renderer: WebGPURenderer): void {
    renderer.clear(this.color, this.depth, this.stencil);
  }
}

import {on} from '@spearwolf/eventize';
import type {WebGLRenderer} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import type {WebGPURenderer} from 'three/webgpu';
import type {ThreeRendererType} from '../display/types.js';
import {
  StageAdded,
  StageRemoved,
  type IStageAdded,
  type IStageRemoved,
  type StageAddedProps,
  type StageRemovedProps,
} from '../events.js';
import type {IStage} from './IStage.js';
import type {StageType} from './IStageRenderer.js';
import type {Stage2D} from './Stage2D.js';
import {Stage2DRenderPass} from './Stage2DRenderPass.js';
import {StageRenderer} from './StageRenderer.js';

export class PostProcessingRenderer extends StageRenderer implements IStageAdded, IStageRemoved {
  override name = 'PostProcessingRenderer';

  /**
   * A temporary cache in which the passes are stored temporarily before a composer is created.
   * After the composer has been created, the passes can be found in the composer.passes array,
   * and this array is then empty.
   */
  protected passes: Pass[] = [];

  #orderedPasses?: Pass[];

  passesNeedsUpdate = true;

  composer?: EffectComposer;

  /**
   * The post processing renderer uses an effect composer.
   * All stages are rendered as a pass.
   * The stage-pass relation is stored here.
   */
  stagePass: WeakMap<IStage, RenderPass> = new WeakMap();

  passesByName = new Map<string, Set<Pass>>();

  constructor() {
    super();
    on(this, [StageAdded, StageRemoved], this);
  }

  override renderFrame(
    renderer: ThreeRendererType,
    now: number,
    deltaTime: number,
    frameNo: number,
    skipRenderCall = false,
  ): void {
    // preface - before we render the stage passes with the effect composer,
    // we want to give all stages the opportunity to react to the current dimension and update their render pass settings.

    this.stages.forEach((stage) => {
      this.resizeStage(stage, this.width, this.height);
      stage.stage.renderFrame(renderer, now, deltaTime, frameNo, true);
    });

    // render the stage passes

    const composer = this.getComposer(renderer);

    if (this.passesNeedsUpdate) {
      composer.passes.length = 0;
      for (const pass of this.getOrderedPasses()) {
        composer.addPass(pass);
      }
      this.passesNeedsUpdate = false;
    }

    if (!skipRenderCall) {
      composer.render();
    }
  }

  protected override onRenderOrderChanged(): void {
    this.#orderedPasses = undefined;
  }

  getOrderedPasses(): Pass[] {
    if (this.#orderedPasses) {
      return this.#orderedPasses;
    }

    this.passesNeedsUpdate = true;

    const renderOrder = this.renderOrderArray;

    if (renderOrder.length === 0 || (renderOrder.length === 1 && (renderOrder[0] === '' || renderOrder[0] === '*'))) {
      this.#orderedPasses = this.passes;
      return this.passes;
    }

    const otherNames = new Set<string>(Array.from(this.passesByName.keys()));

    renderOrder.forEach((name) => {
      if (name !== '*') {
        otherNames.delete(name);
      }
    });

    const orderedPasses: Pass[] = renderOrder
      .map((name) => {
        if (name === '*') {
          return Array.from(otherNames)
            .map((name) => Array.from(this.passesByName.get(name)!))
            .flat();
        }
        if (this.passesByName.has(name)) {
          return Array.from(this.passesByName.get(name));
        }
      })
      .flat()
      .filter(Boolean) as Pass[];

    this.#orderedPasses = orderedPasses;
    return orderedPasses;
  }

  addPass(pass: Pass, name?: string) {
    this.passes.push(pass);
    this.composer?.addPass(pass);

    name = name || '*';
    if (this.passesByName.has(name)) {
      this.passesByName.get(name)!.add(pass);
    } else {
      this.passesByName.set(name, new Set([pass]));
    }

    this.#orderedPasses = undefined;
  }

  removePass(pass: Pass) {
    this.composer?.removePass(pass);

    const index = this.passes.indexOf(pass);
    if (index !== -1) {
      this.passes.splice(index, 1);
    }

    for (const [, passes] of this.passesByName) {
      if (passes.has(pass)) {
        passes.delete(pass);
      }
    }

    this.#orderedPasses = undefined;
  }

  getComposer(renderer: ThreeRendererType): EffectComposer {
    if (this.composer == null) {
      if ((renderer as WebGPURenderer).isWebGPURenderer) {
        throw new Error('PostProcessingRenderer: WebGPURenderer not supported');
      }
      this.composer = new EffectComposer(renderer as WebGLRenderer);
      this.passes.forEach((pass) => this.composer.addPass(pass));
      this.onResizeRenderer(this.width, this.height, this.pixelRatio);
    }
    return this.composer;
  }

  protected override onResizeRenderer(width: number, height: number, pixelRatio: number): void {
    if (this.composer) {
      this.composer.setPixelRatio(pixelRatio);
      this.composer.setSize(width, height);
    }
  }

  stageAdded({stage}: StageAddedProps) {
    if (!this.stagePass.has(stage)) {
      const renderPass = this.createRenderPass(stage);
      this.addPass(renderPass, stage.name);
    }
  }

  private createRenderPass(stage: IStage): RenderPass {
    if ((stage as Stage2D).isStage2D) {
      const pass = new Stage2DRenderPass(stage as Stage2D);
      this.stagePass.set(stage, pass);
      return pass;
    }
    throw new Error(`[PostProcessingRenderer] stage ${stage.name} is not a Stage2D - so, no render pass can be created`);
  }

  stageRemoved({stage}: StageRemovedProps) {
    if (this.stagePass.has(stage)) {
      const renderPass = this.stagePass.get(stage)!;
      this.stagePass.delete(stage);
      this.removePass(renderPass);
      renderPass.dispose();
    }
  }

  /**
   * @deprecated do not use
   */
  reorderPasses(passes: (Pass | StageType)[]) {
    const nextPasses: Pass[] = passes
      .map((pass) => {
        if (pass instanceof Pass) {
          return pass;
        }
        return this.stagePass.get(pass)!;
      })
      .filter(Boolean);

    // const target = this.composer?.passes ?? this.passes;
    const target = this.passes;

    if (target.length !== nextPasses.length) {
      // eslint-disable-next-line no-console
      console.error(
        '[PostProcessingRenderer] reorderPasses: nextPasses length mismatch: should be',
        target.length,
        'but is',
        nextPasses.length,
        {target, passes, nextPasses, renderer: this},
      );
    }

    target.length = 0;
    target.push(...nextPasses);
  }

  dispose() {
    this.passes.forEach((pass) => pass.dispose());
    this.passes.length = 0;
    if (this.composer) {
      this.composer.dispose();
      this.composer = undefined;
    }
    this.passesByName.clear();
    this.passesNeedsUpdate = true;
    this.#orderedPasses = undefined;
  }
}

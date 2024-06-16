import type {WebGLRenderer} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {Pass} from 'three/addons/postprocessing/Pass.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {
  StageAdded,
  StageRemoved,
  type IStageAdded,
  type IStageRemoved,
  type StageAddedProps,
  type StageRemovedProps,
} from '../events.js';
import {hasGetRenderPass} from './IGetRenderPass.js';
import type {IStage} from './IStage.js';
import type {StageType} from './IStageRenderer.js';
import {StageRenderer} from './StageRenderer.js';

export class PostProcessingRenderer extends StageRenderer implements IStageAdded, IStageRemoved {
  composer?: EffectComposer;

  stagePasses: WeakMap<IStage, RenderPass> = new WeakMap();
  passes: Pass[] = [];

  constructor() {
    super();
    this.on([StageAdded, StageRemoved], this);
  }

  override renderFrame(renderer: WebGLRenderer, now: number, deltaTime: number, frameNo: number): void {
    const composer = this.getComposer(renderer);

    this.stages.forEach((stage) => {
      this.resizeStage(stage, this.width, this.height);
      stage.stage.renderFrame(renderer, now, deltaTime, frameNo, (scene, camera, autoClear) => {
        const renderPass = this.stagePasses.get(stage.stage);
        if (renderPass) {
          renderPass.clear = autoClear;
          renderPass.scene = scene;
          renderPass.camera = camera;
        }
      });
    });

    composer.render();
  }

  addPass(pass: Pass) {
    if (this.composer) {
      this.composer.addPass(pass);
    } else {
      this.passes.push(pass);
    }
  }

  removePass(pass: Pass) {
    if (this.composer) {
      this.composer.removePass(pass);
    } else {
      const index = this.passes.indexOf(pass);
      if (index !== -1) {
        this.passes.splice(index, 1);
      }
    }
  }

  getComposer(renderer: WebGLRenderer): EffectComposer {
    if (this.composer == null) {
      this.composer = new EffectComposer(renderer);
      this.passes.forEach((pass) => this.composer.addPass(pass));
      this.passes.length = 0;
    }
    return this.composer;
  }

  stageAdded({stage}: StageAddedProps) {
    if (hasGetRenderPass(stage) && !this.stagePasses.has(stage)) {
      const renderPass = stage.getRenderPass();
      this.stagePasses.set(stage, renderPass);
      this.addPass(renderPass);
    }
  }

  stageRemoved({stage}: StageRemovedProps) {
    if (this.stagePasses.has(stage)) {
      const renderPass = this.stagePasses.get(stage)!;
      this.stagePasses.delete(stage);
      this.removePass(renderPass);
      renderPass.dispose();
    }
  }

  reorderPasses(passes: (Pass | StageType)[]) {
    const nextPasses: Pass[] = passes
      .map((pass) => {
        if (pass instanceof Pass) {
          return pass;
        }
        return this.stagePasses.get(pass)!;
      })
      .filter(Boolean);

    const target = this.composer?.passes ?? this.passes;

    if (target.length !== nextPasses.length) {
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

  // TODO dispose
}

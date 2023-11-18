import type {WebGLRenderer} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {
  StageAdded,
  StageRemoved,
  type IStageAdded,
  type IStageRemoved,
  type StageAddedProps,
  type StageRemovedProps,
} from '../events.js';
import type {IStage} from './IStage.js';
import {Stage2D} from './Stage2D.js';
import {StageRenderer} from './StageRenderer.js';

const isRenderPassable = (stage: IStage): stage is Stage2D => stage instanceof Stage2D;

export class PostProcessingRenderer extends StageRenderer implements IStageAdded, IStageRemoved {
  composer?: EffectComposer;
  renderPass: WeakMap<IStage, RenderPass> = new WeakMap();

  constructor() {
    super();
    this.on([StageAdded, StageRemoved], this);
  }

  override renderFrame(renderer: WebGLRenderer, now: number, deltaTime: number, frameNo: number): void {
    if (!this.composer) {
      this.composer = new EffectComposer(renderer);
    }

    this.stages.forEach((stage) => {
      this.resizeStage(stage, this.width, this.height);
      stage.stage.renderFrame(renderer, now, deltaTime, frameNo, (scene, camera, autoClear) => {
        const renderPass = this.renderPass.get(stage.stage);
        if (renderPass) {
          renderPass.clear = autoClear;
          renderPass.scene = scene;
          renderPass.camera = camera;
        }
      });
    });

    this.composer.render();
  }

  stageAdded({stage}: StageAddedProps) {
    if (isRenderPassable(stage) && !this.renderPass.has(stage)) {
      this.renderPass.set(stage, new RenderPass(stage.scene, stage.camera));
      console.log('stageAdded as renderPass', {stage, postEffectsRenderer: this});
    }
  }

  stageRemoved({stage}: StageRemovedProps) {
    if (this.renderPass.has(stage)) {
      const renderPass = this.renderPass.get(stage)!;
      this.renderPass.delete(stage);
      renderPass.dispose();
      console.log('stageRemoved as renderPass', {stage, postEffectsRenderer: this});
    }
  }
}

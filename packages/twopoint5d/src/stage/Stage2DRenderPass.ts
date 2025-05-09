import type {Camera, Color, Scene} from 'three';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import type {Stage2D} from './Stage2D.js';

export class Stage2DRenderPass extends RenderPass {
  stage: Stage2D;

  constructor(stage: Stage2D) {
    super(stage.scene, stage.camera, null, stage.clearColor, stage.clearAlpha);

    this.stage = stage;
    this.clear = stage.autoClear;

    Object.defineProperties(this, {
      scene: {
        get: () => this.stage.scene ?? null,
        set: (val: Scene) => {
          this.stage.scene = val;
        },
      },
      camera: {
        get: () => this.stage.camera ?? null,
        set: (val: Camera) => {
          this.stage.camera = val;
        },
      },
      clear: {
        get: () => this.stage.autoClear,
        set: (val: boolean) => {
          this.stage.autoClear = val;
        },
      },
      clearColor: {
        get: () => this.stage.clearColor,
        set: (val: Color) => {
          this.stage.clearColor = val;
        },
      },
      clearAlpha: {
        get: () => this.stage.clearAlpha,
        set: (val: number) => {
          this.stage.clearAlpha = val;
        },
      },
    });
  }
}

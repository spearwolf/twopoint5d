import type {Display, Stage2D} from '@spearwolf/twopoint5d';
import type {WebGLRenderer} from 'three';

export type StageParentType = Display | IStageRenderer;
export type StageType = Stage2D | IStageRenderer;

export interface IStageRenderer {
  attach(parent: StageParentType): void;
  detach(): void;

  resize(width: number, height: number): void;
  renderFrame(renderer: WebGLRenderer, now: number, deltaTime: number, frameNo: number): void;

  addStage(stage: StageType): void;
  removeStage(stage: StageType): void;
}

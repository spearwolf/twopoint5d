import type {Display} from '../display/Display.js';
import type {IStage} from './IStage.js';
import type {Stage2D} from './Stage2D.js';

export type StageParentType = Display | IStageRenderer;

// TODO use IStage
export type StageType = Stage2D | IStageRenderer;

export interface IStageRenderer extends IStage {
  isStageRenderer: true;

  attach(parent: StageParentType): void;
  detach(): void;

  addStage(stage: StageType): void;
  removeStage(stage: StageType): void;
}

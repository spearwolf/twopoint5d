import type {Display} from '../display/Display.js';
import type {IStage} from './IStage.js';

export type StageParentType = Display | IStageRenderer;
export type StageType = IStage | IStageRenderer;

export interface IStageRenderer extends IStage {
  isStageRenderer: true;

  attach(parent: StageParentType): void;
  detach(): void;

  addStage(stage: StageType): void;
  removeStage(stage: StageType): void;
}

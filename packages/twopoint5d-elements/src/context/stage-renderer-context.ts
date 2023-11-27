import {createContext} from '@lit/context';
import type {StageType} from '@spearwolf/twopoint5d';

export interface StageElement extends HTMLElement {
  getStage(): StageType;
}

export interface IStageRendererContext {
  addStageElement(el: StageElement): void;
  removeStageElement(el: StageElement): void;
}

export const stageRendererContext = createContext<IStageRendererContext | undefined>(Symbol('stage-renderer'));

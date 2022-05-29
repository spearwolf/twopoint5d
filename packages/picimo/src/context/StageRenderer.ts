import eventize, {Eventize} from '@spearwolf/eventize';
import {Stage2D} from '@spearwolf/stage25';
import {createContext} from 'react';

export interface StageRenderer extends Eventize {}

export class StageRenderer {
  readonly #stages = new Map<string, Stage2D>();

  constructor() {
    eventize(this);

    this.on('addStage', (name, stage) => {
      // eslint-disable-next-line no-console
      console.log('StageRenderer:addStage', name, stage);
    });

    this.on('removeStage', (name, stage) => {
      // eslint-disable-next-line no-console
      console.log('StageRenderer:removeStage', name, stage);
    });
  }

  addStage(name: string, stage: Stage2D): void {
    const prevStage = this.#stages.get(name);
    this.#stages.set(name, stage);
    if (stage !== prevStage) {
      this.emit('addStage', name, stage, prevStage);
    }
  }

  removeStage(name: string): void {
    if (this.#stages.has(name)) {
      this.emit('removeStage', name, this.#stages.get(name));
    }
    this.#stages.delete(name);
  }

  getStage(name: string): Stage2D | undefined {
    return this.#stages.get(name);
  }
}

const defaultStageRenderer = new StageRenderer();

export const StageRendererContext = createContext(defaultStageRenderer);

StageRendererContext.displayName = 'StageRenderer';

export default StageRendererContext;

import eventize, {Eventize} from '@spearwolf/eventize';
import {Stage2D} from 'twopoint5d';
import {createContext} from 'react';

const STAGE_RENDERER = 'StageRenderer';

export const REGISTER = 'register';
export const UNREGISTER = 'unregister';

export interface StageRenderer extends Eventize {}

export class StageRenderer {
  readonly #stages = new Map<string, Stage2D>();

  constructor() {
    eventize(this);

    // XXX remove me
    this.on(REGISTER, (name, stage) => {
      // eslint-disable-next-line no-console
      console.log(`${STAGE_RENDERER}:${REGISTER}`, name, stage);
    });

    // XXX remove me
    this.on(UNREGISTER, (name, stage) => {
      // eslint-disable-next-line no-console
      console.log(`${STAGE_RENDERER}:${UNREGISTER}`, name, stage);
    });
  }

  register(name: string, stage: Stage2D): void {
    const prevStage = this.#stages.get(name);
    this.#stages.set(name, stage);
    if (stage !== prevStage) {
      this.emit(REGISTER, name, stage, prevStage);
    }
  }

  unregister(name: string): void {
    if (this.#stages.has(name)) {
      this.emit(UNREGISTER, name, this.#stages.get(name));
    }
    this.#stages.delete(name);
  }

  getStage(name: string): Stage2D | undefined {
    return this.#stages.get(name);
  }
}

const defaultStageRenderer = new StageRenderer();

export const StageRendererContext = createContext(defaultStageRenderer);

StageRendererContext.displayName = STAGE_RENDERER;

export default StageRendererContext;

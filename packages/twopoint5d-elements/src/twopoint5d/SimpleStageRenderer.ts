import {eventize, type Eventize} from '@spearwolf/eventize';
import {Display, Stage2D} from '@spearwolf/twopoint5d';
import type {WebGLRenderer} from 'three';
import {
  StageAdded,
  StageRemoved,
  StageRenderFrame,
  type StageAddedProps,
  type StageRemovedProps,
  type StageRenderFrameProps,
} from '../events.js';
import type {IStageRenderer, StageParentType, StageType} from './IStageRenderer.js';

export interface SimpleStageRenderer extends Eventize {}

interface StageItem {
  stage: StageType;
  width: number;
  height: number;
}

const UnsubscribeFromParent = 'unsubscribeFromParent';

// TODO rename to StageRenderer
export class SimpleStageRenderer implements IStageRenderer {
  #parent?: StageParentType;

  width: number = 0;
  height: number = 0;

  get parent(): StageParentType | undefined {
    return this.#parent;
  }

  set parent(parent: StageParentType | undefined) {
    if (this.#parent !== parent) {
      if (this.#parent) {
        this.#removeFromParent();
      }
      this.#parent = parent;
      if (this.#parent) {
        this.#addToParent();
      }
    }
  }

  #removeFromParent(): void {
    this.emit(UnsubscribeFromParent);

    if (!(this.#parent instanceof Display)) {
      this.#parent!.removeStage(this);
    }
  }

  #addToParent(): void {
    if (this.#parent instanceof Display) {
      this.#addToDisplay(this.#parent);
    } else {
      this.#parent!.addStage(this);
    }
  }

  #addToDisplay(display: Display): void {
    this.once(
      UnsubscribeFromParent,
      display.on('resize', ({width, height}: {width: number; height: number}) => {
        this.resize(width, height);
      }),
    );
    this.once(
      UnsubscribeFromParent,
      display.on(
        'frame',
        ({renderer, now, deltaTime, frameNo}: {renderer: WebGLRenderer; now: number; deltaTime: number; frameNo: number}) => {
          this.renderFrame(renderer, now, deltaTime, frameNo);
        },
      ),
    );
  }

  readonly #stages: StageItem[] = [];

  constructor() {
    eventize(this);
  }

  attach(parent: StageParentType): void {
    this.parent = parent;
  }

  detach(): void {
    this.parent = undefined;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;

    this.#stages.forEach((stage) => this.#resizeStage(stage, width, height));
  }

  #resizeStage(stage: StageItem, width: number, height: number): void {
    if (
      stage.width !== width ||
      stage.height !== height ||
      (stage.stage instanceof Stage2D && (stage.stage.containerWidth !== width || stage.stage.containerHeight !== height))
    ) {
      stage.width = width;
      stage.height = height;
      stage.stage.resize(width, height);
    }
  }

  renderFrame(renderer: WebGLRenderer, now: number, deltaTime: number, frameNo: number): void {
    this.#stages.forEach((stage) => {
      this.#resizeStage(stage, this.width, this.height);

      if (stage.stage instanceof Stage2D) {
        stage.stage.emit(StageRenderFrame, {
          width: stage.stage.width,
          height: stage.stage.height,
          renderer,
          now,
          deltaTime,
          frameNo,
        } as StageRenderFrameProps);
        stage.stage.renderFrame(renderer);
      } else {
        stage.stage.renderFrame(renderer, now, deltaTime, frameNo);
      }
    });
  }

  #getIndex(stage: StageType): number {
    return this.#stages.findIndex((item) => item.stage === stage);
  }

  hasStage(stage: StageType): boolean {
    return this.#getIndex(stage) !== -1;
  }

  addStage(stage: StageType): void {
    if (!this.hasStage(stage)) {
      this.#stages.push({
        stage,
        width: 0,
        height: 0,
      });
      this.emit(StageAdded, {stage, renderer: this} as StageAddedProps);
    }
  }

  removeStage(stage: StageType): void {
    const index = this.#getIndex(stage);
    if (index !== -1) {
      this.#stages.splice(index, 1);
      this.emit(StageRemoved, {stage, renderer: this} as StageRemovedProps);
    }
  }
}

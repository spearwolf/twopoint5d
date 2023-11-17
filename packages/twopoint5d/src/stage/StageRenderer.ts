import {eventize, type Eventize} from '@spearwolf/eventize';
import type {WebGLRenderer} from 'three';
import {Display} from '../display/Display.js';
import {RemoveFromParent, StageAdded, StageRemoved, type StageAddedProps, type StageRemovedProps} from '../events.js';
import type {IStageRenderer, StageParentType, StageType} from './IStageRenderer.js';

interface StageItem {
  stage: StageType;
  width: number;
  height: number;
}

export interface StageRenderer extends Eventize {}

export class StageRenderer implements IStageRenderer {
  readonly isStageRenderer = true;

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
    this.emit(RemoveFromParent);

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
      RemoveFromParent,
      display.on('resize', ({width, height}: {width: number; height: number}) => {
        this.resize(width, height);
      }),
    );
    this.once(
      RemoveFromParent,
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
    if (stage.width !== width || stage.height !== height) {
      stage.width = width;
      stage.height = height;
      stage.stage.resize(width, height);
    }
  }

  renderFrame(renderer: WebGLRenderer, now: number, deltaTime: number, frameNo: number): void {
    this.#stages.forEach((stage) => {
      this.#resizeStage(stage, this.width, this.height);
      stage.stage.renderFrame(renderer, now, deltaTime, frameNo);
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

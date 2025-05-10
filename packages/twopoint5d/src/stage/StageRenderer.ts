import {emit, eventize, on, once} from '@spearwolf/eventize';
import {Display} from '../display/Display.js';
import type {ThreeRendererType} from '../display/types.js';
import {
  OnRenderFrame,
  OnResize,
  RemoveFromParent,
  StageAdded,
  StageRemoved,
  type OnRenderFrameProps,
  type OnResizeProps,
  type StageAddedProps,
  type StageRemovedProps,
} from '../events.js';
import type {IStageRenderer, StageParentType, StageType} from './IStageRenderer.js';

interface StageItem {
  stage: StageType;
  width: number;
  height: number;
}

/**
 * The StageRenderer gets its dimension from the parent or the display.
 * Use `attach()` to attach it to a parent (or display).
 *
 * It can contains multiple stages.
 *
 * When `renderFrame()` is called, all stages that were added using `addStage()` are rendered.
 * If an explicit `renderOrder` is set, the stages are rendered in the order defined there.
 */
export class StageRenderer implements IStageRenderer {
  readonly isStageRenderer = true;

  name = 'StageRenderer';

  #parent?: StageParentType;

  width: number = 0;
  height: number = 0;
  pixelRatio: number = 1;

  /**
   * All stages are included here, but unsorted. The render order is not included here yet.
   * see `renderOrder` and `getOrderedStages()`
   */
  readonly stages: StageItem[] = [];

  #renderOrder = '*';
  #orderedStages?: StageItem[];

  /**
   * A comma separated list of stage names (see `IStage#name`) or '*' for all other stages which are not listed explicitly
   */
  set renderOrder(order: string | undefined) {
    order = order || '*';
    if (this.#renderOrder !== order) {
      this.#renderOrder = order;
      this.#renderOrderArray = undefined;
      this.#orderedStages = undefined;
      this.onRenderOrderChanged();
    }
  }

  protected onRenderOrderChanged(): void {
    // ntdh
  }

  get renderOrder(): string {
    return this.#renderOrder;
  }

  #renderOrderArray?: string[] = [];

  get renderOrderArray(): string[] {
    if (!this.#renderOrderArray) {
      this.#renderOrderArray = this.renderOrder
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
    }
    return this.#renderOrderArray;
  }

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
    emit(this, RemoveFromParent);

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
    once(
      this,
      RemoveFromParent,
      on(display, OnResize, ({width, height, pixelRatio}: OnResizeProps) => {
        this.resize(width, height, pixelRatio);
      }),
    );
    once(
      this,
      RemoveFromParent,
      on(display, OnRenderFrame, ({renderer, now, deltaTime, frameNo}: OnRenderFrameProps) => {
        this.renderFrame(renderer, now, deltaTime, frameNo);
      }),
    );
  }

  constructor() {
    eventize(this);
  }

  attach(parent: StageParentType): void {
    this.parent = parent;
  }

  detach(): void {
    this.parent = undefined;
  }

  resize(width: number, height: number, pixelRatio: number = 1): void {
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;

    this.stages.forEach((stage) => this.resizeStage(stage, width, height));

    this.onResizeRenderer(width, height, pixelRatio);
  }

  protected onResizeRenderer(_width: number, _height: number, _pixelRatio: number): void {
    // ntdh
  }

  protected resizeStage(stage: StageItem, width: number, height: number): void {
    if (stage.width !== width || stage.height !== height) {
      stage.width = width;
      stage.height = height;
      stage.stage.resize(width, height);
    }
  }

  renderFrame(renderer: ThreeRendererType, now: number, deltaTime: number, frameNo: number, skipRenderCall = false): void {
    this.getOrderedStages().forEach((stage) => {
      this.resizeStage(stage, this.width, this.height);
      stage.stage.renderFrame(renderer, now, deltaTime, frameNo, skipRenderCall);
    });
  }

  getOrderedStages(): StageItem[] {
    if (this.#orderedStages) return this.#orderedStages;

    const renderOrder = this.renderOrderArray;

    if (renderOrder.length === 0 || (renderOrder.length === 1 && (renderOrder[0] === '' || renderOrder[0] === '*'))) {
      return this.stages;
    }

    const explicitlyNamedStages = new Map<string, StageItem>();
    const otherStages = this.stages.slice();

    renderOrder.forEach((name) => {
      if (name !== '*') {
        const index = otherStages.findIndex((stage) => stage.stage.name === name);
        if (index !== -1) {
          const stage = otherStages.splice(index, 1)[0];
          explicitlyNamedStages.set(name, stage);
        }
      }
    });

    const orderedStages = renderOrder
      .map((name) => {
        if (name === '*') {
          return otherStages;
        }
        return explicitlyNamedStages.get(name);
      })
      .flat()
      .filter(Boolean) as StageItem[];

    explicitlyNamedStages.clear();

    this.#orderedStages = orderedStages;

    return orderedStages;
  }

  #getIndex(stage: StageType): number {
    return this.stages.findIndex((item) => item.stage === stage);
  }

  hasStage(stage: StageType): boolean {
    return this.#getIndex(stage) !== -1;
  }

  addStage(stage: StageType): void {
    if (!this.hasStage(stage)) {
      this.stages.push({
        stage,
        width: 0,
        height: 0,
      });
      this.#orderedStages = undefined;
      emit(this, StageAdded, {stage, renderer: this} as StageAddedProps);
    }
  }

  removeStage(stage: StageType): void {
    const index = this.#getIndex(stage);
    if (index !== -1) {
      this.stages.splice(index, 1);
      this.#orderedStages = undefined;
      emit(this, StageRemoved, {stage, renderer: this} as StageRemovedProps);
    }
  }
}

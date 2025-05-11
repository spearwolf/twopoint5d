import {emit, eventize, on, once} from '@spearwolf/eventize';
import {Color, type WebGLRenderer} from 'three';
import {Display} from '../display/Display.js';
import {isWebGPURenderer} from '../display/isWebGPURenderer.js';
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
import type {IStage} from './IStage.js';

export type StageRendererParentType = Display | StageRenderer;

interface StageItem {
  stage: IStage;

  // TODO insertionNumber: number;

  width: number;
  height: number;
}

const isStageRenderer = (obj: unknown): obj is StageRenderer => (obj as {isStageRenderer: boolean})?.isStageRenderer === true;

export class StageRenderer implements IStage {
  readonly isStageRenderer = true;

  name = 'StageRenderer';

  #parent?: StageRendererParentType;

  width: number = 0;
  height: number = 0;

  clearColor?: Color;
  clearAlpha: number = 1;

  clearColorBuffer = true;
  clearDepthBuffer = true;
  clearStencilBuffer = true;

  #oldClearColor = new Color(0x000000);

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

  get parent(): StageRendererParentType | undefined {
    return this.#parent;
  }

  set parent(parent: StageRendererParentType | undefined) {
    if (this.#parent !== parent) {
      this.#removeFromParent();
      this.#parent = parent;
      if (this.#parent) {
        this.#addToParent();
      }
    }
  }

  #removeFromParent(): void {
    if (this.#parent == null) return;

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
      on(display, OnResize, ({width, height}: OnResizeProps) => {
        this.resize(width, height);
      }),
    );
    once(
      this,
      RemoveFromParent,
      on(display, OnRenderFrame, ({renderer, now, deltaTime, frameNo}: OnRenderFrameProps) => {
        this.updateFrame(now, deltaTime, frameNo);
        this.renderFrame(renderer);
      }),
    );
  }

  constructor(parent?: StageRendererParentType) {
    eventize(this);
    if (parent) {
      this.parent = parent;
    }
  }

  attach(parent: StageRendererParentType): void {
    this.parent = parent;
  }

  detach(): void {
    this.parent = undefined;
  }

  resize(width: number, height: number): void {
    if (this.width === width && this.height === height) return;

    this.width = width;
    this.height = height;

    for (const stage of this.stages) {
      this.resizeStage(stage, width, height);
    }
  }

  protected resizeStage(stageItem: StageItem, width: number, height: number): void {
    if (stageItem.width !== width || stageItem.height !== height) {
      stageItem.width = width;
      stageItem.height = height;
      stageItem.stage.resize(width, height);
    }
  }

  updateFrame(now: number, deltaTime: number, frameNo: number): void {
    for (const {stage} of this.getOrderedStages()) {
      stage.updateFrame(now, deltaTime, frameNo);
    }
  }

  renderFrame(renderer: ThreeRendererType): void {
    if (isWebGPURenderer(renderer)) {
      throw new Error('WebGPU renderer is not supported yet');
    }

    const wasPreviouslyAutoClear = renderer.autoClear;
    const oldClearAlpha = renderer.getClearAlpha();
    const clearColor = this.clearColor;

    if (clearColor != null) {
      renderer.getClearColor(this.#oldClearColor);
      renderer.setClearColor(clearColor, this.clearAlpha);
      renderer.setClearAlpha(this.clearAlpha);
      renderer.clear(this.clearColorBuffer, this.clearDepthBuffer, this.clearStencilBuffer);
    }

    renderer.autoClear = false;

    for (const stageItem of this.getOrderedStages()) {
      this.renderStage(stageItem, renderer);
    }

    renderer.autoClear = wasPreviouslyAutoClear;

    if (clearColor != null) {
      renderer.setClearColor(this.#oldClearColor, oldClearAlpha);
      renderer.setClearAlpha(oldClearAlpha);
    }
  }

  protected renderStage(stageItem: StageItem, renderer: WebGLRenderer): void {
    const {stage} = stageItem;
    if (isStageRenderer(stage)) {
      stage.renderFrame(renderer);
    } else {
      if (stage.scene != null && stage.camera == null && stageItem.width > 0 && stageItem.height > 0) {
        stage.resize(stageItem.width, stageItem.height);
      }
      if (stage.scene && stage.camera) {
        renderer.render(stage.scene, stage.camera);
      }
    }
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

  #getIndex(stage: IStage): number {
    return this.stages.findIndex((item) => item.stage === stage);
  }

  hasStage(stage: IStage): boolean {
    return this.#getIndex(stage) !== -1;
  }

  addStage(stage: IStage): void {
    if (!this.hasStage(stage)) {
      const si: StageItem = {
        stage,
        width: 0,
        height: 0,
      };
      this.stages.push(si);
      this.#orderedStages = undefined;
      this.resizeStage(si, this.width, this.height);
      emit(this, StageAdded, {stage, renderer: this} as StageAddedProps);
    }
  }

  removeStage(stage: IStage): void {
    const index = this.#getIndex(stage);
    if (index !== -1) {
      this.stages.splice(index, 1);
      this.#orderedStages = undefined;
      emit(this, StageRemoved, {stage, renderer: this} as StageRemovedProps);
    }
  }
}

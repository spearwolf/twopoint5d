import {emit, type EventizedObject, eventize, once} from '@spearwolf/eventize';
import {Color, type WebGPURenderer} from 'three/webgpu';
import {isWebGLRenderer} from '../display/isWebGLRenderer.js';
import {
  OnAddToParent,
  OnRemoveFromParent,
  OnStageAdded,
  OnStageRemoved,
  type StageAddedProps,
  type StageRemovedProps,
} from '../events.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import type {IStageRendererHost} from './IStageRendererHost.js';

export type StageRendererParentType = IStageRendererHost | StageRenderer;

interface StageItem {
  stage: IStage & IRenderable;

  width: number;
  height: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface StageRenderer extends EventizedObject {}

/**
 * Renders a list of {@link IStage}s into a renderer, in order. Implements
 * {@link IStage} + {@link IRenderable} itself, so renderers can be nested.
 *
 * ## Frame-loop modes
 *
 * - **Auto-driven (recommended).** Pass a host (`Display` or parent
 *   `StageRenderer`) to the constructor (or call `attach(host)`): the renderer
 *   wires itself into the host's `onResize` / `onRenderFrame` and calls
 *   `updateFrame()` + `renderTo()` on every frame.
 * - **Manual.** Construct without a host and drive `updateFrame()` +
 *   `renderTo(renderer)` yourself from your own frame loop.
 *
 * **Do not mix the two.** If a `parent` is set, the renderer already ticks
 * itself — calling `updateFrame()` / `renderTo()` from your own
 * `OnDisplayRenderFrame` handler will render every frame twice.
 *
 * ## Clearing
 *
 * Clearing is opt-in via {@link clear} (default `false`). When `clear` is
 * `true`, the renderer clears the active render target before drawing its
 * stages, using {@link clearColor} / {@link clearAlpha} and the
 * `clearColorBuffer` / `clearDepthBuffer` / `clearStencilBuffer` flags.
 *
 * Setting `clearColor` to a non-null value also sets `clear = true` as a
 * convenience. Multiple stages are drawn additively into the same target
 * (the renderer sets `autoClear = false` while iterating stages) — use this
 * to layer stages on top of each other in a single pass.
 */
export class StageRenderer implements IStage, IRenderable {
  /**
   * Sort key for `parent.renderOrder` and for diagnostics. Defaults to
   * `'StageRenderer'`; rename when you have multiple nested renderers and
   * want to address them by name in a parent's `renderOrder`.
   */
  name = 'StageRenderer';

  #parent?: StageRendererParentType;

  width: number = 0;
  height: number = 0;

  /**
   * When `true`, the active render target is cleared before drawing the
   * stages. Defaults to `false`. Setting {@link clearColor} to a non-null
   * value flips this to `true` automatically.
   */
  clear: boolean = false;

  #clearColor: Color | null = null;

  /**
   * Color used when {@link clear} is `true`. `null` means "leave the
   * renderer's current clear color in place" — only `clearAlpha` is applied.
   *
   * Assigning a non-null `Color` activates {@link clear} as a convenience;
   * assigning `null` leaves `clear` untouched (set it explicitly to disable).
   */
  get clearColor(): Color | null {
    return this.#clearColor;
  }

  set clearColor(color: Color | null | undefined) {
    if (color == null) {
      this.#clearColor = null;
    } else {
      this.#clearColor = color;
      this.clear = true;
    }
  }

  /**
   * Alpha used when {@link clear} is `true`. Default `1`.
   * Set to `0` for a transparent clear.
   */
  clearAlpha: number = 1;

  clearColorBuffer = true;
  clearDepthBuffer = true;
  clearStencilBuffer = true;

  /**
   * Activate clearing with the given color/alpha. Sets `clear = true`.
   * Returns `this` for chaining.
   *
   * Pass `null` to clear without overriding the renderer's current color
   * (alpha still applies); `clear` is enabled in that case as well.
   */
  setClearColor(color: Color | null, alpha = 1): this {
    this.#clearColor = color;
    this.clearAlpha = alpha;
    this.clear = true;
    return this;
  }

  #oldClearColor = new Color(0x000000);

  /**
   * All stages are included here, but unsorted. The render order is not included here yet.
   * see `renderOrder` and `getOrderedStages()`
   */
  readonly stages: StageItem[] = [];

  #renderOrder = '*';
  #orderedStages?: StageItem[];

  /**
   * A comma separated list of stage names (see `IStage#name`) or `'*'` for
   * all other stages which are not listed explicitly.
   *
   * Stage `name`s must be unique within this renderer for the sort to be
   * deterministic — otherwise the warning emitted by {@link add} kicks in.
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

    emit(this, OnRemoveFromParent);

    if (this.#parent instanceof StageRenderer) {
      this.#parent.remove(this);
    }
  }

  #addToParent(): void {
    if (this.#parent instanceof StageRenderer) {
      this.#parent.add(this);
    } else {
      this.#addToHost(this.#parent as IStageRendererHost);
    }
    emit(this, OnAddToParent);
  }

  #addToHost(host: IStageRendererHost): void {
    once(
      this,
      OnRemoveFromParent,
      host.onResize(({width, height}) => {
        this.resize(width, height);
      }),
    );
    once(
      this,
      OnRemoveFromParent,
      host.onRenderFrame(({renderer, now, deltaTime, frameNo}) => {
        this.updateFrame(now, deltaTime, frameNo);
        this.renderTo(renderer);
      }),
    );
  }

  /**
   * @param parent Optional host (e.g. a `Display`) or parent `StageRenderer`.
   * Passing a parent enables the auto-driven frame loop — do not also drive
   * `updateFrame()`/`renderTo()` from your own handler (see class docs).
   */
  constructor(parent?: StageRendererParentType) {
    eventize(this);
    if (parent) {
      this.parent = parent;
    }
  }

  /** Equivalent to assigning `this.parent = parent`. */
  attach(parent: StageRendererParentType): this {
    this.parent = parent;
    return this;
  }

  /** Equivalent to assigning `this.parent = undefined`. */
  detach(): this {
    this.parent = undefined;
    return this;
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
    for (const {stage} of this.orderedStages) {
      stage.updateFrame(now, deltaTime, frameNo);
    }
  }

  /**
   * Render all stages into `renderer` (applies the clear policy first).
   * This is the {@link IRenderable} method — call it from your frame loop
   * if you are running in manual mode (no `parent` set).
   */
  renderTo(renderer: WebGPURenderer): void {
    if (isWebGLRenderer(renderer)) {
      throw new TypeError('The WebGLRenderer renderer is not supported anymore');
    }

    const wasPreviouslyAutoClear = renderer.autoClear;

    if (this.clear) {
      const oldClearAlpha = renderer.getClearAlpha();
      let colorWasOverridden = false;

      if (this.#clearColor != null) {
        renderer.getClearColor(this.#oldClearColor as any);
        renderer.setClearColor(this.#clearColor, this.clearAlpha);
        colorWasOverridden = true;
      } else {
        renderer.setClearAlpha(this.clearAlpha);
      }

      renderer.clear(this.clearColorBuffer, this.clearDepthBuffer, this.clearStencilBuffer);

      if (colorWasOverridden) {
        renderer.setClearColor(this.#oldClearColor, oldClearAlpha);
      } else {
        renderer.setClearAlpha(oldClearAlpha);
      }
    }

    renderer.autoClear = false;

    for (const stageItem of this.orderedStages) {
      this.renderStage(stageItem, renderer);
    }

    renderer.autoClear = wasPreviouslyAutoClear;
  }

  protected renderStage(stageItem: StageItem, renderer: WebGPURenderer): void {
    stageItem.stage.renderTo(renderer);
  }

  get orderedStages(): StageItem[] {
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

  /**
   * Add a stage. The stage must implement both {@link IStage} and
   * {@link IRenderable}. Returns `this` for chaining.
   *
   * Emits `OnStageAdded`. Warns when `renderOrder` is set and another stage
   * already uses the same `name` — sort order is ambiguous in that case.
   */
  add(stage: IStage & IRenderable): this {
    if (!this.hasStage(stage)) {
      if (this.#renderOrder !== '*' && this.stages.some((item) => item.stage.name === stage.name)) {
        // eslint-disable-next-line no-console
        console.warn(
          `StageRenderer: a stage named ${JSON.stringify(stage.name)} is already present and renderOrder=${JSON.stringify(
            this.#renderOrder,
          )} cannot disambiguate. Set unique names on your stages.`,
        );
      }
      const si: StageItem = {
        stage,
        width: 0,
        height: 0,
      };
      this.stages.push(si);
      this.#orderedStages = undefined;
      this.resizeStage(si, this.width, this.height);
      emit(this, OnStageAdded, {stage, renderer: this} as StageAddedProps);
    }
    return this;
  }

  /**
   * Remove a stage. Returns `this` for chaining. Emits `OnStageRemoved`.
   */
  remove(stage: IStage): this {
    const index = this.#getIndex(stage);
    if (index !== -1) {
      this.stages.splice(index, 1);
      this.#orderedStages = undefined;
      emit(this, OnStageRemoved, {stage, renderer: this} as StageRemovedProps);
    }
    return this;
  }
}

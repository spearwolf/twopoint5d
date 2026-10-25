/**
 * Per-frame contract of a stage: sized container with an update tick.
 *
 * Stages describe the **what** (scene, projection, frame logic).
 * Stages do **not** render themselves — see {@link IRenderable}.
 */
export interface IStage {
  /**
   * Sort key for {@link StageRenderer.renderOrder}. Stages sharing a name that
   * `renderOrder` lists render together at its position, in the order they
   * were added, and the `StageRenderer` warns about them; a stage needs a name
   * of its own to get a position of its own. A stage renamed after `add()` is
   * sorted under its new name from the next frame on.
   */
  name: string;

  /**
   * Called by the parent `StageRenderer` when the container size or its pixel ratio changes.
   * `pixelRatio` is the pixels of the drawing buffer per unit of `width` and `height` —
   * `Display#pixelRatio` —, a finite number above 0; a stage that has no use for it ignores it.
   */
  resize(width: number, height: number, pixelRatio?: number): void;

  /** Called once per frame, before any rendering. */
  updateFrame(now: number, deltaTime: number, frameNo: number): void;
}

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

  /** Called by the parent `StageRenderer` when the container size changes. */
  resize(width: number, height: number): void;

  /** Called once per frame, before any rendering. */
  updateFrame(now: number, deltaTime: number, frameNo: number): void;
}

/**
 * Per-frame contract of a stage: sized container with an update tick.
 *
 * Stages describe the **what** (scene, projection, frame logic).
 * Stages do **not** render themselves — see {@link IRenderable}.
 */
export interface IStage {
  /**
   * Sort key for {@link StageRenderer.renderOrder}. Should be unique within a
   * single `StageRenderer`, otherwise `renderOrder` cannot disambiguate.
   */
  name: string;

  /** Called by the parent `StageRenderer` when the container size changes. */
  resize(width: number, height: number): void;

  /** Called once per frame, before any rendering. */
  updateFrame(now: number, deltaTime: number, frameNo: number): void;
}

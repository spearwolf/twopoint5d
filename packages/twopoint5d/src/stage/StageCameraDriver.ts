import type {Camera} from 'three/webgpu';
import type {IProjection} from './IProjection.js';

/**
 * What places and writes the camera of a `Stage2D` in place of its projection while it is attached
 * through `Stage2DInternals.attachDriver()`. Not part of the public API.
 *
 * The stage draws with {@link camera} for as long as the driver is attached. Wherever it would
 * place its camera through the projection, it calls {@link placeBase} instead, emits
 * `OnStageCameraPlaced` with the camera that answers, and then calls {@link compose}. In every
 * `updateFrame()` with a camera it calls {@link write}, before `OnStageUpdateFrame`.
 * @internal
 */
export interface StageCameraDriver {
  /**
   * The camera the stage draws with while the driver is attached: `stage.camera` answers it. A
   * driver that swaps it for another tells the stage through `Stage2DInternals.announceCamera()`.
   */
  readonly camera: Camera;

  /**
   * Lets `projection` place a base camera of the driver's own — of the kind the projection builds,
   * never drawn with — and answers it. The view of the projection is up to date when the stage
   * calls it; what the projection throws comes out of this call, and the stage then keeps the
   * view it had.
   */
  placeBase(projection: IProjection): Camera;

  /**
   * Composes the camera the stage draws with over the base, once the listeners of
   * `OnStageCameraPlaced` have changed the base as they wish. Called after every
   * {@link placeBase}, also behind a listener that threw.
   */
  compose(): void;

  /** Writes {@link camera} for the frame, in every `updateFrame()` with a camera, before `OnStageUpdateFrame`. */
  write(): void;
}

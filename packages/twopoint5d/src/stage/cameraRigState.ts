import {copyPoseValues, createPoseValues} from './cameraPose.js';
import {createRest, type Rest} from './cameraRest.js';
import {copyShot, createShot} from './cameraShot.js';
import {copyObjectFollow, createLook, createObjectFollow, type TargetKind} from './cameraTarget.js';
import type {CameraTrack} from './cameraTrack.js';
import type {IProjection} from './IProjection.js';

/**
 * What the camera of a CameraRig shows while it takes part in no flight:
 *
 * - `'pose'`: the pose over the rest of the stage — also after a `jump()` to a projection, and once a
 *   move to a pose or a projection has arrived;
 * - `'held'`: the shot `cancel()` held;
 * - `'move'`: a move is under way, to the target of `targetKind`;
 * - `'locked'`: locked on to a camera or an `Object3D`, which it follows;
 * - `'track'`: the shot of a track at its shown progress.
 *
 * @internal
 */
export type CameraRigMode = 'pose' | 'held' | 'move' | 'locked' | 'track';

/** Whether a target of `kind` is followed: a camera or an `Object3D`. @internal */
export const isFollowed = (kind: TargetKind): boolean => kind === 'camera' || kind === 'object';

/**
 * The target state of a `CameraRig`: its mode and everything it resolves its shot from. A flight
 * across a transition saves it whole and gives it back whole.
 * @internal
 */
export class CameraRigState {
  mode: CameraRigMode = 'pose';
  /** The kind of the target of a move or a lock-on; a camera and an `Object3D` are followed. */
  targetKind: TargetKind = 'pose';

  /** The pose of the target. */
  readonly pose = createPoseValues();
  /** The look the rig shows: the one of the target, or of `look()` since. */
  readonly look = createLook();

  /** The shot `cancel()` held, its lens kept as a zoom; `holdingTurn` while it keeps its own turn. */
  readonly held = createShot();
  holdingTurn = false;

  /** The track of the mode `'track'`: its keys and its progress. */
  track: CameraTrack | undefined = undefined;

  /**
   * The projection the target resolves on, placed for the container of the stage: the one a move
   * travels to, which the arrival assigns to the stage where `assigns`, or the CameraProjection of a
   * camera target, which it does not. `rest` is its rest where `placed`, for the container of
   * `width`, `height` and `pixelRatio`.
   */
  projection: IProjection | undefined = undefined;
  assigns = false;
  rest: Rest = createRest();
  placed = false;
  width = 0;
  height = 0;
  pixelRatio = 0;

  /** The `Object3D` the rig follows, with the offset and the trailing of the move. */
  readonly follow = createObjectFollow();

  /** The focus and the depth of a lens change the move names, `NaN` where it names none. */
  focus = Number.NaN;
  depth = Number.NaN;

  /**
   * Copies `source` into this state and answers it: the values of the pose, the look, the held
   * shot, the follow and every number and flag, and the references of the track, the projection and
   * its rest. The rest goes by reference since it is not rewritten in place where a new target comes:
   * a target with a projection gets a rest of its own when the rig takes it, so a saved rest stays
   * as it was, and a target without a projection places none.
   */
  copy(source: CameraRigState): this {
    this.mode = source.mode;
    this.targetKind = source.targetKind;
    copyPoseValues(source.pose, this.pose);
    this.look.yaw = source.look.yaw;
    this.look.pitch = source.look.pitch;
    copyShot(source.held, this.held);
    this.holdingTurn = source.holdingTurn;
    this.track = source.track;
    this.projection = source.projection;
    this.assigns = source.assigns;
    this.rest = source.rest;
    this.placed = source.placed;
    this.width = source.width;
    this.height = source.height;
    this.pixelRatio = source.pixelRatio;
    copyObjectFollow(source.follow, this.follow);
    this.focus = source.focus;
    this.depth = source.depth;
    return this;
  }
}

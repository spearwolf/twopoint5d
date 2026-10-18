import {Quaternion} from 'three/webgpu';
import {defineFeature} from '../SpriteFeature.js';

export interface OrientationApi {
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  /**
   * Sets the orientation as the four values of a unit quaternion, `w` last — the order of
   * `Quaternion#toArray()`. The placement does not normalize it: a quaternion of another length
   * scales the sprite by the square of that length.
   */
  setOrientation(qx: number, qy: number, qz: number, qw: number): void;
  setOrientation(orientation: [qx: number, qy: number, qz: number, qw: number]): void;
  /**
   * Turns the sprite as `Object3D.quaternion` turns an object: about the origin of its quad, after
   * the plane and before the instance position.
   *
   * `orientation` is a static attribute. What is written to it before the first `update()` after
   * `createSprite()` reaches the gpu with it; a later change reaches the gpu only once it is marked
   * for upload — `spritePool.touchVO(sprite, 'orientation')` for this sprite alone,
   * `geometry.touch('orientation')` for every sprite in use. An orientation that changes every frame
   * belongs in a geometry built with `attributeUsage: {dynamic: ['orientation']}`.
   */
  setQuaternion(quaternion: Quaternion): void;
  /**
   * Answers the orientation in `target`. Without a `target` every call builds a new `Quaternion` —
   * in an update loop, hand in one that is reused.
   */
  getQuaternion(target?: Quaternion): Quaternion;
  /**
   * Writes the quaternion of a turn about +Y of the mesh, in the sense of `Object3D.rotation.y`: the
   * same facing as a `yaw` of that angle under `flatPlacement({orientation: 'yaw'})`.
   */
  setYaw(angle: number): void;
}

// one tuple serves every call: in it the fractional values stay unboxed on their way to the
// generated setter, which copies them into the buffer of the sprite
const orientationScratch: [qx: number, qy: number, qz: number, qw: number] = [0, 0, 0, 1];

/**
 * The orientation of a sprite as a unit quaternion — any tilt, where `Yaw` turns about +Y alone.
 * Data alone: a placement of `flatPlacement({orientation: 'quaternion'})` reads it, every other
 * placement leaves it be.
 */
export const Orientation = defineFeature<OrientationApi>({
  name: 'orientation',
  attributes: {orientation: {components: ['qx', 'qy', 'qz', 'qw']}},
  methods: {
    setQuaternion(quaternion: Quaternion) {
      orientationScratch[0] = quaternion.x;
      orientationScratch[1] = quaternion.y;
      orientationScratch[2] = quaternion.z;
      orientationScratch[3] = quaternion.w;
      this.setOrientation(orientationScratch);
    },
    getQuaternion(target: Quaternion = new Quaternion()) {
      return target.set(this.qx, this.qy, this.qz, this.qw);
    },
    setYaw(angle: number) {
      const half = angle / 2;
      orientationScratch[0] = 0;
      orientationScratch[1] = Math.sin(half);
      orientationScratch[2] = 0;
      orientationScratch[3] = Math.cos(half);
      this.setOrientation(orientationScratch);
    },
  },
  initialize() {
    // 0 is not neutral for a quaternion: a new sprite starts unturned
    this.setOrientation(0, 0, 0, 1);
  },
});

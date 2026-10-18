import {defineFeature} from '../SpriteFeature.js';

export interface YawApi {
  /**
   * The turn of the sprite about +Y of its mesh, in radians, in the sense of `Object3D.rotation.y`
   * — counter-clockwise as seen from above.
   *
   * `yaw` is a static attribute. What is written to it before the first `update()` after
   * `createSprite()` reaches the gpu with it; a later change reaches the gpu only once it is marked
   * for upload — `spritePool.touchVO(sprite, 'yaw')` for this sprite alone, `geometry.touch('yaw')`
   * for every sprite in use. A yaw that changes every frame belongs in a geometry built with
   * `attributeUsage: {dynamic: ['yaw']}`.
   */
  yaw: number;
}

/**
 * The facing of a sprite as a turn about +Y of its mesh. Data alone: a placement of
 * `flatPlacement({orientation: 'yaw'})` reads it, every other placement leaves it be.
 */
export const Yaw = defineFeature<YawApi>({
  name: 'yaw',
  attributes: {yaw: {size: 1}},
  initialize() {
    this.yaw = 0;
  },
});

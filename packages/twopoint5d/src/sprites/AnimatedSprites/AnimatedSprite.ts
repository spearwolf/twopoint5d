import {voInitialize} from '../../vertex-objects/constants.js';
import type {VertexObjectDescription, VO} from '../../vertex-objects/types.js';

export interface AnimatedSprite extends VO {
  width: number;
  height: number;

  /**
   * The animation of the animsMap the sprite plays.
   *
   * `anim` — `animId` and `animOffset` — is a static attribute. What is written to it before the
   * first `update()` after `createSprite()` reaches the gpu with it; a later change reaches the gpu
   * only once it is marked for upload — `spritePool.touchVO(sprite, 'anim')` for this sprite alone,
   * `geometry.touch('anim')` for every sprite in use. An animation that changes every frame belongs
   * in a geometry built with `attributeUsage: {dynamic: ['anim']}`, whose attribute uploads with
   * every `update()`.
   */
  animId: number;
  /**
   * The time, in seconds, the animation of the sprite is ahead of the time of the material.
   *
   * It is part of the static attribute `anim` and reaches the gpu the way {@link animId} describes.
   */
  animOffset: number;

  x: number;
  y: number;
  z: number;

  rotation: number;

  setQuadSize(width: number, height: number): void;
  setQuadSize(quadSize: [width: number, height: number]): void;
  setInstancePosition(x: number, y: number, z: number): void;
  /** A tuple of two values writes `x` and `y` and leaves `z` as it is. */
  setInstancePosition(position: [x: number, y: number, z?: number]): void;
}

// V8 boxes a fractional value that a method hands on as an argument of its own to a setter it
// does not inline in a full frame loop — a heap number of 16 B per value; in a tuple the value
// stays unboxed, and the setters copy it into the buffer of the sprite, so one tuple serves every call
const quadSizeScratch: [width: number, height: number] = [0, 0];
const positionScratch: [x: number, y: number, z: number] = [0, 0, 0];

// the setter writes only as many values as a tuple holds, so a shorter tuple leaves z as it is. A
// tuple of its own rather than an undefined in the one above: an undefined turns the array away
// from plain doubles, and V8 then boxes every fractional value written into it
const positionXYScratch: [x: number, y: number] = [0, 0];

export class AnimatedSprite {
  [voInitialize]() {
    // the slot createVO() hands out still carries the values of the sprite that stood in it before;
    // a new sprite starts from the values of a slot no sprite has stood in
    this.setQuadSize(0, 0);
    this.animId = 0;
    this.animOffset = 0;
    this.setInstancePosition(0, 0, 0);
    this.rotation = 0;
  }

  /**
   * Sets the size of the quad of the sprite.
   *
   * `quadSize` is a static attribute. What is written to it before the first `update()` after
   * `createSprite()` reaches the gpu with it; a later change reaches the gpu only once it is marked
   * for upload — `spritePool.touchVO(sprite, 'quadSize')` for this sprite alone,
   * `geometry.touch('quadSize')` for every sprite in use. A size that changes every frame belongs in
   * a geometry built with `attributeUsage: {dynamic: ['size']}`, whose attribute uploads with every
   * `update()`.
   */
  setSize(width: number, height: number): void {
    quadSizeScratch[0] = width;
    quadSizeScratch[1] = height;
    this.setQuadSize(quadSizeScratch);
  }

  /**
   * Sets the position of the sprite. Without a `z` the sprite keeps the one it has; a sprite out of
   * `createSprite()` starts at `z = 0`.
   */
  setPosition(x: number, y: number, z?: number): void {
    if (z === undefined) {
      positionXYScratch[0] = x;
      positionXYScratch[1] = y;
      this.setInstancePosition(positionXYScratch);
      return;
    }
    positionScratch[0] = x;
    positionScratch[1] = y;
    positionScratch[2] = z;
    this.setInstancePosition(positionScratch);
  }
}

export const AnimatedSpriteDescriptor: VertexObjectDescription = {
  attributes: {
    quadSize: {components: ['width', 'height']},
    anim: {components: ['animId', 'animOffset']},
    instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    rotation: {size: 1, usage: 'dynamic'},
  },

  basePrototype: AnimatedSprite.prototype,
};

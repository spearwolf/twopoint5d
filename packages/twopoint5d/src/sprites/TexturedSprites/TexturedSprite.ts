import {Color, type Node} from 'three/webgpu';
import {voInitialize} from '../../vertex-objects/constants.js';
import {frameTrimMargins, type FrameTrimMargins} from '../../texture/frameTrimMargins.js';
import type {TextureAtlasFrame} from '../../texture/TextureAtlas.js';
import type {VertexObjectDescription, VO} from '../../vertex-objects/types.js';

export interface TexturedSprite extends VO {
  width: number;
  height: number;

  x: number;
  y: number;
  z: number;

  s: number;
  t: number;
  u: number;
  v: number;

  /**
   * `1` while the frame on the sprite is drawn with `TextureCoords.FLIP_DIAGONAL` (the lookup swaps
   * its two components), `0` otherwise. `setFrame()` writes it together with the tex coords, and a
   * caller who writes the tex coords of a `TextureCoords` through `setTexCoords()` writes it as well.
   * A sprite out of `createVO()` starts with 0.
   */
  texFlipDiagonal: number;

  /**
   * The margins a packer cut off the frame on the sprite, as fractions of the untrimmed sprite:
   * `trimLeft` and `trimRight` of its width, `trimTop` and `trimBottom` of its height — 0 at every side
   * for an untrimmed frame. `setFrame()` writes them. They move the corners of the unit quad onto the
   * part of the sprite the trimmed frame covers; a base quad of another side length is moved by the
   * measure of the unit quad all the same.
   */
  trimLeft: number;
  trimTop: number;
  trimRight: number;
  trimBottom: number;

  rotation: number;

  r: number;
  g: number;
  b: number;
  a: number;

  setQuadSize(width: number, height: number): void;
  setQuadSize(quadSize: [width: number, height: number]): void;
  setTexCoords(s: number, t: number, u: number, v: number): void;
  setTexCoords(texCoords: [s: number, t: number, u: number, v: number]): void;
  setTexTrim(left: number, top: number, right: number, bottom: number): void;
  setTexTrim(margins: [left: number, top: number, right: number, bottom: number]): void;
  setInstancePosition(x: number, y: number, z: number): void;
  /** A tuple of two values writes `x` and `y` and leaves `z` as it is. */
  setInstancePosition(position: [x: number, y: number, z?: number]): void;
  /** Sets the color that tints the sprite, alpha included — see {@link TexturedSprite.setColor}. */
  setColorValues(r: number, g: number, b: number, a: number): void;
  /** A tuple of three values writes `r`, `g` and `b` and leaves the alpha as it is. */
  setColorValues(color: [r: number, g: number, b: number, a?: number]): void;
}

/**
 * What {@link TexturedSprite.setFrame} writes for one frame of an atlas, worked out once: the tex
 * coords, the diagonal flip and the trim margins. Built by {@link prepareSpriteFrame} and written by
 * {@link TexturedSprite.setPreparedFrame}.
 */
export interface PreparedSpriteFrame {
  readonly texCoords: [s: number, t: number, u: number, v: number];
  readonly texFlipDiagonal: number;
  readonly texTrim: [left: number, top: number, right: number, bottom: number];
}

/**
 * Works out what {@link TexturedSprite.setFrame} writes for `frame`, for sprites that change their
 * frame often: {@link TexturedSprite.setPreparedFrame} then copies nine numbers into the sprite,
 * where `setFrame()` walks the coords up to their root texture and reads the trim out of the frame
 * data on every call.
 *
 * The result is a snapshot of the frame at the time of the call: once the `coords` or the `data` of
 * the frame change — a new `flip`, another parent — prepare it again.
 *
 * `frame` is a frame of any atlas, whatever the type of its data: the trim margins come from
 * TexturePacker data and are zero for every other.
 */
export function prepareSpriteFrame(frame: TextureAtlasFrame<unknown>): PreparedSpriteFrame {
  return {
    texCoords: frame.coords.getTexCoords(),
    texFlipDiagonal: frame.coords.flipD ? 1 : 0,
    texTrim: frameTrimMargins(frame.data),
  };
}

// setTexCoords() copies the four values into the buffer of the sprite, so one tuple serves every call
const texCoordsScratch: [s: number, t: number, u: number, v: number] = [0, 0, 0, 0];

// setTexTrim() copies the four margins into the buffer of the sprite as well
const trimScratch: FrameTrimMargins = [0, 0, 0, 0];

// V8 boxes a fractional value that a method hands on as an argument of its own to a setter it
// does not inline in a full frame loop — a heap number of 16 B per value; in a tuple the value
// stays unboxed, and the setters copy it into the buffer of the sprite, so one tuple serves every call
const quadSizeScratch: [width: number, height: number] = [0, 0];
const positionScratch: [x: number, y: number, z: number] = [0, 0, 0];
const colorScratch: [r: number, g: number, b: number, a: number] = [0, 0, 0, 0];

// the setters write only as many values as a tuple holds, so a shorter tuple leaves the last value
// as it is. A tuple of its own rather than an undefined in the one above: an undefined turns the
// array away from plain doubles, and V8 then boxes every fractional value written into it
const positionXYScratch: [x: number, y: number] = [0, 0];
const colorRGBScratch: [r: number, g: number, b: number] = [0, 0, 0];

export class TexturedSprite {
  [voInitialize]() {
    // the slot createVO() hands out still carries the values of the sprite that stood in it before;
    // a new sprite starts from the values of a slot no sprite has stood in — 0 in every attribute,
    // and white as the color that tints it
    this.setQuadSize(0, 0);
    this.setTexCoords(0, 0, 0, 0);
    this.texFlipDiagonal = 0;
    this.setTexTrim(0, 0, 0, 0);
    this.setInstancePosition(0, 0, 0);
    this.rotation = 0;
    this.setColorValues(1, 1, 1, 1);
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

  /**
   * Writes the tex coords, the diagonal flip and the trim margins of the frame to the sprite.
   * `frame` is a frame of any atlas, whatever the type of its data: the trim margins come from
   * TexturePacker data and are zero for every other.
   *
   * The quad of the sprite — `width`, `height` — stands for the untrimmed sprite: a trimmed frame lies
   * in the part of it the packer cut the frame out of. A sprite that shows trimmed frames is therefore
   * sized by the `sourceSize` of its frames, not by the measures of their `coords`.
   *
   * Every call works the values out of the frame as it is at that moment. Sprites that change their
   * frame every frame take {@link prepareSpriteFrame} once per atlas frame and
   * {@link setPreparedFrame} per sprite.
   *
   * `texCoords` is a static attribute, and `texFlipDiagonal` and `texTrim` take the same way up. What
   * is written to them before the first `update()` after `createSprite()` reaches the gpu with it; a
   * later change reaches the gpu only once it is marked for upload —
   * `spritePool.touchVO(sprite, 'texCoords')` for this sprite alone, `geometry.touch('texCoords')` for
   * every sprite in use. A frame that changes every frame belongs in a geometry built with
   * `attributeUsage: {dynamic: ['texCoords']}`, whose attributes upload with every `update()`.
   */
  setFrame(frame: TextureAtlasFrame<unknown>): void {
    this.setTexCoords(frame.coords.getTexCoords(texCoordsScratch));
    this.texFlipDiagonal = frame.coords.flipD ? 1 : 0;
    this.setTexTrim(frameTrimMargins(frame.data, trimScratch));
  }

  /**
   * Writes a frame prepared by {@link prepareSpriteFrame} to the sprite: the same values as
   * {@link setFrame} for the frame as it was when it was prepared, without working them out again.
   *
   * The upload takes the way {@link setFrame} describes: `spritePool.touchVO(sprite, 'texCoords')`
   * or `geometry.touch('texCoords')` for a later change, or a geometry built with
   * `attributeUsage: {dynamic: ['texCoords']}`.
   */
  setPreparedFrame(prepared: PreparedSpriteFrame): void {
    this.setTexCoords(prepared.texCoords);
    this.texFlipDiagonal = prepared.texFlipDiagonal;
    this.setTexTrim(prepared.texTrim);
  }

  /**
   * Sets the color that tints the sprite. The sprite materials multiply what they draw by it,
   * alpha included; white, the color every sprite starts with, leaves the sprite as it is. Without
   * an `a` the sprite keeps the alpha it has; a sprite out of `createSprite()` starts with an alpha
   * of 1.
   *
   * An alpha between 0 and 1 blends only on a material with `transparent: true`, and under the
   * default alpha test a sprite with an alpha of 0 is not drawn at all.
   *
   * `color` is a static attribute. What is written to it before the first `update()` after
   * `createSprite()` reaches the gpu with it; a later change reaches the gpu only once it is marked
   * for upload — `spritePool.touchVO(sprite, 'color')` for this sprite alone,
   * `geometry.touch('color')` for every sprite in use. A color that changes every frame belongs in a
   * geometry built with `attributeUsage: {dynamic: ['color']}`, whose attribute uploads with every
   * `update()`.
   */
  setColor(color: Color, a?: number): void {
    if (a === undefined) {
      colorRGBScratch[0] = color.r;
      colorRGBScratch[1] = color.g;
      colorRGBScratch[2] = color.b;
      this.setColorValues(colorRGBScratch);
      return;
    }
    colorScratch[0] = color.r;
    colorScratch[1] = color.g;
    colorScratch[2] = color.b;
    colorScratch[3] = a;
    this.setColorValues(colorScratch);
  }

  /**
   * Answers `r`, `g` and `b` of the sprite in `target`; the alpha is not part of a `Color`, read `a`
   * for it. Without a `target` every call builds a new `Color` — in an update loop, hand in one that
   * is reused.
   */
  getColor(target: Color = new Color()): Color {
    return target.set(this.r, this.g, this.b);
  }
}

export const TexturedSpriteDescriptor: VertexObjectDescription = {
  attributes: {
    quadSize: {components: ['width', 'height']},
    texCoords: {components: ['s', 't', 'u', 'v']},
    texFlipDiagonal: {size: 1},
    texTrim: {components: ['trimLeft', 'trimTop', 'trimRight', 'trimBottom']},
    instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    rotation: {size: 1, usage: 'dynamic'},
    color: {components: ['r', 'g', 'b', 'a'], setter: 'setColorValues', getter: false},
  },

  basePrototype: TexturedSprite.prototype,
};

export type TAttributeNodeQuadSize = Node<'vec2'>;
export type TAttributeNodeTexCoords = Node<'vec4'>;
/** Whether the lookup of a frame swaps its two components: above 0.5 for a frame with `TextureCoords.FLIP_DIAGONAL`. */
export type TAttributeNodeTexFlipDiagonal = Node<'float'>;
/** `[left, top, right, bottom]`: the margins of a trimmed frame, as fractions of the untrimmed sprite. */
export type TAttributeNodeTexTrim = Node<'vec4'>;
/** The position of a vertex of the unit quad a sprite is drawn from, before scale, rotation and instance position. */
export type TAttributeNodeVertexPosition = Node<'vec3'>;
export type TAttributeNodeInstancePosition = Node<'vec3'>;
export type TAttributeNodeRotation = Node<'float'>;
export type TAttributeNodeColor = Node<'vec4'>;

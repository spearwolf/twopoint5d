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
  setInstancePosition(position: [x: number, y: number, z: number]): void;
  /** Sets the color that tints the sprite, alpha included — see {@link TexturedSprite.setColor}. */
  setColorValues(r: number, g: number, b: number, a: number): void;
  setColorValues(color: [r: number, g: number, b: number, a: number]): void;
}

// setTexCoords() copies the four values into the buffer of the sprite, so one tuple serves every call
const texCoordsScratch: [s: number, t: number, u: number, v: number] = [0, 0, 0, 0];

// setTexTrim() copies the four margins into the buffer of the sprite as well
const trimScratch: FrameTrimMargins = [0, 0, 0, 0];

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

  setSize(width: number, height: number): void {
    this.setQuadSize(width, height);
  }

  setPosition(x: number, y: number, z = 0): void {
    this.setInstancePosition(x, y, z);
  }

  /**
   * Writes the tex coords, the diagonal flip and the trim margins of the frame to the sprite.
   *
   * The quad of the sprite — `width`, `height` — stands for the untrimmed sprite: a trimmed frame lies
   * in the part of it the packer cut the frame out of. A sprite that shows trimmed frames is therefore
   * sized by the `sourceSize` of its frames, not by the measures of their `coords`.
   */
  setFrame(frame: TextureAtlasFrame): void {
    this.setTexCoords(frame.coords.getTexCoords(texCoordsScratch));
    this.texFlipDiagonal = frame.coords.flipD ? 1 : 0;
    this.setTexTrim(frameTrimMargins(frame.data, trimScratch));
  }

  /**
   * Sets the color that tints the sprite. The sprite materials multiply what they draw by it,
   * alpha included; white, the color every sprite starts with, leaves the sprite as it is.
   *
   * An alpha between 0 and 1 blends only on a material with `transparent: true`, and under the
   * default alpha test a sprite with an alpha of 0 is not drawn at all.
   */
  setColor(color: Color, a = 1): void {
    this.setColorValues(color.r, color.g, color.b, a);
  }

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

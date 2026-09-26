import {Color, type Node} from 'three/webgpu';
import {voInitialize} from '../../vertex-objects/constants.js';
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
   */
  texFlipDiagonal: number;

  rotation: number;

  r: number;
  g: number;
  b: number;
  a: number;

  setQuadSize(width: number, height: number): void;
  setQuadSize(quadSize: [width: number, height: number]): void;
  setTexCoords(s: number, t: number, u: number, v: number): void;
  setTexCoords(texCoords: [s: number, t: number, u: number, v: number]): void;
  setInstancePosition(x: number, y: number, z: number): void;
  setInstancePosition(position: [x: number, y: number, z: number]): void;
  /** Sets the color that tints the sprite, alpha included — see {@link TexturedSprite.setColor}. */
  setColorValues(r: number, g: number, b: number, a: number): void;
  setColorValues(color: [r: number, g: number, b: number, a: number]): void;
}

// setTexCoords() copies the four values into the buffer of the sprite, so one tuple serves every call
const texCoordsScratch: [s: number, t: number, u: number, v: number] = [0, 0, 0, 0];

export class TexturedSprite {
  [voInitialize]() {
    this.setColorValues(1, 1, 1, 1);
  }

  setSize(width: number, height: number): void {
    this.setQuadSize(width, height);
  }

  setPosition(x: number, y: number, z = 0): void {
    this.setInstancePosition(x, y, z);
  }

  setFrame(frame: TextureAtlasFrame): void {
    this.setTexCoords(frame.coords.getTexCoords(texCoordsScratch));
    this.texFlipDiagonal = frame.coords.flipD ? 1 : 0;
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
/** The position of a vertex of the unit quad a sprite is drawn from, before scale, rotation and instance position. */
export type TAttributeNodeVertexPosition = Node<'vec3'>;
export type TAttributeNodeInstancePosition = Node<'vec3'>;
export type TAttributeNodeRotation = Node<'float'>;
export type TAttributeNodeColor = Node<'vec4'>;

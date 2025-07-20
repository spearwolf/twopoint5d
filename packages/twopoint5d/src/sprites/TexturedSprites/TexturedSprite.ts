import {Color} from 'three/webgpu';
import {voInitialize} from '../../index.js';
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

  rotation: number;

  r: number;
  g: number;
  b: number;
  a: number;

  setQuadSize(quadSize: [width: number, height: number]): void;
  setTexCoords(texCoords: [s: number, t: number, u: number, v: number]): void;
  setInstancePosition(position: [x: number, y: number, z: number]): void;
  setColorValues(color: [r: number, g: number, b: number, b: number]): void;
}

export class TexturedSprite {
  [voInitialize]() {
    this.setColorValues([1, 1, 1, 1]);
  }

  setSize(width: number, height: number): void {
    this.setQuadSize([width, height]);
  }

  setPosition(x: number, y: number, z = 0): void {
    this.setInstancePosition([x, y, z]);
  }

  setFrame(frame: TextureAtlasFrame): void {
    const {coords} = frame;
    this.setTexCoords([coords.s, coords.t, coords.u, coords.v]);
  }

  setColor(color: Color, a = 1): void {
    this.setColorValues([color.r, color.g, color.b, a]);
  }

  getColor(target: Color = new Color()): Color {
    return target.set(this.r, this.g, this.b);
  }
}

export const TexturedSpriteDescriptor: VertexObjectDescription = {
  meshCount: 1,

  attributes: {
    quadSize: {components: ['width', 'height']},
    texCoords: {components: ['s', 't', 'u', 'v']},
    instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    rotation: {size: 1, usage: 'dynamic'},
    color: {components: ['r', 'g', 'b', 'a'], setter: 'setColorValues', getter: false},
  },

  basePrototype: TexturedSprite.prototype,
};

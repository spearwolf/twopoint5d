import type {TextureAtlasFrame} from '../vertexObjects/TextureAtlas.js';
import type {VertexObjectDescription, VO} from '../vertexObjects/types.js';

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

  setQuadSize(quadSize: [width: number, height: number]): void;
  setTexCoords(texCoords: [s: number, t: number, u: number, v: number]): void;
  setInstancePosition(position: [x: number, y: number, z: number]): void;
}

export class TexturedSprite {
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
}

export const TexturedSpriteDescriptor: VertexObjectDescription = {
  meshCount: 1,

  attributes: {
    quadSize: {components: ['width', 'height']},
    texCoords: {components: ['s', 't', 'u', 'v']},
    instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    rotation: {size: 1, usage: 'dynamic'},
  },

  basePrototype: TexturedSprite.prototype,
};

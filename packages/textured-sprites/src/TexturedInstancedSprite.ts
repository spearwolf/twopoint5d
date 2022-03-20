import {TextureAtlasFrame, VertexObjectDescription, VO} from '@spearwolf/vertex-objects';

export interface TexturedInstancedSprite extends VO {
  rotation: number;

  setQuadSize(quadSize: [width: number, height: number]): void;
  setTexCoords(texCoords: [s: number, t: number, u: number, v: number]): void;
  setInstancePosition(position: [x: number, y: number, z: number]): void;
}

export class TexturedInstancedSprite {
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

export const TexturedInstancedSpriteDescriptor: VertexObjectDescription = {
  meshCount: 1,

  attributes: {
    quadSize: {components: ['width', 'height']},
    texCoords: {size: 4},
    instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    rotation: {size: 1, usage: 'dynamic'},
  },

  basePrototype: TexturedInstancedSprite.prototype,
};

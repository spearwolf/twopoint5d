import {TextureAtlasFrame, VertexObjectDescription, VO} from 'three-vertex-objects';

export interface InstancedSprite extends VO {
  rotation: number;

  setQuadSize(quadSize: [width: number, height: number]): void;
  setTexCoords(texCoords: [s: number, t: number, u: number, v: number]): void;
  setInstancePosition(position: [x: number, y: number, z: number]): void;
}

export class InstancedSprite {
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

export const InstancedSpriteDescriptor: VertexObjectDescription = {
  meshCount: 1,

  attributes: {
    quadSize: {components: ['width', 'height']},
    texCoords: {size: 4},
    instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    rotation: {size: 1, usage: 'dynamic'},
  },

  basePrototype: InstancedSprite.prototype,
};

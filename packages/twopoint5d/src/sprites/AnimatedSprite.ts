import type {VertexObjectDescription, VO} from '../vertexObjects/types.js';

export interface AnimatedSprite extends VO {
  width: number;
  height: number;

  animId: number;
  animOffset: number;

  x: number;
  y: number;
  z: number;

  rotation: number;

  setQuadSize(quadSize: [width: number, height: number]): void;
  setInstancePosition(position: [x: number, y: number, z: number]): void;
}

export class AnimatedSprite {
  setSize(width: number, height: number): void {
    this.setQuadSize([width, height]);
  }

  setPosition(x: number, y: number, z = 0): void {
    this.setInstancePosition([x, y, z]);
  }
}

export const AnimatedSpriteDescriptor: VertexObjectDescription = {
  meshCount: 1,

  attributes: {
    quadSize: {components: ['width', 'height']},
    anim: {components: ['animId', 'animOffset']},
    instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic'},
    rotation: {size: 1, usage: 'dynamic'},
  },

  basePrototype: AnimatedSprite.prototype,
};

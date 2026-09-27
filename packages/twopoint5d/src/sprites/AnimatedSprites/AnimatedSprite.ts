import {voInitialize} from '../../vertex-objects/constants.js';
import type {VertexObjectDescription, VO} from '../../vertex-objects/types.js';

export interface AnimatedSprite extends VO {
  width: number;
  height: number;

  animId: number;
  animOffset: number;

  x: number;
  y: number;
  z: number;

  rotation: number;

  setQuadSize(width: number, height: number): void;
  setQuadSize(quadSize: [width: number, height: number]): void;
  setInstancePosition(x: number, y: number, z: number): void;
  setInstancePosition(position: [x: number, y: number, z: number]): void;
}

// V8 boxes a fractional value that a method hands on as an argument of its own to a setter it
// does not inline in a full frame loop — a heap number of 16 B per value; in a tuple the value
// stays unboxed, and the setters copy it into the buffer of the sprite, so one tuple serves every call
const quadSizeScratch: [width: number, height: number] = [0, 0];
const positionScratch: [x: number, y: number, z: number] = [0, 0, 0];

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

  setSize(width: number, height: number): void {
    quadSizeScratch[0] = width;
    quadSizeScratch[1] = height;
    this.setQuadSize(quadSizeScratch);
  }

  setPosition(x: number, y: number, z = 0): void {
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

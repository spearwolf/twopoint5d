import {VertexObjectDescription, VO} from '../../vertexObjects';

export interface TileBaseSprite extends VO {
  setPosition(position: number[]): void;
  setUv(texCoords: number[]): void;
}

export class TileBaseSprite {
  make(width = 1, height = 1, xOffset = 0, zOffset = 0): void {
    // prettier-ignore
    this.setPosition([
      xOffset,         0, zOffset,
      xOffset,         0, height + zOffset,
      width + xOffset, 0, height + zOffset,
      width + xOffset, 0, zOffset,
    ]);
    // prettier-ignore
    this.setUv([
      0, 0,
      0, 1,
      1, 1,
      1, 0,
    ]);
  }
}

export const TileBaseSpriteDescriptor: VertexObjectDescription = {
  vertexCount: 4,
  indices: [0, 2, 1, 0, 3, 2],

  attributes: {
    position: {components: ['x', 'y', 'z']},
    uv: {size: 2},
  },

  basePrototype: TileBaseSprite.prototype,
};

export const TileSpriteDescriptor: VertexObjectDescription = {
  meshCount: 1,

  attributes: {
    instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic', autoTouch: false},
    texCoords: {size: 4, usage: 'dynamic', autoTouch: false},
    quadSize: {components: ['width', 'height'], usage: 'dynamic', autoTouch: false},
  },
};

export interface TileSprite extends VO {
  setInstancePosition(position: [x: number, y: number, z: number]): void;

  x: number;
  y: number;
  z: number;

  setTexCoords(texCoords: [s: number, t: number, u: number, v: number]): void;

  setQuadSize(size: [width: number, height: number]): void;

  width: number;
  height: number;
}

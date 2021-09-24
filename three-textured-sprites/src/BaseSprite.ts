import {VertexObjectDescription, VO} from 'three-vertex-objects';

export interface BaseSprite extends VO {
  setPosition(position: number[]): void;
  setUv(texCoords: number[]): void;
}

export class BaseSprite {
  make(width = 0.5, height = 0.5, xOffset = 0, yOffset = 0): void {
    this.setPosition([
      -width + xOffset,
      -height + yOffset,
      0,
      -width + xOffset,
      +height + yOffset,
      0,
      +width + xOffset,
      +height + yOffset,
      0,
      +width + xOffset,
      -height + yOffset,
      0,
    ]);
    this.setUv([
      // flipY = false
      0, 1, 0, 0, 1, 0, 1, 1,
    ]);
  }
}

export const BaseSpriteDescriptor: VertexObjectDescription = {
  vertexCount: 4,
  indices: [0, 2, 1, 0, 3, 2],

  attributes: {
    position: {components: ['x', 'y', 'z']},
    uv: {size: 2},
  },

  basePrototype: BaseSprite.prototype,
};

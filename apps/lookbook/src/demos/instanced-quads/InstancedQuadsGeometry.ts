import {InstancedVertexObjectGeometry, type VO} from '@spearwolf/twopoint5d';

export interface BaseQuad extends VO {
  setPosition(positions: [number, number, number, number, number, number, number, number, number, number, number, number]): void;

  x0: number;
  y0: number;
  z0: number;

  x1: number;
  y1: number;
  z1: number;

  x2: number;
  y2: number;
  z2: number;

  x3: number;
  y3: number;
  z3: number;

  x4: number;
  y4: number;
  z4: number;

  setUv(uvs: [number, number, number, number, number, number, number, number]): void;
}

export class BaseQuad {
  make(width = 0.5, height = 0.5) {
    // prettier-ignore
    this.setPosition([
      - width, - height, 0,
      - width, + height, 0,
      + width, + height, 0,
      + width, - height, 0,
    ]);
    // prettier-ignore
    this.setUv([
      // flipY = false
      0, 1,
      0, 0,
      1, 0,
      1, 1,
    ]);
  }
}

export const BaseQuadDescriptor = {
  vertexCount: 4,
  indices: [0, 2, 1, 0, 3, 2],

  attributes: {
    position: {components: ['x', 'y', 'z']},
    uv: {size: 2},
  },

  basePrototype: BaseQuad.prototype,
};

export interface InstancedQuad extends VO {
  setQuadSize(sizes: [number, number]): void;

  width: number;
  height: number;

  setInstancePosition(positions: [number, number, number]): void;

  x: number;
  y: number;
  z: number;

  setTexCoords(coords: [number, number, number, number]): void;
}

export const InstancedQuadDescriptor = {
  meshCount: 1,

  attributes: {
    quadSize: {components: ['width', 'height']},
    instancePosition: {components: ['x', 'y', 'z']},
    texCoords: {size: 4},
  },
};

export class InstancedQuadsGeometry extends InstancedVertexObjectGeometry<InstancedQuad, BaseQuad> {
  constructor(capacity: number) {
    super(InstancedQuadDescriptor, capacity, BaseQuadDescriptor);
  }
}

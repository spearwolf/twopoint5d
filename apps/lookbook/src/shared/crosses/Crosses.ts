import {VO, getDescriptorOf} from '@spearwolf/twopoint5d';
import {Matrix4, Vector3} from 'three';

export interface Cross extends VO {
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

  x5: number;
  y5: number;
  z5: number;

  x6: number;
  y6: number;
  z6: number;

  x7: number;
  y7: number;
  z7: number;

  x8: number;
  y8: number;
  z8: number;

  x9: number;
  y9: number;
  z9: number;

  x10: number;
  y10: number;
  z10: number;

  x11: number;
  y11: number;
  z11: number;

  setPosition(positions: number[]): void;
}

export type CrossVertexIndexType = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11;

export class Cross {
  make(width = 0.5, height = 0.5, innerSize = 1 / 8, outerSize = 1 / 2) {
    // prettier-ignore
    this.setPosition([
        - width * innerSize, + height * innerSize, 0,
        - width * innerSize, + height * outerSize, 0,
        + width * innerSize, + height * outerSize, 0,
        + width * innerSize, + height * innerSize, 0,
        + width * outerSize, + height * innerSize, 0,
        + width * outerSize, - height * innerSize, 0,
        + width * innerSize, - height * innerSize, 0,
        + width * innerSize, - height * outerSize, 0,
        - width * innerSize, - height * outerSize, 0,
        - width * innerSize, - height * innerSize, 0,
        - width * outerSize, - height * innerSize, 0,
        - width * outerSize, + height * innerSize, 0,
      ]);
  }

  rotate(angle: number) {
    const theta = (angle * 180) / Math.PI;
    this.transform(new Matrix4().makeRotationZ(theta));
  }

  translate(x: number, y: number, z = 0) {
    this.transform(new Matrix4().makeTranslation(x, y, z));
  }

  transform(transform: Matrix4) {
    const v = new Vector3();
    const {vertexCount} = getDescriptorOf(this);
    for (let i = 0; i < vertexCount; i++) {
      this.getVertexPosition(i as CrossVertexIndexType, v);
      v.applyMatrix4(transform);
      this.setVertexPosition(i as CrossVertexIndexType, v);
    }
  }

  getVertexPosition(idx: CrossVertexIndexType, target: Vector3) {
    target.x = this[`x${idx}`];
    target.y = this[`y${idx}`];
    target.z = this[`z${idx}`];
  }

  setVertexPosition(idx: CrossVertexIndexType, position: Vector3) {
    this[`x${idx}`] = position.x;
    this[`y${idx}`] = position.y;
    this[`z${idx}`] = position.z;
  }
}

export const CrossDescriptor = {
  vertexCount: 12,
  indices: [0, 2, 1, 0, 3, 2, 10, 4, 11, 10, 5, 4, 7, 9, 8, 7, 6, 9],

  attributes: {
    position: {components: ['x', 'y', 'z']},
  },

  basePrototype: Cross.prototype,
};

import {VertexObjectDescription, VO} from '../vertexObjects';

export interface BaseSprite extends VO {
  x0: number;
  x1: number;
  x2: number;
  x3: number;

  y0: number;
  y1: number;
  y2: number;
  y3: number;

  z0: number;
  z1: number;
  z2: number;
  z3: number;

  u0: number;
  u1: number;
  u2: number;
  u3: number;

  v0: number;
  v1: number;
  v2: number;
  v3: number;

  setPosition(position: number[]): void;
  setUv(texCoords: number[]): void;
}

export class BaseSprite {
  make(width = 0.5, height = 0.5, xOffset = 0, yOffset = 0): void {
    // A square lying on the XY plane:
    //
    //             ^(y)
    //             |
    //        B''''|''''C
    //        .    |    .
    //        .    #--------->(x)
    //        .   /     .
    //        A../......D
    //          /
    //      (z)v

    // prettier-ignore
    this.setPosition([
      -width + xOffset, -height + yOffset, 0,
      -width + xOffset, +height + yOffset, 0,
      +width + xOffset, +height + yOffset, 0,
      +width + xOffset, -height + yOffset, 0,
    ]);

    //   (0,0)----(1,0)
    //     |        |
    //     |        |
    //   (0,1)----(1,1)

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

export const BaseSpriteDescriptor: VertexObjectDescription = {
  vertexCount: 4,

  //
  //  (1)<---(2)
  //        ^
  //       /
  //      /
  //  (0)
  //
  //         (2)
  //          ^
  //          |
  //          |
  //  (0)--->(3)
  //
  indices: [0, 2, 1, 0, 3, 2],

  attributes: {
    position: {components: ['x', 'y', 'z']},
    uv: {components: ['u', 'v']},
  },

  basePrototype: BaseSprite.prototype,
};

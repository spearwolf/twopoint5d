import type {VertexObjectDescription, VO} from '../../vertex-objects/types.js';

export interface TileBaseSprite extends VO {
  setPosition(position: number[]): void;
  setUv(texCoords: number[]): void;
}

export class TileBaseSprite {
  make(width = 1, height = 1, xOffset = 0, zOffset = 0): void {
    // A square lying on the XZ plane:
    //
    //             ^(y)
    //             |
    //             |
    //             |
    //             A----D---->(x)
    //            /    /
    //           B----C
    //          /
    //      (z)v

    // prettier-ignore
    this.setPosition([
      xOffset,         0, zOffset,
      xOffset,         0, zOffset + height,
      xOffset + width, 0, zOffset + height,
      xOffset + width, 0, zOffset,
    ]);

    //   (0,0)----(1,0)
    //     |        |
    //     |        |
    //   (0,1)----(1,1)

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

  //
  //  (0)
  //   |
  //   |
  //   v
  //  (1)--->(2)
  //
  //  (0)    (3)
  //     \    ^
  //      \   |
  //       v  |
  //         (2)
  //
  //
  indices: [0, 1, 2, 0, 2, 3],

  attributes: {
    position: {components: ['x', 'y', 'z']},
    uv: {size: 2},
  },

  basePrototype: TileBaseSprite.prototype,
};

export const TileSpriteDescriptor: VertexObjectDescription = {
  attributes: {
    instancePosition: {components: ['x', 'y', 'z'], usage: 'dynamic', autoTouch: false},
    texCoords: {size: 4, usage: 'dynamic', autoTouch: false},
    texFlipDiagonal: {size: 1, usage: 'dynamic', autoTouch: false},
    quadSize: {components: ['width', 'height'], usage: 'dynamic', autoTouch: false},
  },
};

export interface TileSprite extends VO {
  setInstancePosition(x: number, y: number, z: number): void;
  setInstancePosition(position: [x: number, y: number, z: number]): void;

  x: number;
  y: number;
  z: number;

  setTexCoords(s: number, t: number, u: number, v: number): void;
  setTexCoords(texCoords: [s: number, t: number, u: number, v: number]): void;

  /**
   * `1` while the frame on the tile is drawn with `TextureCoords.FLIP_DIAGONAL` (the lookup swaps
   * its two components), `0` otherwise. `TileSpritesFactory#createTile()` writes it together with
   * the tex coords, and a caller who writes the tex coords of a `TextureCoords` through
   * `setTexCoords()` writes it as well.
   */
  texFlipDiagonal: number;

  setQuadSize(width: number, height: number): void;
  setQuadSize(size: [width: number, height: number]): void;

  width: number;
  height: number;
}

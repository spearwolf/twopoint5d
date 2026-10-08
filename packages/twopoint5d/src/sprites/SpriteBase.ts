import type {VertexObjectDescription, VO} from '../vertex-objects/types.js';

/**
 * The geometry every sprite of a kind is drawn from: a vertex object description with
 * `vertexCount` and `indices`, whose `basePrototype` carries a `make(...args)` that fills the one
 * base vertex object. It provides two attributes:
 *
 * - `position` (3 values): the vertex in the local quad space on the XY plane, centred on the
 *   pivot, unscaled
 * - `uv` (2 values): where the vertex lies on the untrimmed sprite, `(0, 0)` at the top left, x to
 *   the right and y downwards; the trim shift reads it
 */
export interface SpriteBase<Args extends readonly unknown[] = readonly unknown[]> {
  /** Names the base in the errors of `defineSprite()`. */
  readonly name: string;
  readonly description: VertexObjectDescription;
  /** What `make()` is called with when a geometry is built without `baseArgs`. */
  readonly defaultArgs: Args;
}

/** The base vertex object as its pool hands it out. */
export interface SpriteBaseVO extends VO {
  make(...args: readonly unknown[]): void;
}

export interface QuadBaseVO extends SpriteBaseVO {
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
  setUv(uv: number[]): void;
  /** The trim margins of a frame move the corners by the measure of the unit quad, also on a quad of another side length. */
  make(halfWidth?: number, halfHeight?: number, xOffset?: number, yOffset?: number): void;
}

export type QuadBaseArgs =
  | readonly [halfWidth: number, halfHeight: number]
  | readonly [halfWidth: number, halfHeight: number, xOffset: number, yOffset: number];

class QuadBasePrototype {
  make(this: QuadBaseVO, halfWidth = 0.5, halfHeight = 0.5, xOffset = 0, yOffset = 0): void {
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

    // biome-ignore format: the line breaks lay the numbers out row by row
    this.setPosition([
      -halfWidth + xOffset, -halfHeight + yOffset, 0,
      -halfWidth + xOffset, +halfHeight + yOffset, 0,
      +halfWidth + xOffset, +halfHeight + yOffset, 0,
      +halfWidth + xOffset, -halfHeight + yOffset, 0,
    ]);
    //   (0,0)----(1,0)
    //     |        |
    //     |        |
    //   (0,1)----(1,1)

    // biome-ignore format: the line breaks lay the numbers out row by row
    this.setUv([
      // flipY = false
      0, 1,
      0, 0,
      1, 0,
      1, 1,
    ]);
  }
}

/**
 * The quad every built-in sprite kind is drawn from: four vertices with `position` and `uv`, two
 * triangles, and a `make(halfWidth, halfHeight, xOffset, yOffset)` that lays them out.
 */
export const QuadBase: SpriteBase<QuadBaseArgs> = Object.freeze({
  name: 'quad',
  description: {
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
    basePrototype: QuadBasePrototype.prototype,
  },
  defaultArgs: Object.freeze([0.5, 0.5] as const),
});

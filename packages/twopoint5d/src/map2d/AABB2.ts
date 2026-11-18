/**
 * An axis-aligned box in 2D. `left` and `top` are its smaller coordinates, `right = left + width`
 * and `bottom = top + height` its larger ones; in the map, `top` is the north edge, and `y` grows to
 * the south. The four fields are plain and writable, and nothing checks them: a width or height
 * below 0, or a value that is no finite number, is kept as it is and makes the tests below answer
 * what their comparisons answer.
 */
export class AABB2 {
  /** The smaller x coordinate, the west edge. */
  left: number;
  /** The smaller y coordinate, the north edge. */
  top: number;
  /** The extent along x; `right` is `left + width`. */
  width: number;
  /** The extent along y; `bottom` is `top + height`. */
  height: number;

  /** A box of `width` × `height` from `(left, top)`; every value 0 unless given. */
  constructor(left = 0, top = 0, width = 0, height = 0) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
  }

  /** Writes the four fields and answers this box. */
  set(left: number, top: number, width: number, height: number): AABB2 {
    this.top = top;
    this.left = left;
    this.width = width;
    this.height = height;
    return this;
  }

  /** A new box with the four fields of this one. */
  clone(): AABB2 {
    return new AABB2(this.left, this.top, this.width, this.height);
  }

  /** Writes the four fields of `aabb` into this box and answers it. */
  copy(aabb: AABB2): AABB2 {
    this.top = aabb.top;
    this.left = aabb.left;
    this.width = aabb.width;
    this.height = aabb.height;
    return this;
  }

  /**
   * A box from anything with a `left`, `top`, `width` and `height`: written into `target` and
   * answered, or a new box without one.
   */
  static from(
    {
      top,
      left,
      width,
      height,
    }: {
      top: number;
      left: number;
      width: number;
      height: number;
    },
    target?: AABB2,
  ): AABB2 {
    return target ? target.set(left, top, width, height) : new AABB2(left, top, width, height);
  }

  /**
   * Grows this box to cover `other` as well: each edge of `other` that lies further out moves the
   * edge of this box there. Answers this box; `other` stays as it is.
   */
  extend(other: AABB2): AABB2 {
    if (other.left < this.left) {
      this.width += this.left - other.left;
      this.left = other.left;
    }
    if (other.right > this.right) {
      this.width = other.right - this.left;
    }
    if (other.top < this.top) {
      this.height += this.top - other.top;
      this.top = other.top;
    }
    if (other.bottom > this.bottom) {
      this.height = other.bottom - this.top;
    }
    return this;
  }

  /** The larger x coordinate, `left + width`: the east edge. */
  get right(): number {
    return this.left + this.width;
  }

  /** The larger y coordinate, `top + height`: the south edge. */
  get bottom(): number {
    return this.top + this.height;
  }

  /** The middle along x, `left + width / 2`. Set, it moves the box along x and keeps its width. */
  get centerX(): number {
    return this.left + this.width / 2;
  }

  set centerX(x: number) {
    this.left += x - this.centerX;
  }

  /** The middle along y, `top + height / 2`. Set, it moves the box along y and keeps its height. */
  get centerY(): number {
    return this.top + this.height / 2;
  }

  set centerY(y: number) {
    this.top += y - this.centerY;
  }

  /** Whether the four fields are these values, each compared with `===`. */
  is(left: number, top: number, width: number, height: number): boolean {
    return this.top === top && this.left === left && this.width === width && this.height === height;
  }

  /** Whether the four fields equal those of `aabb`, each compared with `===`. */
  isEqual(aabb: AABB2): boolean {
    return this.top === aabb.top && this.left === aabb.left && this.width === aabb.width && this.height === aabb.height;
  }

  /**
   * Whether the point `(x, y)` lies in the box, half-open: the left and the top edge count, the
   * right and the bottom edge do not — so the boxes of a grid share no point, and a point on the
   * border of two lies in exactly one. A box of width or height 0 holds no point.
   */
  isInside(x: number, y: number): boolean {
    return this.left <= x && x < this.right && this.top <= y && y < this.bottom;
  }

  /**
   * Whether `aabb` lies completely in this box, closed: every edge counts, so a box lies in itself
   * and in a box whose edges it shares.
   */
  isInsideAABB(aabb: AABB2): boolean {
    return this.left <= aabb.left && aabb.right <= this.right && this.top <= aabb.top && aabb.bottom <= this.bottom;
  }

  /**
   * Whether the two boxes overlap: on both axes each starts before the other ends —
   * `aabb.left < right` and `left < aabb.right`, and the same for top and bottom. Boxes that only
   * touch at an edge or a corner do not intersect. A box of width 0 intersects another only where
   * its `left` lies strictly between the left and the right edge of the other, and never one of
   * width 0 at the same `left`; the same holds for a height of 0.
   */
  isIntersecting(aabb: AABB2): boolean {
    return !(aabb.right <= this.left || aabb.left >= this.right || aabb.bottom <= this.top || aabb.top >= this.bottom);
  }

  /**
   * Whether the box reaches into the quarter to the north-west of the point `(x, y)`: its left edge
   * lies left of `x` and its top edge above `y` (a smaller `y`), both strictly.
   */
  isNorthWest(x: number, y: number): boolean {
    return this.left < x && this.top < y;
  }

  /**
   * Whether the box reaches into the quarter to the north-east of the point `(x, y)`: its right edge
   * lies right of `x` and its top edge above `y` (a smaller `y`), both strictly.
   */
  isNorthEast(x: number, y: number): boolean {
    return this.right > x && this.top < y;
  }

  /**
   * Whether the box reaches into the quarter to the south-east of the point `(x, y)`: its right edge
   * lies right of `x` and its bottom edge below `y` (a larger `y`), both strictly.
   */
  isSouthEast(x: number, y: number): boolean {
    return this.right > x && this.bottom > y;
  }

  /**
   * Whether the box reaches into the quarter to the south-west of the point `(x, y)`: its left edge
   * lies left of `x` and its bottom edge below `y` (a larger `y`), both strictly.
   */
  isSouthWest(x: number, y: number): boolean {
    return this.left < x && this.bottom > y;
  }
}

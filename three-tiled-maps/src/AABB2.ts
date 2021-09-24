/**
 * Represents a 2D axis aligned boundary box.
 */
export class AABB2 {
  left: number;
  top: number;
  width: number;
  height: number;

  constructor(left = 0, top = 0, width = 0, height = 0) {
    this.left = left;
    this.top = top;
    this.width = width;
    this.height = height;
  }

  set(left: number, top: number, width: number, height: number): AABB2 {
    this.top = top;
    this.left = left;
    this.width = width;
    this.height = height;
    return this;
  }

  clone(): AABB2 {
    return new AABB2(this.left, this.top, this.width, this.height);
  }

  copy(aabb: AABB2): AABB2 {
    this.top = aabb.top;
    this.left = aabb.left;
    this.width = aabb.width;
    this.height = aabb.height;
    return this;
  }

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

  get right(): number {
    return this.left + this.width;
  }

  get bottom(): number {
    return this.top + this.height;
  }

  get centerX(): number {
    return this.left + this.width / 2;
  }

  set centerX(x: number) {
    this.left += x - this.centerX;
  }

  get centerY(): number {
    return this.top + this.height / 2;
  }

  set centerY(y: number) {
    this.top += y - this.centerY;
  }

  is(left: number, top: number, width: number, height: number): boolean {
    return this.top === top && this.left === left && this.width === width && this.height === height;
  }

  isEqual(aabb: AABB2): boolean {
    return this.top === aabb.top && this.left === aabb.left && this.width === aabb.width && this.height === aabb.height;
  }

  /**
   * @returns `true` if point is within
   */
  isInside(x: number, y: number): boolean {
    return this.left <= x && x < this.right && this.top <= y && y < this.bottom;
  }

  /**
   *
   * @returns `true` if _aabb_ is completely within
   */
  isInsideAABB(aabb: AABB2): boolean {
    return (
      this.isInside(aabb.top, aabb.left) &&
      this.left <= aabb.right &&
      aabb.right <= this.right &&
      this.top <= aabb.bottom &&
      aabb.bottom <= this.bottom
    );
  }

  /**
   * @returns `true` if the two overlap
   */
  isIntersecting(aabb: AABB2): boolean {
    return !(aabb.right <= this.left || aabb.left >= this.right || aabb.bottom <= this.top || aabb.top >= this.bottom);
  }

  isNorthWest(x: number, y: number): boolean {
    return (this.right <= x || this.left < x) && (this.top < y || this.bottom <= y);
  }

  isNorthEast(x: number, y: number): boolean {
    return (this.right > x || this.left >= x) && (this.top < y || this.bottom <= y);
  }

  isSouthEast(x: number, y: number): boolean {
    return (this.right > x || this.left >= x) && (this.top >= y || this.bottom > y);
  }

  isSouthWest(x: number, y: number): boolean {
    return (this.right <= x || this.left < x) && (this.top >= y || this.bottom > y);
  }
}

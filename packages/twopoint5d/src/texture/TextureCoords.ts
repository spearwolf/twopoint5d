// One walk from a TextureCoords up to its root answers all four values of `s`, `t`, `u` and `v`, so
// the getters and `getTexCoords()` agree to the last bit. The result lives in this module-wide
// scratch array (s, t, s1, t1): the walk never calls out and never re-enters, so nothing can
// overwrite it before the caller has read it.
const scratch: [s: number, t: number, s1: number, t1: number] = [0, 0, 0, 0];

const computeBounds = (current: TextureCoords): typeof scratch => {
  const {width, height, flip} = current;

  let sumX = 0;
  let sumY = 0;
  let node = current;

  while (node.parent != null) {
    sumX += node.x;
    sumY += node.y;
    node = node.parent;
  }

  const rootW = node.width;
  const rootH = node.height;

  const minX = sumX / rootW;
  const maxX = (width + sumX) / rootW;
  const minY = sumY / rootH;
  const maxY = (height + sumY) / rootH;

  // FLIP_DIAGONAL swaps the axes: s runs along y, t along x
  const flipD = (flip & TextureCoords.FLIP_DIAGONAL) > 0;
  const sMin = flipD ? minY : minX;
  const sMax = flipD ? maxY : maxX;
  const tMin = flipD ? minX : minY;
  const tMax = flipD ? maxX : maxY;

  const flipH = (flip & TextureCoords.FLIP_HORIZONTAL) > 0;
  const flipV = (flip & TextureCoords.FLIP_VERTICAL) > 0;

  scratch[0] = flipH ? sMax : sMin;
  scratch[1] = flipV ? tMax : tMin;
  scratch[2] = flipH ? sMin : sMax;
  scratch[3] = flipV ? tMin : tMax;

  return scratch;
};

/**
 * A rectangle inside a texture, given in pixels relative to its `parent` (or, without a parent, to the texture itself).
 * `s`, `t`, `u` and `v` derive the rectangle as absolute texture coordinates from the whole chain of parents up to the root.
 *
 * The three flip bits together describe all eight orientations of a rectangle: `FLIP_HORIZONTAL` and
 * `FLIP_VERTICAL` mirror the drawn axis, `FLIP_DIAGONAL` swaps the axes.
 * Under `FLIP_DIAGONAL` `s` and `u` run along the y axis of the texture and `t` and `v` along its x axis.
 * The lookup at a quad position `(a, b)` (0 to 1, `b` counted downwards) reads the texture at
 * `(s + a·u, t + b·v)` and swaps the two components; without `FLIP_DIAGONAL` it takes them as they are.
 * `width` and `height` stay the measures of the area inside the texture; under `FLIP_DIAGONAL` it is drawn
 * `height` wide and `width` high.
 * A rotated TexturePacker frame arrives as `FLIP_DIAGONAL | FLIP_VERTICAL`.
 */
export class TextureCoords {
  /** The bit of `flip` that mirrors the drawn horizontal axis. */
  static readonly FLIP_HORIZONTAL = 1;
  /** The bit of `flip` that mirrors the drawn vertical axis. */
  static readonly FLIP_VERTICAL = 2;
  /** The bit of `flip` that swaps the axes. */
  static readonly FLIP_DIAGONAL = 4;

  /** The left edge of the area in pixels, relative to `parent` — not to the texture, where there is one. */
  x = 0;
  /** The top edge of the area in pixels, relative to `parent` — not to the texture, where there is one. */
  y = 0;

  /** The width of the area in the texture, in pixels; under `FLIP_DIAGONAL` it is drawn as the height. */
  width = 0;
  /** The height of the area in the texture, in pixels; under `FLIP_DIAGONAL` it is drawn as the width. */
  height = 0;

  /**
   * The flip bits of the area, an OR of {@link TextureCoords.FLIP_HORIZONTAL},
   * {@link TextureCoords.FLIP_VERTICAL} and {@link TextureCoords.FLIP_DIAGONAL}; 0 for none.
   */
  flip = 0;

  /** The area `x` and `y` are relative to; without one they are relative to the texture itself. */
  parent?: TextureCoords;

  /**
   * Takes three forms: without arguments every value is 0; `(parent, x?, y?, width?, height?)` gives
   * the area relative to `parent`; `(x?, y?, width?, height?)` gives it relative to the texture. A value
   * left out is 0, and `flip` starts at 0.
   */
  constructor(
    ...args:
      | []
      | [parent: TextureCoords, x?: number, y?: number, width?: number, height?: number]
      | [x?: number, y?: number, width?: number, height?: number]
  ) {
    if (args[0] instanceof TextureCoords) {
      this.parent = args[0];
      this.x = args[1] ?? 0;
      this.y = args[2] ?? 0;
      this.width = args[3] ?? 0;
      this.height = args[4] ?? 0;
    } else if (args?.length) {
      this.x = args[0] ?? 0;
      this.y = args[1] ?? 0;
      this.width = args[2] ?? 0;
      this.height = args[3] ?? 0;
    }
  }

  /**
   * A new instance with the same values and the same `parent` — the parent itself, not a copy of it.
   */
  clone(): TextureCoords {
    const texCoords = new TextureCoords();
    texCoords.parent = this.parent;
    texCoords.x = this.x;
    texCoords.y = this.y;
    texCoords.width = this.width;
    texCoords.height = this.height;
    texCoords.flip = this.flip;
    return texCoords;
  }

  /** The topmost ancestor up the chain of parents, or the instance itself where it has no `parent`. */
  get root(): TextureCoords {
    let root: TextureCoords = this;
    while (root.parent) {
      root = root.parent;
    }
    return root;
  }

  /** Whether `FLIP_HORIZONTAL` is set; a write sets or clears that bit and leaves the others. */
  get flipH(): boolean {
    return (this.flip & TextureCoords.FLIP_HORIZONTAL) > 0;
  }

  set flipH(flip: boolean) {
    this.flip =
      (flip ? TextureCoords.FLIP_HORIZONTAL : 0) | (this.flip & (TextureCoords.FLIP_VERTICAL | TextureCoords.FLIP_DIAGONAL));
  }

  /** Whether `FLIP_VERTICAL` is set; a write sets or clears that bit and leaves the others. */
  get flipV(): boolean {
    return (this.flip & TextureCoords.FLIP_VERTICAL) > 0;
  }

  set flipV(flip: boolean) {
    this.flip =
      (flip ? TextureCoords.FLIP_VERTICAL : 0) | (this.flip & (TextureCoords.FLIP_HORIZONTAL | TextureCoords.FLIP_DIAGONAL));
  }

  /** Whether `FLIP_DIAGONAL` is set; a write sets or clears that bit and leaves the others. */
  get flipD(): boolean {
    return (this.flip & TextureCoords.FLIP_DIAGONAL) > 0;
  }

  set flipD(flip: boolean) {
    this.flip =
      (flip ? TextureCoords.FLIP_DIAGONAL : 0) | (this.flip & (TextureCoords.FLIP_VERTICAL | TextureCoords.FLIP_HORIZONTAL));
  }

  /** Toggles `FLIP_HORIZONTAL` and answers `this`. */
  flipHorizontal(): TextureCoords {
    this.flipH = !this.flipH;
    return this;
  }

  /** Toggles `FLIP_VERTICAL` and answers `this`. */
  flipVertical(): TextureCoords {
    this.flipV = !this.flipV;
    return this;
  }

  /** Toggles `FLIP_DIAGONAL` and answers `this`. */
  flipDiagonal(): TextureCoords {
    this.flipD = !this.flipD;
    return this;
  }

  /**
   * The `s` of the corner the lookup starts at, in texture coordinates from 0 to 1 of the root, after the
   * flips. Walks the chain of parents once; `getTexCoords()` answers all four values in one walk.
   */
  get s(): number {
    return computeBounds(this)[0];
  }

  /**
   * The `t` of the corner the lookup starts at, in texture coordinates from 0 to 1 of the root, after the
   * flips. Walks the chain of parents once; `getTexCoords()` answers all four values in one walk.
   */
  get t(): number {
    return computeBounds(this)[1];
  }

  /**
   * The `s` of the opposite corner, in texture coordinates from 0 to 1 of the root, after the flips. Walks
   * the chain of parents once; `getTexCoords()` answers all four values in one walk.
   */
  get s1(): number {
    return computeBounds(this)[2];
  }

  /**
   * The `t` of the opposite corner, in texture coordinates from 0 to 1 of the root, after the flips. Walks
   * the chain of parents once; `getTexCoords()` answers all four values in one walk.
   */
  get t1(): number {
    return computeBounds(this)[3];
  }

  /**
   * `s1 - s`: negative where the axis is mirrored. Walks the chain of parents once; `getTexCoords()` answers
   * all four values in one walk.
   */
  get u(): number {
    const bounds = computeBounds(this);
    return bounds[2] - bounds[0];
  }

  /**
   * `t1 - t`: negative where the axis is mirrored. Walks the chain of parents once; `getTexCoords()` answers
   * all four values in one walk.
   */
  get v(): number {
    const bounds = computeBounds(this);
    return bounds[3] - bounds[1];
  }

  /**
   * The four values `s`, `t`, `u` and `v`, computed in one walk up the chain of parents where each getter walks it on
   * its own. Without a `target` the values come as a new tuple; with one they are written to its indices 0 to 3 and
   * `target` is answered, without allocating.
   *
   * @throws {RangeError} if `target` holds fewer than four values; it stays as it was.
   */
  getTexCoords(): [s: number, t: number, u: number, v: number];
  getTexCoords<T extends {length: number; [index: number]: number}>(target: T): T;
  getTexCoords(target?: {length: number; [index: number]: number}): unknown {
    if (target != null && target.length < 4) {
      throw new RangeError(`TextureCoords: getTexCoords() got a target of ${target.length} values, s, t, u and v are 4`);
    }
    const bounds = computeBounds(this);
    const out = target ?? [0, 0, 0, 0];
    out[0] = bounds[0];
    out[1] = bounds[1];
    out[2] = bounds[2] - bounds[0];
    out[3] = bounds[3] - bounds[1];
    return out;
  }
}

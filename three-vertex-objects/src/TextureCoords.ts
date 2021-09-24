const minCoord = (current: TextureCoords, scalarKey: 'x' | 'y', sizeKey: 'width' | 'height') => {
  let texCoords: TextureCoords = current;
  let scalar = 0;

  while (texCoords.parent != null) {
    scalar += texCoords[scalarKey];
    texCoords = texCoords.parent;
  }

  return scalar / texCoords[sizeKey];
};

const maxCoord = (current: TextureCoords, scalarKey: 'x' | 'y', sizeKey: 'width' | 'height') => {
  let texCoords: TextureCoords = current;
  let coord = current[sizeKey];

  while (texCoords.parent != null) {
    coord += texCoords[scalarKey];
    texCoords = texCoords.parent;
  }

  return coord / texCoords[sizeKey];
};

/**
 * @category Texture Mapping
 */
export class TextureCoords {
  static readonly FLIP_HORIZONTAL = 1;
  static readonly FLIP_VERTICAL = 2;
  static readonly FLIP_DIAGONAL = 4;

  x = 0;
  y = 0;

  width = 0;
  height = 0;

  flip = 0;

  parent?: TextureCoords;

  constructor(
    ...args:
      | undefined
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

  get root(): TextureCoords | undefined {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let root: TextureCoords = this;
    while (root.parent) {
      root = root.parent;
    }
    return root;
  }

  get flipH(): boolean {
    return (this.flip & TextureCoords.FLIP_HORIZONTAL) > 0;
  }

  set flipH(flip: boolean) {
    this.flip =
      (flip ? TextureCoords.FLIP_HORIZONTAL : 0) | (this.flip & (TextureCoords.FLIP_VERTICAL | TextureCoords.FLIP_DIAGONAL));
  }

  get flipV(): boolean {
    return (this.flip & TextureCoords.FLIP_VERTICAL) > 0;
  }

  set flipV(flip: boolean) {
    this.flip =
      (flip ? TextureCoords.FLIP_VERTICAL : 0) | (this.flip & (TextureCoords.FLIP_HORIZONTAL | TextureCoords.FLIP_DIAGONAL));
  }

  get flipD(): boolean {
    return (this.flip & TextureCoords.FLIP_DIAGONAL) > 0;
  }

  set flipD(flip: boolean) {
    this.flip =
      (flip ? TextureCoords.FLIP_DIAGONAL : 0) | (this.flip & (TextureCoords.FLIP_VERTICAL | TextureCoords.FLIP_HORIZONTAL));
  }

  flipHorizontal(): TextureCoords {
    this.flipH = !this.flipH;
    return this;
  }

  flipVertical(): TextureCoords {
    this.flipV = !this.flipV;
    return this;
  }

  flipDiagonal(): TextureCoords {
    this.flipD = !this.flipD;
    return this;
  }

  get s(): number {
    const {flipD} = this;
    return this.flipH
      ? maxCoord(this, flipD ? 'y' : 'x', flipD ? 'height' : 'width')
      : minCoord(this, flipD ? 'y' : 'x', flipD ? 'height' : 'width');
  }

  get t(): number {
    const {flipD} = this;
    return this.flipV
      ? maxCoord(this, flipD ? 'x' : 'y', flipD ? 'width' : 'height')
      : minCoord(this, flipD ? 'x' : 'y', flipD ? 'width' : 'height');
  }

  get s1(): number {
    const {flipD} = this;
    return this.flipH
      ? minCoord(this, flipD ? 'y' : 'x', flipD ? 'height' : 'width')
      : maxCoord(this, flipD ? 'y' : 'x', flipD ? 'height' : 'width');
  }

  get t1(): number {
    const {flipD} = this;
    return this.flipV
      ? minCoord(this, flipD ? 'x' : 'y', flipD ? 'width' : 'height')
      : maxCoord(this, flipD ? 'x' : 'y', flipD ? 'width' : 'height');
  }

  get u(): number {
    return this.s1 - this.s;
  }

  get v(): number {
    return this.t1 - this.t;
  }
}

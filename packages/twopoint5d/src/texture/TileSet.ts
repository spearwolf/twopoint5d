import {describeValue} from '../utils/describeValue.js';
import {randomInt} from '../utils/randomInt.js';
import {TextureAtlas, type TextureAtlasFrame, type TextureAtlasFrameData} from './TextureAtlas.js';
import {TextureCoords} from './TextureCoords.js';

//
// +---------------------------------------------+
// |         margin                              |
// |   +---------------+-----+---------------+   |
// |   |    padding    |     |    padding    |   |
// |   |  +---------+  |     |  +---------+  |   |
// |   |  |.........|  |     |  |.........|  |   |
// |   |  |.........|  |     |  |.........|  |   |
// |   |  |.........|  |     |  |.........|  |   |
// |   |  +---------+  |     |  +---------+  |   |
// |   |               |     |               |   |
// |   +---------------+     +---------------+   |
// |   |               spacing               |   |
// |   +---------------+     +---------------+   |
// |   |    padding    |     |    padding    |   |
// |   |  +---------+  |     |  +---------+  |   |
// |   |  |.........|  |     |  |.........|  |   |
// |   |  |.........|  |     |  |.........|  |   |
// |   |  |.........|  |     |  |.........|  |   |
// |   |  +---------+  |     |  +---------+  |   |
// |   |               |     |               |   |
// |   +---------------+-----+---------------+   |
// |         margin                              |
// +---------------------------------------------+
//

/**
 * The layout of a {@link TileSet}: the size of a tile, the spaces around and between tiles, how
 * many there are and where their ids start.
 */
export interface TileSetOptions {
  /** The width of one tile — a finite number above 0. Defaults to the width of the `baseCoords`. */
  tileWidth?: number;
  /**
   * The height of one tile — a finite number above 0. Defaults to the height of the `baseCoords`.
   */
  tileHeight?: number;

  /** The space around the whole grid of tiles — a finite number of 0 or more. Defaults to 0. */
  margin?: number;
  /** The space between two neighbouring tiles — a finite number of 0 or more. Defaults to 0. */
  spacing?: number;
  /** The space around each tile inside its cell — a finite number of 0 or more. Defaults to 0. */
  padding?: number;

  /**
   * How many tiles the set holds — a whole number from 1 to {@link TileSet.MaxTiles}, no more than fit
   * into the image. Defaults to as many tiles as fit into the image, which may be no more than
   * `MaxTiles`.
   */
  tileCount?: number;

  /** The `tileId` of the first tile — a whole number. Defaults to 1. */
  firstId?: number;
}

const assertOption = (valid: boolean, name: string, rule: string, value: unknown): void => {
  if (!valid) {
    throw new RangeError(`TileSet: ${name} must be ${rule}, got ${describeValue(value)}`);
  }
};

const assertFits = (fits: boolean, message: () => string): void => {
  if (!fits) {
    throw new RangeError(`TileSet: ${message()}`);
  }
};

/**
 * The `TileSet` maps _tileIds_ to _frameIds_.
 * Unlike the `frameId` of {@link TextureAtlas}, the `tileId` starts at 1 by default (but is optionally
 * configurable using the `firstId` option).
 * The `frameId` range of a `TileSet` starts at `firstFrameId` and goes without gaps to up to `firstFrameId + tileCount - 1`.
 *
 * `D` is the type of the frame data of its atlas: a `TileSet` over an atlas with a data type of its
 * own takes that type on. The frames the `TileSet` lays out itself carry no data.
 */
export class TileSet<D = TextureAtlasFrameData> {
  /**
   * The most tiles a tile set holds: 2^20 — every tile of 8 × 8 texels or more on an image of
   * 8192 × 8192, the largest 2D texture every WebGPU device takes. `new TileSet()` refuses a set
   * of more, and a `tileCount` above it, before it lays a tile.
   */
  static readonly MaxTiles: number = 1_048_576;

  /**
   * The atlas that holds the frame of every tile — the one handed to the constructor, or one the
   * constructor built when none was given.
   */
  readonly atlas: TextureAtlas<D>;
  /**
   * The area the tiles lie in, the whole image of the tile set or a part of it. The tile size, the
   * `margin`, the `padding` and the `spacing` are in its units.
   */
  readonly baseCoords: TextureCoords;

  /**
   * A frozen copy of the options the tile set was built with: the layout, the checks and the getters
   * read the same values, and a change to the object handed in reaches none of them. A write to it
   * throws a `TypeError` in strict-mode code.
   */
  readonly options: Readonly<TileSetOptions>;

  #tileCount = 0;

  #firstFrameId = -1;

  /**
   * How many tiles the layout holds: the option `tileCount` — the constructor refuses one that does not
   * fit into the `baseCoords` —, or as many as fit into the `baseCoords` when none is given. The
   * constructor lays the tiles out once, and the number does not change afterwards.
   */
  get tileCount(): number {
    return this.#tileCount;
  }

  /**
   * The `frameId` of the _first_ tile. Set by the constructor; the frames of the tiles follow
   * without a gap up to `lastFrameId`.
   */
  get firstFrameId(): number {
    return this.#firstFrameId;
  }

  /**
   * @throws {RangeError} if `tileWidth` or `tileHeight` is not a finite number above 0, if
   * `margin`, `padding` or `spacing` is not a finite number of 0 or more, if `tileCount` is not a
   * whole number of 1 or more, if `firstId` is not a whole number, if the width or height of the
   * `baseCoords` is not finite, if the first tile does not fit into the `baseCoords` with its
   * `margin` and `padding`, if the tiles of a `tileCount` do not all fit into the `baseCoords`, if
   * a `tileCount` lies above {@link TileSet.MaxTiles}, or if more than `MaxTiles` tiles fit without
   * a `tileCount`; the atlas handed in is then left as it was.
   */
  constructor(...args: [TextureAtlas<D>, TextureCoords, TileSetOptions?] | [TextureCoords, TileSetOptions?]) {
    if (args[0] instanceof TextureAtlas) {
      const [atlas, baseCoords, options] = args as [TextureAtlas<D>, TextureCoords, TileSetOptions?];
      this.atlas = atlas;
      this.baseCoords = baseCoords;
      this.options = Object.freeze({...options});
    } else {
      this.atlas = new TextureAtlas<D>();
      const [baseCoords, options] = args as [TextureCoords, TileSetOptions?];
      this.baseCoords = baseCoords;
      this.options = Object.freeze({...options});
    }
    this.#createTextureCoords();
  }

  /**
   * The width of one tile, in the units of the `baseCoords`: the option `tileWidth`, or the width
   * of the `baseCoords`.
   */
  get tileWidth(): number {
    return this.options.tileWidth ?? this.baseCoords.width;
  }

  /**
   * The height of one tile, in the units of the `baseCoords`: the option `tileHeight`, or the
   * height of the `baseCoords`.
   */
  get tileHeight(): number {
    return this.options.tileHeight ?? this.baseCoords.height;
  }

  /**
   * The `tileId` of the _first_ tile
   */
  get firstId(): number {
    return this.options.firstId ?? 1;
  }

  /**
   * The `tileId` of the _last_ tile
   */
  get lastId(): number {
    return this.firstId + this.tileCount - 1;
  }

  /**
   * The `frameId` of the _last_ tile
   */
  get lastFrameId(): number {
    return this.firstFrameId + this.tileCount - 1;
  }

  /**
   * The option `tileCount`, or `Infinity` when none was given. It is the limit that was asked for;
   * the number of tiles the set holds is {@link tileCount}.
   */
  get tileCountLimit(): number {
    return this.options.tileCount ?? Infinity;
  }

  /**
   * The space around the whole grid of tiles, in the units of the `baseCoords`: the option
   * `margin`, or 0.
   */
  get margin(): number {
    return this.options.margin ?? 0;
  }

  /**
   * The space around each tile inside its cell, in the units of the `baseCoords`: the option
   * `padding`, or 0.
   */
  get padding(): number {
    return this.options.padding ?? 0;
  }

  /**
   * The space between two neighbouring tiles, in the units of the `baseCoords`: the option
   * `spacing`, or 0.
   */
  get spacing(): number {
    return this.options.spacing ?? 0;
  }

  /**
   * @throws {RangeError} if `tileId` is not a whole number; a negative whole number is fine, the arithmetic wraps it around.
   */
  frameId(tileId: number): number {
    assertOption(Number.isInteger(tileId), 'tileId', 'a whole number', tileId);
    return ((((tileId - this.firstId) % this.tileCount) + this.tileCount) % this.tileCount) + this.firstFrameId;
  }

  /** A `tileId` drawn at random from `firstId` to `lastId`, each as likely as any other. */
  randomTileId(): number {
    return this.firstId + randomInt(this.tileCount);
  }

  /**
   * The `frameId` of a tile drawn at random, from `firstFrameId` to `lastFrameId`, each as likely
   * as any other.
   */
  randomFrameId(): number {
    return this.firstFrameId + randomInt(this.tileCount);
  }

  /**
   * @throws {RangeError} if `tileId` is not a whole number; a negative whole number is fine, the arithmetic wraps it around.
   */
  frame(tileId: number): TextureAtlasFrame<D> {
    // frameId() answers a whole number inside the range of the tiles, and the atlas holds a frame for each of them
    return this.atlas.get(this.frameId(tileId))!;
  }

  /** The frame of a tile drawn at random, as {@link randomFrameId} draws it. */
  randomFrame(): TextureAtlasFrame<D> {
    return this.atlas.get(this.randomFrameId())!;
  }

  // How many cells of `outer` with `spacing` between them fit along `extent` with `margin` at both
  // ends; the caller has made sure the first one fits. The quotient is rounded once and can land
  // one off where the cells meet the bound exactly, so the count is held to the test the layout
  // places a cell by. A count past 2^53 is far over MaxTiles, and so is Infinity, which a tile of a
  // denormal width yields: neither is corrected. Without a tileCount the caller refuses both; with
  // one, the tiles of that count all fit into the first row, and the caller lays them there. The
  // first cell is there in any case, whatever the rounding of the quotient says.
  static #cellsAlong(extent: number, margin: number, outer: number, spacing: number): number {
    const step = outer + spacing;
    let count = Math.floor((extent - 2 * margin - outer) / step) + 1;
    if (Number.isSafeInteger(count)) {
      if (margin + count * step + outer + margin <= extent) count += 1;
      else if (count > 1 && margin + (count - 1) * step + outer + margin > extent) count -= 1;
    }
    return Math.max(count, 1);
  }

  #createTextureCoords = (): void => {
    const {width: baseWidth, height: baseHeight} = this.baseCoords;

    const {padding, margin, spacing, tileCountLimit} = this;

    // The number of tiles is worked out from these values, and it takes a step that moves forward and
    // image bounds that are finite. The values come unchecked out of catalog json
    // (`TextureStore.parse()` → `TextureResource.fromTileSet()` → `new TileSet()` inside an effect), and
    // one that does not hold would count no number or an endless one — so they are refused before the
    // count. The number of tiles is held to MaxTiles before the first one is laid as well: a tiny
    // tileWidth out of the catalog would fill the memory otherwise.
    assertOption(Number.isFinite(baseWidth), 'baseCoords.width', 'a finite number', baseWidth);
    assertOption(Number.isFinite(baseHeight), 'baseCoords.height', 'a finite number', baseHeight);
    assertOption(Number.isFinite(this.tileWidth) && this.tileWidth > 0, 'tileWidth', 'a finite number above 0', this.tileWidth);
    assertOption(
      Number.isFinite(this.tileHeight) && this.tileHeight > 0,
      'tileHeight',
      'a finite number above 0',
      this.tileHeight,
    );
    assertOption(Number.isFinite(margin) && margin >= 0, 'margin', 'a finite number of 0 or more', margin);
    assertOption(Number.isFinite(padding) && padding >= 0, 'padding', 'a finite number of 0 or more', padding);
    assertOption(Number.isFinite(spacing) && spacing >= 0, 'spacing', 'a finite number of 0 or more', spacing);
    assertOption(
      tileCountLimit === Infinity ||
        (Number.isInteger(tileCountLimit) && tileCountLimit >= 1 && tileCountLimit <= TileSet.MaxTiles),
      'tileCount',
      `a whole number from 1 to ${TileSet.MaxTiles}`,
      tileCountLimit,
    );
    // the ids of the tiles are counted from here: a string would be concatenated, not added
    assertOption(Number.isInteger(this.firstId), 'firstId', 'a whole number', this.firstId);

    const tileOuterWidth = this.tileWidth + padding * 2;
    const tileOuterHeight = this.tileHeight + padding * 2;

    // the first tile is checked here, and with it inside, the count of every axis is 1 or more:
    // #cellsAlong() counts the cells that follow it
    assertFits(
      margin * 2 + tileOuterWidth <= baseWidth,
      () =>
        `the first tile does not fit into the width of the baseCoords: margin, padding and tileWidth take ${margin * 2 + tileOuterWidth}, the baseCoords are ${baseWidth} wide`,
    );
    assertFits(
      margin * 2 + tileOuterHeight <= baseHeight,
      () =>
        `the first tile does not fit into the height of the baseCoords: margin, padding and tileHeight take ${margin * 2 + tileOuterHeight}, the baseCoords are ${baseHeight} high`,
    );

    const columns = TileSet.#cellsAlong(baseWidth, margin, tileOuterWidth, spacing);
    const rows = TileSet.#cellsAlong(baseHeight, margin, tileOuterHeight, spacing);
    const fitting = columns * rows;

    assertFits(
      this.options.tileCount !== undefined || fitting <= TileSet.MaxTiles,
      () =>
        `${fitting} tiles of ${this.tileWidth} × ${this.tileHeight} fit into ${baseWidth} × ${baseHeight} with margin ${margin}, padding ${padding} and spacing ${spacing} — a tile set holds at most ${TileSet.MaxTiles}; give a tileCount, or larger tiles`,
    );
    assertFits(
      this.options.tileCount === undefined || tileCountLimit <= fitting,
      () =>
        `the tileCount of ${tileCountLimit} does not fit into the baseCoords: ${fitting === 1 ? '1 tile' : `${fitting} tiles`} of ${this.tileWidth} × ${this.tileHeight} fit into ${baseWidth} × ${baseHeight} with margin ${margin}, padding ${padding} and spacing ${spacing}`,
    );

    const tileCount = this.options.tileCount ?? fitting;

    // the tiles go into the atlas only once their number is checked, so a refused set leaves the
    // atlas handed in as it was; they fill the rows from the top left
    for (let i = 0; i < tileCount; i++) {
      const x = margin + (i % columns) * (tileOuterWidth + spacing);
      const y = margin + Math.floor(i / columns) * (tileOuterHeight + spacing);
      const coords = new TextureCoords(this.baseCoords, x + padding, y + padding, this.tileWidth, this.tileHeight);
      const frameId = this.atlas.add(coords);
      if (i === 0) this.#firstFrameId = frameId;
    }

    this.#tileCount = tileCount;
  };
}

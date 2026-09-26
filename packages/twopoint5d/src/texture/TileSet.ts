import {describeValue} from '../utils/describeValue.js';
import {TextureAtlas, type TextureAtlasFrame} from './TextureAtlas.js';
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

const rand = (max: number) => (Math.random() * max) | 0;

export interface TileSetOptions {
  /** The width of one tile — a finite number above 0. Defaults to the width of the `baseCoords`. */
  tileWidth?: number;
  /** The height of one tile — a finite number above 0. Defaults to the height of the `baseCoords`. */
  tileHeight?: number;

  /** The space around the whole grid of tiles — a finite number of 0 or more. Defaults to 0. */
  margin?: number;
  /** The space between two neighbouring tiles — a finite number of 0 or more. Defaults to 0. */
  spacing?: number;
  /** The space around each tile inside its cell — a finite number of 0 or more. Defaults to 0. */
  padding?: number;

  /** How many tiles the set holds — a whole number of 1 or more. Defaults to as many tiles as fit into the image. */
  tileCount?: number;

  firstId?: number;
}

const assertOption = (valid: boolean, name: string, rule: string, value: unknown): void => {
  if (!valid) {
    throw new RangeError(`[TileSet] ${name} must be ${rule}, got ${describeValue(value)}`);
  }
};

/**
 * The [[TileSet]] maps _tileIds_ to _frameIds_.
 * Unlike the `frameId` of [[TextureAtlas]], the `tileId` starts at 1 by default (but is optionally configurable using the `firstId` option).
 * The `frameId` range of a [[TileSet]] starts at `firstFrameId` and goes without gaps to up to `firstFrameId + tileCount - 1`.
 */
export class TileSet {
  readonly atlas: TextureAtlas;
  readonly baseCoords: TextureCoords;
  readonly options: TileSetOptions;

  tileCount = 0;

  /**
   * The `frameId` of the _first_ tile
   */
  firstFrameId = -1;

  /**
   * @throws {RangeError} if `tileWidth` or `tileHeight` is not a finite number above 0, if `margin`,
   * `padding` or `spacing` is not a finite number of 0 or more, if `tileCount` is not a whole number
   * of 1 or more, or if the width or height of the `baseCoords` is not finite.
   */
  constructor(...args: [TextureAtlas, TextureCoords, TileSetOptions?] | [TextureCoords, TileSetOptions?]) {
    if (args[0] instanceof TextureAtlas) {
      const [atlas, baseCoords, options] = args as [TextureAtlas, TextureCoords, TileSetOptions];
      this.atlas = atlas;
      this.baseCoords = baseCoords;
      this.options = options;
    } else {
      this.atlas = new TextureAtlas();
      const [baseCoords, options] = args as [TextureCoords, TileSetOptions];
      this.baseCoords = baseCoords;
      this.options = options;
    }
    this.#createTextureCoords();
  }

  get tileWidth(): number {
    return this.options?.tileWidth ?? this.baseCoords.width;
  }

  get tileHeight(): number {
    return this.options?.tileHeight ?? this.baseCoords.height;
  }

  /**
   * The `tileId` of the _first_ tile
   */
  get firstId(): number {
    return this.options?.firstId ?? 1;
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

  get tileCountLimit(): number {
    return this.options?.tileCount ?? Infinity;
  }

  get margin(): number {
    return this.options?.margin ?? 0;
  }

  get padding(): number {
    return this.options?.padding ?? 0;
  }

  get spacing(): number {
    return this.options?.spacing ?? 0;
  }

  frameId(tileId: number): number {
    return ((((tileId - this.firstId) % this.tileCount) + this.tileCount) % this.tileCount) + this.firstFrameId;
  }

  randomTileId(): number {
    return this.firstId + rand(this.tileCount);
  }

  randomFrameId(): number {
    return this.firstFrameId + rand(this.tileCount);
  }

  frame(tileId: number): TextureAtlasFrame {
    return this.atlas.get(this.frameId(tileId))!;
  }

  randomFrame(): TextureAtlasFrame {
    return this.atlas.get(this.randomFrameId())!;
  }

  #createTextureCoords = (): void => {
    const {width: baseWidth, height: baseHeight} = this.baseCoords;

    const {padding, margin, spacing, tileCountLimit} = this;

    // The layout loop ends only if every step moves forward and the image bounds are finite. The
    // values come unchecked out of catalog json (`TextureStore.parse()` → `TextureResource.fromTileSet()`
    // → `new TileSet()` inside an effect), and one that does not hold would freeze the page
    // synchronously — so they are refused before the loop starts.
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
      tileCountLimit === Infinity || (Number.isInteger(tileCountLimit) && tileCountLimit >= 1),
      'tileCount',
      'a whole number of 1 or more',
      tileCountLimit,
    );

    const tileOuterWidth = this.tileWidth + padding * 2;
    const tileOuterHeight = this.tileHeight + padding * 2;

    let x = margin;
    let y = margin;
    let tileCount = 0;

    while (tileCount < tileCountLimit) {
      const coords = new TextureCoords(this.baseCoords, x + padding, y + padding, this.tileWidth, this.tileHeight);

      const frameId = this.atlas.add(coords);

      if (this.firstFrameId === -1) {
        this.firstFrameId = frameId;
      }

      ++tileCount;

      if (tileCount === tileCountLimit) {
        break;
      }

      const xOffsetNext = tileOuterWidth + spacing;

      if (x + xOffsetNext + tileOuterWidth + margin <= baseWidth) {
        x += xOffsetNext;
      } else {
        x = margin;
        y += tileOuterHeight + spacing;
        if (y + tileOuterHeight + margin > baseHeight) {
          break;
        }
      }
    }

    this.tileCount = tileCount;
  };
}

import {TextureAtlas, TextureAtlasFrame} from './TextureAtlas.js';
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
  tileWidth?: number;
  tileHeight?: number;

  margin?: number;
  spacing?: number;
  padding?: number;

  tileCount?: number;

  firstId?: number;
}

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

    const tileOuterWidth = this.tileWidth + (padding << 1);
    const tileOuterHeight = this.tileHeight + (padding << 1);

    let x = margin;
    let y = margin;
    let tileCount = 0;

    while (tileCountLimit === Infinity || tileCount < tileCountLimit) {
      const coords = new TextureCoords(this.baseCoords, x + padding, y + padding, this.tileWidth, this.tileHeight);

      const frameId = this.atlas.add(coords);

      if (this.firstFrameId === -1) {
        this.firstFrameId = frameId;
      }

      ++tileCount;

      if (tileCountLimit !== Infinity && tileCount === tileCountLimit) {
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

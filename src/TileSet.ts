import {TextureAtlas, TextureAtlasFrame} from './TextureAtlas';
import {TextureCoords} from './TextureCoords';

//
// +---------------------------------------------+
// |         margin                              |
// |   +---------------+<--->+---------------+   |
// | m |    padding    |  s  |    padding    | m |
// | a |  +---------+  |<-p->|  +---------+  | a |
// | r |  |         |  |  a  |  |         |  | r |
// | g |  |         |  |  c  |  |         |  | g |
// | i |  |         |  |  i  |  |         |  | i |
// | n |  +---------+  |<-n->|  +---------+  | n |
// |   |               |  g  |               |   |
// |   +---------------+<--->+---------------+   |
// |         margin                              |
// +---------------------------------------------+
//

export interface TileSetOptions {
  tileWidth?: number;
  tileHeight?: number;

  margin?: number;
  spacing?: number;
  padding?: number;

  tileCount?: number;

  firstId?: number;
}

export class TileSet {
  readonly atlas: TextureAtlas;
  readonly baseCoords: TextureCoords;
  readonly options: TileSetOptions;

  tileCount = 0;
  firstFrameId = -1;

  constructor(
    ...args:
      | [TextureAtlas, TextureCoords, TileSetOptions?]
      | [TextureCoords, TileSetOptions?]
  ) {
    if (args[0] instanceof TextureAtlas) {
      const [atlas, baseCoords, options] = args as [
        TextureAtlas,
        TextureCoords,
        TileSetOptions,
      ];
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

  get firstId(): number {
    return this.options?.firstId ?? 1;
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
    return (
      ((((tileId - this.firstId) % this.tileCount) + this.tileCount) %
        this.tileCount) +
      this.firstFrameId
    );
  }

  frame(tileId: number): TextureAtlasFrame {
    return this.atlas.get(this.frameId(tileId));
  }

  #createTextureCoords = (): void => {
    const {width: baseWidth, height: baseHeight} = this.baseCoords;

    const {padding, margin, spacing, tileCountLimit} = this;

    const tileOuterWidth = this.tileWidth + (padding << 1);
    const tileOuterHeight = this.tileHeight + (padding << 1);

    let x = margin;
    let y = margin;
    let tileCount = 0;

    while (1) {
      const coords = new TextureCoords(
        this.baseCoords,
        x + padding,
        y + padding,
        this.tileWidth,
        this.tileHeight,
      );

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

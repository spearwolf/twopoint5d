import type {AnimationTimingOptions} from './FrameBasedAnimations.js';
import type {TextureOptionClasses} from './TextureFactory.js';
import type {TileSetOptions} from './TileSet.js';

export type TextureSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

/**
 * Animation data for tile-based animations using specific tile IDs.
 */
export type FrameBasedAnimationsDataByTileIds = AnimationTimingOptions & {
  /** Array of tile IDs in the order they should be played — whole numbers */
  tileIds: number[];
};

/**
 * Animation data for tile-based animations using a range of tiles.
 */
export type FrameBasedAnimationsDataByTileCount = AnimationTimingOptions & {
  /** ID of the first tile in the animation sequence — a whole number */
  firstTileId: number;
  /** Number of tiles to include in the animation — a whole number from 1 to `FrameBasedAnimations.MaxTextureSize` */
  tileCount: number;
};

/**
 * Animation data for atlas-based animations using frame name queries.
 */
export type FrameBasedAnimationsDataByAtlas = AnimationTimingOptions & {
  /**
   * Regular expression pattern to match frame names in the atlas.
   *
   * It is compiled into a `RegExp` and run against every frame name of the atlas, so a pattern
   * that backtracks catastrophically stalls the page: take it only from a catalog you trust.
   */
  frameNameQuery: string;
};

export type FrameBasedAnimationsData =
  FrameBasedAnimationsDataByTileIds | FrameBasedAnimationsDataByTileCount | FrameBasedAnimationsDataByAtlas;

export type FrameBasedAnimationsDataMap = Record<string, FrameBasedAnimationsData>;

export interface TextureResourceData {
  /**
   * The image of an image or a tile set resource. A relative url names a file next to the
   * catalog when `TextureStore#load()` fetches it, or next to the `baseUrl` given to
   * `TextureStore#parse()`.
   */
  imageUrl?: string;
  /**
   * The image of an atlas resource, in place of the one its atlas json names. Relative to the
   * catalog, as `imageUrl` is.
   */
  overrideImageUrl?: string;
  /** The atlas json of an atlas resource. Relative to the catalog, as `imageUrl` is. */
  atlasUrl?: string;
  tileSet?: TileSetOptions;
  /**
   * The texture classes of this resource, on top of the defaults of the store. A name no
   * `TextureFactory` knows is left out by `TextureStore#parse()` and reported.
   */
  texture?: TextureOptionClasses[];
  frameBasedAnimations?: FrameBasedAnimationsDataMap;
}

export interface TextureStoreData {
  /**
   * The texture classes every resource starts from. A name no `TextureFactory` knows is left
   * out by `TextureStore#parse()` and reported.
   */
  defaultTextureClasses?: TextureOptionClasses[];
  items: Record<string, TextureResourceData>;
}

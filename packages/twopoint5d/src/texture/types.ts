import type {AnimationTimingOptions} from './FrameBasedAnimations.js';
import type {TextureOptionClasses} from './TextureFactory.js';
import type {TileSetOptions} from './TileSet.js';

export type TextureSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

/**
 * Animation data for tile-based animations using specific tile IDs.
 */
export type FrameBasedAnimationsDataByTileIds = AnimationTimingOptions & {
  /** Array of tile IDs in the order they should be played */
  tileIds: number[];
};

/**
 * Animation data for tile-based animations using a range of tiles.
 */
export type FrameBasedAnimationsDataByTileCount = AnimationTimingOptions & {
  /** ID of the first tile in the animation sequence */
  firstTileId: number;
  /** Number of tiles to include in the animation */
  tileCount: number;
};

/**
 * Animation data for atlas-based animations using frame name queries.
 */
export type FrameBasedAnimationsDataByAtlas = AnimationTimingOptions & {
  /** Regular expression pattern to match frame names in the atlas */
  frameNameQuery: string;
};

export type FrameBasedAnimationsData =
  FrameBasedAnimationsDataByTileIds | FrameBasedAnimationsDataByTileCount | FrameBasedAnimationsDataByAtlas;

export type FrameBasedAnimationsDataMap = Record<string, FrameBasedAnimationsData>;

export interface TextureResourceData {
  imageUrl?: string;
  overrideImageUrl?: string;
  atlasUrl?: string;
  tileSet?: TileSetOptions;
  texture?: TextureOptionClasses[];
  frameBasedAnimations?: FrameBasedAnimationsDataMap;
}

export interface TextureStoreData {
  defaultTextureClasses: TextureOptionClasses[];
  items: Record<string, TextureResourceData>;
}

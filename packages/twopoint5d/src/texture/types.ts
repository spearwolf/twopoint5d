import type {TextureOptionClasses} from './TextureFactory.js';
import type {TileSetOptions} from './TileSet.js';

export type TextureSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

/**
 * Timing options for frame-based animations.
 * Provide exactly one of the following:
 * - `duration`: Total animation time in seconds (e.g., 1.0 for 1 second)
 * - `frameRate`: Frames per second (e.g., 10 for 10 FPS). Must be greater than 0.
 *
 * When `frameRate` is used, the duration is automatically calculated as:
 * `duration = frameCount / frameRate`
 *
 * @example
 * // Using duration (animation takes 0.5 seconds total)
 * { duration: 0.5 }
 *
 * // Using frameRate (10 frames at 20 fps = 0.5 seconds)
 * { frameRate: 20 }
 */
type FrameBasedAnimationsTimingData = {duration: number; frameRate?: never} | {duration?: never; frameRate: number};

/**
 * Animation data for tile-based animations using specific tile IDs.
 */
export type FrameBasedAnimationsDataByTileIds = FrameBasedAnimationsTimingData & {
  /** Array of tile IDs in the order they should be played */
  tileIds: number[];
};

/**
 * Animation data for tile-based animations using a range of tiles.
 */
export type FrameBasedAnimationsDataByTileCount = FrameBasedAnimationsTimingData & {
  /** ID of the first tile in the animation sequence */
  firstTileId: number;
  /** Number of tiles to include in the animation */
  tileCount: number;
};

/**
 * Animation data for atlas-based animations using frame name queries.
 */
export type FrameBasedAnimationsDataByAtlas = FrameBasedAnimationsTimingData & {
  /** Regular expression pattern to match frame names in the atlas */
  frameNameQuery: string;
};

export type FrameBasedAnimationsData =
  | FrameBasedAnimationsDataByTileIds
  | FrameBasedAnimationsDataByTileCount
  | FrameBasedAnimationsDataByAtlas;

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

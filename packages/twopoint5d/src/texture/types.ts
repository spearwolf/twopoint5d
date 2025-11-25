import type {TextureOptionClasses} from './TextureFactory.js';
import type {TileSetOptions} from './TileSet.js';

export type TextureSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

/**
 * Base timing data for frame-based animations.
 * Use either `duration` (total animation time in seconds) or `frameRate` (frames per second), but not both.
 */
type FrameBasedAnimationsTimingData = {duration: number; frameRate?: never} | {duration?: never; frameRate: number};

export type FrameBasedAnimationsDataByTileIds = FrameBasedAnimationsTimingData & {
  tileIds: number[];
};

export type FrameBasedAnimationsDataByTileCount = FrameBasedAnimationsTimingData & {
  firstTileId: number;
  tileCount: number;
};

export type FrameBasedAnimationsDataByAtlas = FrameBasedAnimationsTimingData & {
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

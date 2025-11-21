import type {TextureOptionClasses} from './TextureFactory.js';
import type {TileSetOptions} from './TileSet.js';

export type TextureSource = HTMLImageElement | HTMLCanvasElement | HTMLVideoElement;

interface FrameBasedAnimationsBaseData {
  duration: number;
}

export interface FrameBasedAnimationsDataByTileIds extends FrameBasedAnimationsBaseData {
  tileIds: number[];
}

export interface FrameBasedAnimationsDataByTileCount extends FrameBasedAnimationsBaseData {
  firstTileId: number;
  tileCount: number;
}

export interface FrameBasedAnimationsDataByAtlas extends FrameBasedAnimationsBaseData {
  frameNameQuery: string;
}

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

import type {AnimationPlayback, AnimationTimingOptions} from './FrameBasedAnimations.js';
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
  | FrameBasedAnimationsDataByTileIds
  | FrameBasedAnimationsDataByTileCount
  | FrameBasedAnimationsDataByAtlas;

export type FrameBasedAnimationsDataMap = Record<string, FrameBasedAnimationsData>;

/**
 * An item of a `TextureStore` catalog: the resource it builds and how.
 *
 * The type of that resource is the first of these the item names: `tileSet` makes a tile set,
 * otherwise `atlasUrl` an atlas, otherwise `imageUrl` an image; an item that names none of them
 * builds no resource. `TextureStore#parse()` leaves out every field the type does not read and
 * reports them in one `error` event of the item.
 */
export interface TextureResourceData {
  /**
   * The image of an image or a tile set resource; an atlas takes its image from its json or from
   * `overrideImageUrl`. A relative url names a file next to the catalog when
   * `TextureStore#loadAsync()` fetches it, or next to the `baseUrl` given to
   * `TextureStore#parse()`.
   */
  imageUrl?: string;
  /**
   * The image of an atlas resource, in place of the one its atlas json names. Read by an atlas
   * alone. Relative to the catalog, as `imageUrl` is.
   */
  overrideImageUrl?: string;
  /** The atlas json of an atlas resource, read by an atlas alone. Relative to the catalog, as `imageUrl` is. */
  atlasUrl?: string;
  /**
   * The atlas adapter that reads the json of an atlas resource, by the name it is registered
   * under in the store — `'texturepacker'`, `'aseprite'` or one of `registerAtlasAdapter()`. Read
   * by an atlas alone. Without it the store picks one by `meta.app` of the json. A name the store
   * does not know makes the item build no resource.
   */
  atlasAdapter?: string;
  /**
   * The options of a tile set: an item with a `tileSet` builds a tile set, whatever else it names.
   * A tile set item without an `imageUrl` is reported and built all the same.
   */
  tileSet?: TileSetOptions;
  /**
   * The texture classes of this resource, on top of the defaults of the store; read by every
   * type. A name no `TextureFactory` knows is left out by `TextureStore#parse()` and reported.
   */
  texture?: TextureOptionClasses[];
  /**
   * The animations of a tile set or an atlas resource, by name — over the tiles of a tile set by
   * `tileIds` or `firstTileId`, over the frames of an atlas by `frameNameQuery`. An image reads
   * none.
   */
  frameBasedAnimations?: FrameBasedAnimationsDataMap;
  /**
   * The playback of an animation the atlas adapter reads out of the json, by its name — an Aseprite
   * tag —, in place of the one the json gives it: `{kick: 'once'}` for a sheet exported without
   * Aseprite's "Repeat". Read by an atlas alone, and handed to its adapter; the built-in `aseprite`
   * adapter refuses a tag the sheet lacks, and `texturepacker`, which reads no animations, every one.
   * The entries of `frameBasedAnimations` carry a playback of their own. `TextureStore#parse()`
   * refuses an item whose `playback` is no object or names a value other than `'loop'`, `'once'` and
   * `'pingpong'`.
   */
  playback?: Readonly<Record<string, AnimationPlayback>>;
}

export interface TextureStoreData {
  /**
   * The texture classes every resource starts from. A name no `TextureFactory` knows is left
   * out by `TextureStore#parse()` and reported.
   */
  defaultTextureClasses?: TextureOptionClasses[];
  items: Record<string, TextureResourceData>;
}

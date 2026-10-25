import {AsepriteJson, type AsepriteJsonData} from './AsepriteJson.js';
import type {AnimationPlayback, FrameBasedAnimations} from './FrameBasedAnimations.js';
import type {TextureAtlas} from './TextureAtlas.js';
import type {TextureCoords} from './TextureCoords.js';
import {TexturePackerJson, type TexturePackerJsonData} from './TexturePackerJson.js';

/** What an {@link AtlasAdapter} answers: the atlas of the json, and the animations it names, if any. */
export interface AtlasAdapterResult {
  readonly atlas: TextureAtlas;
  readonly animations?: FrameBasedAnimations;
}

/**
 * What an atlas resource hands its {@link AtlasAdapter} beside the json: the `playback` of its
 * catalog item, or of `AtlasTextureResource#playback`.
 */
export interface AtlasAdapterOptions {
  /**
   * The playback of an animation the adapter reads, by its name — an Aseprite tag —, in place of the
   * one the json gives it.
   */
  readonly playback?: Readonly<Record<string, AnimationPlayback>>;
}

/**
 * Reads an atlas json of the envelope TexturePacker, free-tex-packer and Aseprite share — `frames`,
 * `meta.size`, `meta.image` — and lays its frames out in `parentCoords`, the coords of the image the
 * resource loaded. A `TextureStore` picks one per atlas item, by the `atlasAdapter` the item names
 * or by `meta.app` of the json; see `TextureStore#registerAtlasAdapter()`. The resource hands it
 * the `options` of its item as well; an adapter that reads no animations may leave them unread.
 */
export type AtlasAdapter = (
  json: TexturePackerJsonData,
  parentCoords: TextureCoords,
  options?: AtlasAdapterOptions,
) => AtlasAdapterResult;

/**
 * `TexturePackerJson.parse()` as an adapter: the frames, no animations. Reads free-tex-packer as
 * well. It reads no animations, so a `playback` that names one is refused.
 */
export const texturePackerAtlasAdapter: AtlasAdapter = (json, parentCoords, options) => {
  const named = Object.keys(options?.playback ?? {});
  if (named.length > 0) {
    throw new Error(
      `texturePackerAtlasAdapter: got a playback for ${named.map((name) => `"${name}"`).join(', ')}, but a TexturePacker json carries no animations — name the playback of an entry of frameBasedAnimations in that entry`,
    );
  }
  const [atlas] = TexturePackerJson.parse(json, parentCoords);
  return {atlas};
};

/**
 * `AsepriteJson.parse()` as an adapter: the frames, and the frame tags as animations — a tag named
 * in `options.playback` with that playback, which `parse()` refuses for a tag the sheet lacks.
 */
export const asepriteAtlasAdapter: AtlasAdapter = (json, parentCoords, options) => {
  // The cast claims a duration at every frame and `meta.frameTags` as a list of tags. parse() checks
  // both before it adds a frame — the duration of each frame, the list and that each tag is an object —
  // so a json that is no Aseprite sheet is refused there.
  const [atlas, , animations] = AsepriteJson.parse(json as AsepriteJsonData, {parentCoords, playback: options?.playback});
  return {atlas, animations};
};

/** @internal An adapter of a registry, and the `meta.app` it reads. */
export interface AtlasAdapterEntry {
  readonly name: string;
  readonly adapter: AtlasAdapter;
  readonly app?: RegExp;
}

/** @internal The adapters every store starts with, and that a resource on its own picks among. */
export const builtInAtlasAdapters = (): AtlasAdapterEntry[] => [
  {name: 'texturepacker', adapter: texturePackerAtlasAdapter, app: /texturepacker|free-tex-packer/i},
  {name: 'aseprite', adapter: asepriteAtlasAdapter, app: /aseprite/i},
];

/**
 * @internal The adapter of `entries` whose `app` matches `meta.app` of the json — the latest entry
 * first — or the one named `texturepacker` when none does or the json names no app.
 */
export const pickAtlasAdapter = (entries: readonly AtlasAdapterEntry[], json: TexturePackerJsonData): AtlasAdapter => {
  const app: unknown = (json.meta as {app?: unknown}).app;
  if (typeof app === 'string') {
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i]!;
      if (entry.app == null) continue;
      // a RegExp with `g` or `y` goes on from its lastIndex; every json is tested from the start
      entry.app.lastIndex = 0;
      if (entry.app.test(app)) return entry.adapter;
    }
  }
  return entries.find(({name}) => name === 'texturepacker')?.adapter ?? texturePackerAtlasAdapter;
};

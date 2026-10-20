import {AsepriteJson, type AsepriteJsonData} from './AsepriteJson.js';
import type {FrameBasedAnimations} from './FrameBasedAnimations.js';
import type {TextureAtlas} from './TextureAtlas.js';
import type {TextureCoords} from './TextureCoords.js';
import {TexturePackerJson, type TexturePackerJsonData} from './TexturePackerJson.js';

/** What an {@link AtlasAdapter} answers: the atlas of the json, and the animations it names, if any. */
export interface AtlasAdapterResult {
  readonly atlas: TextureAtlas;
  readonly animations?: FrameBasedAnimations;
}

/**
 * Reads an atlas json of the envelope TexturePacker, free-tex-packer and Aseprite share — `frames`,
 * `meta.size`, `meta.image` — and lays its frames out in `parentCoords`, the coords of the image the
 * resource loaded. A `TextureStore` picks one per atlas item, by the `atlasAdapter` the item names
 * or by `meta.app` of the json; see `TextureStore#registerAtlasAdapter()`.
 */
export type AtlasAdapter = (json: TexturePackerJsonData, parentCoords: TextureCoords) => AtlasAdapterResult;

/** `TexturePackerJson.parse()` as an adapter: the frames, no animations. Reads free-tex-packer as well. */
export const texturePackerAtlasAdapter: AtlasAdapter = (json, parentCoords) => {
  const [atlas] = TexturePackerJson.parse(json, parentCoords);
  return {atlas};
};

/** `AsepriteJson.parse()` as an adapter: the frames, and the frame tags as animations. */
export const asepriteAtlasAdapter: AtlasAdapter = (json, parentCoords) => {
  const [atlas, , animations] = AsepriteJson.parse(json as unknown as AsepriteJsonData, {parentCoords});
  return {atlas: atlas as unknown as TextureAtlas, animations};
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

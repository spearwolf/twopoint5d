import type {AtlasFrameTableSelection} from './AtlasFrameTable.js';
import {liveFrameIds} from './internals.js';
import type {TextureAtlas, TextureAtlasFrame, TextureAtlasFrameName} from './TextureAtlas.js';

/** The frames a selection takes out of an atlas, in its order, and the index of every name among them. */
export interface SelectedAtlasFrames {
  readonly frames: readonly TextureAtlasFrame<unknown>[];
  readonly indices: ReadonlyMap<TextureAtlasFrameName, number>;
}

/**
 * The frames of `atlas` a selection names: a list of names in its order — a name listed twice keeps
 * its first index —, the names a `RegExp` matches as `TextureAtlas#frameNames()` answers them, or
 * without one every frame the atlas has not let go of, in the order of their ids — the index of a
 * frame its frame id, unless `DynamicAtlas#remove()` let go of a frame before it. `where` names the
 * caller in the errors.
 *
 * @throws {Error} for a name the atlas does not hold.
 * @internal
 */
export function selectAtlasFrames(
  atlas: TextureAtlas<unknown>,
  selection: AtlasFrameTableSelection | undefined,
  where: string,
): SelectedAtlasFrames {
  const indices = new Map<TextureAtlasFrameName, number>();
  if (selection == null) {
    // a frame DynamicAtlas#remove() let go of keeps its id and takes no index: its cell is cleared
    const ids = atlas[liveFrameIds]();
    const indexOfId = new Map<number, number>();
    const frames = ids.map((id, index) => {
      indexOfId.set(id, index);
      return atlas.get(id)!;
    });
    for (const name of atlas.frameNames()) indices.set(name, indexOfId.get(atlas.frameId(name)!)!);
    return {frames, indices};
  }
  const names = Array.isArray(selection) ? selection : atlas.frameNames(selection as RegExp);
  const frames = names.map((name) => {
    const frame = atlas.frame(name);
    if (frame == null) {
      // `toString()` and not an interpolation: a name can be a symbol
      throw new Error(`${where}: the atlas holds no frame "${name.toString()}"`);
    }
    return frame;
  });
  names.forEach((name, index) => {
    if (!indices.has(name)) indices.set(name, index);
  });
  return {frames, indices};
}

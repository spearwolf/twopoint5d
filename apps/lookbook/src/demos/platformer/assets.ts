import {
  type FrameBasedAnimationInfo,
  type FrameBasedAnimations,
  type TextureAtlas,
  TextureStore,
  type TextureStoreData,
} from '@spearwolf/twopoint5d';
import type {DataTexture, Texture, WebGPURenderer} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';

/**
 * The catalog of the demo. Every pixel-art image is read with `nearest` filtering — `PaletteSwap`
 * compares exact colours, and says so on the console when the colour map is filtered otherwise —
 * and in sRGB, the palette alike, so both sides of the comparison lie in one colour space.
 *
 * The two Aseprite sheets are plain atlas items: the store reads `meta.app` of their json and picks
 * its built-in `aseprite` adapter, and the frame tags `idle`, `walk`, `kick` … arrive as the
 * `frameBasedAnimations` of the item. The one-shots — `kick`, `flying-kick`, `hit`, `attack`, `die`
 * — carry Aseprite's "Repeat" of 1, which the adapter reads as a `'once'` that holds its last frame.
 */
const CATALOG: TextureStoreData = {
  defaultTextureClasses: ['nearest', 'srgb'],
  items: {
    fighter: {atlasUrl: 'fighter.json'},
    goblin: {atlasUrl: 'goblin.json'},
    goblinPalette: {imageUrl: 'goblin-palette.png'},
    tiles: {atlasUrl: 'tiles.json'},
    sky: {imageUrl: 'sky.png'},
    mountains: {imageUrl: 'mountains.png'},
    machines: {imageUrl: 'machines.png'},
  },
};

/** One Aseprite sheet out of the store: its frames, its image, and its tags as animations. */
export interface Sheet {
  atlas: TextureAtlas;
  colorMap: Texture;
  animations: FrameBasedAnimations;
  /** The data texture `AnimatedFrames` reads the frames out of, baked from `animations`. */
  animsMap: DataTexture;
  /** The animation of a tag, looked up once: id, playback, per-frame durations, frames, `cycleDuration`. */
  anim(name: string): FrameBasedAnimationInfo;
}

export interface PlatformerAssets {
  store: TextureStore;
  fighter: Sheet;
  goblin: Sheet;
  goblinPalette: Texture;
  tiles: {atlas: TextureAtlas; colorMap: Texture};
  layers: {sky: Texture; mountains: Texture; machines: Texture};
  /** Releases the store, which disposes the textures it built, and the baked animsMaps. */
  dispose(): void;
}

const SHEET_PARTS = ['atlas', 'texture', 'frameBasedAnimations'] as const;

/**
 * A sheet out of the parts the store lent; it bakes the animsMap, which the caller frees. Called
 * once every load is through, so that a load that fails leaves no baked texture behind.
 */
function toSheet([atlas, colorMap, animations]: [TextureAtlas, Texture, FrameBasedAnimations]): Sheet {
  const infos = new Map<string, FrameBasedAnimationInfo>();
  return {
    atlas,
    colorMap,
    animations,
    animsMap: animations.bakeDataTexture(),
    anim(name) {
      let info = infos.get(name);
      if (info === undefined) {
        info = animations.animation(name);
        infos.set(name, info);
      }
      return info;
    },
  };
}

export async function loadPlatformerAssets(renderer: WebGPURenderer): Promise<PlatformerAssets> {
  const store = new TextureStore(renderer);

  try {
    store.parse(CATALOG, {baseUrl: new URL(assetsUrl('platformer/'), location.href)});

    const [fighterParts, goblinParts, [goblinPalette], [tilesAtlas, tilesMap], [sky], [mountains], [machines]] =
      await Promise.all([
        store.getAsync('fighter', SHEET_PARTS),
        store.getAsync('goblin', SHEET_PARTS),
        store.getAsync('goblinPalette', ['texture']),
        store.getAsync('tiles', ['atlas', 'texture']),
        store.getAsync('sky', ['texture']),
        store.getAsync('mountains', ['texture']),
        store.getAsync('machines', ['texture']),
      ]);
    const fighter = toSheet(fighterParts);
    const goblin = toSheet(goblinParts);

    return {
      store,
      fighter,
      goblin,
      goblinPalette,
      tiles: {atlas: tilesAtlas, colorMap: tilesMap},
      layers: {sky, mountains, machines},
      dispose() {
        fighter.animsMap.dispose();
        goblin.animsMap.dispose();
        store.dispose();
      },
    };
  } catch (error) {
    store.dispose();
    throw error;
  }
}

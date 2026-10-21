import {
  AsepriteJson,
  type AsepriteJsonData,
  type FrameBasedAnimationInfo,
  type FrameBasedAnimations,
  type TextureAtlas,
  type TextureAtlasFrame,
  TextureStore,
  type TextureStoreData,
} from '@spearwolf/twopoint5d';
import type {DataTexture, Texture, WebGPURenderer} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';

/**
 * The tags that play once and then hold their last frame. In Aseprite a tag with "Repeat" set to 1
 * is a one-shot, and the store's built-in `aseprite` adapter reads it so without a word of code;
 * these two sheets leave "Repeat" empty, so their one-shots are named here instead.
 */
const ONE_SHOTS = ['kick', 'flying-kick', 'hit', 'attack', 'die'];

/**
 * The catalog of the demo. Every pixel-art image is read with `nearest` filtering — `PaletteSwap`
 * compares exact colours, and says so on the console when the colour map is filtered otherwise —
 * and in sRGB, the palette alike, so both sides of the comparison lie in one colour space.
 *
 * The two Aseprite sheets are plain atlas items: the store reads `meta.app` of their json, and the
 * frame tags `idle`, `walk`, `kick` … arrive as the `frameBasedAnimations` of the item.
 */
const CATALOG: TextureStoreData = {
  defaultTextureClasses: ['nearest', 'srgb'],
  items: {
    fighter: {atlasUrl: 'fighter.json', atlasAdapter: 'aseprite-one-shots'},
    goblin: {atlasUrl: 'goblin.json', atlasAdapter: 'aseprite-one-shots'},
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
  /** The animation of a tag, looked up once: id, playback, per-frame durations, `cycleDuration`. */
  anim(name: string): FrameBasedAnimationInfo;
  /** A frame by its Aseprite name, `"fighter 12.aseprite"`. */
  frame(name: string): TextureAtlasFrame;
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

async function loadSheet(store: TextureStore, id: string): Promise<Sheet> {
  const [atlas, colorMap, animations] = await store.getAsync(id, ['atlas', 'texture', 'frameBasedAnimations']);
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
    frame(name) {
      const frame = atlas.frame(name);
      if (frame === undefined) throw new Error(`[platformer] the sheet "${id}" has no frame "${name}"`);
      return frame;
    },
  };
}

export async function loadPlatformerAssets(renderer: WebGPURenderer): Promise<PlatformerAssets> {
  const store = new TextureStore(renderer);

  // registered before the catalog is parsed: the items above name it with `atlasAdapter`
  store.registerAtlasAdapter('aseprite-one-shots', (json, parentCoords) => {
    const sheet = json as unknown as AsepriteJsonData;
    const playback = Object.fromEntries(
      (sheet.meta.frameTags ?? []).filter(({name}) => ONE_SHOTS.includes(name)).map(({name}) => [name, 'once'] as const),
    );
    const [atlas, , animations] = AsepriteJson.parse(sheet, {parentCoords, playback});
    return {atlas: atlas as unknown as TextureAtlas, animations};
  });

  try {
    store.parse(CATALOG, {baseUrl: new URL(assetsUrl('platformer/'), location.href)});

    const [fighter, goblin, [goblinPalette], [tilesAtlas, tilesMap], [sky], [mountains], [machines]] = await Promise.all([
      loadSheet(store, 'fighter'),
      loadSheet(store, 'goblin'),
      store.getAsync('goblinPalette', ['texture']),
      store.getAsync('tiles', ['atlas', 'texture']),
      store.getAsync('sky', ['texture']),
      store.getAsync('mountains', ['texture']),
      store.getAsync('machines', ['texture']),
    ]);

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

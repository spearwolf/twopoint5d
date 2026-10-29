import {BitmapFont, type TextureAtlas, TextureStore, type TextureStoreData} from '@spearwolf/twopoint5d';
import {CanvasTexture, SRGBColorSpace, type Texture, type WebGPURenderer} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';

/** The size of the view every layer of the two demos lays itself out in, in units. */
export const VIEW_WIDTH = 640;
export const VIEW_HEIGHT = 360;

export interface StageTransitionAssets {
  /** `chrome-32` of the sine scroller, drawn in its own chrome */
  chromeFont: BitmapFont;
  chromePage: Texture;
  /** `pixel-8`, white, coloured by `Tint` */
  pixelFont: BitmapFont;
  pixelPage: Texture;
  ships: TextureAtlas;
  shipsTexture: Texture;
  /** a soft white dot, 32 × 32, drawn at run time: the stars and the bullets */
  dot: Texture;
}

// every image of the two demos: the fonts as pixel art, the ships smooth
const catalog: TextureStoreData = {
  defaultTextureClasses: ['nearest', 'srgb'],
  items: {
    chromePage: {imageUrl: 'sine-scroller/chrome-32.png'},
    pixelPage: {imageUrl: 'sine-scroller/pixel-8.png'},
    ships: {atlasUrl: 'spaceships.json', texture: ['linear', 'srgb']},
  },
};

async function loadFont(name: string): Promise<BitmapFont> {
  const response = await fetch(assetsUrl(`sine-scroller/${name}.fnt`));
  const [font] = BitmapFont.parse(await response.text());
  return font;
}

/** A radial white dot on a 2D canvas: no asset file for a star. */
export function makeDotTexture(): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.8)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 32, 32);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  return texture;
}

/** Loads what the two demos draw with. The store holds the textures; dispose it with the demo. */
export async function loadStageTransitionAssets(
  renderer: WebGPURenderer,
): Promise<{store: TextureStore; assets: StageTransitionAssets}> {
  const store = new TextureStore(renderer);
  store.parse(catalog, {baseUrl: assetsUrl('')});
  const [chromeFont, pixelFont, [chromePage], [pixelPage], [ships, shipsTexture]] = await Promise.all([
    loadFont('chrome-32'),
    loadFont('pixel-8'),
    store.getAsync('chromePage', ['texture']),
    store.getAsync('pixelPage', ['texture']),
    store.getAsync('ships', ['atlas', 'texture']),
  ]);
  return {store, assets: {chromeFont, chromePage, pixelFont, pixelPage, ships, shipsTexture, dot: makeDotTexture()}};
}

import {on} from '@spearwolf/eventize';
import {OnStageUpdateFrame, OrthographicProjection, Stage2D, TextureStore, type TextureStoreData} from '@spearwolf/twopoint5d';
import {positionWorld, texture, uniform, vec2, vec4} from 'three/tsl';
import {Mesh, MeshBasicNodeMaterial, PlaneGeometry, type Texture, type WebGPURenderer} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';
import {jsonNumber, jsonObject} from '~demos/utils/checkJson';
import {fetchJson} from '~demos/utils/fetchAsset';

// the art of the demo "stage masks: matte 3d": one bathroom at night and the same room as the
// world inside its mirror, rendered by Blender from one camera (`assets-src/stage-masks/matte-3d/`)
const DIR = 'stage-masks/matte-3d';

/** the view of both rooms, in units, shown with `fit: 'cover'` */
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;

/** What the demo reads of the layout Blender wrote next to the pictures, in units of the stage: origin in the middle, y up. */
export interface RoomLayout {
  /** the glass of the medicine cabinet */
  glass: {left: number; bottom: number; right: number; top: number};
  units: {width: number; height: number};
}

const checkRoomLayout = jsonObject<RoomLayout>({
  glass: jsonObject({left: jsonNumber, bottom: jsonNumber, right: jsonNumber, top: jsonNumber}),
  units: jsonObject({width: jsonNumber, height: jsonNumber}),
});

export interface RoomAssets {
  /** holds the textures; dispose it with the demo */
  store: TextureStore;
  bathroom: Texture;
  reflection: Texture;
  layout: RoomLayout;
}

// in colour, at the anisotropy of the renderer, flipped on upload as three loads an image
const catalog: TextureStoreData = {
  defaultTextureClasses: ['srgb', 'anisotropy', 'flipy'],
  items: {
    bathroom: {imageUrl: 'bathroom.webp'},
    reflection: {imageUrl: 'reflection.webp'},
  },
};

/** Loads the two pictures and their layout. The store of the answer holds the textures; a load that fails disposes the store it built. */
export async function loadRoomAssets(renderer: WebGPURenderer): Promise<RoomAssets> {
  const store = new TextureStore(renderer);
  try {
    store.parse(catalog, {baseUrl: assetsUrl(`${DIR}/`)});
    const [bathroom, reflection, layout] = await Promise.all([
      store.getAsync('bathroom', 'texture'),
      store.getAsync('reflection', 'texture'),
      fetchJson('InkedRoom', assetsUrl(`${DIR}/layout.json`), checkRoomLayout),
    ]);
    return {store, bathroom, reflection, layout};
  } catch (error) {
    store.dispose();
    throw error;
  }
}

/** The middle of the mirror glass in the uv of the picture, from its top left: where the iris of the demo opens. */
export const glassCenterUv = ({glass, units}: RoomLayout): [number, number] => [
  (glass.left + glass.right) / 2 / units.width + 0.5,
  0.5 - (glass.bottom + glass.top) / 2 / units.height,
];

/** A cheap deterministic noise of the clock in 0…1, for the flicker of a lamp: three detuned sines. */
const hum = (t: number, seed: number) =>
  0.5 + 0.22 * Math.sin(t * 7.3 + seed) + 0.17 * Math.sin(t * 13.1 + seed * 2.1) + 0.11 * Math.sin(t * 29.7 + seed * 3.7);

/**
 * One of the two rooms: the picture Blender rendered on a plane, in a `Stage2D` of its own, with
 * the hum of its lamps in its brightness — so the picture a post-process works on is alive. The
 * stage knows nothing of a look: the page assigns one to `stage.postProcess`.
 */
export class InkedRoom {
  readonly stage: Stage2D;
  readonly kind: 'bathroom' | 'reflection';
  readonly #lamps = uniform(1);
  readonly #mesh: Mesh;
  #time = 0;

  constructor(assets: RoomAssets, kind: 'bathroom' | 'reflection') {
    this.kind = kind;
    this.stage = new Stage2D(
      new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'cover'}),
    );
    this.stage.name = kind === 'bathroom' ? 'the bathroom' : 'the reflection';

    const {width, height} = assets.layout.units;
    const p = positionWorld.xy;
    const uv = vec2(p.x.div(width).add(0.5), p.y.div(height).add(0.5));
    const picture = texture(kind === 'bathroom' ? assets.bathroom : assets.reflection, uv).rgb;

    const material = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    material.colorNode = vec4(picture.mul(this.#lamps), 1);
    this.#mesh = new Mesh(new PlaneGeometry(width, height), material);
    this.#mesh.name = kind;
    this.stage.scene.add(this.#mesh);

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
  }

  #update(deltaTime: number): void {
    const t = (this.#time += deltaTime);
    if (this.kind === 'bathroom') {
      this.#lamps.value = 0.9 + 0.2 * hum(t, 1.3);
    } else {
      // a dying tube: it holds, then stutters out for a few frames, twice in every eleven seconds
      const phase = t % 11;
      const stutter = (phase > 3.1 && phase < 3.5) || (phase > 7.9 && phase < 8.05);
      this.#lamps.value = stutter ? (Math.sin(t * 61) > 0.2 ? 0.35 : 0.8) : 0.85 + 0.3 * hum(t, 4.1);
    }
  }

  dispose(): void {
    this.#mesh.geometry.dispose();
    (this.#mesh.material as MeshBasicNodeMaterial).dispose();
    this.stage.dispose();
  }
}

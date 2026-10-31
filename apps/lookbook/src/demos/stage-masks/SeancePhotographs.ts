import {OrthographicProjection, Stage2D} from '@spearwolf/twopoint5d';
import {abs, clamp, exp, float, fwidth, max, mix, mx_noise_float, sin, smoothstep, uniform, uv, vec2, vec3} from 'three/tsl';
import {
  FloatType,
  HalfFloatType,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  PlaneGeometry,
  SRGBColorSpace,
  type Texture,
  type TextureDataType,
  TextureLoader,
  type UniformNode,
  type WebGPURenderer,
} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';

const DIR = 'stage-masks/resolution';

/** the wall in units, shown whole with `fit: 'contain'` */
export const SEANCE_VIEW = {width: 1200, height: 640, fit: 'contain'} as const;

interface Box {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

/** what `assets-src/stage-masks/resolution/` writes into `layout.json` */
export interface SeanceLayout {
  texelsPerUnit: number;
  wall: Box;
  /** one photograph: `w` × `h` units, its top an arch that rises `arch` units */
  photo: {w: number; h: number; arch: number};
  /** the middle of each photograph, left to right */
  panels: {x: number; y: number}[];
  /** the brass plaque under each frame: its middle `dy` below the photograph's, its size */
  plaque: {dy: number; w: number; h: number};
}

export interface SeanceAssets {
  wall: Texture;
  living: Texture;
  spirit: Texture;
  layout: SeanceLayout;
}

/** Loads the generated art of the demo (`assets-src/stage-masks/resolution/`). */
export async function loadSeanceAssets(renderer: WebGPURenderer): Promise<SeanceAssets> {
  const loader = new TextureLoader();
  const anisotropy = renderer.getMaxAnisotropy();
  const load = async (name: string) => {
    const tex = await loader.loadAsync(assetsUrl(`${DIR}/${name}`));
    tex.colorSpace = SRGBColorSpace;
    tex.magFilter = LinearFilter;
    tex.minFilter = LinearMipmapLinearFilter;
    tex.anisotropy = anisotropy;
    return tex;
  };
  const [wall, living, spirit, layout] = await Promise.all([
    load('wall.webp'),
    load('living.webp'),
    load('spirit.webp'),
    fetch(assetsUrl(`${DIR}/layout.json`)).then((response) => response.json() as Promise<SeanceLayout>),
  ]);
  return {wall, living, spirit, layout};
}

export function disposeSeanceAssets(assets: SeanceAssets): void {
  assets.wall.dispose();
  assets.living.dispose();
  assets.spirit.dispose();
}

const makeStage = (name: string) => {
  const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', SEANCE_VIEW));
  stage.name = name;
  return stage;
};

/** A stage that owns its meshes: one plane each, with a material of its own or a shared one. */
class PlaneStage {
  readonly stage: Stage2D;
  readonly #geometries: PlaneGeometry[] = [];
  readonly #materials = new Set<MeshBasicNodeMaterial>();

  constructor(name: string) {
    this.stage = makeStage(name);
  }

  add(name: string, material: MeshBasicNodeMaterial, x: number, y: number, w: number, h: number, order: number): Mesh {
    const geometry = new PlaneGeometry(w, h);
    const mesh = new Mesh(geometry, material);
    mesh.position.set(x, y, 0);
    mesh.name = name;
    mesh.renderOrder = order;
    this.#geometries.push(geometry);
    this.#materials.add(material);
    this.stage.scene.add(mesh);
    return mesh;
  }

  dispose(): void {
    for (const geometry of this.#geometries) geometry.dispose();
    for (const material of this.#materials) material.dispose();
    this.stage.dispose();
  }
}

const picture = (map: Texture) => new MeshBasicNodeMaterial({map, transparent: true, depthTest: false, depthWrite: false});

/** The bottom layer: the wall with its three frames, and the living plate in each of them. */
export class SeanceRoom extends PlaneStage {
  constructor(assets: SeanceAssets) {
    super('parlour');
    const {wall, photo, panels} = assets.layout;
    this.add('wall', picture(assets.wall), 0, 0, wall.right - wall.left, wall.top - wall.bottom, 0);
    // one material for the three photographs: the same plate in every frame
    const living = picture(assets.living);
    for (let i = 0; i < panels.length; i++) {
      this.add(`living plate ${i + 1}`, living, panels[i]!.x, panels[i]!.y, photo.w, photo.h, 1);
    }
  }
}

/**
 * The spirit plate in one frame: a layer of its own, because each frame has a slot of its own and
 * each slot a mask of its own. Transparent outside the arched window of its photograph.
 */
export class SpiritPlate extends PlaneStage {
  constructor(assets: SeanceAssets, panel: number) {
    super(`spirit plate ${panel + 1}`);
    const {photo, panels} = assets.layout;
    this.add('spirit plate', picture(assets.spirit), panels[panel]!.x, panels[panel]!.y, photo.w, photo.h, 0);
  }
}

/**
 * The uniforms every fog stage reads. One clock for all three: the stage of a mask is updated only
 * while a slot references it, and the page writes `time` once per frame, so the three fogs drift
 * as one even while a panel takes its mask off and on.
 */
export class FogClock {
  readonly time = uniform(0) as unknown as UniformNode<'float', number>;
  /** 0 the soft fog, 1 the hard-edged ectoplasm, any value between a blend of the two */
  readonly hard = uniform(0) as unknown as UniformNode<'float', number>;
}

/**
 * The ectoplasm: one living fog over the photograph of one panel, drawn white with the coverage in
 * its alpha on transparent black — a mask stage that clears nothing, read with `source: 'alpha'`.
 * The three panels draw the same fog: the field is a function of the uv of the photograph and of
 * the shared clock, so only the resolution of the pass target tells them apart.
 */
export class EctoplasmFog extends PlaneStage {
  /**
   * The scale of the mask that draws this stage. Only the hard edge reads it, to keep its
   * anti-aliasing one screen pixel wide at any scale — a true hard edge in the target, the way a
   * sprite with a crisp silhouette would draw it.
   */
  readonly #scale = uniform(1) as unknown as UniformNode<'float', number>;

  constructor(layout: SeanceLayout, panel: number, clock: FogClock) {
    super(`ectoplasm ${panel + 1}`);
    const {photo, panels} = layout;
    const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    material.colorNode = vec3(1, 1, 1);
    material.opacityNode = fogCoverage(clock, this.#scale, photo);
    this.add('ectoplasm', material, panels[panel]!.x, panels[panel]!.y, photo.w, photo.h, 0);
  }

  set scale(scale: number) {
    this.#scale.value = scale;
  }
}

/** The coverage of the fog over a photograph, 0 to 1. */
function fogCoverage(clock: FogClock, scale: UniformNode<'float', number>, photo: SeanceLayout['photo']) {
  const t = clock.time;
  // the uv of the photograph, in hundreds of units, so the fog is round and not squeezed
  const p = uv().mul(vec2(photo.w / 100, photo.h / 100));
  // ectoplasm creeps upwards and curls: a domain warp that turns slowly, an fbm that rises
  const q = p.mul(1.15).add(vec2(0, t.mul(-0.07)));
  const warp = vec2(mx_noise_float(vec3(q, t.mul(0.06))), mx_noise_float(vec3(q.add(5.2), t.mul(0.06).add(3.1))));
  const r = p
    .mul(1.4)
    .add(warp.mul(0.75))
    .add(vec2(t.mul(0.02), t.mul(-0.12)));
  const fbm = mx_noise_float(vec3(r, t.mul(0.08)))
    .mul(0.5)
    .add(mx_noise_float(vec3(r.mul(2.03), t.mul(0.11).add(7))).mul(0.28))
    .add(mx_noise_float(vec3(r.mul(4.01), t.mul(0.15).add(13))).mul(0.14))
    .add(mx_noise_float(vec3(r.mul(8.1), t.mul(0.2).add(21))).mul(0.04));
  // the spirit draws the ectoplasm to it: the fog gathers around its head and her shoulders and
  // breathes in and out there, so the veiled figure keeps coming through
  const spirit = p.sub(vec2(photo.w / 200 - 0.1, photo.h / 100 - 0.55)).mul(vec2(1, 0.7));
  const presence = exp(spirit.dot(spirit).mul(-1.6)).mul(sin(t.mul(0.45)).mul(0.14).add(0.2));
  const n = fbm.mul(0.5).add(0.5).add(presence);
  const threshold = float(0.56).add(sin(t.mul(0.31)).mul(0.04));

  // soft: a wide ramp, far wider than a texel of the coarsest target
  const soft = smoothstep(threshold.sub(0.17), threshold.add(0.17), n);

  // hard: a crisp edge, anti-aliased over one screen pixel, and thin filaments that trail the
  // edge like threads of muslin, about 1.5 screen pixels wide. fwidth() answers per texel of the
  // target; divided by the scale it answers per pixel of the screen
  const perScreenPixel = max(fwidth(n), 1e-5).mul(scale);
  const edge = clamp(n.sub(threshold).div(perScreenPixel).add(0.5), 0, 1);
  const thread = (offset: number, width: number) =>
    clamp(float(width).sub(abs(n.sub(threshold.sub(offset))).div(perScreenPixel)), 0, 1);
  const threads = max(thread(0.05, 1.5), thread(0.1, 1.2).mul(0.8)).mul(float(1).sub(edge));
  const hard = max(edge, threads);

  return mix(soft, hard, clock.hard);
}

/** the bytes of one texel of a color target of this type */
export const bytesPerTexel = (type: TextureDataType): number => (type === FloatType ? 16 : type === HalfFloatType ? 8 : 4);

/** the bytes of one texel of the depth buffer every pass target of the director carries */
export const DEPTH_BYTES_PER_TEXEL = 4;

/**
 * The size of the pass target a director gives a mask stage at `scale`: the logical size times
 * the pixel ratio times the scale, rounded down, at least one pixel — as the guide says.
 */
export const maskTargetSize = (logical: number, pixelRatio: number, scale: number): number =>
  Math.max(1, Math.floor(logical * pixelRatio * scale));

/** Bytes as decimal megabytes, the way the guide counts them. */
export const megabytes = (bytes: number): string => {
  const mb = bytes / 1e6;
  return mb >= 1 ? mb.toFixed(1) : mb.toFixed(2);
};

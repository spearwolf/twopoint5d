import {on} from '@spearwolf/eventize';
import {OnStageUpdateFrame, OrthographicProjection, Stage2D} from '@spearwolf/twopoint5d';
import {exp, float, fract, positionWorld, screenCoordinate, sin, smoothstep, texture, uniform, vec2, vec3, vec4} from 'three/tsl';
import {
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  PlaneGeometry,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  type UniformNode,
  type WebGPURenderer,
} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';

const DIR = 'stage-masks/matte-3d';

/** the view of both scenes and of the mask, in units, shown with `fit: 'cover'` */
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;

/** The layout Blender wrote next to the two pictures, in units of the stage: origin in the middle, y up. */
export interface MirrorLayout {
  /** the glass of the medicine cabinet: an exact rectangle, the wall is parallel to the picture */
  glass: {left: number; bottom: number; right: number; top: number};
  /** the two frosted shades, left and right of the cabinet */
  sconces: [number, number][];
  /** where the eyes of the woman behind the viewer show in the mirror of the reflection */
  figureEyes: [number, number][];
  units: {width: number; height: number; texelsPerUnit: number};
}

export interface MirrorAssets {
  bathroom: Texture;
  reflection: Texture;
  layout: MirrorLayout;
}

/** Loads the generated art of the demo (`assets-src/stage-masks/matte-3d/`). */
export async function loadMirrorAssets(renderer: WebGPURenderer): Promise<MirrorAssets> {
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
  const [bathroom, reflection, layout] = await Promise.all([
    load('bathroom.webp'),
    load('reflection.webp'),
    fetch(assetsUrl(`${DIR}/layout.json`)).then((response) => response.json() as Promise<MirrorLayout>),
  ]);
  return {bathroom, reflection, layout};
}

export function disposeMirrorAssets(assets: MirrorAssets): void {
  assets.bathroom.dispose();
  assets.reflection.dispose();
}

export const makeMirrorStage = (name: string) => {
  const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'cover'}));
  stage.name = name;
  return stage;
};

/** A soft round glow of `radius` units around `at`, 1 in the middle. */
const glowAt = (p: Node<'vec2'>, at: [number, number], radius: number): Node<'float'> => {
  const d = p.sub(vec2(at[0], at[1])).div(radius);
  return exp(d.dot(d).negate());
};

/** A cheap deterministic noise of the clock in 0…1, for the flicker of a lamp: three detuned sines. */
const hum = (t: number, seed: number) =>
  0.5 + 0.22 * Math.sin(t * 7.3 + seed) + 0.17 * Math.sin(t * 13.1 + seed * 2.1) + 0.11 * Math.sin(t * 29.7 + seed * 3.7);

/**
 * One of the two scenes: the picture Blender rendered, lit live — the glow of the two sconces with
 * their flicker, the grain of a dark room, and in the reflection the faint glints of her eyes.
 * `kind` picks the picture and its light: the bathroom hums in sodium orange, the reflection's
 * sconces stutter in a dying red over a cold cyan that breathes.
 */
export class MirrorScene {
  readonly stage: Stage2D;
  readonly kind: 'bathroom' | 'reflection';
  readonly #time = uniform(0) as unknown as UniformNode<'float', number>;
  readonly #lamps = uniform(1) as unknown as UniformNode<'float', number>;
  readonly #mesh: Mesh;

  constructor(assets: MirrorAssets, kind: 'bathroom' | 'reflection') {
    this.kind = kind;
    this.stage = makeMirrorStage(kind === 'bathroom' ? 'the bathroom' : 'the reflection');
    const {layout} = assets;
    const {width, height} = layout.units;
    const p = positionWorld.xy;
    const uv = vec2(p.x.div(width).add(0.5), p.y.div(height).add(0.5));
    const picture = texture(kind === 'bathroom' ? assets.bathroom : assets.reflection, uv).rgb;
    const t = this.#time;
    const lamps = this.#lamps;

    let halo: Node<'float'> = float(0);
    for (const s of layout.sconces)
      halo = halo.add(
        glowAt(p, s, 70)
          .mul(0.5)
          .add(glowAt(p, s, 190).mul(0.12)),
      );

    let color: Node<'vec3'>;
    if (kind === 'bathroom') {
      // the sodium hum: the picture follows the lamps a little, the halo a lot
      const sodium = vec3(1.0, 0.55, 0.22);
      color = picture.mul(lamps.mul(0.12).add(0.88)).add(sodium.mul(halo.mul(lamps).mul(0.2)));
    } else {
      // the dying red of the sconces, over a cold light from below that breathes slowly
      const red = vec3(1.0, 0.12, 0.08);
      const breathe = sin(t.mul(0.8)).mul(0.05).add(1);
      let eyes: Node<'float'> = float(0);
      for (const e of layout.figureEyes) eyes = eyes.add(glowAt(p, e, 2.2));
      // her eyes catch the light, now and then
      const glint = smoothstep(0.55, 1, sin(t.mul(0.45)).mul(0.5).add(0.5));
      color = picture
        .mul(breathe.mul(lamps.mul(0.18).add(0.82)))
        .add(red.mul(halo.mul(lamps).mul(0.24)))
        .add(vec3(0.6, 1.0, 0.92).mul(eyes.mul(glint.mul(0.55).add(0.1))));
    }
    // the grain of a dark room, finer than a pixel of the picture
    const sc = screenCoordinate.xy;
    const frame = t.mul(24).floor();
    const grain = fract(sin(sc.x.mul(12.9898).add(sc.y.mul(78.233)).add(frame.mul(3.7))).mul(43758.5453));
    color = color.add(grain.sub(0.5).mul(0.025));

    const material = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    material.colorNode = vec4(color, 1);
    this.#mesh = new Mesh(new PlaneGeometry(width, height), material);
    this.#mesh.name = kind;
    this.stage.scene.add(this.#mesh);

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
  }

  #update(deltaTime: number): void {
    const t = (this.#time.value += Math.min(deltaTime, 0.1));
    if (this.kind === 'bathroom') {
      this.#lamps.value = 0.85 + 0.15 * hum(t, 1.3);
    } else {
      // a dying tube: it holds, then stutters out for a few frames, twice in every eleven seconds
      const phase = t % 11;
      const stutter = (phase > 3.1 && phase < 3.5) || (phase > 7.9 && phase < 8.05);
      this.#lamps.value = stutter ? (Math.sin(t * 61) > 0.2 ? 0.15 : 0.6) : 0.7 + 0.3 * hum(t, 4.1);
    }
  }

  dispose(): void {
    this.#mesh.geometry.dispose();
    (this.#mesh.material as MeshBasicNodeMaterial).dispose();
    this.stage.dispose();
  }
}

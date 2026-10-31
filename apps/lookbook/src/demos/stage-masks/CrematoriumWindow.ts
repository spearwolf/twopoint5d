import {on} from '@spearwolf/eventize';
import {OnStageUpdateFrame, OrthographicProjection, Stage2D, StageMask} from '@spearwolf/twopoint5d';
import {clamp, exp, float, length, mx_noise_float, positionWorld, smoothstep, uniform, vec2, vec3, vec4} from 'three/tsl';
import {
  AddEquation,
  CustomBlending,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  OneFactor,
  PlaneGeometry,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  type UniformNode,
  type WebGPURenderer,
  ZeroFactor,
} from 'three/webgpu';
import assetsUrl from '~demos/utils/assetsUrl';
import {InkRandom} from './InkWell';
import {type SoftBlob, SoftBlobs} from './SoftBlobs';

const DIR = 'stage-masks/heat-haze';

/** the view of both pictures and of the heat, in units, shown with `fit: 'cover'` */
const VIEW = {width: 960, height: 540, fit: 'cover'} as const;

interface Box {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

interface Arch {
  hw: number;
  sill: number;
  spring: number;
  apex: number;
}

/** what `assets-src/stage-masks/heat-haze/` writes into `layout.json` */
export interface CrematoriumLayout {
  world: Box;
  outside: Box;
  glass: Arch;
  vent: {x: number; y: number; hw: number; hh: number};
  lamp: {x: number; y: number};
}

export type CrematoriumVariant = 'snow' | 'ash';

export interface CrematoriumAssets {
  outside: Record<CrematoriumVariant, Texture>;
  room: Record<CrematoriumVariant, Texture>;
  layout: CrematoriumLayout;
}

/** Loads the generated art of the demo (`assets-src/stage-masks/heat-haze/`). */
export async function loadCrematoriumAssets(renderer: WebGPURenderer): Promise<CrematoriumAssets> {
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
  const [outsideSnow, outsideAsh, roomSnow, roomAsh, layout] = await Promise.all([
    load('outside-snow.webp'),
    load('outside-ash.webp'),
    load('room-snow.webp'),
    load('room-ash.webp'),
    fetch(assetsUrl(`${DIR}/layout.json`)).then((response) => response.json() as Promise<CrematoriumLayout>),
  ]);
  return {outside: {snow: outsideSnow, ash: outsideAsh}, room: {snow: roomSnow, ash: roomAsh}, layout};
}

export function disposeCrematoriumAssets(assets: CrematoriumAssets): void {
  for (const tex of [assets.outside.snow, assets.outside.ash, assets.room.snow, assets.room.ash]) tex.dispose();
}

const makeStage = (name: string) => {
  const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', VIEW));
  stage.name = name;
  return stage;
};

/** how many flakes fall past the window, of snow or of ash */
const FLAKES = 170;
/** how many embers rise past the window in the ash */
const EMBERS = 26;

interface Flake {
  blob: SoftBlob;
  x: number;
  y: number;
  /** how near: near flakes are bigger, faster and brighter */
  near: number;
  phase: number;
  /** an ember rises and glows; a flake falls */
  ember: boolean;
}

/**
 * One of the two pictures: the cemetery behind the glass with its weather falling past the window,
 * the room around the window on top, and the vent of the furnace flickering under the sill.
 */
export class CrematoriumView {
  readonly stage: Stage2D;
  readonly variant: CrematoriumVariant;
  readonly #time = uniform(0) as unknown as UniformNode<'float', number>;
  readonly #meshes: Mesh[] = [];
  readonly #flakes = new SoftBlobs({capacity: FLAKES + EMBERS, name: 'weather'});
  readonly #glows = new SoftBlobs({capacity: 2, name: 'sodium lamp'});
  readonly #list: Flake[] = [];
  readonly #rng: InkRandom;
  readonly #bounds: Box;
  #clock = 0;

  constructor(variant: CrematoriumVariant, assets: CrematoriumAssets) {
    this.variant = variant;
    this.stage = makeStage(variant);
    const {outside, world, glass, vent, lamp} = assets.layout;
    this.#bounds = {left: -glass.hw - 30, right: glass.hw + 30, bottom: glass.sill - 10, top: glass.apex + 10};

    const back = new MeshBasicNodeMaterial({map: assets.outside[variant], depthTest: false, depthWrite: false});
    this.#add('outside', back, outside, 0);

    // the weather behind the glass: it draws under the room, so the wall hides it but at the glass
    this.#rng = new InkRandom(variant === 'snow' ? 1301 : 1302);
    for (let i = 0; i < FLAKES + EMBERS; i++) {
      const ember = variant === 'ash' && i >= FLAKES;
      if (variant === 'snow' && i >= FLAKES) break;
      const blob = this.#flakes.add(0, 0, 1, 0)!;
      const flake: Flake = {blob, x: 0, y: 0, near: 0, phase: 0, ember};
      this.#respawn(flake, true);
      if (ember) tint(blob, 1, 0.45, 0.12);
      else if (variant === 'snow') tint(blob, 0.86, 0.9, 1);
      else tint(blob, 0.42, 0.38, 0.36);
      this.#list.push(flake);
    }
    this.#flakes.mesh.renderOrder = 1;
    this.stage.scene.add(this.#flakes.mesh);

    if (variant === 'snow') {
      tint(this.#glows.add(lamp.x, lamp.y, 34, 0.35)!, 1, 0.62, 0.25);
      tint(this.#glows.add(lamp.x, lamp.y, 10, 0.8)!, 1, 0.85, 0.55);
    }
    this.#glows.mesh.renderOrder = 2;
    this.stage.scene.add(this.#glows.mesh);

    const front = new MeshBasicNodeMaterial({
      map: assets.room[variant],
      transparent: true,
      depthTest: false,
      depthWrite: false,
    });
    this.#add('room', front, world, 3);

    // the furnace behind the vent breathes: a warm light on the wall and the sill, flickering
    const p = positionWorld.xy;
    const t = this.#time;
    const d = length(p.sub(vec2(vent.x, vent.y)).mul(vec2(1, 1.3)));
    const flicker = mx_noise_float(vec3(t.mul(2.3), float(0.5), float(1.7)))
      .mul(0.35)
      .add(mx_noise_float(vec3(t.mul(7.1), float(3.1), float(0.2))).mul(0.15))
      .add(0.75);
    const slots = mx_noise_float(vec3(p.x.mul(0.05), t.mul(1.4), float(4)))
      .mul(0.5)
      .add(0.5);
    const glow = exp(d.div(vent.hw * 0.9).negate())
      .mul(0.32)
      .add(
        exp(d.div(vent.hw * 0.3).negate())
          .mul(slots)
          .mul(0.5),
      )
      .mul(flicker)
      // down to nothing well inside the plane, so its edges never show
      .mul(float(1).sub(smoothstep(150, 230, d)));
    // added as light, and the alpha left as it is: an additive blend would add up the alpha as well,
    // and a picture with an alpha above 1 shows the plane as a box once a transition samples it
    const furnace = new MeshBasicNodeMaterial({
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: CustomBlending,
      blendEquation: AddEquation,
      blendSrc: OneFactor,
      blendDst: OneFactor,
      blendSrcAlpha: ZeroFactor,
      blendDstAlpha: OneFactor,
    });
    furnace.colorNode = vec4(vec3(1, 0.42, 0.12).mul(clamp(glow, 0, 1)), 1);
    this.#add('furnace glow', furnace, {left: -320, right: 320, bottom: world.bottom, top: glass.sill + 140}, 4);

    // precompile() draws the stage before its first update: the pools upload now
    this.#flakes.update();
    this.#glows.update();

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(Math.min(deltaTime, 0.1)));
  }

  #add(name: string, material: MeshBasicNodeMaterial, box: Box, order: number): void {
    const mesh = new Mesh(new PlaneGeometry(box.right - box.left, box.top - box.bottom), material);
    mesh.position.set((box.left + box.right) / 2, (box.bottom + box.top) / 2, 0);
    mesh.name = name;
    mesh.renderOrder = order;
    this.#meshes.push(mesh);
    this.stage.scene.add(mesh);
  }

  #respawn(flake: Flake, anywhere: boolean): void {
    const rng = this.#rng;
    const b = this.#bounds;
    flake.near = rng.next() ** 2;
    flake.phase = rng.range(0, 6.28);
    flake.x = rng.range(b.left, b.right);
    if (anywhere) flake.y = rng.range(b.bottom, b.top);
    else flake.y = flake.ember ? b.bottom : b.top;
    const blob = flake.blob;
    if (flake.ember) {
      blob.radius = 1.2 + flake.near * 2.2;
      blob.intensity = 0.9;
    } else {
      blob.radius = (this.variant === 'snow' ? 1.1 : 1.4) + flake.near * (this.variant === 'snow' ? 3.2 : 3.8);
      blob.intensity = 0.45 + flake.near * 0.5;
    }
  }

  #update(dt: number): void {
    this.#clock += dt;
    this.#time.value = this.#clock;
    const b = this.#bounds;
    const t = this.#clock;
    const list = this.#list;
    for (let i = 0; i < list.length; i++) {
      const f = list[i]!;
      if (f.ember) {
        f.y += (26 + f.near * 40) * dt;
        f.x += Math.sin(t * 1.7 + f.phase) * 22 * dt;
        f.blob.intensity = 0.55 + 0.4 * Math.sin(t * 9 + f.phase * 3);
        if (f.y > b.top) this.#respawn(f, false);
      } else {
        // ash falls slower than snow and tumbles more
        const ash = this.variant === 'ash';
        f.y -= (ash ? 10 + f.near * 22 : 16 + f.near * 38) * dt;
        f.x += (Math.sin(t * (ash ? 1.3 : 0.8) + f.phase) * (ash ? 16 : 10) + (ash ? 3 : -4)) * dt;
        if (f.y < b.bottom) this.#respawn(f, false);
      }
      if (f.x < b.left) f.x = b.right;
      else if (f.x > b.right) f.x = b.left;
      f.blob.x = f.x;
      f.blob.y = f.y;
    }
    this.#flakes.update();
    if (this.variant === 'snow') {
      // the sodium lamp hums: a slow breath with now and then a stutter
      const hum = 0.32 + 0.04 * Math.sin(t * 3.1) + (Math.sin(t * 0.7) > 0.97 ? -0.15 : 0);
      this.#glows.blobs[0]!.intensity = hum;
      this.#glows.update();
    }
  }

  dispose(): void {
    for (const mesh of this.#meshes) {
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    this.#flakes.dispose();
    this.#glows.dispose();
    this.stage.dispose();
  }
}

/** how many plumes of hot air the column holds at once */
const PLUMES = 150;

interface Plume {
  blob: SoftBlob;
  age: number;
  life: number;
  /** where in the width of the column it rises, −1 to 1: the column widens with the progress */
  lane: number;
  rise: number;
  r0: number;
  phase: number;
  wobble: number;
  drift: number;
}

/**
 * The mask stage: a column of hot air rising from the vent. Soft blobs rise and wobble on a clock
 * of their own — the heat lives also while the progress is held — and the progress of the mask
 * shapes the column: thin and faint at the start, widening and thickening until it fills the view.
 * The stage is never in the stack: the effect names its mask, and the director draws it only while
 * a transition runs.
 */
export class HeatColumn {
  readonly stage = makeStage('heat column');
  /** the mask the effect reads: the alpha of the blobs is the coverage */
  readonly mask = new StageMask(this.stage);
  readonly #blobs = new SoftBlobs({capacity: PLUMES, name: 'heat plumes'});
  readonly #plumes: Plume[] = [];
  readonly #rng = new InkRandom(7177);
  readonly #vent: {x: number; y: number};

  constructor(layout: CrematoriumLayout) {
    this.#vent = {x: layout.vent.x, y: layout.vent.y + 6};
    for (let i = 0; i < PLUMES; i++) {
      const plume: Plume = {
        blob: this.#blobs.add(0, 0, 1, 0)!,
        age: 0,
        life: 1,
        lane: 0,
        rise: 0,
        r0: 0,
        phase: 0,
        wobble: 0,
        drift: 0,
      };
      this.#spawn(plume);
      // spread over their lives, so the column stands from the first frame
      plume.age = this.#rng.next() * plume.life;
      this.#plumes.push(plume);
    }
    this.stage.scene.add(this.#blobs.mesh);
    // precompile() draws the stage before its first update: the pool uploads now
    this.#place(0);
    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => {
      this.#advance(Math.min(deltaTime, 0.1));
      this.#place(this.mask.progress);
    });
  }

  #spawn(plume: Plume): void {
    const rng = this.#rng;
    plume.age = 0;
    plume.rise = rng.range(90, 170);
    // up out of the top of the view, wherever it starts
    plume.life = (330 - this.#vent.y) / plume.rise;
    plume.lane = rng.range(-1, 1);
    plume.r0 = rng.range(12, 30);
    plume.phase = rng.range(0, 6.28);
    plume.wobble = rng.range(1.2, 2.6);
    plume.drift = rng.range(-0.08, 0.08);
  }

  #advance(dt: number): void {
    const plumes = this.#plumes;
    for (let i = 0; i < plumes.length; i++) {
      const plume = plumes[i]!;
      plume.age += dt;
      if (plume.age >= plume.life) this.#spawn(plume);
    }
  }

  /** Lays every plume out by its age and by the progress of the transition. */
  #place(progress: number): void {
    // the column: as wide as the vent at the start, the whole view at the end
    const width = 14 + 620 * progress ** 2.2;
    const grow = 1 + 1.3 * progress;
    const strength = smooth(0, 0.1, progress) * (0.3 + 0.7 * progress ** 1.5);
    // late in the transition the plumes keep their strength to the top, so the heat closes up
    const hold = smooth(0.55, 0.95, progress);
    const plumes = this.#plumes;
    for (let i = 0; i < plumes.length; i++) {
      const plume = plumes[i]!;
      const a = plume.age / plume.life;
      const h = plume.age * plume.rise;
      const blob = plume.blob;
      blob.x =
        this.#vent.x +
        plume.lane * width +
        Math.sin(plume.age * plume.wobble + plume.phase) * (6 + h * 0.07) * grow +
        h * plume.drift;
      blob.y = this.#vent.y + h;
      // late in the transition the plumes swell at the vent too, so the bottom of the view closes
      blob.radius = (plume.r0 + h * 0.15) * grow + 120 * progress ** 3;
      const envelope = smooth(0, 0.1, a) * (1 - smooth(0.65, 1, a));
      blob.intensity = strength * (envelope + (1 - envelope) * hold);
    }
    this.#blobs.update();
  }

  dispose(): void {
    this.mask.dispose();
    this.#blobs.dispose();
    this.stage.dispose();
  }
}

function tint(blob: SoftBlob, r: number, g: number, b: number): void {
  blob.r = r;
  blob.g = g;
  blob.b = b;
}

function smooth(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

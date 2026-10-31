import {on} from '@spearwolf/eventize';
import {OnStageUpdateFrame, OrthographicProjection, Stage2D, type StageMask} from '@spearwolf/twopoint5d';
import {
  abs,
  clamp,
  float,
  fwidth,
  length,
  max,
  min,
  mx_noise_float,
  positionWorld,
  pow,
  smoothstep,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry, type UniformNode, Vector4} from 'three/webgpu';
import {SoftBlobs} from './SoftBlobs';

/** the view of both scenes and of the ink, in units, shown with `fit: 'cover'` */
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;
/** how many blots the ink grows from */
export const SEEDS = 7;
/** how many drops splash ahead of the blots */
const DROPS = 56;
/** by this share of the progress every blot has grown to its full size: the screen is covered before the end */
const FULL_AT = 0.92;
/** how a blot's radius follows its share of the growth: slow at first, as a drop soaks in */
const GROWTH = 1.0;

export const makeInkStage = (name: string) => {
  const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'cover'}));
  stage.name = name;
  return stage;
};

/** A tiny deterministic random source, so a seeded run of the ink looks the same every time. */
export class InkRandom {
  #state: number;
  constructor(seed: number) {
    this.#state = seed >>> 0;
  }
  next(): number {
    this.#state = (this.#state + 0x6d2b79f5) >>> 0;
    let t = this.#state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
}

interface Drop {
  seed: number;
  /** where the drop lands, in units */
  x: number;
  y: number;
  /** its distance from its seed: it lands once the blot has grown to a share of it */
  distance: number;
  radius: number;
}

/**
 * The blots of the ink: where they start, when and how big they grow — the layout both the mask
 * stage and the wet edge read. The seeds live in uniforms, so both materials grow the same blots
 * from `mask.progressNode` on the GPU; the drops are worked out on the CPU from `mask.progress`.
 * {@link scatter} lays out a new set of blots, before a transition starts.
 */
export class InkBlotLayout {
  /** per seed: x, y in units, the progress it starts growing at, its full radius */
  readonly seeds: UniformNode<'vec4', Vector4>[] = [];
  readonly drops: Drop[] = [];
  readonly #rng: InkRandom;

  constructor(seed: number) {
    this.#rng = new InkRandom(seed);
    for (let i = 0; i < SEEDS; i++) this.seeds.push(uniform(new Vector4()) as unknown as UniformNode<'vec4', Vector4>);
    for (let i = 0; i < DROPS; i++) this.drops.push({seed: 0, x: 0, y: 0, distance: 0, radius: 0});
    this.scatter();
  }

  /** A new layout: the first blot near the middle, the others spread over the view, later and later. */
  scatter(): void {
    const rng = this.#rng;
    const hw = VIEW_WIDTH / 2;
    const hh = VIEW_HEIGHT / 2;
    for (let i = 0; i < SEEDS; i++) {
      const s = this.seeds[i]!.value;
      if (i === 0) s.set(rng.range(-0.25, 0.25) * hw, rng.range(-0.3, 0.3) * hh, 0, rng.range(330, 380));
      else {
        // around the rim of the view, in turn, so every corner gets a blot of its own
        const a = ((i - 1) / (SEEDS - 1)) * Math.PI * 2 + rng.range(-0.35, 0.35);
        const r = rng.range(0.55, 0.95);
        s.set(Math.cos(a) * hw * r, Math.sin(a) * hh * r, rng.range(0.03, 0.5), rng.range(260, 320));
      }
    }
    for (const d of this.drops) {
      d.seed = Math.floor(rng.next() * SEEDS);
      const s = this.seeds[d.seed]!.value;
      const a = rng.range(0, Math.PI * 2);
      d.distance = s.w * rng.range(0.12, 0.6);
      d.x = s.x + Math.cos(a) * d.distance;
      d.y = s.y + Math.sin(a) * d.distance;
      d.radius = rng.range(2.5, 11) * (rng.next() < 0.15 ? 2 : 1);
    }
  }

  /** The radius of blot `i` at `progress`, in units, as the shader works it out. */
  radiusOf(i: number, progress: number): number {
    const s = this.seeds[i]!.value;
    const g = Math.min(1, Math.max(0, (progress - s.z) / (FULL_AT - s.z)));
    return s.w * g ** GROWTH;
  }

  /** The radius of drop `d` at `progress`: it lands when the edge of its blot is about halfway there, and swells. */
  dropRadiusOf(d: Drop, progress: number): number {
    const edge = this.radiusOf(d.seed, progress);
    const k = Math.min(1, Math.max(0, (edge - d.distance * 0.45) / 30));
    return d.radius * k * (0.6 + 0.4 * k);
  }

  /** 1 while drop `d` lies ahead of the ink, fading to 0 as the blots reach it. */
  dropAheadOf(d: Drop, progress: number): number {
    // the field of the shader without its noise: where the blots, melted together, have reached
    let sum = 0;
    for (let i = 0; i < SEEDS; i++) {
      const s = this.seeds[i]!.value;
      const r = this.radiusOf(i, progress);
      const dx = d.x - s.x;
      const dy = d.y - s.y;
      const q = (r * r) / (dx * dx + dy * dy + 1);
      sum += q * q;
    }
    const t = Math.min(1, Math.max(0, (sum - 0.45) / 0.5));
    return 1 - t * t * (3 - 2 * t);
  }

  /**
   * The ink field at `p`: 1 on the edge of the blots, above 1 inside. Each blot is a metaball whose
   * edge is pushed out into tendrils by a noise around its middle; neighbours melt together.
   */
  field(p: Node<'vec2'>, progress: Node<'float'>, time: Node<'float'>): Node<'float'> {
    // the whole edge wanders a little, slowly, as wet ink creeps
    const q = p.add(
      vec2(mx_noise_float(vec3(p.mul(0.007), time.mul(0.05))), mx_noise_float(vec3(p.mul(0.007).add(17), time.mul(0.05)))).mul(
        26,
      ),
    );
    let sum: Node<'float'> = float(0);
    for (let i = 0; i < SEEDS; i++) {
      const s = this.seeds[i]!;
      const grow = clamp(progress.sub(s.z).div(float(FULL_AT).sub(s.z)), 0, 1);
      const radius = s.w.mul(pow(grow, GROWTH));
      const delta = q.sub(s.xy);
      const d = length(delta).add(0.001);
      const dir = delta.div(d);
      // tendrils: a noise over the direction from the middle — continuous all the way round
      const tendril = pow(
        clamp(
          mx_noise_float(vec3(dir.mul(2.0), float(i * 7.3)))
            .mul(0.5)
            .add(0.5),
          0,
          1,
        ),
        3.4,
      );
      const fine = mx_noise_float(vec3(dir.mul(7), float(i * 3.1 + 40))).mul(0.03);
      const reach = d.mul(float(1).sub(tendril.mul(0.62)).sub(fine));
      // a quartic metaball: neighbours melt together, but the sum of seven does not swallow the screen at once
      const ball = radius.mul(radius).div(reach.mul(reach).add(1));
      sum = sum.add(ball.mul(ball));
    }
    // a fine grain along the edge: paper fibres the ink bleeds into
    return sum.mul(float(1).add(mx_noise_float(vec3(p.mul(0.09), float(3))).mul(0.02)));
  }
}

/**
 * The mask stage: the ink, white over transparent black. Its alpha is the coverage `matte()`
 * reads in `'coverage'` mode, the share of `to`. The blots grow on the GPU by `mask.progressNode`;
 * the drops that splash ahead of them are a {@link SoftBlobs} pool sized on the CPU by
 * `mask.progress` — both follow the eased progress of the transition, whatever its duration.
 */
export class InkBlots {
  readonly stage = makeInkStage('ink');
  readonly layout: InkBlotLayout;
  readonly #time = uniform(0);
  #plane: Mesh | undefined;
  readonly #drops = new SoftBlobs({
    capacity: DROPS,
    name: 'ink drops',
    // a drop has a crisp rim, not a glow
    falloff: (t) => 1 - Math.min(1, Math.max(0, (t - 0.72) / 0.28)) ** 2,
  });
  #mask: StageMask | undefined;

  constructor(layout: InkBlotLayout) {
    this.layout = layout;
    for (let i = 0; i < DROPS; i++) this.#drops.add(0, 0, 0, 1);
    this.#drops.mesh.renderOrder = 1;
    this.stage.scene.add(this.#drops.mesh);
    // precompile() draws the mask stage before its first update: the pool has to have uploaded once
    this.#drops.update();

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
  }

  /**
   * Binds the mask that reads this stage, once it is made: its `progressNode` grows the blots on
   * the GPU, its `progress` sizes the drops on the CPU. The mask needs the stage first, so the
   * material that needs the mask is built here.
   */
  bind(mask: StageMask): void {
    this.#mask = mask;
    const f = this.layout.field(positionWorld.xy, mask.progressNode, this.#time);
    // a narrow soft edge of about two pixels wherever it runs: where two blots melt together the
    // field climbs slowly, and a fixed band of the field would turn into a wide blur there. Capped:
    // near the middle of a blot the field and its derivative soar, and the edge is far away
    const w = min(fwidth(f).mul(1.5), 0.2).add(0.004);
    const coverage = smoothstep(float(1).sub(w), float(1).add(w), f);
    const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    material.colorNode = vec4(vec3(coverage), coverage);
    this.#plane = new Mesh(new PlaneGeometry(1600, 1000), material);
    this.#plane.name = 'ink blots';
    this.stage.scene.add(this.#plane);
  }

  #update(deltaTime: number): void {
    this.#time.value += Math.min(deltaTime, 0.1);
    const progress = this.#mask?.progress ?? 0;
    const {drops} = this.layout;
    const blobs = this.#drops.blobs;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i]!;
      const blob = blobs[i]!;
      blob.x = d.x;
      blob.y = d.y;
      blob.radius = this.layout.dropRadiusOf(d, progress) + 0.001;
    }
    this.#drops.update();
  }

  dispose(): void {
    this.#plane?.geometry.dispose();
    (this.#plane?.material as MeshBasicNodeMaterial | undefined)?.dispose();
    this.#drops.dispose();
    this.stage.dispose();
  }
}

/**
 * A layer above the slot of the transition — not a mask: the wet edge of the ink. It draws the same
 * blots from the same uniforms a little wider than the mask, black-violet with a sheen, so the ink
 * is seen where the title gives way to the level. Hidden while no transition runs: between two
 * transitions `progressNode` holds the last value, and a cancelled one would leave its rim behind.
 */
export class WetEdge {
  readonly stage = makeInkStage('wet edge');
  /** the UI's switch: off shows the bare matte */
  enabled = true;
  /** whether a transition through the ink runs: the page sets it */
  running = false;
  readonly #layout: InkBlotLayout;
  readonly #time = uniform(0);
  #plane: Mesh | undefined;
  readonly #rings = new SoftBlobs({
    capacity: DROPS,
    name: 'ink drop rims',
    // a ring around each drop: dark where the drop of the mask ends
    falloff: (t) => Math.exp(-(((t - 0.62) / 0.16) ** 2)),
  });
  #mask: StageMask | undefined;

  constructor(layout: InkBlotLayout) {
    this.#layout = layout;
    for (let i = 0; i < DROPS; i++) {
      const ring = this.#rings.add(0, 0, 0, 0.85)!;
      ring.r = 0.03;
      ring.g = 0.008;
      ring.b = 0.05;
    }
    this.#rings.mesh.renderOrder = 1;
    this.stage.scene.add(this.#rings.mesh);
    // uploaded once now, as the drops of the mask stage are
    this.#rings.update();

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
  }

  /** Binds the mask of the ink: its `progressNode` and `progress` grow the edge as they grow the blots. */
  bind(mask: StageMask): void {
    this.#mask = mask;
    const p = positionWorld.xy;
    const f = this.#layout.field(p, mask.progressNode, this.#time);
    // the ink soaks a little into the title outside the edge, and lies wet just inside it
    const band = smoothstep(0.7, 0.98, f).mul(float(1).sub(smoothstep(1.04, 1.9, f)));
    const sheen = pow(
      clamp(
        mx_noise_float(vec3(p.mul(0.012), this.#time.mul(0.2)))
          .mul(0.5)
          .add(0.5),
        0,
        1,
      ),
      3,
    );
    // a glossy highlight on the wet lip just inside the edge
    const lip = float(1).sub(smoothstep(0.0, 0.05, abs(f.sub(1.16))));
    const base = vec3(0.012, 0.004, 0.02);
    const violet = vec3(0.16, 0.04, 0.24);
    const color = base.add(violet.mul(sheen.mul(0.28).add(lip.mul(0.14))));
    const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    // matte() shows all of `to` at progress 1, whatever the ink drew: the edge dries up on the last stretch
    const dry = float(1).sub(smoothstep(0.9, 1, mask.progressNode));
    material.colorNode = vec4(color, max(band.mul(0.95), lip.mul(0.4)).mul(dry));
    this.#plane = new Mesh(new PlaneGeometry(1600, 1000), material);
    this.#plane.name = 'wet edge';
    // visible until the first update hides it: precompile() draws the stage before that, and builds its shader
    this.stage.scene.add(this.#plane);
  }

  #update(deltaTime: number): void {
    this.#time.value += Math.min(deltaTime, 0.1);
    const visible = this.enabled && this.running;
    if (this.#plane) this.#plane.visible = visible;
    this.#rings.mesh.visible = visible;
    if (!visible) return;
    const progress = this.#mask?.progress ?? 0;
    const {drops} = this.#layout;
    const blobs = this.#rings.blobs;
    for (let i = 0; i < drops.length; i++) {
      const d = drops[i]!;
      const blob = blobs[i]!;
      blob.x = d.x;
      blob.y = d.y;
      // the drop of the mask fills 0.72 of its radius crisp: the ring sits around that, and goes
      // once the edge of its blot has swallowed the drop
      blob.radius = this.#layout.dropRadiusOf(d, progress) * 1.45 + 0.001;
      blob.intensity = 0.85 * this.#layout.dropAheadOf(d, progress);
    }
    this.#rings.update();
  }

  dispose(): void {
    this.#plane?.geometry.dispose();
    (this.#plane?.material as MeshBasicNodeMaterial | undefined)?.dispose();
    this.#rings.dispose();
    this.stage.dispose();
  }
}

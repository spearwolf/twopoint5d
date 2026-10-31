import {on} from '@spearwolf/eventize';
import {OnStageUpdateFrame, OrthographicProjection, Stage2D} from '@spearwolf/twopoint5d';
import {abs, exp, float, length, max, mx_noise_float, positionWorld, pow, smoothstep, uniform, vec3, vec4} from 'three/tsl';
import {
  CustomBlending,
  Mesh,
  MeshBasicNodeMaterial,
  type Node,
  OneFactor,
  PlaneGeometry,
  Vector2,
  ZeroFactor,
} from 'three/webgpu';
import {SoftBlobs} from './SoftBlobs';

/** The view every stage of the demo lays itself out in, in units; `cover` fills any window. */
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;
/** The world the room images cover, in units, the origin in the middle, y up. */
export const WORLD = {left: -600, right: 600, bottom: -320, top: 320};

/** Where the rift may wander: the view, less a margin. */
const BOUNDS = {left: -440, right: 440, bottom: -230, top: 230};
const RIFT_SPEED = 260;
/** how long the rift takes to tear open at the start, in seconds */
const OPEN_TIME = 1.8;
/** how many spores the membrane buds at its rim at most */
const SPORES = 10;

export const makeRiftStage = (name: string) => {
  const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'cover'}));
  stage.name = name;
  return stage;
};

/** What moves the rift: held keys, or a point a pointer drag leads it to (in units). */
export interface RiftInput {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  target: {x: number; y: number} | undefined;
}

/**
 * The state of the rift, shared by the mask stage that draws it, the glow of its rim and the rooms:
 * where it is, how big, how far open, how it breathes and flickers. One instance per page,
 * {@link update} once per frame before anything draws.
 */
export class RiftState {
  readonly input: RiftInput = {left: false, right: false, up: false, down: false, target: undefined};
  /** the rift size of the UI: the radius of the membrane at rest, in units */
  size = 170;

  /** the uniforms the shaders read */
  readonly center = uniform(new Vector2(150, 30));
  readonly radius = uniform(0);
  readonly time = uniform(0);
  readonly flicker = uniform(1);

  /** where the rift goes; it follows softly */
  readonly #goal = new Vector2(150, 30);
  #open = 0;
  #idle = 0;
  #stutter = 0;
  #nextStutter = 4;
  /** a small deterministic random, so the preview card is the same each run */
  #seed = 7;

  random(): number {
    this.#seed = (this.#seed * 16807) % 2147483647;
    return this.#seed / 2147483647;
  }

  get x(): number {
    return this.center.value.x;
  }

  get y(): number {
    return this.center.value.y;
  }

  update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1);
    const t = (this.time.value += dt);
    const {input} = this;
    const goal = this.#goal;

    // the keys push the goal, a drag sets it; left alone a while, the rift drifts on its own
    const kx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const ky = (input.up ? 1 : 0) - (input.down ? 1 : 0);
    if (kx !== 0 || ky !== 0) {
      const k = RIFT_SPEED * dt * (kx !== 0 && ky !== 0 ? Math.SQRT1_2 : 1);
      goal.x += kx * k;
      goal.y += ky * k;
      this.#idle = 0;
    } else if (input.target) {
      goal.set(input.target.x, input.target.y);
      this.#idle = 0;
    } else {
      this.#idle += dt;
      if (this.#idle > 6) {
        const w = Math.min(1, (this.#idle - 6) / 4) * dt * 0.6;
        goal.x += (Math.sin(t * 0.13) * 300 - goal.x) * w;
        goal.y += (Math.sin(t * 0.21 + 1) * 90 + 20 - goal.y) * w;
      }
    }
    goal.x = Math.min(BOUNDS.right, Math.max(BOUNDS.left, goal.x));
    goal.y = Math.min(BOUNDS.top, Math.max(BOUNDS.bottom, goal.y));
    const c = this.center.value;
    const follow = 1 - Math.exp(-dt * 5);
    c.x += (goal.x - c.x) * follow;
    c.y += (goal.y - c.y) * follow;

    // it tears open with an overshoot, then breathes
    this.#open = Math.min(1, this.#open + dt / OPEN_TIME);
    const o = this.#open;
    const opening = 1 - (1 - o) ** 3 + Math.sin(o * Math.PI) * 0.12;
    const breath = 1 + Math.sin(t * 1.25) * 0.05 + Math.sin(t * 0.47) * 0.03;
    this.radius.value = this.size * opening * breath;

    // the membrane flickers: a fine shiver, and now and then a stutter where it nearly goes
    this.#nextStutter -= dt;
    if (this.#nextStutter <= 0) {
      this.#stutter = 0.35 + this.random() * 0.25;
      this.#nextStutter = 3 + this.random() * 6;
    }
    this.#stutter = Math.max(0, this.#stutter - dt);
    const stutter = this.#stutter > 0 ? 0.55 + 0.45 * Math.abs(Math.sin(t * 47)) : 1;
    this.flicker.value = (0.93 + 0.07 * Math.sin(t * 31) * Math.sin(t * 13.7)) * stutter;
  }
}

/** The nodes of the rift's outline at a point: its distance from the middle and where its edge lies there. */
export interface RiftShape {
  d: Node<'float'>;
  edge: Node<'float'>;
}

/**
 * The outline of the rift at a point `p` in units, in TSL: a ring that wobbles, torn into tendrils
 * — thin spikes where a ridged noise over the direction peaks — and roughened by a fine noise over
 * the place. The mask stage and the rim glow read the same outline.
 */
export function riftShape(p: Node<'vec2'>, rift: RiftState): RiftShape {
  const rel = p.sub(rift.center);
  const d = length(rel);
  const dir = rel.div(max(d, 0.001));
  const t = rift.time;
  const wobble = mx_noise_float(vec3(dir.mul(1.6), t.mul(0.22)));
  const ripple = mx_noise_float(vec3(dir.mul(4.2).add(3.1), t.mul(0.55)));
  const ridge = float(1).sub(abs(mx_noise_float(vec3(dir.mul(1.7).add(9.7), t.mul(0.12)))));
  const tendril = pow(ridge, float(16));
  const rough = mx_noise_float(vec3(p.mul(0.045), t.mul(0.9))).mul(7);
  const edge = rift.radius.mul(float(1).add(wobble.mul(0.13)).add(ripple.mul(0.05)).add(tendril.mul(0.34))).add(rough);
  return {d, edge};
}

/** how soft the edge of the membrane is, in units: the band where both worlds mix */
const SOFT_EDGE = 26;

/**
 * The mask stage: the membrane of the rift over transparent black. One full-world plane works out
 * the outline per pixel; a {@link SoftBlobs} pool adds the spores it buds at its rim, small pockets
 * of the other world that drift off and close.
 *
 * Its alpha is the coverage. Its rgb is that coverage times a slow boil, so `source: 'luminance'`
 * reads a membrane with holes boiling through it, and `'alpha'` the whole membrane.
 */
export class RiftMembrane {
  readonly stage = makeRiftStage('rift membrane');
  /** how often the membrane drew since {@link takeDraws} was asked last */
  #draws = 0;

  readonly #rift: RiftState;
  readonly #plane: Mesh;
  readonly #spores = new SoftBlobs({capacity: SPORES, name: 'rift spores', falloff: (t) => (1 - t * t) ** 2});
  readonly #sporeState: {angle: number; life: number; span: number; size: number; drift: number}[] = [];

  constructor(rift: RiftState) {
    this.#rift = rift;
    const p = positionWorld.xy;
    const {d, edge} = riftShape(p, rift);
    const coverage = float(1)
      .sub(smoothstep(edge.sub(SOFT_EDGE), edge, d))
      .mul(rift.flicker);
    const boil = smoothstep(-0.35, 0.45, mx_noise_float(vec3(p.mul(0.014), rift.time.mul(0.5))));
    const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    material.colorNode = vec4(vec3(boil.mul(0.75).add(0.25)), coverage);
    this.#plane = new Mesh(new PlaneGeometry(WORLD.right - WORLD.left, WORLD.top - WORLD.bottom), material);
    this.#plane.name = 'rift membrane';
    // counts the draws of the mask stage: two StageMask objects on it are still one stage, drawn once
    this.#plane.onBeforeRender = () => {
      this.#draws++;
    };
    this.stage.scene.add(this.#plane);

    for (let i = 0; i < SPORES; i++) {
      this.#spores.add(0, 0, 0, 0);
      this.#sporeState.push({angle: 0, life: 1, span: 1, size: 0, drift: 0});
    }
    this.#spores.mesh.renderOrder = 1;
    this.stage.scene.add(this.#spores.mesh);
    // the director may draw the mask stage (precompile()) before its first update: upload the pool now
    this.#spores.update();

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
  }

  /** The draws of the membrane since the last call. */
  takeDraws(): number {
    const draws = this.#draws;
    this.#draws = 0;
    return draws;
  }

  #update(deltaTime: number): void {
    const rift = this.#rift;
    const r = rift.radius.value;
    const blobs = this.#spores.blobs;
    for (let i = 0; i < blobs.length; i++) {
      const s = this.#sporeState[i]!;
      const blob = blobs[i]!;
      s.life += deltaTime / s.span;
      if (s.life >= 1) {
        s.life = 0;
        s.span = 1.6 + rift.random() * 2.4;
        s.angle = rift.random() * Math.PI * 2;
        s.size = 0.1 + rift.random() * 0.12;
        s.drift = 0.25 + rift.random() * 0.35;
      }
      // born at the rim, drifting out, swelling and closing again
      const k = Math.sin(s.life * Math.PI);
      const dist = r * (0.95 + s.drift * s.life);
      blob.x = rift.x + Math.cos(s.angle) * dist;
      blob.y = rift.y + Math.sin(s.angle) * dist;
      blob.radius = r * s.size * k + 0.001;
      blob.intensity = k * rift.flicker.value;
    }
    this.#spores.update();
  }

  dispose(): void {
    this.#plane.geometry.dispose();
    (this.#plane.material as MeshBasicNodeMaterial).dispose();
    this.#spores.dispose();
    this.stage.dispose();
  }
}

/** Purely additive: rgb onto what lies below, the alpha of the layer left as it is. */
export function additive(material: MeshBasicNodeMaterial): MeshBasicNodeMaterial {
  material.transparent = true;
  material.blending = CustomBlending;
  material.blendSrc = OneFactor;
  material.blendDst = OneFactor;
  material.blendSrcAlpha = ZeroFactor;
  material.blendDstAlpha = OneFactor;
  material.depthTest = false;
  material.depthWrite = false;
  return material;
}

/**
 * The top layer, never masked: the torn rim of the rift glowing cyan, so the edge of the membrane
 * reads as a thing, and a faint seed of light where the rift's middle is — where it follows you.
 */
export class RiftRim {
  readonly stage = makeRiftStage('rift rim');
  readonly #plane: Mesh;

  constructor(rift: RiftState) {
    const p = positionWorld.xy;
    const {d, edge} = riftShape(p, rift);
    const x = d.sub(edge.sub(SOFT_EDGE * 0.5)).div(6);
    const rim = exp(x.mul(x).negate())
      .mul(0.3)
      .add(exp(x.mul(x).mul(0.06).negate()).mul(0.07));
    const seedX = d.div(7);
    const seed = exp(seedX.mul(seedX).negate()).mul(0.35);
    const glow = vec3(0.35, 0.95, 1)
      .mul(rim)
      .add(vec3(0.75, 1, 1).mul(seed))
      .mul(rift.flicker);
    const material = additive(new MeshBasicNodeMaterial());
    material.colorNode = vec4(glow, 1);
    this.#plane = new Mesh(new PlaneGeometry(WORLD.right - WORLD.left, WORLD.top - WORLD.bottom), material);
    this.#plane.name = 'rift rim';
    this.stage.scene.add(this.#plane);
  }

  dispose(): void {
    this.#plane.geometry.dispose();
    (this.#plane.material as MeshBasicNodeMaterial).dispose();
    this.stage.dispose();
  }
}

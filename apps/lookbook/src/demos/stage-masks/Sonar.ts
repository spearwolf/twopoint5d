import {on} from '@spearwolf/eventize';
import {OnStageUpdateFrame, OrthographicProjection, Stage2D, type StageMask} from '@spearwolf/twopoint5d';
import {
  abs,
  atan,
  clamp,
  exp,
  float,
  fract,
  fwidth,
  length,
  max,
  min,
  mix,
  mx_fractal_noise_float,
  mx_noise_float,
  positionWorld,
  sin,
  smoothstep,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {Mesh, MeshBasicNodeMaterial, type Node, PlaneGeometry, type UniformNode, Vector3, Vector4} from 'three/webgpu';

/** the view of both scenes, of the mask stage and of the HUD, in units, shown with `fit: 'cover'` */
export const VIEW_WIDTH = 960;
export const VIEW_HEIGHT = 540;

export const makeSonarStage = (name: string) => {
  const stage = new Stage2D(new OrthographicProjection('xy|bottom-left', {width: VIEW_WIDTH, height: VIEW_HEIGHT, fit: 'cover'}));
  stage.name = name;
  return stage;
};

/** the three pictures the mask stage can draw, in the order of {@link SonarField.weights} */
export const SONAR_KINDS = ['sonar sweep', 'boiling noise', 'pulse rings'] as const;
export type SonarKind = (typeof SONAR_KINDS)[number];

const TAU = Math.PI * 2;
/** how fast the beam turns, in radians per second: a turn in about five seconds, clockwise */
const BEAM_SPEED = 1.25;
/** the pings: how many per second leave the sub, and how far apart their fronts travel, in units */
const PING_RATE = 0.55;
const PING_SPACING = 150;
/** the reach of the sonar over the view, in units: the distance at which the bias of range ends */
const RANGE = 900;

/**
 * The living gray picture of the sonar, as TSL: for every point of the view a coverage from 0 to 1
 * — in `'threshold'` mode the progress at which that pixel switches. One field, read by three
 * materials: the mask stage (what `matte()` samples), the HUD's glowing front and the inset scope.
 * They share the uniforms, so all three show the same picture in the same frame.
 *
 * - **sonar sweep**: the angle behind a turning beam. Just behind the beam the coverage is 0, a
 *   full turn behind it 1: at progress p the wedge of the last p of a turn has switched, and it
 *   turns with the beam — the thing shows in the wake of the sweep, and the wake widens with p.
 * - **boiling noise**: a fractal noise that boils with the time, stretched over the whole range.
 * - **pulse rings**: the time since a ping front passed, biased by the range: near the sub first,
 *   then ring after ring outwards.
 */
export class SonarField {
  /** the clock of the sonar, in seconds: the page advances it, the mask stage does not own it */
  readonly time = uniform(0);
  /** the share of each kind in the picture: one is 1 and eases over when the kind changes */
  readonly weights = uniform(new Vector3(1, 0, 0)) as unknown as UniformNode<'vec3', Vector3>;
  readonly #origin: Node<'vec2'>;
  readonly #target = new Vector3(1, 0, 0);
  #kind: SonarKind = 'sonar sweep';

  constructor(origin: {x: number; y: number}) {
    this.#origin = vec2(origin.x, origin.y);
  }

  get kind(): SonarKind {
    return this.#kind;
  }

  set kind(kind: SonarKind) {
    this.#kind = kind;
    const i = SONAR_KINDS.indexOf(kind);
    this.#target.set(i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0);
  }

  /** Advances the clock and eases the weights towards the kind, in about half a second. */
  update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1);
    this.time.value += dt;
    this.weights.value.lerp(this.#target, 1 - Math.exp(-dt * 8));
  }

  /** The polar parts of a point around the sub: its distance, the phase behind the beam and behind the last ping. */
  parts(p: Node<'vec2'>) {
    const d = p.sub(this.#origin);
    const r = length(d);
    const angle = atan(d.y, d.x);
    // the beam turns clockwise: just behind it the phase is 0, it climbs to 1 a full turn behind
    const sweep = fract(angle.add(this.time.mul(BEAM_SPEED)).div(TAU));
    const ping = fract(this.time.mul(PING_RATE).sub(r.div(PING_SPACING)));
    return {r, sweep, ping};
  }

  coverage(p: Node<'vec2'>): Node<'float'> {
    const t = this.time;
    const {r, sweep, ping} = this.parts(p);
    const range = clamp(r.div(RANGE), 0, 1);
    // a slow wobble, so even the sweep looks like it is read off a living sea
    const wobble = mx_noise_float(vec3(p.mul(0.008), t.mul(0.3)));
    const sweepCov = clamp(sweep.mul(0.86).add(range.mul(0.1)).add(wobble.mul(0.05)), 0, 1);
    const ringCov = clamp(ping.mul(0.55).add(range.mul(0.45)).add(wobble.mul(0.03)), 0, 1);
    const warp = vec2(
      mx_noise_float(vec3(p.mul(0.003), t.mul(0.15))),
      mx_noise_float(vec3(p.mul(0.003).add(31), t.mul(0.15))),
    ).mul(60);
    const boil = mx_fractal_noise_float(vec3(p.add(warp).mul(0.0045), t.mul(0.22)), 4, 2, 0.5, 1);
    const boilCov = clamp(boil.mul(1.3).add(0.5), 0, 1);
    const w = this.weights;
    return sweepCov.mul(w.x).add(boilCov.mul(w.y)).add(ringCov.mul(w.z));
  }
}

/**
 * The mask stage: the field as an opaque gray picture, read under `source: 'luminance'`. It is never
 * in the stack — `matte()` names its mask, and the director draws it only while a transition runs.
 */
export class SonarMaskStage {
  readonly stage = makeSonarStage('sonar mask');
  readonly #plane: Mesh;

  constructor(field: SonarField) {
    const material = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    material.colorNode = vec4(vec3(field.coverage(positionWorld.xy)), 1);
    this.#plane = new Mesh(new PlaneGeometry(1600, 1000), material);
    this.#plane.name = 'sonar field';
    this.stage.scene.add(this.#plane);
  }

  dispose(): void {
    this.#plane.geometry.dispose();
    (this.#plane.material as MeshBasicNodeMaterial).dispose();
    this.stage.dispose();
  }
}

/** the inset scope on the screen, in CSS pixels: where the page puts its caption */
export interface ScopeRect {
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * A layer above the slot, not a mask: the sonar display. Over the whole picture it draws the
 * beam, the ping fronts and faint range rings, and — while a transition runs — the front where the
 * pixels switch, glowing cyan, as wide as the softness. In a corner it draws the scope: the raw gray
 * picture of the mask stage, the switched part tinted, so the threshold can be read off it.
 */
export class SonarHud {
  readonly stage = makeSonarStage('sonar hud');
  /** the softness of the running `matte()`: the page writes it when a transition begins */
  readonly softness = uniform(0.05);
  /** whether the scope in the corner shows */
  scopeVisible = true;
  /** where the scope is, in CSS pixels; written in every update */
  readonly scope: ScopeRect = {right: 16, bottom: 16, width: 0, height: 0};
  /** whether a transition through the sonar runs: the page sets it */
  running = false;

  readonly #active = uniform(0);
  readonly #view = uniform(new Vector4(0, 0, VIEW_WIDTH, VIEW_HEIGHT)) as unknown as UniformNode<'vec4', Vector4>;
  readonly #canvas: HTMLCanvasElement;
  #overlay: Mesh | undefined;
  #inset: Mesh | undefined;

  constructor(canvas: HTMLCanvasElement) {
    this.#canvas = canvas;
    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
  }

  /** Binds the field and the mask whose `progressNode` the front follows. */
  bind(field: SonarField, mask: StageMask): void {
    const progress = mask.progressNode;
    const s = this.softness;
    const active = this.#active;
    const cyan = vec3(0.32, 1, 0.9);

    // ---- over the whole picture
    const p = positionWorld.xy;
    const c = field.coverage(p);
    const {r, sweep, ping} = field.parts(p);
    // where matte() switches: the middle of the band of `switched()` in the library, edge − s / 2
    const front = progress.mul(s.add(1)).sub(s.mul(0.5));
    // the front as a line about two pixels wide wherever the field runs (the distance in pixels is
    // the distance in coverage over its derivative), and a faint band as wide as the softness.
    // fwidth is capped where the field jumps (the beam), so the jump does not draw a wide stroke
    const fw = clamp(fwidth(c), 0.00002, 0.02);
    const dc = c.sub(front);
    const band = exp(dc.div(fw.mul(2.2)).pow(2).negate())
      .mul(0.9)
      .add(exp(dc.div(s.mul(0.5).add(0.0001)).pow(2).negate()).mul(0.07));
    // the front holds both ends by the switching function: it fades in and out at progress 0 and 1
    const ends = smoothstep(0, 0.03, progress).mul(float(1).sub(smoothstep(0.97, 1, progress)));
    const frontGlow = band.mul(ends).mul(active);
    const w = field.weights;
    // the beam: a thin line and the afterglow behind it, in units across, at any range
    const across = min(sweep, float(1).sub(sweep)).mul(TAU).mul(r);
    const beam = exp(across.div(2.2).pow(2).negate()).add(exp(sweep.mul(-14)).mul(0.22));
    const pingAcross = min(ping, float(1).sub(ping)).mul(PING_SPACING);
    const pingFront = exp(pingAcross.div(1.8).pow(2).negate()).add(exp(ping.mul(-9)).mul(0.12));
    const grid = exp(
      abs(fract(r.div(PING_SPACING).add(0.5)).sub(0.5))
        .mul(PING_SPACING)
        .div(0.7)
        .pow(2)
        .negate(),
    ).mul(0.35);
    // near the sub every angle is a hair's breadth from the beam: the lines start a little out
    const fade = float(1)
      .sub(smoothstep(250, 900, r).mul(0.6))
      .mul(smoothstep(20, 90, r));
    const display = beam.mul(w.x).add(pingFront.mul(w.z)).add(grid).mul(fade).mul(active.mul(0.16).add(0.1));
    const overlay = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    overlay.colorNode = vec4(mix(cyan, vec3(0.85, 1, 0.98), frontGlow.mul(0.6)), clamp(frontGlow.mul(0.85).add(display), 0, 1));
    this.#overlay = new Mesh(new PlaneGeometry(1600, 1000), overlay);
    this.#overlay.name = 'sonar display';
    this.stage.scene.add(this.#overlay);

    // ---- the scope: the visible view squeezed into the corner
    const view = this.#view;
    const q = view.xy.add(uv().sub(0.5).mul(view.zw));
    const cq = field.coverage(q);
    const edge = progress.mul(s.add(1));
    // the switched share as matte() works it out (a tiny band for softness 0, so smoothstep keeps a < b)
    const switched = float(1)
      .sub(smoothstep(edge.sub(s).sub(0.0005), edge, cq))
      .mul(active);
    const fq = clamp(fwidth(cq), 0.00002, 0.03);
    const line = exp(cq.sub(front).div(fq.mul(1.4)).pow(2).negate())
      .mul(ends)
      .mul(active);
    const gray = vec3(cq.mul(0.88).add(0.04));
    const tinted = mix(gray, gray.mul(vec3(0.25, 0.85, 0.8)).add(vec3(0.0, 0.1, 0.1)), switched.mul(0.8));
    // a frame, scan lines, a darker rim
    const fu = uv();
    const rim = max(abs(fu.x.sub(0.5)), abs(fu.y.sub(0.5)));
    const frame = smoothstep(0.488, 0.492, rim);
    const scan = sin(fu.y.mul(view.w).mul(1.6)).mul(0.04).add(0.96);
    const color = mix(tinted.add(cyan.mul(line)).mul(scan), cyan.mul(0.8), frame);
    const inset = new MeshBasicNodeMaterial({depthTest: false, depthWrite: false});
    inset.colorNode = vec4(color, 1);
    this.#inset = new Mesh(new PlaneGeometry(1, 1), inset);
    this.#inset.name = 'sonar scope';
    this.#inset.renderOrder = 1;
    this.stage.scene.add(this.#inset);
  }

  #update(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.1);
    this.#active.value += ((this.running ? 1 : 0) - this.#active.value) * (1 - Math.exp(-dt * 6));
    const inset = this.#inset;
    const projection = this.stage.projection as OrthographicProjection | undefined;
    if (!inset || !projection) return;
    inset.visible = this.scopeVisible;
    const rect = projection.getViewRect();
    const cw = this.#canvas.clientWidth;
    const ch = this.#canvas.clientHeight;
    if (!(cw > 0 && ch > 0 && rect.width > 0)) return;
    // the scope shows the visible view: same aspect as the canvas, a fifth of its width or so
    let width = Math.min(280, Math.max(150, cw * 0.22));
    let height = (width * ch) / cw;
    if (height > ch * 0.3) {
      height = ch * 0.3;
      width = (height * cw) / ch;
    }
    const margin = 16;
    const upp = rect.width / cw;
    this.#view.value.set(rect.offsetX, rect.offsetY, rect.width, rect.height);
    inset.scale.set(width * upp, height * upp, 1);
    inset.position.set(
      rect.offsetX + rect.width / 2 - (margin + width / 2) * upp,
      rect.offsetY - rect.height / 2 + (margin + height / 2) * upp,
      0,
    );
    this.scope.right = margin;
    this.scope.bottom = margin;
    this.scope.width = width;
    this.scope.height = height;
  }

  dispose(): void {
    for (const mesh of [this.#overlay, this.#inset]) {
      if (!mesh) continue;
      mesh.geometry.dispose();
      (mesh.material as MeshBasicNodeMaterial).dispose();
    }
    this.stage.dispose();
  }
}

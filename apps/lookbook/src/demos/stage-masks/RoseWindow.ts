import {abs, attribute, float, step, texture, uv, vec4} from 'three/tsl';
import {BufferAttribute, BufferGeometry, Mesh, MeshBasicNodeMaterial} from 'three/webgpu';
import {type ChapelAssets, makeChapelStage, type PaneInfo, type SeanceClock} from './MothChapel';

/** What a pane does: rests in its lead, flies out to a place of its own and floats there, or comes back. */
interface Pane {
  info: PaneInfo;
  mesh: Mesh;
  /** where it is, from its place in the lead: a shift in units and a turn in radians */
  x: number;
  y: number;
  rot: number;
  /** where its flight started and where it goes */
  fromX: number;
  fromY: number;
  fromRot: number;
  toX: number;
  toY: number;
  toRot: number;
  /** seconds into the flight, its length, its delay */
  t: number;
  take: number;
  delay: number;
  /** how it floats once it is out: 0 … 1 */
  float: number;
  floatTo: number;
  bob: number;
  spin: number;
  phase: number;
}

const easeInOut = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * The mask stage: the glass of the rose window, one mesh per pane — 253 of them, each a quad over
 * its pane with the glass picture at its home place in the window. A pane keeps only its own glass:
 * the ids of `panes.png` cut every quad to its pane. The picture's red is the amber of the glass,
 * its blue the violet, its alpha the light it lets through; the demo reads the one stage through
 * three `StageMask`s, one per channel.
 *
 * The panes are moved by {@link update}, which the demo calls from the bottom layer — never from
 * this stage's own frame. So the mask scene changes even while the director has frozen this stage,
 * and the screen shows none of it until the stage is drawn again.
 */
export class RoseWindow {
  readonly stage = makeChapelStage('rose window');
  readonly panes: Pane[] = [];

  readonly #clock: SeanceClock;
  readonly #material: MeshBasicNodeMaterial;
  /** how often the glass was drawn since {@link takeDraws} was asked last */
  #draws = 0;
  #moving = false;
  #scattered = false;

  constructor(assets: ChapelAssets, clock: SeanceClock) {
    this.#clock = clock;
    const {window} = assets;
    const e = window.extent;

    const q = uv();
    const glass = texture(assets.glass, q);
    const ids = texture(assets.panes, q);
    // the id under this texel, little-endian over red and green: is it this pane's?
    const id = ids.r
      .mul(255)
      .add(ids.g.mul(255 * 256))
      .round();
    const mine = float(1).sub(step(0.5, abs(id.sub(attribute('paneId', 'float')))));
    this.#material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    this.#material.colorNode = vec4(glass.r, float(0), glass.b, glass.a.mul(mine));

    for (const info of window.panes) {
      const mesh = new Mesh(paneGeometry(info, e), this.#material);
      mesh.name = `pane ${info.id} (${info.ring} ${info.part})`;
      mesh.position.set(info.cx, info.cy, 0);
      // a pane that flies out still draws: the quads are cheap to cull by hand, not worth the risk
      mesh.frustumCulled = false;
      this.stage.scene.add(mesh);
      this.panes.push({
        info,
        mesh,
        x: 0,
        y: 0,
        rot: 0,
        fromX: 0,
        fromY: 0,
        fromRot: 0,
        toX: 0,
        toY: 0,
        toRot: 0,
        t: 0,
        take: 0,
        delay: 0,
        float: 0,
        floatTo: 0,
        bob: 0,
        spin: 0,
        phase: 0,
      });
    }
    // counts the draws of the mask stage: every draw draws every pane, the first one counts them
    const counter = this.panes[0]!.mesh;
    counter.onBeforeRender = () => {
      this.#draws++;
    };
  }

  /** The draws of the glass since the last call. */
  takeDraws(): number {
    const draws = this.#draws;
    this.#draws = 0;
    return draws;
  }

  /** whether any pane moves: the mask scene changes */
  get isMoving(): boolean {
    return this.#moving;
  }

  /** whether the glass is out of its lead */
  get isScattered(): boolean {
    return this.#scattered;
  }

  /**
   * Lifts every pane out of the lead to a new place of its own, turned, and lets it float there.
   * Pressed again, the panes fly to new places.
   */
  scramble(): void {
    const clock = this.#clock;
    this.#scattered = true;
    for (const pane of this.panes) {
      const {cx, cy, ring} = pane.info;
      const r = Math.hypot(cx, cy) || 1;
      const out =
        ring === 'eye' ? 8 + clock.random() * 30 : ring === 'petal' ? 18 + clock.random() * 46 : 10 + clock.random() * 34;
      const across = (clock.random() - 0.5) * (ring === 'eye' ? 30 : 46);
      const nx = cx / r;
      const ny = cy / r;
      this.#fly(
        pane,
        nx * out - ny * across,
        ny * out + nx * across,
        (clock.random() - 0.5) * (ring === 'lancet' ? 2.4 : 3.4),
        // the eye goes first, then the glass ripples out to the rim
        (r / 300) * 0.9 + clock.random() * 0.35,
        1.3 + clock.random() * 1.1,
      );
      pane.floatTo = 1;
      pane.bob = 2.5 + clock.random() * 6;
      pane.spin = 0.04 + clock.random() * 0.12;
      pane.phase = clock.random() * Math.PI * 2;
    }
  }

  /** Brings every pane back into its lead, the rim first, and lets it rest there. */
  mend(): void {
    if (!this.#scattered) return;
    const clock = this.#clock;
    this.#scattered = false;
    for (const pane of this.panes) {
      const r = Math.hypot(pane.info.cx, pane.info.cy);
      this.#fly(pane, 0, 0, 0, (1 - r / 300) * 0.8 + clock.random() * 0.3, 1.1 + clock.random() * 0.7);
      pane.floatTo = 0;
    }
  }

  #fly(pane: Pane, x: number, y: number, rot: number, delay: number, take: number): void {
    pane.fromX = pane.x;
    pane.fromY = pane.y;
    pane.fromRot = pane.rot;
    pane.toX = x;
    pane.toY = y;
    pane.toRot = rot;
    pane.t = 0;
    pane.delay = delay;
    pane.take = take;
    this.#moving = true;
  }

  /** Moves the panes. Called by the demo once per frame, whether the director draws this stage or not. */
  update(deltaTime: number): void {
    if (!this.#moving) return;
    const dt = Math.min(deltaTime, 0.1);
    const t = this.#clock.time.value;
    let moving = false;
    for (let i = 0; i < this.panes.length; i++) {
      const pane = this.panes[i]!;
      let k = 1;
      if (pane.take > 0) {
        pane.t += dt;
        k = easeInOut((pane.t - pane.delay) / pane.take);
        if (k >= 1) pane.take = 0;
      }
      pane.x = pane.fromX + (pane.toX - pane.fromX) * k;
      pane.y = pane.fromY + (pane.toY - pane.fromY) * k;
      pane.rot = pane.fromRot + (pane.toRot - pane.fromRot) * k;
      pane.float += (pane.floatTo - pane.float) * Math.min(1, dt * 2);
      if (pane.floatTo === 0 && pane.float < 0.01) pane.float = 0;
      const f = pane.float;
      const bob = Math.sin(t * 0.9 + pane.phase) * pane.bob * f;
      const sway = Math.cos(t * 0.7 + pane.phase * 1.3) * pane.bob * 0.6 * f;
      pane.mesh.position.set(pane.info.cx + pane.x + sway, pane.info.cy + pane.y + bob, 0);
      pane.mesh.rotation.z = pane.rot + Math.sin(t * pane.spin * 6 + pane.phase) * 0.18 * f;
      if (pane.take > 0 || f > 0) moving = true;
    }
    this.#moving = moving;
  }

  dispose(): void {
    for (const pane of this.panes) pane.mesh.geometry.dispose();
    this.#material.dispose();
    this.stage.dispose();
  }
}

/** A quad over a pane, around its middle, with the uv of its home place in the glass picture (t from the top). */
function paneGeometry(info: PaneInfo, extent: number): BufferGeometry {
  const {x0, y0, x1, y1, cx, cy, id} = info;
  const size = extent * 2;
  const positions = new Float32Array([x0 - cx, y0 - cy, 0, x1 - cx, y0 - cy, 0, x1 - cx, y1 - cy, 0, x0 - cx, y1 - cy, 0]);
  const u = (x: number) => (x + extent) / size;
  const v = (y: number) => (extent - y) / size;
  const uvs = new Float32Array([u(x0), v(y0), u(x1), v(y0), u(x1), v(y1), u(x0), v(y1)]);
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setAttribute('paneId', new BufferAttribute(new Float32Array([id, id, id, id]), 1));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}

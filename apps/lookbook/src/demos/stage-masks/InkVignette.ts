import {on} from '@spearwolf/eventize';
import {OnStageUpdateFrame} from '@spearwolf/twopoint5d';
import {abs, float, length, max, min, mx_noise_float, positionWorld, pow, smoothstep, uniform, vec2, vec3, vec4} from 'three/tsl';
import {Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector2} from 'three/webgpu';
import {type FootageClock, makeFootageStage, VIEW_HEIGHT} from './FoundFootage';
import {SoftBlobs} from './SoftBlobs';

/** how many ink drops crawl in from the edges at once */
const DROPS = 12;
/** how long the ink takes to creep in when the tape starts, in seconds */
const CREEP_TIME = 3.2;
/** the radius of the rounded corners of the frame the ink grows in from, in units */
const CORNER = 110;

interface Drop {
  /** 0 … 1 along its life */
  life: number;
  span: number;
  /** where on the rim of the view it was born: 0 … 1 around the perimeter */
  at: number;
  size: number;
  reach: number;
}

/**
 * The mask stage: ink — or rot — that creeps in from the edges of the picture and pulses with the
 * heartbeat. It draws the ink over transparent black, so its alpha is where the darkness is; the
 * demo's `StageMask` reads it with `invert: true`, and the picture shows where there is no ink.
 *
 * One full-view plane works out the ragged edge per pixel in TSL — a rounded frame pushed in and out
 * by three octaves of noise, with veins that run on ahead of it — and a {@link SoftBlobs} pool adds
 * drops of ink that crawl in from the rim and back, and four swellings in the corners.
 */
export class InkVignette {
  readonly stage = makeFootageStage('ink');
  /** 0 … 1, the vignette strength of the UI: how far the ink may come in */
  strength = 0.35;

  readonly #clock: FootageClock;
  readonly #halfSize = uniform(new Vector2(480, VIEW_HEIGHT / 2));
  readonly #reach = uniform(0);
  readonly #plane: Mesh;
  readonly #blobs = new SoftBlobs({capacity: DROPS + 4, name: 'ink drops', falloff: (t) => (1 - t * t) ** 1.6});
  readonly #drops: Drop[] = [];
  #creep = 0;
  /** how often the ink plane drew since {@link takeDraws} was asked last */
  #draws = 0;

  constructor(clock: FootageClock) {
    this.#clock = clock;
    const p = positionWorld.xy;
    const t = clock.time;
    const half = this.#halfSize;

    // the signed distance to a rounded frame just inside the view: below 0 inside, 0 on the frame
    const q = abs(p).sub(half.sub(CORNER));
    const frame = length(max(q, vec2(0, 0)))
      .add(min(max(q.x, q.y), float(0)))
      .sub(CORNER);
    const warp = mx_noise_float(vec3(p.mul(0.0055), t.mul(0.11)))
      .mul(78)
      .add(mx_noise_float(vec3(p.mul(0.021), t.mul(0.33).add(7))).mul(24))
      .add(mx_noise_float(vec3(p.mul(0.075), t.mul(0.7).add(13))).mul(6));
    // s > 0 is ink
    const s = frame.add(this.#reach).add(warp);
    const body = smoothstep(-16, 5, s);
    // veins: thin ridges of a noise that run on ahead of the ink, fading with the distance from it
    const ridge = pow(float(1).sub(abs(mx_noise_float(vec3(p.mul(0.011), t.mul(0.06).add(29))))), float(11));
    const ahead = smoothstep(-120, -10, s);
    const veins = smoothstep(0.45, 0.8, ridge.mul(ahead));
    const ink = max(body, veins);

    const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    material.colorNode = vec4(vec3(ink), ink);
    this.#plane = new Mesh(new PlaneGeometry(4000, 900), material);
    this.#plane.name = 'ink';
    // counts the draws of the mask stage: two masked slots sample it, it draws once
    this.#plane.onBeforeRender = () => {
      this.#draws++;
    };
    this.stage.scene.add(this.#plane);

    for (let i = 0; i < DROPS + 4; i++) this.#blobs.add(0, 0, 0, 0);
    for (let i = 0; i < DROPS; i++) {
      // staggered, so they do not all arrive together
      this.#drops.push({life: i / DROPS, span: 3, at: clock.random(), size: 40, reach: 60});
    }
    this.#blobs.mesh.renderOrder = 1;
    this.stage.scene.add(this.#blobs.mesh);
    // the director may draw the mask stage (precompile()) before its first update: upload the pool now
    this.#blobs.update();

    on(this.stage, OnStageUpdateFrame, ({deltaTime}) => this.#update(deltaTime));
  }

  /** The draws of the ink since the last call. */
  takeDraws(): number {
    const draws = this.#draws;
    this.#draws = 0;
    return draws;
  }

  #update(deltaTime: number): void {
    const clock = this.#clock;
    const dt = Math.min(deltaTime, 0.1);
    const hw = this.stage.width > 0 ? this.stage.width / 2 : 480;
    const hh = VIEW_HEIGHT / 2;
    this.#halfSize.value.set(hw, hh);

    this.#creep = Math.min(1, this.#creep + dt / CREEP_TIME);
    const creep = 1 - (1 - this.#creep) ** 2;
    const pulse = clock.pulse.value;
    const glitch = clock.glitch.value;
    const strength = this.strength;
    const reach = creep * (6 + strength * 190 + pulse * (10 + strength * 30)) + glitch * 60;
    this.#reach.value = reach;

    const blobs = this.#blobs.blobs;
    const perimeter = 4 * (hw + hh);
    for (let i = 0; i < DROPS; i++) {
      const d = this.#drops[i]!;
      const blob = blobs[i]!;
      d.life += dt / d.span;
      if (d.life >= 1) {
        d.life = 0;
        d.span = 3 + clock.random() * 4;
        d.at = clock.random();
        d.size = 26 + clock.random() * 46;
        d.reach = 30 + clock.random() * 90;
      }
      // a point on the rim of the view and the way in from there
      let along = d.at * perimeter;
      let x: number;
      let y: number;
      let nx = 0;
      let ny = 0;
      if (along < 2 * hw) {
        x = along - hw;
        y = hh;
        ny = -1;
      } else if ((along -= 2 * hw) < 2 * hh) {
        x = hw;
        y = hh - along;
        nx = -1;
      } else if ((along -= 2 * hh) < 2 * hw) {
        x = hw - along;
        y = -hh;
        ny = 1;
      } else {
        along -= 2 * hw;
        x = -hw;
        y = -hh + along;
        nx = 1;
      }
      // it crawls in, swells, and pulls back
      const k = Math.sin(d.life * Math.PI);
      const inward = reach + d.reach * k * (0.4 + strength);
      blob.x = x + nx * inward;
      blob.y = y + ny * inward;
      blob.radius = d.size * (0.5 + strength) * (0.4 + 0.6 * k) * (1 + pulse * 0.12) + 0.001;
      blob.intensity = Math.min(1, k * 1.6) * creep;
    }
    // the corners swell with every beat
    for (let c = 0; c < 4; c++) {
      const blob = blobs[DROPS + c]!;
      blob.x = c % 2 === 0 ? -hw : hw;
      blob.y = c < 2 ? -hh : hh;
      blob.radius = (50 + strength * 230) * (1 + pulse * 0.14 + glitch * 0.3) * creep + 0.001;
      blob.intensity = creep;
    }
    this.#blobs.update();
  }

  dispose(): void {
    this.#plane.geometry.dispose();
    (this.#plane.material as MeshBasicNodeMaterial).dispose();
    this.#blobs.dispose();
    this.stage.dispose();
  }
}

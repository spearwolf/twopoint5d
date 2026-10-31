import {on} from '@spearwolf/eventize';
import {OnStageResize, OnStageUpdateFrame} from '@spearwolf/twopoint5d';
import {
  clamp,
  exp,
  float,
  floor,
  fract,
  max,
  mx_noise_float,
  positionWorld,
  screenCoordinate,
  smoothstep,
  step,
  texture,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  CanvasTexture,
  CircleGeometry,
  LinearFilter,
  Mesh,
  MeshBasicNodeMaterial,
  type Object3D,
  PlaneGeometry,
  SRGBColorSpace,
} from 'three/webgpu';
import {type FootageClock, hash21, makeFootageStage, VIEW_HEIGHT} from './FoundFootage';

/** canvas pixels per unit of the HUD: sharp up to a window 1620 px tall */
const DENSITY = 3;
/** the inset of the viewfinder's corners from the edge of the view, in units */
const MARGIN = 60;
/** the inset of the labels, in units */
const INSET = 84;
const OSD_FONT = '"DejaVu Sans Mono", "Liberation Mono", Menlo, Consolas, monospace';

/**
 * A label of the HUD: a canvas of its own on a plane, drawn again only when its text changes, so the
 * texture is uploaded seldom and small.
 */
class HudLabel {
  readonly mesh: Mesh;
  readonly #canvas: HTMLCanvasElement;
  readonly #ctx: CanvasRenderingContext2D;
  readonly #texture: CanvasTexture;
  readonly #draw: (ctx: CanvasRenderingContext2D, w: number, h: number, text: string) => void;
  #text: string | undefined;

  constructor(
    name: string,
    w: number,
    h: number,
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number, text: string) => void,
  ) {
    this.#canvas = document.createElement('canvas');
    this.#canvas.width = w * DENSITY;
    this.#canvas.height = h * DENSITY;
    this.#ctx = this.#canvas.getContext('2d')!;
    this.#draw = draw;
    this.#texture = new CanvasTexture(this.#canvas);
    this.#texture.colorSpace = SRGBColorSpace;
    this.#texture.minFilter = LinearFilter;
    this.#texture.magFilter = LinearFilter;
    this.#texture.generateMipmaps = false;
    const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    material.colorNode = texture(this.#texture);
    this.mesh = new Mesh(new PlaneGeometry(w, h), material);
    this.mesh.name = name;
  }

  set(text: string): void {
    if (text === this.#text) return;
    this.#text = text;
    const ctx = this.#ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.#canvas.width, this.#canvas.height);
    ctx.setTransform(DENSITY, 0, 0, DENSITY, 0, 0);
    this.#draw(ctx, this.#canvas.width / DENSITY, this.#canvas.height / DENSITY, text);
    this.#texture.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicNodeMaterial).dispose();
    this.#texture.dispose();
  }
}

/** On-screen-display text: white with a black rim, as a camcorder writes it into its picture. */
function osdText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
  align: CanvasTextAlign = 'left',
): void {
  ctx.font = `700 ${size}px ${OSD_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.2;
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.strokeText(text, x, y);
  ctx.fillStyle = '#f4f6f0';
  ctx.fillText(text, x, y);
}

/**
 * The HUD of the camcorder: the corners of the viewfinder and a cross in the middle, REC and its
 * blinking dot, NIGHTSHOT, a battery on its last bar, the date and the time of the recording, the
 * running timecode — and SIGNAL LOST while the picture is gone. Laid out against the corners of the
 * view, whatever the width of the window.
 */
export class CamcorderHud {
  readonly stage = makeFootageStage('hud');
  readonly #clock: FootageClock;
  readonly #white = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
  readonly #shade = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
  readonly #red = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
  readonly #bars: {white: Mesh; shade: Mesh; corner: number; vertical: boolean}[] = [];
  readonly #cross: Mesh[] = [];
  readonly #recDot: Mesh;
  readonly #rec: HudLabel;
  readonly #battery: HudLabel;
  readonly #date: HudLabel;
  readonly #timecode: HudLabel;
  readonly #lost: HudLabel;
  readonly #labels: HudLabel[] = [];
  readonly #geometries: (PlaneGeometry | CircleGeometry)[] = [];
  #tapeFrame = -1;
  #minutes = -1;

  constructor(clock: FootageClock) {
    this.#clock = clock;
    this.#white.colorNode = vec4(0.96, 0.97, 0.94, 1);
    this.#shade.colorNode = vec4(0, 0, 0, 0.7);
    this.#red.colorNode = vec4(1, 0.12, 0.08, 1);

    // the viewfinder: an L in every corner, a dark rim under each bar
    const LEN = 38;
    const THICK = 3;
    const barGeo = new PlaneGeometry(1, 1);
    this.#geometries.push(barGeo);
    for (let corner = 0; corner < 4; corner++) {
      for (const vertical of [false, true]) {
        const shade = new Mesh(barGeo, this.#shade);
        shade.scale.set(vertical ? THICK + 3 : LEN + 3, vertical ? LEN + 3 : THICK + 3, 1);
        shade.renderOrder = 0;
        const white = new Mesh(barGeo, this.#white);
        white.scale.set(vertical ? THICK : LEN, vertical ? LEN : THICK, 1);
        white.renderOrder = 1;
        this.stage.scene.add(shade, white);
        this.#bars.push({white, shade, corner, vertical});
      }
    }
    for (const [w, h, x, y] of [
      [14, 2, -13, 0],
      [14, 2, 13, 0],
      [2, 14, 0, -13],
      [2, 14, 0, 13],
    ] as const) {
      const shade = new Mesh(barGeo, this.#shade);
      shade.scale.set(w + 3, h + 3, 1);
      shade.position.set(x, y, 0);
      const white = new Mesh(barGeo, this.#white);
      white.scale.set(w, h, 1);
      white.position.set(x, y, 0);
      white.renderOrder = 1;
      this.stage.scene.add(shade, white);
      this.#cross.push(shade, white);
    }

    const dotGeo = new CircleGeometry(8, 32);
    this.#geometries.push(dotGeo);
    this.#recDot = new Mesh(dotGeo, this.#red);
    this.#recDot.renderOrder = 2;
    this.stage.scene.add(this.#recDot);

    this.#rec = this.#label('rec', 170, 56, (ctx, _w, h) => {
      osdText(ctx, 'REC', 0, h * 0.3, 22);
      // a crescent moon and NIGHTSHOT, the camcorder's infrared mode
      ctx.save();
      ctx.translate(9, h * 0.76);
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.arc(3.5, -2.5, 6, 0, Math.PI * 2, true);
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.stroke();
      ctx.fillStyle = '#f4f6f0';
      ctx.fill('evenodd');
      ctx.restore();
      osdText(ctx, 'NIGHTSHOT', 22, h * 0.76, 14);
    });
    this.#battery = this.#label('battery', 120, 34, (ctx, w, h, text) => {
      osdText(ctx, 'SP', 0, h / 2, 18);
      // a battery on its last bar; the text is 'on' or 'off' for the blinking bar
      const bx = w - 62;
      const by = h / 2 - 10;
      ctx.lineWidth = 6;
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeRect(bx, by, 52, 20);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#f4f6f0';
      ctx.strokeRect(bx, by, 52, 20);
      ctx.fillStyle = '#f4f6f0';
      ctx.fillRect(bx + 52, by + 6, 5, 8);
      if (text === 'on') {
        ctx.fillStyle = '#ff2a1a';
        ctx.fillRect(bx + 4, by + 4, 11, 12);
      }
    });
    this.#date = this.#label('date', 220, 56, (ctx, _w, h, text) => {
      const [date, time] = text.split('|');
      osdText(ctx, date ?? '', 0, h * 0.28, 19);
      osdText(ctx, time ?? '', 0, h * 0.74, 19);
    });
    this.#timecode = this.#label('timecode', 210, 34, (ctx, w, h, text) => {
      osdText(ctx, text, w, h / 2, 24, 'right');
    });
    this.#lost = this.#label('signal lost', 300, 60, (ctx, w, h) => {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fillRect(0, 0, w, h);
      osdText(ctx, 'SIGNAL LOST', w / 2, h / 2 + 1, 30, 'center');
    });

    this.#rec.set('');
    this.#lost.set('');

    on(this.stage, OnStageResize, () => this.#layout());
    on(this.stage, OnStageUpdateFrame, () => this.#update());
    this.#layout();
    this.#update();
  }

  #label(
    name: string,
    w: number,
    h: number,
    draw: (ctx: CanvasRenderingContext2D, w: number, h: number, text: string) => void,
  ): HudLabel {
    const label = new HudLabel(name, w, h, draw);
    label.mesh.renderOrder = 3;
    this.stage.scene.add(label.mesh);
    this.#labels.push(label);
    return label;
  }

  #layout(): void {
    const hw = (this.stage.width > 0 ? this.stage.width : 960) / 2;
    const hh = VIEW_HEIGHT / 2;
    // a narrow window keeps the labels nearer its edges, and stacks the timecode above the date
    const margin = Math.min(MARGIN, hw * 0.14);
    const inset = Math.min(INSET, hw * 0.2);
    const narrow = hw < 360;
    for (const {white, shade, corner, vertical} of this.#bars) {
      const sx = corner % 2 === 0 ? -1 : 1;
      const sy = corner < 2 ? 1 : -1;
      const cx = sx * (hw - margin);
      const cy = sy * (hh - margin);
      // the bars run from the corner into the view
      const x = vertical ? cx : cx - (sx * white.scale.x) / 2 + (sx * white.scale.y) / 2;
      const y = vertical ? cy - (sy * white.scale.y) / 2 + (sy * white.scale.x) / 2 : cy;
      white.position.set(x, y, 0);
      shade.position.set(x, y, 0);
    }
    const place = (obj: Object3D, x: number, y: number) => obj.position.set(x, y, 0);
    place(this.#recDot, -hw + inset + 8, hh - inset - 9);
    place(this.#rec.mesh, -hw + inset + 24 + 85, hh - inset - 25);
    // the battery in the middle at the top, out of the way of the demo's panel on the right
    place(this.#battery.mesh, narrow ? hw - inset - 60 : 0, hh - inset - 12);
    place(this.#date.mesh, -hw + inset + 110, -hh + inset + 28);
    place(this.#timecode.mesh, hw - inset - 105, -hh + inset + (narrow ? 82 : 14));
    place(this.#lost.mesh, 0, -70);
  }

  #update(): void {
    const clock = this.#clock;
    const t = clock.time.value;
    // the dot blinks once a second; while the signal is lost the camcorder still thinks it records
    this.#recDot.visible = t % 1 < 0.6;
    this.#battery.set(t % 0.9 < 0.5 ? 'on' : 'off');
    // the strings are built only when what they show changes: 30 times a second, once a minute
    const tape = clock.tape;
    const tapeFrame = Math.floor(tape * 30);
    if (tapeFrame !== this.#tapeFrame) {
      this.#tapeFrame = tapeFrame;
      const h = Math.floor(tape / 3600);
      const m = Math.floor(tape / 60) % 60;
      const s = Math.floor(tape) % 60;
      const f = tapeFrame % 30;
      this.#timecode.set(`${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}:${f < 10 ? '0' : ''}${f}`);
    }
    // the time of day on the tape: the recording started at 23:00 on Halloween
    const minutes = 23 * 60 + Math.floor(tape / 60);
    if (minutes !== this.#minutes) {
      this.#minutes = minutes;
      const hour = Math.floor(minutes / 60) % 24;
      const minute = minutes % 60;
      const pm = hour >= 12;
      const date = pm ? 'OCT 31 2026' : 'NOV 1 2026';
      this.#date.set(`${date}|${pm ? 'PM' : 'AM'} ${hour % 12 === 0 ? 12 : hour % 12}:${minute < 10 ? '0' : ''}${minute}`);
    }
    this.#lost.mesh.visible = clock.signalLost && t % 0.5 < 0.32;
  }

  dispose(): void {
    for (const label of this.#labels) label.dispose();
    for (const geometry of this.#geometries) geometry.dispose();
    this.#white.dispose();
    this.#shade.dispose();
    this.#red.dispose();
    this.stage.dispose();
  }
}

/**
 * The tape itself, between the level and the HUD and never masked: a tracking band that rolls up
 * the picture, dropouts, the head-switching noise at the bottom edge and a chromatic grain over
 * everything — over the ink too, which shows that an unmasked slot is left alone. While the signal
 * is lost it turns to snow.
 */
export class VhsNoise {
  readonly stage = makeFootageStage('vhs');
  readonly #plane: Mesh;

  constructor(clock: FootageClock) {
    const p = positionWorld.xy;
    const t = clock.time;
    const g = clock.glitch;
    const v = p.y.add(VIEW_HEIGHT / 2).div(VIEW_HEIGHT);
    const frameNo = floor(t.mul(29.97));

    // the tracking band, rolling slowly up through the picture
    const bandPos = fract(t.mul(0.045).add(0.55)).mul(1.5).sub(0.25);
    const bandX = v.sub(bandPos).div(0.026);
    const band = exp(bandX.mul(bandX).negate()).mul(float(0.55).add(g.mul(0.45)));
    const row = floor(p.y.mul(0.8));
    const rowNoise = hash21(vec2(row, frameNo));
    const streak = smoothstep(0.3, 0.7, mx_noise_float(vec3(p.x.mul(0.028).add(rowNoise.mul(40)), row.mul(0.37), t.mul(6)))).mul(
      band,
    );
    // a dropout now and then: one bright line across the picture
    const dropout = step(float(0.9994).sub(g.mul(0.03)), hash21(vec2(row.mul(1.31), frameNo.add(5)))).mul(0.4);
    // the head switching: torn, jittering lines at the very bottom
    const head = float(1)
      .sub(smoothstep(0.003, 0.016, v))
      .mul(step(0.5, hash21(vec2(floor(p.x.mul(0.08)).add(row.mul(7)), frameNo))))
      .mul(0.45);
    const lines = clamp(streak.mul(0.5).add(dropout).add(head), 0, 1);

    // the grain: a speck of colour per pixel per frame, and snow when the signal is gone
    const cell = floor(screenCoordinate.xy.div(1.5));
    const f = vec2(frameNo.mul(1.37), frameNo.mul(7.11));
    const grainRgb = vec3(
      hash21(cell.add(f)),
      hash21(cell.add(f).add(vec2(17.3, 5.1))),
      hash21(cell.add(f).add(vec2(3.7, 29.9))),
    );
    const snow = hash21(cell.add(f).add(vec2(41.1, 2.3)));
    const grainA = float(0.03).add(g.mul(0.5));
    // the specks of colour are dark: blended in linear light, a bright speck lifts the black a lot
    const grain = vec3(snow)
      .mul(g)
      .add(grainRgb.mul(grainRgb).mul(0.6).mul(float(1).sub(g)));

    // premultiplied contributions, then back to straight colour for the blending
    const a = clamp(lines.add(grainA), 0, 1);
    const pm = vec3(0.92, 0.96, 1).mul(lines).add(grain.mul(grainA));
    const material = new MeshBasicNodeMaterial({transparent: true, depthTest: false, depthWrite: false});
    material.colorNode = vec4(pm.div(max(a, 0.001)), a);
    this.#plane = new Mesh(new PlaneGeometry(4000, 900), material);
    this.#plane.name = 'vhs';
    this.stage.scene.add(this.#plane);
  }

  dispose(): void {
    this.#plane.geometry.dispose();
    (this.#plane.material as MeshBasicNodeMaterial).dispose();
    this.stage.dispose();
  }
}

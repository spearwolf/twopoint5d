// stage-masks/found-footage: the forest floor of "Found Footage" — a strip seen from the side, far at
// the top and near at the bottom, that repeats along x. Dark loam shaded pixel by pixel, dry leaves
// and twigs drawn as SVG (each one also a strip's width to the left and the right, so the seam
// does not show), a trodden path across it, and a fringe of grass at the top that thins into the
// dark. Neutral greys: the demo tints it and scrolls each row at the speed of its depth.
import {fbm, Rng, valueNoise} from '../../lib/image.mjs';
import {el, lerp, n, rasterize, sat, smoothstep, svgDoc} from '../spotlight/svg.mjs';

/** 1024 × 200 units at 2 texels per unit */
export const GROUND_W = 2048;
export const GROUND_H = 400;
/** the noise repeats every this many pixels along x */
const CELL = 32;

/** how near a row is, 0 at the top (far) to 1 at the bottom (near) @param {number} y */
const nearness = (y) => y / GROUND_H;

/** @param {Rng} rng */
function litter(rng) {
  const out = [];
  const copies = (/** @type {(dx: number) => string} */ draw) => {
    for (const dx of [-GROUND_W, 0, GROUND_W]) out.push(draw(dx));
  };
  for (let k = 0; k < 2600; k++) {
    // more of them near the camera, where they are bigger
    const t = Math.sqrt(rng.next());
    const y = 60 + t * (GROUND_H - 50);
    const near = nearness(y);
    const onPath = Math.abs(y - GROUND_H * 0.56) < 34;
    if (onPath && rng.next() < 0.75) continue;
    const x = rng.range(0, GROUND_W);
    const size = (3 + rng.next() * 5) * (0.35 + near * 1.2);
    const flat = 0.35 + near * 0.4;
    const angle = rng.range(0, 360);
    // the leaves drawn first lie at the bottom of the litter, in the shade of the later ones
    const depth = k / 2600;
    const grey = Math.round(lerp(55, 120, depth) + rng.range(-15, 50));
    const fill = `rgb(${grey},${grey},${grey - 4})`;
    const rib = Math.round(grey * 0.6);
    copies((dx) => {
      const lx = x + dx;
      const transform = `translate(${n(lx)} ${n(y)}) scale(1 ${n(flat)}) rotate(${n(angle)})`;
      const leaf = el('path', {
        d: `M${n(-size)} 0Q0 ${n(-size * 0.55)} ${n(size)} 0Q0 ${n(size * 0.55)} ${n(-size)} 0Z`,
        fill,
        transform,
      });
      if (size < 5) return leaf;
      return (
        leaf +
        el('path', {
          d: `M${n(-size * 1.15)} 0L${n(size * 0.9)} 0`,
          stroke: `rgb(${rib},${rib},${rib})`,
          'stroke-width': 0.8,
          transform,
        })
      );
    });
  }
  for (let k = 0; k < 90; k++) {
    const y = rng.range(90, GROUND_H - 10);
    const near = nearness(y);
    const x = rng.range(0, GROUND_W);
    const len = rng.range(14, 40) * (0.4 + near * 1.2);
    const a = rng.range(-0.35, 0.35);
    const w = (1 + rng.next() * 1.5) * (0.5 + near);
    copies((dx) =>
      el('path', {
        d: `M${n(x + dx)} ${n(y)}L${n(x + dx + Math.cos(a) * len)} ${n(y + Math.sin(a) * len * 0.4)}`,
        stroke: '#3a3a36',
        'stroke-width': n(w),
        'stroke-linecap': 'round',
      }),
    );
  }
  // the fringe of grass along the top edge, bright in the camera's light
  for (let k = 0; k < 900; k++) {
    const x = rng.range(0, GROUND_W);
    const root = rng.range(52, 96);
    const h = rng.range(8, 34);
    const lean = rng.range(-7, 7);
    const grey = Math.round(lerp(110, 190, rng.next()));
    copies((dx) =>
      el('path', {
        d: `M${n(x + dx - 1.2)} ${n(root)}Q${n(x + dx + lean * 0.5)} ${n(root - h * 0.6)} ${n(x + dx + lean)} ${n(root - h)}Q${n(x + dx + lean * 0.5 + 0.8)} ${n(root - h * 0.6)} ${n(x + dx + 1.2)} ${n(root)}Z`,
        fill: `rgb(${grey},${grey},${grey})`,
      }),
    );
  }
  return out;
}

/**
 * The strip as straight RGBA floats, 0..1.
 * @returns {Promise<Float32Array>}
 */
export async function renderGround() {
  const w = GROUND_W;
  const h = GROUND_H;
  const rng = new Rng(4711);
  const leaves = await rasterize(svgDoc(w, h, [], litter(rng)), w, h);
  const out = new Float32Array(w * h * 4);
  const period = w / CELL;
  for (let y = 0; y < h; y++) {
    const near = nearness(y);
    // far rows are foreshortened: the noise squeezes towards the top
    const yy = (y / CELL) * (0.5 + near * 1.5);
    const fade = smoothstep(50, 110, y);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const loam = fbm(x / CELL, yy, 31, 4, period);
      const grain = valueNoise(x / 3, y / 3, 32);
      let v = 0.14 + loam * 0.18 + (grain - 0.5) * 0.05;
      // the trodden path: a paler band of bare earth
      const path = sat(1 - Math.abs(y - h * 0.56 + (fbm(x / CELL, 7, 33, 2, period) - 0.5) * 22) / 30);
      v = lerp(v, 0.3 + loam * 0.08, smoothstep(0, 1, path) * 0.85);
      let a = fade;
      const la = leaves[i + 3] / 255;
      if (la > 0) {
        const lv = leaves[i] / 255;
        // a leaf casts a little shadow into the loam and is lit a little less the farther it lies
        v = lerp(v, lv * (0.55 + near * 0.45), la);
        a = Math.max(a, la);
      }
      // the far rows sink into the dark before the fringe of grass begins
      v *= 0.45 + near * 0.55;
      out[i] = out[i + 1] = out[i + 2] = v;
      out[i + 3] = a;
    }
  }
  return out;
}

// stage-masks/found-footage: the birch trunks of "Found Footage", shaded pixel by pixel. Each trunk
// is a cylinder that leans and wobbles a little and flares into its roots: white bark lit from the
// camera, horizontal lenticels, black patches, the dark chevrons a birch keeps where a branch fell
// off (they look back), a fissured black base with moss, dead twigs behind it — and on four of the
// five trunks a symbol cut into the bark. The bark is neutral grey; the demo tints it.
import {fbm, Img, Rng, valueNoise} from '../../lib/image.mjs';
import {el, lerp, n, rasterize, sat, smoothstep, svgDoc} from '../spotlight/svg.mjs';

/** the height of every trunk frame, in pixels (2 per unit: 620 units, more than the view is tall) */
export const TRUNK_H = 1240;

/**
 * @typedef {object} TrunkSpec
 * @property {string} name
 * @property {number} w the frame width in pixels
 * @property {number} r the radius at the base of the straight part, in pixels
 * @property {number} lean how far the top leans off the middle, in pixels
 * @property {number} seed
 * @property {'spiral' | 'eye' | 'tally' | 'sigil' | undefined} carving
 */

/** @type {TrunkSpec[]} */
export const TRUNKS = [
  {name: 'birch-a', w: 240, r: 40, lean: 10, seed: 11, carving: 'spiral'},
  {name: 'birch-b', w: 220, r: 33, lean: -14, seed: 23, carving: undefined},
  {name: 'birch-c', w: 260, r: 47, lean: 6, seed: 37, carving: 'eye'},
  {name: 'birch-d', w: 200, r: 28, lean: -6, seed: 41, carving: 'tally'},
  {name: 'birch-e', w: 240, r: 38, lean: 16, seed: 53, carving: 'sigil'},
];

/** where a carving sits, as a share of the frame height from the top */
const CARVING_AT = 0.42;

/** @param {TrunkSpec} spec @param {number} y */
function centre(spec, y) {
  const t = y / TRUNK_H;
  return spec.w / 2 + spec.lean * (1 - t) ** 2 + 3 * Math.sin(y / 170 + spec.seed);
}

/** @param {TrunkSpec} spec @param {number} y */
function radius(spec, y) {
  const t = y / TRUNK_H;
  return spec.r * (0.84 + 0.16 * t) * (1 + 0.6 * Math.exp(-(TRUNK_H - y) / 46));
}

/**
 * The strokes of a carving, white on transparent, centred on (0, 0) in pixels.
 * @param {TrunkSpec['carving']} kind
 */
function carvingStrokes(kind) {
  const s = {stroke: '#fff', 'stroke-width': 4.5, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round'};
  switch (kind) {
    case 'spiral': {
      let d = '';
      for (let k = 0; k <= 80; k++) {
        const a = k * 0.21;
        const r = 2 + k * 0.34;
        d += `${k ? 'L' : 'M'}${n(Math.cos(a) * r)} ${n(Math.sin(a) * r * 1.15)}`;
      }
      return [el('path', {d, ...s})];
    }
    case 'eye':
      return [
        el('path', {d: 'M-26 0Q0 -22 26 0Q0 22 -26 0Z', ...s}),
        el('circle', {r: 7, ...s, 'stroke-width': 5}),
        el('path', {
          d: 'M-16 -14L-20 -24M0 -18L0 -30M16 -14L20 -24M-16 14L-20 24M0 18L0 30M16 14L20 24',
          ...s,
          'stroke-width': 3.5,
        }),
      ];
    case 'tally':
      return [
        el('path', {d: 'M-18 -26L-18 4M-8 -27L-8 5M2 -26L2 4M12 -27L12 5M-26 -4L20 -18', ...s}),
        el('path', {d: 'M-12 16L8 34M8 16L-12 34', ...s}),
      ];
    case 'sigil':
      return [el('circle', {r: 20, ...s}), el('path', {d: 'M0 -34L0 34M-12 -8L12 -8M-9 6L9 6M-6 18L6 18', ...s})];
    default:
      return [];
  }
}

/**
 * Dead twigs behind the trunk: thin grey branches that leave its sides in the upper half, forked once
 * or twice. Drawn as SVG in the frame's pixels.
 * @param {TrunkSpec} spec @param {Rng} rng
 */
function twigStrokes(spec, rng) {
  const out = [];
  const count = rng.int(2, 4);
  for (let k = 0; k < count; k++) {
    const y = rng.range(120, TRUNK_H * 0.55);
    const side = rng.next() < 0.5 ? -1 : 1;
    const x0 = centre(spec, y);
    const len = rng.range(45, spec.w / 2 - 6);
    const rise = rng.range(-30, -8);
    const x1 = x0 + side * len;
    const y1 = y + rise;
    const width = rng.range(2.5, 4.5);
    out.push(
      el('path', {
        d: `M${n(x0)} ${n(y)}Q${n(x0 + side * len * 0.5)} ${n(y + rise * 0.2)} ${n(x1)} ${n(y1)}`,
        stroke: '#4a4a46',
        'stroke-width': width,
        fill: 'none',
        'stroke-linecap': 'round',
      }),
    );
    const forks = rng.int(1, 2);
    for (let f = 0; f < forks; f++) {
      const t = rng.range(0.4, 0.8);
      const fx = x0 + side * len * t;
      const fy = y + rise * t * 0.6;
      out.push(
        el('path', {
          d: `M${n(fx)} ${n(fy)}L${n(fx + side * rng.range(12, 28))} ${n(fy - rng.range(10, 24))}`,
          stroke: '#454541',
          'stroke-width': width * 0.6,
          fill: 'none',
          'stroke-linecap': 'round',
        }),
      );
    }
  }
  // two broken stubs on the trunk's rim
  for (let k = 0; k < 2; k++) {
    const y = rng.range(200, TRUNK_H * 0.7);
    const side = k === 0 ? -1 : 1;
    const x0 = centre(spec, y) + side * radius(spec, y) * 0.9;
    out.push(
      el('path', {
        d: `M${n(x0)} ${n(y)}L${n(x0 + side * rng.range(8, 14))} ${n(y - rng.range(3, 8))}`,
        stroke: '#2c2c2a',
        'stroke-width': rng.range(5, 8),
        'stroke-linecap': 'round',
      }),
    );
  }
  return out;
}

/**
 * One trunk as an RGBA image.
 * @param {TrunkSpec} spec
 * @returns {Promise<Img>}
 */
export async function renderTrunk(spec) {
  const {w, seed} = spec;
  const h = TRUNK_H;
  const rng = new Rng(seed * 977);

  const twigs = await rasterize(svgDoc(w, h, [], twigStrokes(spec, rng)), w, h);

  const carveY = Math.round(h * CARVING_AT);
  const carveX = centre(spec, carveY);
  const carving = spec.carving
    ? await rasterize(
        svgDoc(
          w,
          h,
          [],
          [el('g', {transform: `translate(${n(carveX)} ${carveY}) scale(${n(spec.r / 44)})`}, carvingStrokes(spec.carving))],
        ),
        w,
        h,
      )
    : undefined;
  const cut = (/** @type {number} */ x, /** @type {number} */ y) =>
    carving && x >= 0 && y >= 0 && x < w && y < h ? carving[(y * w + x) * 4 + 3] / 255 : 0;

  // the chevrons: a dark almond where a branch was, a "brow" bent down over it
  const eyes = [];
  for (let k = 0; k < 4; k++) {
    eyes.push({y: rng.range(140, h - 330), arc: rng.range(-spec.r * 0.55, spec.r * 0.55), size: rng.range(9, 17)});
  }

  // the light comes from the camera, a touch from the left and from above; the normal of a cylinder
  // standing upright has no y, so only x and z of the light count
  const lx = -0.28;
  const ly = -0.12;
  const lz = Math.sqrt(1 - lx * lx - ly * ly);
  const img = new Img(w, h, new Uint8Array(twigs));
  const data = img.data;

  for (let y = 0; y < h; y++) {
    const cx = centre(spec, y);
    const r = radius(spec, y);
    const baseK = smoothstep(h - 300, h - 30, y);
    const mossBand = smoothstep(h - 170, h - 30, y);
    for (let x = 0; x < w; x++) {
      // a ragged rim: the silhouette shivers by a pixel along the trunk
      const rim =
        r +
        (valueNoise(y / 5, x > cx ? 3 : 7, seed + 9) - 0.5) * 1.6 +
        baseK * (valueNoise(y / 9, x > cx ? 1 : 5, seed + 8) - 0.5) * 5;
      const dx = x + 0.5 - cx;
      const edge = rim - Math.abs(dx);
      const cover = sat(edge + 0.5);
      if (cover <= 0) continue;
      const u = Math.max(-1, Math.min(1, dx / rim));
      const nz = Math.sqrt(1 - u * u);
      const arc = Math.asin(u) * spec.r;

      // the bark: white, a little uneven, peeling in thin rings
      let a = 0.8 + (fbm(arc / 40, y / 90, seed, 3) - 0.5) * 0.18;
      const peel = valueNoise(arc / 70, y / 7, seed + 5);
      if (peel > 0.78) a *= 1 - 0.25 * smoothstep(0.78, 0.84, peel);
      else if (peel > 0.72) a = Math.min(1, a + 0.08 * smoothstep(0.72, 0.78, peel));

      // lenticels: short dark dashes across the trunk
      const len = valueNoise(arc / 15, y / 2.4, seed + 1);
      a *= 1 - 0.72 * smoothstep(0.79, 0.86, len);

      // black patches with rough edges
      const patch = fbm(arc / 55, y / 36, seed + 2, 4) + (valueNoise(arc / 5, y / 5, seed + 3) - 0.5) * 0.12;
      a = lerp(a, 0.07 + valueNoise(arc / 4, y / 4, seed + 4) * 0.06, smoothstep(0.65, 0.69, patch));

      // the chevrons — only on the front, where they look at the camera
      for (let k = 0; k < eyes.length; k++) {
        const e = eyes[k];
        const ex = arc - e.arc;
        const ey = y - e.y;
        if (Math.abs(ex) > e.size * 1.6 || Math.abs(ey) > e.size * 1.2) continue;
        const qx = ex / e.size;
        const almond = Math.abs(ey) - e.size * 0.32 * (1 - qx * qx);
        let dark = sat(0.5 - almond);
        const brow = Math.abs(ey + e.size * 0.42 - Math.abs(ex) * 0.62) - 2.4 * (1 - Math.abs(qx) / 1.6);
        dark = Math.max(dark, sat(0.5 - brow) * (Math.abs(qx) < 1.6 ? 1 : 0));
        a = lerp(a, 0.05, dark * smoothstep(0.95, 0.6, Math.abs(u)));
        // a wet glint in the middle of the almond
        const g = Math.hypot(ex + e.size * 0.12, ey + e.size * 0.08);
        if (g < 1.8) a = lerp(a, 0.55, sat(1.8 - g) * 0.8);
      }

      // the base: black fissured bark, then moss
      if (baseK > 0) {
        const fiss = fbm(arc / 8, y / 60, seed + 6, 3);
        const k = sat(baseK * 1.5 - (1 - fiss) * 0.6);
        a = lerp(a, 0.08 + fiss * 0.16, k);
        const moss = smoothstep(0.48, 0.62, fbm(arc / 11, y / 11, seed + 7, 3)) * mossBand;
        a = lerp(a, 0.32 + valueNoise(arc / 2, y / 2, seed + 10) * 0.12, moss);
      }

      // the carving: pale wood in the cut, a dark lip below it and a lit one above
      if (carving) {
        const c = cut(x, y);
        const lip = cut(x - 2, y - 2) - cut(x + 2, y + 2);
        a = lerp(a, 0.34, c);
        a = sat(a - lip * 0.22);
      }

      // lit from the camera, a touch from the left: the cylinder darkens to its sides
      const diff = Math.max(0, u * lx + nz * lz);
      const shade = 0.16 + 0.84 * diff ** 1.15;
      const v = sat(a * shade);
      const i = (y * w + x) * 4;
      // over the twig layer
      const ta = data[i + 3] / 255;
      const oa = cover + ta * (1 - cover);
      for (let ch = 0; ch < 3; ch++) {
        const tint = ch === 2 ? 0.97 : 1;
        data[i + ch] = Math.round(((v * tint * cover + (data[i + ch] / 255) * ta * (1 - cover)) / oa) * 255);
      }
      data[i + 3] = Math.round(oa * 255);
    }
  }
  return img;
}

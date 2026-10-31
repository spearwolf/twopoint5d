// stage-masks/rift: what lies behind the window of each room. The night: a clear sky over low
// hills, the Milky Way, a thin moon, and the big dish of the station, tilted up at the sky, with a
// smaller one far off. The deep: dark water lit from far above, shafts of light, a seabed of rock
// columns and the ruin of the dish's mount — the jellyfish that is the dish here is a sprite.
import {fbm, Rng} from '../../lib/image.mjs';
import {BACKDROP, blurFilter, box, DISH, el, n, PX, rasterize, rgrad, smoothstep, toFloat, vgrad, worldDoc} from './kit.mjs';

const W = (BACKDROP.right - BACKDROP.left) * PX;
const H = (BACKDROP.top - BACKDROP.bottom) * PX;
export const BACKDROP_W = W;
export const BACKDROP_H = H;

const defs = [blurFilter('b1', 0.5), blurFilter('b2', 1.2), blurFilter('b6', 5), blurFilter('b14', 12)];

/** The horizon: low hills, the same line in both. @param {number} x */
const hill = (x) => -12 + Math.sin(x * 0.011 + 1.3) * 9 + Math.sin(x * 0.031) * 4 + Math.sin(x * 0.07 + 2) * 1.5;

function hillPath(/** @type {number} */ lift = 0) {
  let d = `M${BACKDROP.left} ${BACKDROP.bottom}`;
  for (let x = BACKDROP.left; x <= BACKDROP.right; x += 3) d += `L${x} ${n(hill(x) + lift)}`;
  return `${d}L${BACKDROP.right} ${BACKDROP.bottom}Z`;
}

/**
 * The dish: a parabolic bowl tilted up and to the left, its feed on three legs, a truss behind, an
 * A-frame mount on a pedestal. Drawn around (cx, cy) at `s` (1 = the big dish).
 * @param {number} cx @param {number} cy @param {number} s @param {string} fill @param {string} rim
 */
function dish(cx, cy, s, fill, rim) {
  const out = [];
  const tilt = 24;
  const g = [];
  // the pedestal and the A-frame
  g.push(
    el('path', {d: `M${-26 * s} ${-96 * s}L${-10 * s} ${-20 * s}L${10 * s} ${-20 * s}L${26 * s} ${-96 * s}Z`, fill}),
    el('path', {
      d: `M${-14 * s} ${-96 * s}L0 ${-40 * s}L${14 * s} ${-96 * s}`,
      stroke: rim,
      'stroke-width': 0.8 * s,
      fill: 'none',
      opacity: 0.4,
    }),
    box(-36 * s, -104 * s, 36 * s, -94 * s, {fill}),
  );
  const bowl = [];
  // the bowl, seen from the side and a little behind: a deep lens
  bowl.push(
    el('path', {
      d: `M${-86 * s} 0C${-60 * s} ${-44 * s} ${60 * s} ${-44 * s} ${86 * s} 0C${60 * s} ${-14 * s} ${-60 * s} ${-14 * s} ${-86 * s} 0Z`,
      fill,
    }),
  );
  // its rim lit by the moon
  bowl.push(
    el('path', {
      d: `M${-86 * s} 0C${-60 * s} ${-14 * s} ${60 * s} ${-14 * s} ${86 * s} 0`,
      stroke: rim,
      'stroke-width': 1.4 * s,
      fill: 'none',
      opacity: 0.8,
    }),
  );
  bowl.push(
    el('path', {
      d: `M${-86 * s} 0C${-60 * s} ${10 * s} ${60 * s} ${10 * s} ${86 * s} 0`,
      stroke: fill,
      'stroke-width': 1.2 * s,
      fill: 'none',
    }),
  );
  // the backing truss
  let truss = '';
  for (let k = -3; k <= 3; k++) truss += `M${k * 22 * s} ${-28 * s}L${k * 11 * s} ${-12 * s}`;
  bowl.push(el('path', {d: truss, stroke: fill, 'stroke-width': 2 * s}));
  // three legs to the feed horn
  bowl.push(
    el('path', {
      d: `M${-80 * s} ${2 * s}L0 ${86 * s}M${80 * s} ${2 * s}L0 ${86 * s}M0 ${-4 * s}L0 ${86 * s}`,
      stroke: fill,
      'stroke-width': 1.8 * s,
    }),
    el('path', {d: `M${-80 * s} ${2 * s}L0 ${86 * s}`, stroke: rim, 'stroke-width': 0.6 * s, opacity: 0.6}),
    box(-6 * s, 82 * s, 6 * s, 96 * s, {fill}),
  );
  g.push(el('g', {transform: `rotate(${tilt})`}, bowl));
  out.push(el('g', {transform: `translate(${cx} ${cy})`}, g));
  return out;
}

/** The night sky behind the window: straight RGBA floats of the backdrop's size, opaque. */
export async function renderSky() {
  const rng = new Rng(2202);
  const body = [];
  body.push(
    vgrad('sky', BACKDROP.top, BACKDROP.bottom, [
      [0, '#02040b'],
      [0.6, '#06101e'],
      [0.85, '#0e1a26'],
      [1, '#16202a'],
    ]),
  );
  body.push(box(BACKDROP.left, BACKDROP.bottom, BACKDROP.right, BACKDROP.top, {fill: 'url(#sky)'}));
  // the Milky Way: a soft band across, mottled
  for (let k = 0; k < 40; k++) {
    const t = rng.next();
    const x = BACKDROP.left + t * (BACKDROP.right - BACKDROP.left);
    const y = 40 + t * 170 + rng.range(-24, 24);
    body.push(
      el('ellipse', {
        cx: x,
        cy: y,
        rx: rng.range(14, 36),
        ry: rng.range(8, 20),
        fill: '#8a9ab8',
        opacity: rng.range(0.03, 0.08),
        filter: 'url(#b14)',
      }),
    );
  }
  // stars: most tiny and dim, some bright with a halo
  for (let k = 0; k < 420; k++) {
    const x = rng.range(BACKDROP.left, BACKDROP.right);
    const y = rng.range(-10, BACKDROP.top);
    const band = Math.abs(y - (40 + ((x - BACKDROP.left) / 420) * 170));
    if (band > 40 && rng.next() < 0.45) continue;
    const b = rng.next() ** 3;
    const col = rng.pick(['#ffffff', '#dfe8ff', '#fff2d8', '#cfe0ff']);
    body.push(el('circle', {cx: x, cy: y, r: 0.35 + b * 0.9, fill: col, opacity: 0.35 + b * 0.65}));
    if (b > 0.7) body.push(el('circle', {cx: x, cy: y, r: 1.2 + b * 1.4, fill: col, opacity: 0.18, filter: 'url(#b1)'}));
  }
  // a thin moon, high at the right
  body.push(el('circle', {cx: 390, cy: 196, r: 22, fill: '#a0b0c8', opacity: 0.12, filter: 'url(#b14)'}));
  body.push(el('path', {d: 'M384 208A13 13 0 1 0 398 186A10 10 0 1 1 384 208Z', fill: '#e8eef8'}));
  // the far dish and the hills
  body.push(...dish(70, 8, 0.32, '#070a10', '#5a6a80'));
  body.push(el('path', {d: hillPath(6), fill: '#0a0f16'}));
  body.push(el('path', {d: hillPath(), fill: '#05080c'}));
  // the big dish
  body.push(...dish(DISH.x, DISH.y, 1, '#03050a', '#8a9ab8'));
  // a service hut at its foot, one window lit
  body.push(box(170, -20, 214, 4, {fill: '#04060a'}), box(196, -10, 204, -2, {fill: '#ffb050'}));
  body.push(el('circle', {cx: 200, cy: -6, r: 8, fill: '#ffb050', opacity: 0.2, filter: 'url(#b6)'}));
  const img = toFloat(await rasterize(worldDoc(defs, body, BACKDROP), W, H));
  // a faint grain against banding
  for (let i = 0, p = 0; i < img.length; i += 4, p++) {
    const g = (fbm((p % W) * 0.7, Math.floor(p / W) * 0.7, 5, 2) - 0.5) * 0.012;
    img[i] += g;
    img[i + 1] += g;
    img[i + 2] += g;
  }
  return img;
}

/** The deep behind the window: straight RGBA floats of the backdrop's size, opaque. */
export async function renderDeep() {
  const rng = new Rng(3303);
  const body = [];
  body.push(
    vgrad('deep', BACKDROP.top, BACKDROP.bottom, [
      [0, '#06323c'],
      [0.5, '#031c24'],
      [1, '#010a0e'],
    ]),
  );
  body.push(box(BACKDROP.left, BACKDROP.bottom, BACKDROP.right, BACKDROP.top, {fill: 'url(#deep)'}));
  // the glow where the jellyfish hangs, so the water around it is lit
  body.push(
    rgrad('jellyGlow', DISH.x, DISH.y + 20, 200, [
      [0, '#2ab8c0', 0.35],
      [1, '#2ab8c0', 0],
    ]),
  );
  body.push(el('circle', {cx: DISH.x, cy: DISH.y + 20, r: 200, fill: 'url(#jellyGlow)'}));
  // shafts of light from far above, slanting
  for (let k = 0; k < 7; k++) {
    const x = rng.range(BACKDROP.left - 40, BACKDROP.right);
    const w = rng.range(10, 34);
    body.push(
      el('path', {
        d: `M${n(x)} ${BACKDROP.top}L${n(x + w)} ${BACKDROP.top}L${n(x + w + 90)} ${BACKDROP.bottom}L${n(x + 70)} ${BACKDROP.bottom}Z`,
        fill: '#7ae8e8',
        opacity: rng.range(0.03, 0.07),
        filter: 'url(#b6)',
      }),
    );
  }
  // far rock columns, then the seabed with the drowned mount of the dish
  for (let k = 0; k < 5; k++) {
    const x = rng.range(BACKDROP.left, BACKDROP.right);
    const h = rng.range(18, 52);
    const w = rng.range(26, 60);
    let d = `M${n(x - w)} -24`;
    for (let j = 1; j < 9; j++) {
      const t = j / 9;
      const bump = Math.sin(t * Math.PI) * h * rng.range(0.7, 1.15);
      d += `L${n(x - w + t * 2 * w)} ${n(-14 + bump)}`;
    }
    body.push(el('path', {d: `${d}L${n(x + w)} -24Z`, fill: '#04161c', opacity: 0.85}));
  }
  body.push(el('path', {d: hillPath(4), fill: '#031014'}));
  // the pedestal of the dish, tilted and overgrown
  body.push(
    el('path', {
      d: `M${DISH.x - 26} -12L${DISH.x - 8} ${DISH.y - 48}L${DISH.x + 12} ${DISH.y - 50}L${DISH.x + 30} -14Z`,
      fill: '#021014',
    }),
    el('path', {d: `M${DISH.x - 14} -10L${DISH.x - 4} ${DISH.y - 50}`, stroke: '#0e3a40', 'stroke-width': 1, opacity: 0.6}),
  );
  body.push(el('path', {d: hillPath(), fill: '#01080b'}));
  // marine snow, painted (more drifts in the demo)
  for (let k = 0; k < 260; k++) {
    body.push(
      el('circle', {
        cx: rng.range(BACKDROP.left, BACKDROP.right),
        cy: rng.range(BACKDROP.bottom, BACKDROP.top),
        r: rng.range(0.3, 1),
        fill: '#c8f0f0',
        opacity: rng.range(0.1, 0.4),
      }),
    );
  }
  const img = toFloat(await rasterize(worldDoc(defs, body, BACKDROP), W, H));
  for (let i = 0, p = 0; i < img.length; i += 4, p++) {
    const x = p % W;
    const y = Math.floor(p / W);
    // a murk that moves in clouds
    const m = fbm(x * 0.012, y * 0.012, 9, 4);
    const k = 0.75 + 0.5 * smoothstep(0.2, 0.8, m);
    img[i] *= k;
    img[i + 1] *= k;
    img[i + 2] *= k;
  }
  return img;
}

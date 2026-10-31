// stage-masks/matte-threshold: the two pictures of "Sonar" — the same deep-sea trench, seen down
// its length from the research submersible's survey camera. `survey` is the calm view: rock walls
// that close in towards the far end, a floor of pale ooze with boulders, sea pens and glass
// sponges, the sub's floodlight pooling on the floor. `thing` is the same trench, the same props,
// the same light — and a vast pale body lying along the floor, from out of frame in the
// foreground into the dark of the far end, ringed in segments, partly buried, studded with cyan
// parasites. The eyes are not drawn here: the demo draws them as sprites, so they can open.
//
// Everything is worked out per pixel in JavaScript (floor, walls, water, light, the body), the
// props and the sub are SVG laid over it. Units of the stage: origin in the middle, y up, 2
// texels per unit, x in ±600, y in ±320.
import {fbm, Rng} from '../../lib/image.mjs';
import {blobPath, el, lerp, n, rasterize, sat, smoothstep} from '../spotlight/svg.mjs';
import {encodeWebpRGB, IMG_H, IMG_W, PX, rgrad, vgrad, WORLD, worldDoc} from '../rift/kit.mjs';

/** where the trench closes in, far away */
export const VP = {x: 70, y: 74};
/** the hull of the sub, its floodlight and where the light pools on the floor */
export const SUB = {x: -262, y: 186};
export const NOSE = {x: -210, y: 168};
export const POOL = {x: 30, y: -150};

/** the floor: depth 1 at the bottom edge of the picture, rising to infinity at the far end */
const FLOOR_K = VP.y - WORLD.bottom;
/** @param {number} y */
const floorDepth = (y) => FLOOR_K / Math.max(1, VP.y - y);

/** the rays from the far end that part the floor, the walls and the open water (angles in radians) */
const RAY = {
  floorLeft: Math.atan2(-170 - VP.y, -640 - VP.x),
  wallLeft: Math.atan2(340 - VP.y, -300 - VP.x),
  wallRight: Math.atan2(340 - VP.y, 330 - VP.x),
  floorRight: Math.atan2(-140 - VP.y, 660 - VP.x),
};

/**
 * The middle line of the body, in units: from out of the frame on the left, across the pool of
 * light, then curving away into the dark of the far end.
 * @type {[number, number][]}
 */
const SPINE = [
  [-760, -300],
  [-560, -262],
  [-340, -222],
  [-120, -196],
  [80, -176],
  [236, -150],
  [306, -112],
  [282, -64],
  [204, -24],
  [140, 12],
  [100, 42],
  [82, 60],
];
/** the radius of the body at depth 1, in units */
const BODY_R = 92;

/** Samples of the spine: a Catmull-Rom curve, spaced finer where the body is thin. */
function spineSamples() {
  const P = SPINE;
  /** @param {number} i */
  const p = (i) => P[Math.max(0, Math.min(P.length - 1, i))];
  /** @type {{x: number, y: number, tx: number, ty: number, r: number, phase: number, s: number}[]} */
  const out = [];
  let phase = 0;
  let prev;
  for (let i = 0; i < P.length - 1; i++) {
    const [p0, p1, p2, p3] = [p(i - 1), p(i), p(i + 1), p(i + 2)];
    const steps = 900;
    for (let k = 0; k < steps; k++) {
      const t = k / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const cr = (/** @type {number} */ a, /** @type {number} */ b, /** @type {number} */ c, /** @type {number} */ d) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      const x = cr(p0[0], p1[0], p2[0], p3[0]);
      const y = cr(p0[1], p1[1], p2[1], p3[1]);
      const scale = 1 / floorDepth(y);
      if (prev) {
        const step = Math.hypot(x - prev.x, y - prev.y);
        // the rings of the body are evenly spaced on the floor, so they crowd together far away
        phase += step / scale / 54;
      }
      out.push({x, y, tx: 0, ty: 0, r: 0, phase, s: 0});
      prev = {x, y};
    }
  }
  const total = out.length;
  for (let i = 0; i < total; i++) {
    const a = out[Math.max(0, i - 2)];
    const b = out[Math.min(total - 1, i + 2)];
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    out[i].tx = (b.x - a.x) / len;
    out[i].ty = (b.y - a.y) / len;
    out[i].s = i / (total - 1);
    const scale = 1 / floorDepth(out[i].y);
    // it thins towards its far end, the tail, out in the dark
    const taper = 1 - smoothstep(0.55, 1, out[i].s) * 0.72;
    // not a pipe: it swells and narrows along its length, as a gorged thing does
    const swell = 1 + Math.sin(out[i].phase * 0.42 + 1.3) * 0.08 + (fbm(out[i].phase * 0.25, 0.5, 51, 3) - 0.5) * 0.22;
    out[i].r = BODY_R * scale * taper * swell;
  }
  return out;
}

/**
 * The light of the scene at a point in units: a cold ambient that dies away with the depth, and the
 * floodlight of the sub — a pool on the floor, a falloff around the beam on the walls.
 * @param {number} x @param {number} y @param {number} depth @param {'floor' | 'wall' | 'water'} kind
 * @returns {[number, number, number]}
 */
function lightAt(x, y, depth, kind) {
  const fog = Math.exp(-(depth - 1) * 0.16);
  let flood = 0;
  if (kind === 'floor') {
    const dx = (x - POOL.x) / 250;
    const dy = (y - POOL.y) / 92;
    flood = Math.exp(-(dx * dx + dy * dy)) * 2.4 + Math.exp(-Math.hypot(dx, dy * 1.2) * 1.4) * 0.7;
  } else {
    // the distance from the axis of the beam, from the nose to the pool
    const ax = POOL.x - NOSE.x;
    const ay = POOL.y - NOSE.y;
    const len = Math.hypot(ax, ay);
    const t = sat(((x - NOSE.x) * ax + (y - NOSE.y) * ay) / (len * len));
    const off = Math.hypot(x - (NOSE.x + ax * t), y - (NOSE.y + ay * t));
    flood = Math.exp(-off / (60 + 140 * t)) * 0.5 * (0.3 + t) + Math.exp(-Math.hypot(x - NOSE.x, y - NOSE.y) / 160) * 0.35;
  }
  const amb = 0.15 * fog + 0.025;
  return [amb * 0.32 + flood * 1.0, amb * 0.62 + flood * 0.91, amb * 0.8 + flood * 0.74];
}

/**
 * The boulders, sea pens, glass sponges and sea cucumbers of the floor, the same in both pictures.
 * Placed off the path of the body, so the body lies between them rather than over them.
 * @param {ReturnType<typeof spineSamples>} spine
 */
function props(spine) {
  const rng = new Rng(4405);
  /** @param {number} x @param {number} y */
  const nearBody = (x, y) => {
    for (let i = 0; i < spine.length; i += 12) {
      const s = spine[i];
      if (Math.hypot(x - s.x, y - s.y) < s.r * 1.55 + 10) return true;
    }
    return false;
  };
  /** @param {number} x @param {number} y */
  const onFloor = (x, y) => {
    if (y > VP.y - 14) return false;
    const a = Math.atan2(y - VP.y, x - VP.x);
    return a < RAY.floorRight - 0.04 && a > RAY.floorLeft + 0.04;
  };
  /** @type {{kind: string, x: number, y: number, scale: number, seed: number}[]} */
  const list = [];
  /** @type {[string, number][]} */
  const tries = [
    ['boulder', 42],
    ['pebble', 140],
    ['seapen', 22],
    ['sponge', 9],
    ['cucumber', 7],
  ];
  for (const [kind, count] of tries) {
    let placed = 0;
    for (let k = 0; k < count * 30 && placed < count; k++) {
      const x = rng.range(-620, 620);
      // more of them near: an even spread over the floor's depth
      const depth = 1 + rng.next() ** 1.6 * 9;
      const y = VP.y - FLOOR_K / depth;
      // pebbles may lie under the body, it covers them; what stands up stays clear of it
      if (!onFloor(x, y) || (kind !== 'pebble' && nearBody(x, y))) continue;
      list.push({kind, x, y, scale: 1 / depth, seed: rng.int(1, 1e6)});
      placed++;
    }
  }
  // far first, so the near ones lie over them
  list.sort((a, b) => b.y - a.y);
  return list;
}

/**
 * The props as SVG, in albedo with their own form shading (the scene's light multiplies them later).
 * @param {ReturnType<typeof props>} list
 */
function propsSvg(list) {
  /** @type {string[]} */
  const defs = [
    el(
      'filter',
      {id: 'shadowBlur', x: '-50%', y: '-50%', width: '200%', height: '200%'},
      el('feGaussianBlur', {stdDeviation: 3}),
    ),
    rgrad('rock', 0, 0.35, 1.1, [
      [0, '#6f6c66'],
      [0.6, '#3d3c3a'],
      [1, '#1c1d1f'],
    ]),
    rgrad('sponge', 0, 0.5, 1, [
      [0, '#e9e4d6'],
      [0.7, '#b6b0a2'],
      [1, '#7d796f'],
    ]),
    rgrad('cucumber', -0.2, 0.3, 1, [
      [0, '#d8a7a0'],
      [0.6, '#9c6a6a'],
      [1, '#4e3236'],
    ]),
  ];
  /** @type {string[]} */
  const body = [];
  for (const p of list) {
    const rng = new Rng(p.seed);
    const s = p.scale;
    const tf = `translate(${n(p.x)} ${n(p.y)})`;
    if (p.kind === 'boulder' || p.kind === 'pebble') {
      const size = (p.kind === 'boulder' ? rng.range(10, 30) : rng.range(2.2, 6)) * s;
      /** @type {[number, number][]} */
      const pts = [];
      const count = 9;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2;
        const k = 1 + rng.range(-0.25, 0.25);
        // flat below, rounded on top: a stone sitting in the ooze
        const yy = Math.sin(a) * (Math.sin(a) > 0 ? 0.85 : 0.32) * k;
        pts.push([Math.cos(a) * 1.15 * k, yy]);
      }
      body.push(
        el('ellipse', {
          cx: p.x + size * 0.5,
          cy: p.y - size * 0.25,
          rx: size * 1.7,
          ry: size * 0.5,
          fill: '#000',
          opacity: 0.55,
          filter: 'url(#shadowBlur)',
        }),
        el('path', {d: blobPath(pts), transform: `${tf} scale(${n(size)})`, fill: 'url(#rock)'}),
      );
    } else if (p.kind === 'seapen') {
      const h = rng.range(26, 46) * s;
      const lean = rng.range(-0.25, 0.25);
      const tipX = p.x + lean * h;
      const tipY = p.y + h;
      const w = Math.max(0.5, 1.2 * s);
      const fronds = [];
      for (let i = 0; i < 14; i++) {
        const t = 0.35 + (i / 14) * 0.62;
        const cx = lerp(p.x, tipX, t);
        const cy = lerp(p.y, tipY, t);
        const len = (1 - Math.abs(t - 0.7) * 1.6) * 7 * s;
        fronds.push(
          el('path', {
            d: `M${n(cx)} ${n(cy)}q${n(-len * 0.6)} ${n(len * 0.2)} ${n(-len)} ${n(-len * 0.5)}M${n(cx)} ${n(cy)}q${n(len * 0.6)} ${n(len * 0.2)} ${n(len)} ${n(-len * 0.5)}`,
            stroke: '#e6c8a8',
            'stroke-width': w * 0.6,
            fill: 'none',
            opacity: 0.9,
          }),
        );
      }
      body.push(
        el('path', {
          d: `M${n(p.x)} ${n(p.y)}Q${n(p.x + lean * h * 0.2)} ${n(p.y + h * 0.5)} ${n(tipX)} ${n(tipY)}`,
          stroke: '#cfae90',
          'stroke-width': w,
          fill: 'none',
        }),
        ...fronds,
      );
    } else if (p.kind === 'sponge') {
      // a glass sponge: a pale vase, a lattice drawn on it
      const h = rng.range(22, 34) * s;
      const w = h * 0.38;
      const vase = `M${n(-w * 0.35)} 0C${n(-w * 0.6)} ${n(h * 0.4)} ${n(-w * 1.1)} ${n(h * 0.8)} ${n(-w)} ${n(h)}L${n(w)} ${n(h)}C${n(w * 1.1)} ${n(h * 0.8)} ${n(w * 0.6)} ${n(h * 0.4)} ${n(w * 0.35)} 0Z`;
      const lattice = [];
      for (let i = 1; i < 6; i++) {
        const yy = (h * i) / 6;
        lattice.push(`M${n(-w)} ${n(yy)}L${n(w)} ${n(yy)}`);
      }
      for (let i = -3; i <= 3; i++) lattice.push(`M${n(i * w * 0.1)} 0L${n(i * w * 0.32)} ${n(h)}`);
      body.push(
        el('ellipse', {
          cx: p.x + w * 0.6,
          cy: p.y - 1 * s,
          rx: w * 1.6,
          ry: w * 0.35,
          fill: '#000',
          opacity: 0.5,
          filter: 'url(#shadowBlur)',
        }),
        el('g', {transform: tf}, [
          el('path', {d: vase, fill: '#b9b2a2', opacity: 0.85}),
          el('path', {
            d: lattice.join(''),
            stroke: '#efe9da',
            'stroke-width': Math.max(0.35, 0.6 * s),
            fill: 'none',
            opacity: 0.7,
          }),
          el('ellipse', {cx: 0, cy: h, rx: w, ry: w * 0.28, fill: '#2a2826'}),
        ]),
      );
    } else if (p.kind === 'cucumber') {
      const len = rng.range(16, 24) * s;
      const rot = rng.range(-25, 25);
      const papillae = [];
      for (let i = 0; i < 7; i++) {
        const xx = -len * 0.8 + (i / 6) * len * 1.6;
        papillae.push(el('circle', {cx: xx, cy: len * 0.28, r: len * 0.05, fill: '#e8b9ae'}));
      }
      body.push(
        el('ellipse', {
          cx: p.x + len * 0.2,
          cy: p.y - len * 0.12,
          rx: len * 1.2,
          ry: len * 0.22,
          fill: '#000',
          opacity: 0.45,
          filter: 'url(#shadowBlur)',
        }),
        el('g', {transform: `${tf} rotate(${n(rot)})`}, [
          el('ellipse', {cx: 0, cy: len * 0.12, rx: len, ry: len * 0.27, fill: '#a0706c'}),
          el('ellipse', {cx: -len * 0.1, cy: len * 0.2, rx: len * 0.75, ry: len * 0.12, fill: '#d29d95', opacity: 0.6}),
          ...papillae,
        ]),
      );
    }
  }
  return worldDoc(defs, body);
}

/**
 * The sub, pre-lit: it hangs in the dark above the floor, rim-lit by its own lamps. Its floodlight
 * shines from the nose; the beam and its glow are drawn by the demo.
 */
function subSvg() {
  const {x, y} = SUB;
  const L = 112;
  const H = 44;
  const hull = `M${-L * 0.5} ${-H * 0.05}C${-L * 0.5} ${H * 0.45} ${-L * 0.25} ${H * 0.55} ${L * 0.05} ${H * 0.55}L${L * 0.3} ${H * 0.5}C${L * 0.48} ${H * 0.45} ${L * 0.55} ${H * 0.15} ${L * 0.52} ${-H * 0.1}C${L * 0.5} ${-H * 0.35} ${L * 0.35} ${-H * 0.45} ${L * 0.2} ${-H * 0.45}L${-L * 0.3} ${-H * 0.45}C${-L * 0.45} ${-H * 0.42} ${-L * 0.5} ${-H * 0.3} ${-L * 0.5} ${-H * 0.05}Z`;
  const defs = [
    vgrad('hull', -H * 0.5, H * 0.6, [
      [0, '#0c0d0e'],
      [0.55, '#3a2e1a'],
      [0.85, '#8a6a32'],
      [1, '#c79a4a'],
    ]),
    rgrad('port', 0, 0, 7, [
      [0, '#fff3c9'],
      [0.4, '#f0b860'],
      [1, '#5a3410'],
    ]),
    rgrad('lamp', 0, 0, 9, [
      [0, '#ffffff'],
      [0.5, '#fff1d0'],
      [1, '#ffd890', 0],
    ]),
  ];
  const g = [
    // the conning sail and its mast
    el('path', {
      d: `M${-L * 0.12} ${H * 0.5}L${-L * 0.08} ${H * 0.82}L${L * 0.14} ${H * 0.82}L${L * 0.2} ${H * 0.5}Z`,
      fill: '#2c2416',
    }),
    el('path', {d: `M${L * 0.02} ${H * 0.82}L${L * 0.03} ${H * 1.15}`, stroke: '#3a3020', 'stroke-width': 1.4}),
    // the tail, its fin and the thruster ring
    el('path', {
      d: `M${-L * 0.48} ${H * 0.05}L${-L * 0.66} ${H * 0.5}L${-L * 0.7} ${H * 0.48}L${-L * 0.62} ${-H * 0.05}Z`,
      fill: '#5a1c14',
    }),
    el('ellipse', {cx: -L * 0.58, cy: -H * 0.05, rx: 4, ry: 13, fill: 'none', stroke: '#2a2218', 'stroke-width': 3}),
    el('path', {d: hull, fill: 'url(#hull)'}),
    // a highlight along the top, where the lamps of the mast catch it
    el('path', {
      d: `M${-L * 0.36} ${H * 0.5}C${-L * 0.1} ${H * 0.58} ${L * 0.2} ${H * 0.55} ${L * 0.38} ${H * 0.42}`,
      stroke: '#e8c27a',
      'stroke-width': 1.3,
      fill: 'none',
      opacity: 0.7,
    }),
    // the sampling basket and the manipulator arm reaching down
    el('path', {
      d: `M${L * 0.18} ${-H * 0.45}L${L * 0.22} ${-H * 0.7}L${L * 0.48} ${-H * 0.7}L${L * 0.46} ${-H * 0.32}`,
      stroke: '#2a2a28',
      'stroke-width': 2,
      fill: 'none',
    }),
    el('path', {
      d: `M${L * 0.24} ${-H * 0.58}L${L * 0.44} ${-H * 0.58}M${L * 0.3} ${-H * 0.7}L${L * 0.3} ${-H * 0.46}M${L * 0.38} ${-H * 0.7}L${L * 0.38} ${-H * 0.46}`,
      stroke: '#222',
      'stroke-width': 1,
    }),
    el('path', {
      d: `M${L * 0.1} ${-H * 0.42}L${L * 0.05} ${-H * 0.9}L${L * 0.18} ${-H * 1.15}`,
      stroke: '#3a3226',
      'stroke-width': 2.4,
      fill: 'none',
      'stroke-linejoin': 'round',
    }),
    el('path', {d: `M${L * 0.18} ${-H * 1.15}l3 -3m-3 3l4 1`, stroke: '#4a4232', 'stroke-width': 1.4, fill: 'none'}),
    // panels and bolts
    el('path', {
      d: `M${-L * 0.2} ${H * 0.5}L${-L * 0.22} ${-H * 0.44}M${L * 0.12} ${H * 0.55}L${L * 0.1} ${-H * 0.45}`,
      stroke: '#1a150d',
      'stroke-width': 0.8,
      opacity: 0.8,
    }),
    // the viewport of the pilot, warm
    el('circle', {cx: L * 0.36, cy: H * 0.06, r: 7.5, fill: '#1a140a'}),
    el('circle', {cx: L * 0.27, cy: -H * 0.08, r: 3.4, fill: '#f2c06a', opacity: 0.85}),
    // the floodlight housing on the nose
    el('path', {d: `M${L * 0.47} ${-H * 0.3}l9 -2l2 9l-8 2z`, fill: '#1c1a16'}),
  ];
  // the radial gradients are in user space: move the port's to its centre
  const port = el('circle', {
    cx: 0,
    cy: 0,
    r: 5.6,
    fill: 'url(#port)',
    transform: `translate(${n(x + L * 0.36)} ${n(y + H * 0.06)})`,
  });
  const lamp = el('circle', {cx: 0, cy: 0, r: 9, fill: 'url(#lamp)', transform: `translate(${n(NOSE.x)} ${n(NOSE.y)})`});
  return worldDoc(defs, [el('g', {transform: `translate(${n(x)} ${n(y)})`}, g), port, lamp]);
}

/**
 * Renders one of the two pictures.
 * @param {{thing: boolean}} opts
 */
export async function renderTrench({thing}) {
  const W = IMG_W;
  const H = IMG_H;
  const albedo = new Float32Array(W * H * 3);
  const light = new Float32Array(W * H * 3);
  /** a multiplier of the light only: the body's own shading, the shadow it casts */
  const shade = new Float32Array(W * H).fill(1);
  const fogAmt = new Float32Array(W * H);
  const emissive = new Float32Array(W * H * 3);

  const water = [0.006, 0.02, 0.028];

  // ---- the floor, the walls, the open water
  for (let j = 0; j < H; j++) {
    const y = WORLD.top - (j + 0.5) / PX;
    for (let i = 0; i < W; i++) {
      const x = WORLD.left + (i + 0.5) / PX;
      const p = j * W + i;
      const dx = x - VP.x;
      const dy = y - VP.y;
      const r = Math.hypot(dx, dy) + 1e-3;
      const a = Math.atan2(dy, dx);
      // rocky outlines: the rays bend by a noise that grows with the distance from the far end
      const wob = (fbm(r * 0.018, 3.1, 7, 4) - 0.5) * 0.45 + (fbm(r * 0.07, 9.7, 8, 3) - 0.5) * 0.12;
      const inFloor = y < VP.y && a > RAY.floorLeft + wob * 0.6 && a < RAY.floorRight - wob * 0.5;
      const inWallL = !inFloor && (a > RAY.wallLeft + wob * 0.5 || a < RAY.floorLeft + wob * 0.6);
      const inWallR = !inFloor && !inWallL && a < RAY.wallRight - wob * 0.5;
      let c0;
      let c1;
      let c2;
      let depth;
      /** @type {'floor' | 'wall' | 'water'} */
      let kind;
      if (inFloor) {
        kind = 'floor';
        depth = floorDepth(y);
        const fx = (dx * depth) / FLOOR_K;
        const fz = depth;
        // pale ooze: drifts, ripple marks, a speckle of grit, darker hollows
        const drift = fbm(fx * 0.012, fz * 0.9, 21, 5);
        const ripple = Math.sin(fx * 0.09 + fbm(fx * 0.01, fz * 0.5, 23, 3) * 9 + fz * 1.3) * 0.5 + 0.5;
        const grit = fbm(fx * 0.22, fz * 14, 25, 2);
        const hollow = smoothstep(0.62, 0.8, fbm(fx * 0.006, fz * 0.35, 27, 4));
        const v = 0.27 + drift * 0.16 + ripple * 0.02 * (1 / depth) + (grit - 0.5) * 0.08 - hollow * 0.08;
        c0 = v * 1.02;
        c1 = v * 0.98;
        c2 = v * 0.9;
      } else if (inWallL || inWallR) {
        kind = 'wall';
        depth = 1 + 260 / r;
        // strata run towards the far end; cracks and ledges break them up
        const u = a * 9;
        const v = Math.log(r) * 6;
        const strata = Math.sin(a * (inWallL ? 38 : 34) + fbm(u * 0.5, v * 0.6, 31, 4) * 6) * 0.5 + 0.5;
        const rock = fbm(u * 1.7, v * 1.4, 33, 5);
        const crack = smoothstep(0.035, 0.0, Math.abs(fbm(u * 0.9, v * 0.8, 35, 4) - 0.5));
        const tone = 0.1 + rock * 0.17 + strata * 0.06 - crack * 0.08;
        c0 = tone * 0.92;
        c1 = tone * 0.98;
        c2 = tone * 1.04;
      } else {
        kind = 'water';
        depth = 1 + 300 / r;
        c0 = 0;
        c1 = 0;
        c2 = 0;
      }
      albedo[p * 3] = c0;
      albedo[p * 3 + 1] = c1;
      albedo[p * 3 + 2] = c2;
      const [l0, l1, l2] = lightAt(x, y, depth, kind);
      light[p * 3] = l0;
      light[p * 3 + 1] = l1;
      light[p * 3 + 2] = l2;
      // far away the water swallows everything
      fogAmt[p] = kind === 'water' ? 1 : 1 - Math.exp(-(depth - 1) * (kind === 'floor' ? 0.28 : 0.22));
    }
  }

  // ---- the props, in albedo over the floor
  const spine = spineSamples();
  const propList = props(spine);
  const propRgba = await rasterize(propsSvg(propList), W, H);
  for (let p = 0, q = 0; p < W * H; p++, q += 4) {
    const al = propRgba[q + 3] / 255;
    if (al === 0) continue;
    for (let c = 0; c < 3; c++) albedo[p * 3 + c] = lerp(albedo[p * 3 + c], propRgba[q + c] / 255, al);
  }

  /** @type {{x: number, y: number, w: number, rot: number, light: number}[]} */
  const eyes = [];
  /** @type {{x: number, y: number, r: number}[]} */
  const parasites = [];

  if (thing) {
    // ---- the body: stamp every sample of the spine, keep the nearest
    const best = new Float32Array(W * H).fill(1e9);
    const bestK = new Int32Array(W * H).fill(-1);
    const bestV = new Float32Array(W * H);
    const shadow = new Float32Array(W * H);
    let last = -1e9;
    for (let k = 0; k < spine.length; k++) {
      const sm = spine[k];
      // a stamp every few percent of the radius: enough for a smooth outline
      if (k !== spine.length - 1 && sm.s * spine.length - last < Math.max(1, sm.r * 0.05) * 3) continue;
      last = sm.s * spine.length;
      const reach = sm.r * 1.5 + 4;
      const sx = sm.x + sm.r * 0.4;
      const sy = sm.y - sm.r * 0.22;
      const i0 = Math.max(0, Math.floor((sm.x - reach - WORLD.left) * PX));
      const i1 = Math.min(W - 1, Math.ceil((sm.x + reach + sm.r * 0.5 - WORLD.left) * PX));
      const j0 = Math.max(0, Math.floor((WORLD.top - (sm.y + reach)) * PX));
      const j1 = Math.min(H - 1, Math.ceil((WORLD.top - (sm.y - reach - sm.r * 0.3)) * PX));
      for (let j = j0; j <= j1; j++) {
        const y = WORLD.top - (j + 0.5) / PX;
        for (let i = i0; i <= i1; i++) {
          const x = WORLD.left + (i + 0.5) / PX;
          const p = j * W + i;
          const ddx = x - sm.x;
          const ddy = y - sm.y;
          const d = Math.hypot(ddx, ddy) / sm.r;
          if (d < best[p]) {
            best[p] = d;
            bestK[p] = k;
            // which side of the spine: + is the far flank (up on the screen)
            bestV[p] = Math.sign(sm.tx * ddy - sm.ty * ddx) * d;
          }
          // the shadow it casts, away from the light, soft
          const ds = Math.hypot((x - sx) / 1.25, y - sy) / sm.r;
          const sh = 1 - smoothstep(0.55, 1.35, ds);
          if (sh > shadow[p]) shadow[p] = sh;
        }
      }
    }
    for (let p = 0; p < W * H; p++) {
      const k = bestK[p];
      const d = best[p];
      if (k < 0) continue;
      if (d >= 1) {
        // the floor around it: its cast shadow and a dark contact line where it presses into the ooze
        const contact = 1 - smoothstep(1, 1.45, d);
        shade[p] *= (1 - shadow[p] * 0.72) * (1 - contact * 0.35);
        continue;
      }
      const sm = spine[k];
      const v = bestV[p];
      const nz = Math.sqrt(Math.max(0, 1 - v * v));
      // the rings, wrapped round the body
      const ring = sm.phase + v * v * 0.18 + (fbm(sm.phase * 2, v * 3, 41, 3) - 0.5) * 0.3;
      const fr = ring - Math.floor(ring);
      const groove = smoothstep(0.1, 0.0, fr) + smoothstep(0.88, 1.0, fr);
      const plate = Math.sin(fr * Math.PI);
      // pale flesh, bruised, wrinkled
      const mott = fbm(sm.phase * 1.3 + 3, v * 2.2, 43, 4);
      const bruise = smoothstep(0.58, 0.78, fbm(sm.phase * 0.6, v * 1.2 + 9, 45, 4));
      const wrinkle = fbm(sm.phase * 9, v * 14, 47, 3);
      // folds of skin between the rings, running along the body
      const fold = Math.abs(Math.sin(v * 9 + fbm(sm.phase * 0.8, v * 2, 53, 3) * 5));
      let s0 = 0.7 + (mott - 0.5) * 0.18 + (wrinkle - 0.5) * 0.1 - fold * 0.05;
      let s1 = 0.68 + (mott - 0.5) * 0.16 + (wrinkle - 0.5) * 0.1 - fold * 0.05;
      let s2 = 0.66 + (mott - 0.5) * 0.12 + (wrinkle - 0.5) * 0.08 - fold * 0.04;
      s0 = lerp(s0, 0.55, bruise * 0.6);
      s1 = lerp(s1, 0.48, bruise * 0.6);
      s2 = lerp(s2, 0.6, bruise * 0.6);
      // lit from above and from the left, where the sub hangs: the top bright, the near flank in shadow
      const lambert = sat(0.15 + v * 0.75 + nz * 0.45) ** 1.4;
      const form = (0.12 + lambert * 1.0) * (1 - groove * 0.6) * (0.8 + plate * 0.2);
      // the far edge darkens to a silhouette against the floor, the near edge sinks into the ooze
      const rim = smoothstep(0.82, 1.0, v) * 0.55 + smoothstep(-0.7, -1.0, v) * 0.6;
      // sediment drifts over it, thicker at the bottom of its near flank
      const buried = smoothstep(0.0, 0.25, fbm(sm.phase * 0.35, 1, 49, 3) - 0.55 + Math.max(0, -v - 0.4) * 0.6);
      const edge = smoothstep(1, 0.93, d);
      const fa = buried * 0.9;
      for (let c = 0; c < 3; c++) {
        const skin = c === 0 ? s0 : c === 1 ? s1 : s2;
        const mixed = lerp(skin, albedo[p * 3 + c], fa);
        albedo[p * 3 + c] = lerp(albedo[p * 3 + c], mixed, edge);
      }
      shade[p] = lerp(shade[p], lerp(form * (1 - rim), 0.8, fa * 0.6), edge);
      // wet: a broken highlight along the top of each plate, where the floodlight glints
      const spec = Math.exp(-(((v - 0.42) / 0.13) ** 2)) * plate ** 2 * smoothstep(0.35, 0.7, wrinkle + mott * 0.4) * (1 - fa);
      const lp = (light[p * 3] + light[p * 3 + 1] + light[p * 3 + 2]) / 3;
      for (let c = 0; c < 3; c++) emissive[p * 3 + c] += spec * lp * 0.09 * edge;
      // the body is lit like the floor it lies on, and a little more on top: it rises towards the lamp
      const lift = 1 + nz * 0.25 * sm.r * 0.01;
      for (let c = 0; c < 3; c++) light[p * 3 + c] *= lerp(1, lift, edge);
      fogAmt[p] = lerp(fogAmt[p], 1 - Math.exp(-(floorDepth(sm.y) - 1) * 0.3), edge);
    }

    // ---- the eyes: on the far flank, all along the body, closer together towards the tail
    const eyeAt = [0.13, 0.205, 0.275, 0.345, 0.41, 0.47, 0.53, 0.585, 0.635, 0.68, 0.72];
    for (const s of eyeAt) {
      const k = Math.round(s * (spine.length - 1));
      const sm = spine[k];
      // the normal of the spine on its far side
      const nx = -sm.ty;
      const ny = sm.tx;
      const off = sm.r * 0.3;
      const ex = sm.x + nx * off;
      const ey = sm.y + ny * off;
      if (ex < WORLD.left + 20 || ex > WORLD.right - 20) continue;
      const [l0, l1, l2] = lightAt(ex, ey, floorDepth(ey), 'floor');
      const fog = 1 - Math.exp(-(floorDepth(sm.y) - 1) * 0.3);
      eyes.push({x: ex, y: ey, w: sm.r * 0.62, rot: Math.atan2(sm.ty, sm.tx), light: ((l0 + l1 + l2) / 3) * (1 - fog * 0.85)});
    }
    // a dark crease around each eye, so it sits in the flesh
    for (const e of eyes) {
      const hw = e.w * 0.62;
      const hh = e.w * 0.3;
      const c = Math.cos(e.rot);
      const sn = Math.sin(e.rot);
      const reach = hw * 1.3;
      const i0 = Math.max(0, Math.floor((e.x - reach - WORLD.left) * PX));
      const i1 = Math.min(W - 1, Math.ceil((e.x + reach - WORLD.left) * PX));
      const j0 = Math.max(0, Math.floor((WORLD.top - (e.y + reach)) * PX));
      const j1 = Math.min(H - 1, Math.ceil((WORLD.top - (e.y - reach)) * PX));
      for (let j = j0; j <= j1; j++) {
        const y = WORLD.top - (j + 0.5) / PX;
        for (let i = i0; i <= i1; i++) {
          const x = WORLD.left + (i + 0.5) / PX;
          const lx = (x - e.x) * c + (y - e.y) * sn;
          const ly = -(x - e.x) * sn + (y - e.y) * c;
          const q = Math.hypot(lx / hw, ly / hh);
          shade[j * W + i] *= 1 - (1 - smoothstep(0.7, 1.25, q)) * 0.45;
        }
      }
    }

    // ---- the parasites: cyan specks in clusters on the body, crisp, with a small glow
    const rng = new Rng(1313);
    for (let cl = 0; cl < 16; cl++) {
      const k = Math.floor(rng.range(0.06, 0.78) * (spine.length - 1));
      const v0 = rng.range(-0.5, 0.85);
      const count = rng.int(3, 7);
      for (let m = 0; m < count; m++) {
        const kk = Math.max(0, Math.min(spine.length - 1, k + Math.round(rng.range(-60, 60))));
        const sm = spine[kk];
        const v = Math.max(-0.8, Math.min(0.95, v0 + rng.range(-0.2, 0.2)));
        const x = sm.x - sm.ty * v * sm.r;
        const y = sm.y + sm.tx * v * sm.r;
        if (x < WORLD.left || x > WORLD.right) continue;
        parasites.push({x, y, r: Math.max(0.8, rng.range(1.2, 2.6) * (sm.r / 60))});
      }
    }
    for (const pa of parasites) {
      const reach = pa.r * 6;
      const i0 = Math.max(0, Math.floor((pa.x - reach - WORLD.left) * PX));
      const i1 = Math.min(W - 1, Math.ceil((pa.x + reach - WORLD.left) * PX));
      const j0 = Math.max(0, Math.floor((WORLD.top - (pa.y + reach)) * PX));
      const j1 = Math.min(H - 1, Math.ceil((WORLD.top - (pa.y - reach)) * PX));
      for (let j = j0; j <= j1; j++) {
        const y = WORLD.top - (j + 0.5) / PX;
        for (let i = i0; i <= i1; i++) {
          const x = WORLD.left + (i + 0.5) / PX;
          const d = Math.hypot(x - pa.x, y - pa.y) / pa.r;
          const core = 1 - smoothstep(0.6, 1.05, d);
          const glow = Math.exp(-d * d * 0.18) * 0.35;
          const p = j * W + i;
          emissive[p * 3] += core * 0.75 + glow * 0.05;
          emissive[p * 3 + 1] += core * 1.0 + glow * 0.75;
          emissive[p * 3 + 2] += core * 0.95 + glow * 0.7;
          // a dark ring of the host's flesh around it, where it bites
          shade[p] *= 1 - smoothstep(1.6, 1.0, d) * (1 - core) * 0.5;
        }
      }
    }
  }

  // ---- light, fog, the sub over it all
  const out = new Float32Array(W * H * 4);
  for (let p = 0; p < W * H; p++) {
    const f = fogAmt[p];
    const i = p % W;
    const j = (p - i) / W;
    const x = WORLD.left + (i + 0.5) / PX;
    const y = WORLD.top - (j + 0.5) / PX;
    // the water column itself: a whisper of the floodlight scattered around the beam
    const scatter = Math.exp(-Math.hypot((x - POOL.x) * 0.6, y - (POOL.y + NOSE.y) * 0.5) / 260) * 0.05;
    for (let c = 0; c < 3; c++) {
      const lit = albedo[p * 3 + c] * light[p * 3 + c] * shade[p];
      const wc = water[c] + scatter * (c === 0 ? 0.6 : c === 1 ? 0.9 : 1);
      out[p * 4 + c] = lerp(lit, wc, f) + emissive[p * 3 + c];
    }
    out[p * 4 + 3] = 1;
  }
  const subRgba = await rasterize(subSvg(), W, H);
  for (let p = 0, q = 0; p < W * H; p++, q += 4) {
    const al = subRgba[q + 3] / 255;
    if (al === 0) continue;
    for (let c = 0; c < 3; c++) out[p * 4 + c] = lerp(out[p * 4 + c], subRgba[q + c] / 255, al);
  }

  // ---- the grade: a soft shoulder for the floodlight, a vignette, a whisper of grain against banding
  const grain = new Rng(thing ? 77 : 76);
  for (let p = 0; p < W * H; p++) {
    const i = p % W;
    const j = (p - i) / W;
    const u = (i / W - 0.5) * 2;
    const v = (j / H - 0.5) * 2;
    const vig = 1 - smoothstep(0.55, 1.5, Math.hypot(u * 0.9, v)) * 0.55;
    const g = (grain.next() - 0.5) * 0.012;
    for (let c = 0; c < 3; c++) {
      const lin = out[p * 4 + c] * vig;
      // a filmic shoulder: bright floodlight rolls off instead of clipping
      const toned = lin / (1 + lin * 0.55);
      out[p * 4 + c] = Math.max(0, toned ** (1 / 1.05) + g);
    }
  }

  return {image: await encodeWebpRGB(out, W, H), eyes, parasites};
}

/** For the README and the demo: the layout of the scene, in units. */
export const LAYOUT = {VP, SUB, NOSE, POOL};

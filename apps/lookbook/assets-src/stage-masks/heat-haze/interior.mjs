// stage-masks/heat-haze: the inside of the crematorium around the window — a wall of dark ashlar, a
// deep splayed reveal, a stone sill with a brass urn and a jar of dead flowers on it, the tracery of
// the window (a mullion, two lancets, a roundel) with its lead cames, and under the sill the
// cast-iron vent of the furnace, glowing. The whole room is lit from below by the vent and from the
// window by the evening outside.
//
// Two versions, one per picture: the light through the window is cold in the snow and red in the
// ash, and the glass is rimmed with frost in one and with soot in the other. The glass itself is
// see-through (alpha 0 but for the frost, the soot and a faint reflection of the vent): the demo
// draws the outside behind it.
import {fbm, Rng} from '../../lib/image.mjs';
import {el, lerp, n, rasterize, sat, smoothstep} from '../spotlight/svg.mjs';
import {encodeWebpRGBA, overRGBA, vgrad, worldDoc} from '../rift/kit.mjs';
import {archPath, GLASS, insideArch, LANCET, REVEAL, ROUNDEL, VENT, WORLD} from './layout.mjs';

const PX = 2;
const W = (WORLD.right - WORLD.left) * PX;
const H = (WORLD.top - WORLD.bottom) * PX;

/** the lead cames across the lancets, at these heights */
const CAMES = [-100, -35, 30, 98];
/** the front face of the stone sill under the reveal */
const SILL_FACE = {hw: 282, top: REVEAL.sill, bottom: REVEAL.sill - 13};

/** @typedef {'snow' | 'ash'} Variant */
/** @typedef {[number, number, number]} RGB */

const LIGHT = {
  snow: {window: /** @type {RGB} */ ([0.36, 0.42, 0.72])},
  ash: {window: /** @type {RGB} */ ([0.78, 0.3, 0.14])},
};
/** @type {RGB} */
const VENT_LIGHT = [1.0, 0.44, 0.14];

/** The window between the glass (k = 0) and the outer edge of the reveal (k = 1). */
const windowAt = (/** @type {number} */ k) => ({
  hw: lerp(GLASS.hw, REVEAL.hw, k),
  sill: lerp(GLASS.sill, REVEAL.sill, k),
  spring: GLASS.spring,
  apex: lerp(GLASS.apex, REVEAL.apex, k),
});

/** How far into the reveal a point lies, 0 at the glass, 1 at the face of the wall. */
function revealK(/** @type {number} */ x, /** @type {number} */ y) {
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    if (insideArch(x, y, windowAt(mid))) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** the roundel as a window shape, for {@link insideArch}: a box around it, the circle tested below */
const ROUNDEL_AS_ARCH = {hw: ROUNDEL.r, sill: ROUNDEL.y - ROUNDEL.r, spring: ROUNDEL.y + ROUNDEL.r, apex: ROUNDEL.y + ROUNDEL.r};

/** How far a point of the glass lies from the edge of its pane, in units (capped at 40). */
function paneEdge(/** @type {number} */ x, /** @type {number} */ y) {
  if (insideArch(x, y, ROUNDEL_AS_ARCH) && Math.hypot(x - ROUNDEL.x, y - ROUNDEL.y) < ROUNDEL.r) {
    const d = ROUNDEL.r - Math.hypot(x - ROUNDEL.x, y - ROUNDEL.y);
    return Math.min(d, Math.abs(x - ROUNDEL.x), Math.abs(y - ROUNDEL.y));
  }
  const cx = x < 0 ? -LANCET.cx : LANCET.cx;
  let lo = 0;
  let hi = 40;
  if (!insideArch(x, y, LANCET, cx)) return 0;
  for (let i = 0; i < 8; i++) {
    const m = (lo + hi) / 2;
    if (insideArch(x, y, {hw: LANCET.hw - m, sill: LANCET.sill + m, spring: LANCET.spring, apex: LANCET.apex - m}, cx)) lo = m;
    else hi = m;
  }
  let d = lo;
  // the cames gather a thinner rim than the stone does
  for (const c of CAMES) d = Math.min(d, Math.abs(y - c) * 3 + 4);
  return d;
}

/**
 * The ashlar of the wall: the tone of the block at a point, and how near it lies to a joint.
 * @param {number} x @param {number} y
 */
function ashlar(x, y) {
  const course = 34;
  const row = Math.floor((y - WORLD.bottom) / course);
  const fy = (y - WORLD.bottom) / course - row;
  const rng = new Rng(row * 7919 + 13);
  const shift = rng.range(0, 90);
  let left = WORLD.left - shift;
  let width = rng.range(64, 112);
  while (left + width < x) {
    left += width;
    width = rng.range(64, 112);
  }
  const fx = (x - left) / width;
  const tone = rng.range(0.82, 1.18);
  const jointX = Math.min(fx * width, (1 - fx) * width);
  const jointY = Math.min(fy * course, (1 - fy) * course);
  return {tone, joint: Math.min(jointX, jointY), fy, id: row * 1000 + Math.round(left)};
}

/**
 * The room per pixel, straight RGBA floats: wall, reveal, sill face; the glass stays clear.
 * @param {Variant} variant
 */
function room(variant) {
  const img = new Float32Array(W * H * 4);
  const win = LIGHT[variant].window;
  for (let py = 0; py < H; py++) {
    const y = WORLD.top - (py + 0.5) / PX;
    for (let px = 0; px < W; px++) {
      const x = WORLD.left + (px + 0.5) / PX;
      const i = (py * W + px) * 4;
      const dv = Math.hypot(x - VENT.x, (y - VENT.y) * 1.25);
      let vent = 1.7 * Math.exp(-dv / 140) + 0.4 * Math.exp(-dv / 420);
      /** @type {RGB} */
      let albedo;
      /** @type {RGB} */
      let light = [0.018, 0.018, 0.026];
      if (insideArch(x, y, GLASS)) {
        img[i + 3] = 0;
        continue;
      }
      const grain = fbm(x * 0.05, y * 0.05, 11, 4);
      const fine = fbm(x * 0.3, y * 0.3, 12, 2);
      if (insideArch(x, y, REVEAL)) {
        // the reveal: dressed stone that slopes from the face of the wall to the glass
        const k = revealK(x, y);
        const onSill = y < windowAt(k).sill + 0.6;
        const tone = 0.9 + (grain - 0.5) * 0.35 + (fine - 0.5) * 0.12;
        albedo = [0.36 * tone, 0.33 * tone, 0.3 * tone];
        const near = (1 - k) ** 1.3;
        const amount = onSill ? 0.55 + near * 0.7 : 0.14 + near * 0.95;
        light = [light[0] + win[0] * amount, light[1] + win[1] * amount, light[2] + win[2] * amount];
        // the sill slab stands between the vent and the reveal: only its glow reaches up there
        vent *= onSill ? 0.22 : 0.3;
        // a shadow in the corner where the jamb meets the sill
        if (!onSill) {
          const corner = 1 - smoothstep(0, 26, y - windowAt(k).sill);
          light = [light[0] * (1 - corner * 0.5), light[1] * (1 - corner * 0.5), light[2] * (1 - corner * 0.5)];
        }
      } else if (Math.abs(x) < SILL_FACE.hw && y < SILL_FACE.top && y > SILL_FACE.bottom) {
        // the front face of the sill slab, right above the vent
        const tone = 0.95 + (grain - 0.5) * 0.3 + (fine - 0.5) * 0.12;
        albedo = [0.4 * tone, 0.36 * tone, 0.32 * tone];
        vent *= 1.25;
        const edge = smoothstep(SILL_FACE.top - 2.5, SILL_FACE.top, y);
        light = [light[0] + win[0] * edge * 0.6, light[1] + win[1] * edge * 0.6, light[2] + win[2] * edge * 0.6];
      } else {
        // the wall of ashlar, bevelled at the joints and lit from the vent below
        const a = ashlar(x, y);
        const mortar = 1 - smoothstep(0.6, 1.8, a.joint);
        const bevel = smoothstep(1.8, 5, a.joint);
        const blockNoise = fbm(x * 0.035 + a.id * 0.37, y * 0.035, 13, 4);
        const tone = a.tone * (0.85 + (blockNoise - 0.5) * 0.4 + (fine - 0.5) * 0.15);
        albedo = [0.27 * tone, 0.24 * tone, 0.21 * tone];
        albedo = [lerp(0.08, albedo[0], 1 - mortar), lerp(0.07, albedo[1], 1 - mortar), lerp(0.06, albedo[2], 1 - mortar)];
        // the lower edge of each block faces the vent and catches more of it, the upper less
        const facing = bevel < 1 ? (a.fy < 0.5 ? 1.5 : 0.55) : 1;
        vent *= lerp(facing, 1, bevel);
        // under the sill slab its shadow, cast by the vent's light from right below
        if (Math.abs(x) < SILL_FACE.hw + 6 && y < SILL_FACE.bottom && y > SILL_FACE.bottom - 10) vent *= 0.7;
        // the window spills a little onto the wall around the reveal
        const out = Math.max(0, revealDistance(x, y));
        const spill = 0.1 * Math.exp(-out / 70);
        light = [light[0] + win[0] * spill, light[1] + win[1] * spill, light[2] + win[2] * spill];
      }
      light = [light[0] + VENT_LIGHT[0] * vent, light[1] + VENT_LIGHT[1] * vent, light[2] + VENT_LIGHT[2] * vent];
      img[i] = albedo[0] * light[0];
      img[i + 1] = albedo[1] * light[1];
      img[i + 2] = albedo[2] * light[2];
      img[i + 3] = 1;
    }
  }
  return img;
}

/** A rough distance from a point outside the reveal to its outline, in units. */
function revealDistance(/** @type {number} */ x, /** @type {number} */ y) {
  const dx = Math.max(0, Math.abs(x) - REVEAL.hw);
  const dy =
    y < REVEAL.sill
      ? REVEAL.sill - y
      : y > REVEAL.spring
        ? Math.max(0, Math.hypot(x, y - REVEAL.spring) - (REVEAL.apex - REVEAL.spring))
        : 0;
  return Math.hypot(dx, dy);
}

/**
 * The glass, straight RGBA floats: frost or soot at the edges of the panes, a faint reflection of
 * the vent on the lower panes, clear in between.
 * @param {Variant} variant @param {Float32Array} img
 */
function glass(variant, img) {
  for (let py = 0; py < H; py++) {
    const y = WORLD.top - (py + 0.5) / PX;
    if (y < GLASS.sill || y > GLASS.apex) continue;
    for (let px = 0; px < W; px++) {
      const x = WORLD.left + (px + 0.5) / PX;
      if (!insideArch(x, y, GLASS)) continue;
      const i = (py * W + px) * 4;
      const edge = paneEdge(x, y);
      /** @type {RGB} */
      let c;
      let a;
      if (variant === 'snow') {
        // frost grows in from the edges of each pane, in feathers
        const feathers = fbm(x * 0.12, y * 0.12, 21, 5);
        const needles = fbm(x * 0.6 + y * 0.2, y * 0.6 - x * 0.2, 22, 2);
        const frost = 1 - smoothstep(2, 16, edge + (feathers - 0.5) * 22);
        a = sat(frost * (0.55 + needles * 0.4));
        c = [0.8, 0.86, 0.97];
      } else {
        // soot at the edges, running down the panes in streaks
        const smudge = fbm(x * 0.08, y * 0.08, 23, 5);
        const streak = fbm(x * 0.35, y * 0.015, 24, 3);
        const soot = 1 - smoothstep(1, 14, edge + (smudge - 0.5) * 18);
        a = sat(soot * 0.88 + smoothstep(0.6, 0.78, streak) * 0.45 + 0.08);
        c = [0.05, 0.035, 0.03];
      }
      // the vent's glow mirrored in the lower panes
      const reflect = 0.13 * Math.exp(-(y - GLASS.sill) / 55);
      const oa = a + reflect * (1 - a);
      img[i] = oa > 0 ? (c[0] * a + 1.0 * reflect * (1 - a)) / oa : 0;
      img[i + 1] = oa > 0 ? (c[1] * a + 0.5 * reflect * (1 - a)) / oa : 0;
      img[i + 2] = oa > 0 ? (c[2] * a + 0.2 * reflect * (1 - a)) / oa : 0;
      img[i + 3] = oa;
    }
  }
}

/**
 * The stone tracery, the lead, the things on the sill and the vent, as SVG.
 * @param {Variant} variant
 */
function propsSvg(variant) {
  const win = variant === 'snow' ? '#8a98d8' : '#e0603a';
  const defs = [
    el('filter', {id: 'soft', x: '-50%', y: '-50%', width: '200%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 3})),
    el('filter', {id: 'glow', x: '-50%', y: '-100%', width: '200%', height: '300%'}, el('feGaussianBlur', {stdDeviation: 14})),
    vgrad('tracery', GLASS.sill, GLASS.apex, [
      [0, '#5a3a24'],
      [0.25, '#2a221c'],
      [1, '#16130f'],
    ]),
    vgrad('hot', VENT.y - VENT.hh, VENT.y + VENT.hh, [
      [0, '#ff7a1e'],
      [0.5, '#ffd27a'],
      [1, '#ff8a2a'],
    ]),
    vgrad('iron', VENT.y - VENT.hh - 8, VENT.y + VENT.hh + 8, [
      [0, '#3a1e10'],
      [0.6, '#1a1210'],
      [1, '#2a1a12'],
    ]),
    el(
      'linearGradient',
      {id: 'brass', x1: 0, y1: 0, x2: 1, y2: 0},
      [
        el('stop', {offset: 0, 'stop-color': win, 'stop-opacity': 1}),
        el('stop', {offset: 0.12, 'stop-color': '#4a3418'}),
        el('stop', {offset: 0.55, 'stop-color': '#a8742e'}),
        el('stop', {offset: 0.8, 'stop-color': '#e8b060'}),
        el('stop', {offset: 1, 'stop-color': '#5a3a18'}),
      ].join(''),
    ),
    el('clipPath', {id: 'lancets'}, [
      el('path', {d: archPath(LANCET, -LANCET.cx)}),
      el('path', {d: archPath(LANCET, LANCET.cx)}),
    ]),
  ];
  // the tracery: the glass outline minus the two lancets and the roundel
  const tracery = el('path', {
    d: `${archPath(GLASS)}${archPath(LANCET, -LANCET.cx)}${archPath(LANCET, LANCET.cx)}M${n(ROUNDEL.x + ROUNDEL.r)} ${n(ROUNDEL.y)}A${n(ROUNDEL.r)} ${n(ROUNDEL.r)} 0 1 0 ${n(ROUNDEL.x - ROUNDEL.r)} ${n(ROUNDEL.y)}A${n(ROUNDEL.r)} ${n(ROUNDEL.r)} 0 1 0 ${n(ROUNDEL.x + ROUNDEL.r)} ${n(ROUNDEL.y)}Z`,
    fill: 'url(#tracery)',
    'fill-rule': 'evenodd',
  });
  // the light of the outside along the inner edges of the stone
  const rims = el('path', {
    d: `${archPath(LANCET, -LANCET.cx)}${archPath(LANCET, LANCET.cx)}`,
    stroke: win,
    'stroke-width': 1.4,
    fill: 'none',
    opacity: 0.45,
  });
  const roundelRim = el('circle', {
    cx: ROUNDEL.x,
    cy: ROUNDEL.y,
    r: ROUNDEL.r,
    stroke: win,
    'stroke-width': 1.4,
    fill: 'none',
    opacity: 0.45,
  });
  // the lead: cames across both lancets (clipped to them), a cross in the roundel
  const lead = [];
  for (const c of CAMES) {
    for (const cx of [-LANCET.cx, LANCET.cx]) lead.push(`M${n(cx - LANCET.hw)} ${n(c)}L${n(cx + LANCET.hw)} ${n(c)}`);
  }
  const roundelLead = el('path', {
    d: `M${n(ROUNDEL.x - ROUNDEL.r)} ${n(ROUNDEL.y)}L${n(ROUNDEL.x + ROUNDEL.r)} ${n(ROUNDEL.y)}M${n(ROUNDEL.x)} ${n(ROUNDEL.y - ROUNDEL.r)}L${n(ROUNDEL.x)} ${n(ROUNDEL.y + ROUNDEL.r)}`,
    stroke: '#0c0b0b',
    'stroke-width': 1.6,
  });
  const leadPath = el('path', {
    d: lead.join(''),
    stroke: '#0c0b0b',
    'stroke-width': 1.6,
    fill: 'none',
    'clip-path': 'url(#lancets)',
  });
  const leadHi = el('path', {
    d: lead.join(''),
    stroke: win,
    'stroke-width': 0.5,
    fill: 'none',
    opacity: 0.35,
    'clip-path': 'url(#lancets)',
  });

  // the urn on the sill, and a jar of dead flowers
  const urnY = GLASS.sill - 28;
  const urn = el('g', {transform: `translate(-128 ${urnY})`}, [
    el('ellipse', {cx: 6, cy: 0, rx: 30, ry: 5, fill: '#000', opacity: 0.5, filter: 'url(#soft)'}),
    el('path', {
      d: 'M-12 0L-14 4L14 4L12 0ZM-9 4C-22 14 -24 34 -14 48C-10 54 -8 56 -8 60L8 60C8 56 10 54 14 48C24 34 22 14 9 4Z',
      fill: 'url(#brass)',
    }),
    el('path', {d: 'M-10 60L10 60L12 64L-12 64ZM-6 64L-4 72L4 72L6 64Z', fill: 'url(#brass)'}),
    el('ellipse', {cx: 0, cy: 73, rx: 5, ry: 2.5, fill: '#e8b060'}),
    el('path', {d: 'M-19 28L19 28', stroke: '#2a1a0a', 'stroke-width': 1.2, opacity: 0.7}),
    el('path', {d: 'M-20 31L20 31', stroke: '#f0c070', 'stroke-width': 0.6, opacity: 0.5}),
  ]);
  const stems = [];
  const rng = new Rng(17);
  for (let i = 0; i < 7; i++) {
    const tx = rng.range(-14, 14);
    const ty = rng.range(40, 70);
    const bend = rng.range(-10, 10);
    stems.push(`M${n(rng.range(-3, 3))} 24Q${n(tx * 0.5 + bend)} ${n(ty * 0.6)} ${n(tx)} ${n(ty)}`);
  }
  const heads = [];
  for (let i = 0; i < 5; i++) {
    const hx = rng.range(-16, 16);
    const hy = rng.range(46, 72);
    // dead roses, their heads hanging
    heads.push(
      el('ellipse', {
        cx: hx,
        cy: hy,
        rx: 4,
        ry: 3,
        fill: '#2a0e0c',
        transform: `rotate(${n(rng.range(-40, 40))} ${n(hx)} ${n(hy)})`,
      }),
    );
  }
  const jar = el('g', {transform: `translate(132 ${n(GLASS.sill - 28)})`}, [
    el('ellipse', {cx: 4, cy: 0, rx: 18, ry: 3.5, fill: '#000', opacity: 0.5, filter: 'url(#soft)'}),
    el('path', {d: stems.join(''), stroke: '#2a2016', 'stroke-width': 1.3, fill: 'none'}),
    ...heads,
    el('path', {d: 'M-9 0L-10 22L-7 26L7 26L10 22L9 0Z', fill: '#3a4a48', opacity: 0.55}),
    el('path', {d: 'M-9 0L-10 22L-8 24L-6 2Z', fill: win, opacity: 0.35}),
    el('path', {d: 'M-9 8L9 8L9 0L-9 0Z', fill: '#1a1a14', opacity: 0.45}),
  ]);

  // the vent: an iron frame, bars, a scrolled boss in the middle, the furnace glowing behind
  const {x: vx, y: vy, hw, hh} = VENT;
  const bars = [];
  for (let bx = vx - hw + 9; bx < vx + hw - 4; bx += 9) bars.push(`M${n(bx)} ${n(vy - hh)}L${n(bx)} ${n(vy + hh)}`);
  const ventSvg = el('g', {}, [
    el('rect', {x: vx - hw - 10, y: vy - hh - 10, width: (hw + 10) * 2, height: (hh + 10) * 2, rx: 3, fill: 'url(#iron)'}),
    el('rect', {x: vx - hw, y: vy - hh, width: hw * 2, height: hh * 2, fill: 'url(#hot)'}),
    el('path', {d: bars.join(''), stroke: '#140c08', 'stroke-width': 3.6}),
    el('path', {d: bars.join(''), stroke: '#ffb060', 'stroke-width': 0.6, opacity: 0.5, transform: 'translate(1.6 0)'}),
    el('path', {d: `M${n(vx - hw)} ${n(vy)}L${n(vx + hw)} ${n(vy)}`, stroke: '#140c08', 'stroke-width': 4}),
    el('ellipse', {cx: vx, cy: vy, rx: 18, ry: 13, fill: '#1a100a', stroke: '#5a2e14', 'stroke-width': 1.5}),
    el('path', {
      d: `M${n(vx - 12)} ${n(vy)}C${n(vx - 12)} ${n(vy + 8)} ${n(vx)} ${n(vy + 8)} ${n(vx)} ${n(vy)}C${n(vx)} ${n(vy - 8)} ${n(vx + 12)} ${n(vy - 8)} ${n(vx + 12)} ${n(vy)}`,
      stroke: '#c0602a',
      'stroke-width': 1.4,
      fill: 'none',
      opacity: 0.8,
    }),
    // rivets
    ...[-1, 1].flatMap((sx) =>
      [-1, 1].map((sy) => el('circle', {cx: vx + sx * (hw + 5), cy: vy + sy * (hh + 5), r: 2, fill: '#6a3a1e'})),
    ),
  ]);
  const body = [tracery, rims, roundelRim, leadPath, leadHi, roundelLead, urn, jar, ventSvg];
  return worldDoc(defs, body);
}

/**
 * One of the two rooms: the interior around the window, see-through at the glass.
 * @param {Variant} variant
 */
export async function renderInterior(variant) {
  const img = room(variant);
  glass(variant, img);
  overRGBA(img, await rasterize(propsSvg(variant), W, H));
  // a vignette and a faint grain, the same in both
  const grain = new Rng(8);
  for (let py = 0, i = 0; py < H; py++) {
    const y = WORLD.top - (py + 0.5) / PX;
    for (let px = 0; px < W; px++, i += 4) {
      const x = WORLD.left + (px + 0.5) / PX;
      if (img[i + 3] === 0) continue;
      const v = 1 - smoothstep(380, 640, Math.hypot(x * 0.8, y * 1.15)) * 0.65;
      const g = (grain.next() - 0.5) * 0.02;
      // the glass stays as it is: frost and soot are not part of the room's falloff
      const solid = img[i + 3] >= 0.999;
      img[i] = solid ? img[i] * v + g : img[i];
      img[i + 1] = solid ? img[i + 1] * v + g : img[i + 1];
      img[i + 2] = solid ? img[i + 2] * v + g : img[i + 2];
    }
  }
  return {image: await encodeWebpRGBA(img, W, H), width: W, height: H};
}

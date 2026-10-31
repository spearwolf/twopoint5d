// stage-masks/spotlight: "Ward C, 3:07 a.m." — the flooded corridor of an abandoned asylum, top
// down with the north wall seen face on. The floor is shaded per pixel (tiles, grout, missing
// tiles, grime, the depth of the water); what lies under the water is drawn as SVG before the water
// tints it, the walls and what stands in the water after.
import {fbm, Rng} from '../../lib/image.mjs';
import {
  blobPath,
  blurFilter,
  el,
  IMG_H,
  IMG_W,
  lerp,
  mixc,
  n,
  over,
  PX,
  poly,
  rasterize,
  rgb,
  sat,
  smoothstep,
  strokeText,
  svgDoc,
  WORLD,
  wobblyRing,
  X,
  Y,
} from './svg.mjs';

/** @typedef {import('./svg.mjs').RGB} RGB */

/** the floor between the walls, in units */
export const FLOOR_TOP = 175;
export const FLOOR_BOTTOM = -250;
const WALL_TOP = 275;

/** where the two wall lamps hang, in units: the mask stage of the demo puts its lamps there */
export const WALL_LAMPS = [
  [-290, 232],
  [330, 232],
];

const TILE = 22;

const C = {
  tile: rgb('#a3b5a6'),
  tileWarm: rgb('#b4b59c'),
  border: rgb('#3e5a4b'),
  grout: rgb('#3a443e'),
  concrete: rgb('#4b4a43'),
  rust: rgb('#5e3a20'),
  water: rgb('#0a1c1a'),
  algae: rgb('#23392a'),
};

/** @param {number} x @param {number} y @param {number} seed */
function hash(x, y, seed) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The tiled floor, dry: per pixel, (u, v) in units.
 * @param {number} u @param {number} v @returns {RGB}
 */
function shadeTiles(u, v) {
  const i = Math.floor(u / TILE);
  const j = Math.floor(v / TILE);
  const fx = u / TILE - i;
  const fy = v / TILE - j;
  const edge = Math.min(fx, 1 - fx, fy, 1 - fy) * TILE;
  const h = hash(i, j, 3);
  const border = (v > 146 && v < 168) || (v < -226 && v > -248);
  // tiles that came away, in clusters
  const missing = fbm(i * 0.31, j * 0.31, 41, 3) > 0.66 && h > 0.25;

  if (missing) {
    // concrete with a crust of tile cement, a little lower than the tiles around it
    const g = fbm(u / 3, v / 3, 77, 4);
    /** @type {RGB} */
    let col = mixc(C.concrete, rgb('#6c6a5f'), g * 0.6);
    col = mixc(col, rgb('#2b2a26'), (1 - smoothstep(0, 1.6, edge)) * 0.7);
    return col;
  }

  /** @type {RGB} */
  let col = mixc(C.tile, C.tileWarm, hash(i, j, 9) * 0.6);
  if (border) col = mixc(C.border, rgb('#4d6a59'), h * 0.5);
  const k = 0.88 + 0.16 * h;
  col = [col[0] * k, col[1] * k, col[2] * k];
  // the glaze: a bevel at the rim, a soft sheen across the face, a few pits
  const bevel = smoothstep(0, 2.2, edge);
  const lit = fy > 0.5 ? 1.04 : 0.98;
  const sheen = 1 + 0.05 * Math.sin((fx + fy) * 3.1);
  const pit = hash(Math.floor(u * 1.7), Math.floor(v * 1.7), 13) > 0.996 ? 0.6 : 1;
  const m = (0.82 + 0.18 * bevel) * lit * sheen * pit;
  col = [col[0] * m, col[1] * m, col[2] * m];
  // a hairline crack through some tiles
  if (hash(i, j, 21) > 0.86) {
    const a = hash(i, j, 22) * Math.PI;
    const d = Math.abs((fx - 0.5) * Math.sin(a) - (fy - 0.5) * Math.cos(a) + 0.08 * Math.sin(fx * 9 + fy * 7));
    col = mixc(col, C.grout, (1 - smoothstep(0.006, 0.02, d)) * 0.8);
  }
  // grout
  const g = 1 - smoothstep(0.25, 0.8, edge);
  return mixc(col, C.grout, g * 0.85);
}

/**
 * The whole floor with its dirt, before anything lies on it.
 * @param {number} u @param {number} v @returns {RGB}
 */
function shadeFloor(u, v) {
  let col = shadeTiles(u, v);
  // grime in layers: broad dirt, finer smudges, rust blooms around the drain and the gurney
  const broad = fbm(u / 70, v / 70, 7, 5);
  const fine = fbm(u / 9, v / 9, 8, 3);
  const k = 0.62 + 0.42 * broad + 0.12 * (fine - 0.5);
  col = [col[0] * k, col[1] * k, col[2] * k];
  const rust = smoothstep(0.66, 0.82, fbm(u / 40, v / 40, 11, 5)) * smoothstep(0.4, 0.7, broad);
  col = mixc(col, C.rust, rust * 0.45);
  const nearDrain = 1 - smoothstep(10, 60, Math.hypot(u - 40, v + 25));
  col = mixc(col, rgb('#4a2c15'), nearDrain * 0.55 * fine);
  return col;
}

/**
 * The water over the floor: deeper in some places, where the tiles go dark green; algae along the
 * walls; the contact shadow under the north wall.
 * @param {RGB} col @param {number} u @param {number} v @returns {RGB}
 */
function underWater(col, u, v) {
  const depth = fbm(u / 160 + 3.1, v / 160, 21, 5);
  const w = 0.28 + 0.6 * smoothstep(0.38, 0.8, depth);
  let c = mixc(col, C.water, w);
  const nearWall = Math.max(1 - smoothstep(0, 26, FLOOR_TOP - v), 1 - smoothstep(0, 20, v - FLOOR_BOTTOM));
  c = mixc(c, C.algae, nearWall * 0.5 * fbm(u / 14, v / 14, 31, 3));
  // the north wall's contact shadow, and the cool of the water
  const shadow = 0.55 + 0.45 * smoothstep(0, 34, FLOOR_TOP - v);
  return [c[0] * shadow * 0.96, c[1] * shadow, c[2] * shadow * 1.02];
}

// ---------------------------------------------------------------- SVG: under the water

/** @param {Rng} rng */
function submerged(rng) {
  const out = [];
  // patient records that sank, the ink run
  for (let k = 0; k < 9; k++) {
    const x = X(rng.range(-520, 520));
    const y = Y(rng.range(-230, 140));
    const rot = rng.range(0, 360);
    const lines = [];
    for (let l = 0; l < 7; l++) {
      lines.push(
        el('path', {
          d: `M${n(-14)} ${n(-18 + l * 5.5)}h${n(rng.range(14, 28))}`,
          stroke: '#3c4a55',
          'stroke-width': 1.4,
          opacity: 0.55,
        }),
      );
    }
    out.push(
      el('g', {transform: `translate(${n(x)} ${n(y)}) rotate(${n(rot)})`, opacity: rng.range(0.45, 0.7)}, [
        el('rect', {x: -20, y: -26, width: 40, height: 52, fill: '#d9d6c7', rx: 1}),
        el('rect', {x: -20, y: -26, width: 40, height: 8, fill: '#a99b7c'}),
        ...lines,
      ]),
    );
  }
  // pills, spilled from a tray
  for (let k = 0; k < 26; k++) {
    const x = X(lerp(-30, 60, rng.next()) + rng.range(-20, 20));
    const y = Y(lerp(-170, -120, rng.next()));
    out.push(
      el('ellipse', {
        cx: x,
        cy: y,
        rx: 3.2,
        ry: 1.8,
        fill: rng.pick(['#d9c9b0', '#c96f4d', '#e1dccb']),
        transform: `rotate(${n(rng.range(0, 180))} ${n(x)} ${n(y)})`,
        opacity: 0.75,
      }),
    );
  }
  out.push(
    el('rect', {
      x: X(-5),
      y: Y(-142),
      width: 54,
      height: 34,
      rx: 5,
      fill: 'none',
      stroke: '#9aa3a6',
      'stroke-width': 3,
      transform: `rotate(-18 ${n(X(8))} ${n(Y(-150))})`,
      opacity: 0.7,
    }),
  );
  // tally marks spilled from the wall onto the floor, in grease pencil
  out.push(tallyMarks(rng, 205, 320, 166, 146, 15, '#3a1612', 0.75, 2.2));
  // a long crack along the corridor
  /** @type {[number, number][]} */
  const crack = [];
  let cy = -60;
  for (let x = -600; x <= 600; x += 18) {
    cy += rng.range(-9, 9);
    crack.push([X(x), Y(cy)]);
  }
  out.push(el('path', {d: poly(crack, false), stroke: '#151a17', 'stroke-width': 2.4, fill: 'none', opacity: 0.8}));
  return out;
}

/**
 * Rows of tally marks in groups of five, in a box from (x0, yTop) to (x1, yBottom) in units.
 * @param {Rng} rng @param {number} x0 @param {number} x1 @param {number} yTop @param {number} yBottom
 * @param {number} height of a mark in units @param {string} colour @param {number} opacity
 * @param {number} width of the stroke in pixels
 */
function tallyMarks(rng, x0, x1, yTop, yBottom, height, colour, opacity, width) {
  let d = '';
  const h = height * PX;
  for (let y = Y(yTop) + h * 0.15; y + h <= Y(yBottom); y += h * 1.35) {
    for (let x = X(x0); x + h * 0.9 < X(x1); x += h * 1.15) {
      if (rng.next() < 0.06) continue;
      const lean = rng.range(-0.12, 0.12) * h;
      for (let s = 0; s < 4; s++) {
        const sx = x + s * h * 0.2 + rng.range(-1, 1);
        d += `M${n(sx + lean)} ${n(y + rng.range(-1.5, 1.5))}L${n(sx - lean + rng.range(-1, 1))} ${n(y + h + rng.range(-1.5, 1.5))}`;
      }
      d += `M${n(x - h * 0.12)} ${n(y + h * 0.75 + rng.range(-2, 2))}L${n(x + h * 0.78)} ${n(y + h * 0.2 + rng.range(-2, 2))}`;
    }
  }
  return el('path', {d, stroke: colour, 'stroke-width': width, 'stroke-linecap': 'round', fill: 'none', opacity});
}

// ---------------------------------------------------------------- SVG: the walls

/** @param {Rng} rng */
function northWall(rng) {
  const out = [];
  const yCap = Y(WALL_TOP);
  const yRail = Y(220);
  const yTiles = Y(217);
  const yFloor = Y(FLOOR_TOP);
  // the top of the wall, in the dark above the face
  out.push(el('rect', {x: 0, y: 0, width: IMG_W, height: yCap, fill: '#121514'}));
  out.push(el('rect', {x: 0, y: yCap - 6, width: IMG_W, height: 6, fill: '#2a302c'}));
  // the plaster, damp at the top, with stains and peeling paint
  out.push(el('rect', {x: 0, y: yCap, width: IMG_W, height: yRail - yCap, fill: 'url(#plaster)'}));
  for (let k = 0; k < 22; k++) {
    const x = rng.range(0, IMG_W);
    out.push(
      el('ellipse', {
        cx: x,
        cy: rng.range(yCap, yRail),
        rx: rng.range(20, 90),
        ry: rng.range(14, 50),
        fill: rng.pick(['#5d5338', '#4a4a33', '#6b5a3a']),
        opacity: rng.range(0.15, 0.35),
        filter: 'url(#blur8)',
      }),
    );
  }
  // grime run down the plaster
  for (let k = 0; k < 60; k++) {
    out.push(
      el('rect', {
        x: rng.range(0, IMG_W),
        y: yCap,
        width: rng.range(2, 9),
        height: rng.range(30, yRail - yCap),
        fill: '#3d3826',
        opacity: rng.range(0.08, 0.22),
        filter: 'url(#blur2)',
      }),
    );
  }
  // drips from the pipe joints
  for (let x = 140; x < IMG_W; x += 280) {
    for (let s = 0; s < 3; s++) {
      const dx = x + rng.range(-18, 18);
      out.push(
        el('rect', {
          x: dx,
          y: Y(262),
          width: rng.range(3, 7),
          height: rng.range(40, 110),
          fill: '#3b2f1d',
          opacity: rng.range(0.25, 0.45),
          filter: 'url(#blur2)',
        }),
      );
    }
  }
  for (let k = 0; k < 14; k++) {
    const cx = rng.range(0, IMG_W);
    const cy = rng.range(yCap + 20, yRail - 12);
    const pts = wobblyRing(rng, cx, cy, rng.range(8, 26), rng.range(5, 15), 0.6, 15);
    const d = blobPath(pts);
    out.push(el('path', {d, fill: '#000', opacity: 0.35, transform: 'translate(2 3)', filter: 'url(#blur2)'}));
    out.push(el('path', {d, fill: '#706853'}));
    out.push(el('path', {d, fill: 'none', stroke: '#d6d2ae', 'stroke-width': 1.6, opacity: 0.8}));
  }
  // the pipe along the top of the face
  const pipeY = Y(266);
  out.push(el('rect', {x: 0, y: pipeY + 6, width: IMG_W, height: 6, fill: '#000', opacity: 0.35, filter: 'url(#blur2)'}));
  out.push(el('rect', {x: 0, y: pipeY - 7, width: IMG_W, height: 14, fill: 'url(#pipe)'}));
  for (let x = 140; x < IMG_W; x += 280) {
    out.push(el('rect', {x: x - 8, y: pipeY - 10, width: 16, height: 20, fill: '#3b3027', rx: 2}));
    out.push(el('rect', {x: x - 8, y: pipeY - 10, width: 16, height: 4, fill: '#6b5a48', rx: 1}));
  }
  // the rail and the tiled wainscot
  out.push(el('rect', {x: 0, y: yRail, width: IMG_W, height: yTiles - yRail, fill: '#2c4436'}));
  out.push(el('rect', {x: 0, y: yRail, width: IMG_W, height: 2, fill: '#7f9a86'}));
  out.push(el('rect', {x: 0, y: yTiles, width: IMG_W, height: yFloor - yTiles, fill: '#1e2924'}));
  const tw = 16 * PX;
  const th = 7 * PX;
  for (let row = 0, y = yTiles + 1; y < yFloor; row++, y += th) {
    for (let x = row % 2 ? -tw / 2 : 0; x < IMG_W; x += tw) {
      if (rng.next() < 0.04) continue;
      const shade = rng.range(0.85, 1.12);
      const base = rgb('#3d6150');
      const fill = `rgb(${base.map((c) => Math.round(sat(c * shade) * 255)).join(',')})`;
      out.push(el('rect', {x: x + 1, y: y + 1, width: tw - 2, height: th - 2, rx: 1.5, fill}));
      out.push(el('rect', {x: x + 2, y: y + 1.5, width: tw - 4, height: 1.6, fill: '#a9c9b4', opacity: 0.45}));
    }
  }
  // the tide line the water left, and the stain under it
  out.push(el('rect', {x: 0, y: Y(196), width: IMG_W, height: yFloor - Y(196), fill: '#1f2614', opacity: 0.45}));
  out.push(el('rect', {x: 0, y: Y(197), width: IMG_W, height: 5, fill: '#4f3f22', opacity: 0.55, filter: 'url(#blur2)'}));
  out.push(el('rect', {x: 0, y: yFloor - 3, width: IMG_W, height: 3, fill: '#0a0d0b'}));
  return out;
}

/**
 * A cell door in the north wall, its leaf from the floor up; `open` shows the dark behind it.
 * @param {Rng} rng @param {number} cx in units @param {string} label @param {boolean} open
 */
function cellDoor(rng, cx, label, open) {
  const w = 62 * PX;
  const h = 90 * PX;
  const x = X(cx) - w / 2;
  const y = Y(FLOOR_TOP) - h;
  const out = [];
  out.push(el('rect', {x: x - 9, y: y - 9, width: w + 18, height: h + 9, fill: '#1b211e'}));
  out.push(el('rect', {x: x - 9, y: y - 9, width: w + 18, height: 3, fill: '#55625a'}));
  if (open) {
    out.push(el('rect', {x, y, width: w, height: h, fill: 'url(#void)'}));
    // the leaf swung in, seen edge on
    out.push(
      el('path', {
        d: poly([
          [x, y],
          [x + 26, y + 22],
          [x + 26, y + h - 6],
          [x, y + h],
        ]),
        fill: '#2f3a33',
      }),
    );
    out.push(
      el('path', {
        d: poly([
          [x + 24, y + 22],
          [x + 28, y + 24],
          [x + 28, y + h - 8],
          [x + 24, y + h - 6],
        ]),
        fill: '#5b6a60',
      }),
    );
    // the water runs on into the cell
    out.push(el('rect', {x: x + 26, y: y + h - 14, width: w - 26, height: 14, fill: '#0d1716', opacity: 0.9}));
    return out;
  }
  out.push(el('rect', {x, y, width: w, height: h, fill: 'url(#doorPaint)'}));
  // scuffs and scratches
  for (let k = 0; k < 26; k++) {
    const sx = x + rng.range(6, w - 6);
    const sy = y + rng.range(10, h - 10);
    out.push(
      el('path', {
        d: `M${n(sx)} ${n(sy)}l${n(rng.range(-10, 10))} ${n(rng.range(-3, 3))}`,
        stroke: rng.next() < 0.5 ? '#9fb0a4' : '#262d29',
        'stroke-width': 1,
        opacity: 0.5,
      }),
    );
  }
  out.push(el('rect', {x, y: y + h - 36, width: w, height: 36, fill: 'url(#doorRust)'}));
  // rivets
  for (let k = 0; k < 9; k++) {
    for (const rx of [x + 6, x + w - 6]) {
      const ry = y + 10 + (k * (h - 20)) / 8;
      out.push(el('circle', {cx: rx, cy: ry, r: 2.2, fill: '#2c3530'}));
      out.push(el('circle', {cx: rx - 0.6, cy: ry - 0.6, r: 1, fill: '#a3b2a8'}));
    }
  }
  // the viewing hatch and its slide
  out.push(el('rect', {x: x + w / 2 - 24, y: y + 26, width: 48, height: 16, fill: '#0b0d0c', rx: 2}));
  out.push(
    el('rect', {
      x: x + w / 2 - 28,
      y: y + 22,
      width: 30,
      height: 24,
      fill: '#4c5a51',
      stroke: '#26302a',
      'stroke-width': 1.5,
      rx: 2,
    }),
  );
  // the bolt
  out.push(
    el('rect', {
      x: x + w - 26,
      y: y + h / 2 - 6,
      width: 34,
      height: 12,
      fill: '#6f7772',
      stroke: '#252b27',
      'stroke-width': 1.5,
      rx: 2,
    }),
  );
  out.push(el('rect', {x: x + w - 12, y: y + h / 2 - 12, width: 8, height: 24, fill: '#3b433e', rx: 1}));
  // the stencilled number
  out.push(
    el('path', {
      d: strokeText(label, x + 22, y + 62, 22, {spacing: 0.35}),
      stroke: '#c9cdb5',
      'stroke-width': 3.2,
      'stroke-linecap': 'square',
      fill: 'none',
      opacity: 0.75,
    }),
  );
  return out;
}

/** A caged lamp on a bracket, unlit: the demo lights it. @param {number} cx @param {number} cy in units */
function wallLamp(cx, cy) {
  const x = X(cx);
  const y = Y(cy);
  const bars = [];
  for (let k = -2; k <= 2; k++) {
    bars.push(
      el('ellipse', {cx: x, cy: y, rx: Math.abs(k) * 5.2 + 0.5, ry: 26, fill: 'none', stroke: '#1d1d1b', 'stroke-width': 2}),
    );
  }
  return [
    el('ellipse', {cx: x + 4, cy: y + 30, rx: 26, ry: 8, fill: '#000', opacity: 0.45, filter: 'url(#blur4)'}),
    el('rect', {x: x - 12, y: y - 38, width: 24, height: 12, fill: '#2b2723', rx: 2}),
    el('rect', {x: x - 3, y: y - 30, width: 6, height: 8, fill: '#3a342c'}),
    el('circle', {cx: x, cy: y, r: 22, fill: 'url(#bulb)'}),
    ...bars,
    el('circle', {cx: x, cy: y, r: 26, fill: 'none', stroke: '#1d1d1b', 'stroke-width': 3}),
    el('path', {d: `M${n(x - 26)} ${n(y)}h52`, stroke: '#1d1d1b', 'stroke-width': 2.5}),
  ];
}

function southWall() {
  const y = Y(FLOOR_BOTTOM);
  return [
    el('rect', {x: 0, y: y - 14, width: IMG_W, height: 16, fill: '#000', opacity: 0.4, filter: 'url(#blur4)'}),
    el('rect', {x: 0, y, width: IMG_W, height: IMG_H - y, fill: '#111413'}),
    el('rect', {x: 0, y, width: IMG_W, height: 4, fill: '#46504a'}),
    el('rect', {x: 0, y: y + 4, width: IMG_W, height: 10, fill: '#1d2320'}),
  ];
}

// ---------------------------------------------------------------- SVG: what stands in the water

/** A soft shadow under a prop, in local pixels. @param {number} w @param {number} h */
const propShadow = (w, h, dx = 6, dy = 10) =>
  el('ellipse', {cx: dx, cy: dy, rx: w / 2, ry: h / 2, fill: '#000', opacity: 0.55, filter: 'url(#blur8)'});

/** a chrome tube: a dark core with a light line on it */
const tube = (/** @type {string} */ d, /** @type {number} */ w = 5) => [
  el('path', {d, stroke: '#1c1f20', 'stroke-width': w + 2.5, fill: 'none', 'stroke-linecap': 'round'}),
  el('path', {d, stroke: '#9aa2a4', 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round'}),
  el('path', {d, stroke: '#e3e8e8', 'stroke-width': w * 0.3, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8}),
];

/** An overturned wheelchair lying on its side, the big wheel up. */
function wheelchair() {
  const spokes = [];
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    spokes.push(
      el('path', {
        d: `M${n(Math.cos(a) * 7)} ${n(Math.sin(a) * 7)}L${n(Math.cos(a + 0.35) * 52)} ${n(Math.sin(a + 0.35) * 52)}`,
        stroke: '#b5bcbe',
        'stroke-width': 1.1,
      }),
    );
  }
  return el('g', {transform: `translate(${n(X(-405))} ${n(Y(-135))}) rotate(22)`}, [
    propShadow(260, 150, 50, 14),
    // the far wheel under it
    el('circle', {cx: 22, cy: 16, r: 58, fill: 'none', stroke: '#0e0f0f', 'stroke-width': 10, opacity: 0.85}),
    // seat and back, oxblood vinyl split at the seams
    el('path', {
      d: poly([
        [20, -46],
        [128, -40],
        [132, 44],
        [24, 50],
      ]),
      fill: '#3f211c',
      stroke: '#1a0d0b',
      'stroke-width': 2,
    }),
    el('path', {
      d: poly([
        [30, -34],
        [118, -30],
        [120, 32],
        [32, 38],
      ]),
      fill: '#5a2c25',
    }),
    el('path', {d: 'M58 -30 Q70 0 60 34', stroke: '#2a1310', 'stroke-width': 2, fill: 'none'}),
    el('path', {d: 'M90 -28 L96 -10 L86 6', stroke: '#c9b9a2', 'stroke-width': 1.5, fill: 'none', opacity: 0.6}),
    ...tube('M14 -48 L140 -42 L156 -30'),
    ...tube('M18 52 L142 46 L160 36'),
    ...tube('M140 -42 L142 46', 4),
    // the footplates and the casters pointing up
    el('rect', {x: 152, y: -40, width: 20, height: 28, fill: '#3b3f40', stroke: '#141616', 'stroke-width': 2, rx: 2}),
    el('rect', {x: 156, y: 12, width: 20, height: 28, fill: '#3b3f40', stroke: '#141616', 'stroke-width': 2, rx: 2}),
    el('ellipse', {cx: 146, cy: -54, rx: 11, ry: 6, fill: '#202222', stroke: '#565b5c', 'stroke-width': 2}),
    el('ellipse', {cx: 148, cy: 58, rx: 11, ry: 6, fill: '#202222', stroke: '#565b5c', 'stroke-width': 2}),
    // the near wheel: tyre, rim, spokes, push rim, hub
    el('circle', {cx: 0, cy: 0, r: 60, fill: 'none', stroke: '#141414', 'stroke-width': 11}),
    el('circle', {cx: 0, cy: 0, r: 60, fill: 'none', stroke: '#2e2f2f', 'stroke-width': 2}),
    el('circle', {cx: 0, cy: 0, r: 53, fill: 'none', stroke: '#8d9496', 'stroke-width': 3.5}),
    ...spokes,
    el('circle', {cx: 0, cy: 0, r: 66, fill: 'none', stroke: '#1a1c1c', 'stroke-width': 4.5}),
    el('circle', {cx: 0, cy: 0, r: 66, fill: 'none', stroke: '#c9cfcf', 'stroke-width': 2}),
    el('circle', {cx: 0, cy: 0, r: 9, fill: '#4a4f50', stroke: '#c0c6c7', 'stroke-width': 2}),
    el('circle', {cx: -2, cy: -2, r: 3, fill: '#e8eded'}),
  ]);
}

/** A gurney at an angle, the sheet sliding off, the straps undone. */
function gurney() {
  const stains = [
    el('ellipse', {cx: 30, cy: 6, rx: 34, ry: 18, fill: '#5d4630', opacity: 0.5, filter: 'url(#blur4)'}),
    el('ellipse', {cx: -60, cy: -14, rx: 16, ry: 10, fill: '#4b3424', opacity: 0.45, filter: 'url(#blur4)'}),
  ];
  return el('g', {transform: `translate(${n(X(215))} ${n(Y(-30))}) rotate(-12)`}, [
    propShadow(280, 130, 10, 16),
    // wheels at the corners
    ...[
      [-118, -46],
      [118, -46],
      [-118, 46],
      [118, 46],
    ].map(([wx, wy]) => el('circle', {cx: wx, cy: wy, r: 8, fill: '#151717', stroke: '#4c5253', 'stroke-width': 2})),
    ...tube('M-122 -50 H122 V50 H-122 Z', 5),
    el('rect', {x: -114, y: -42, width: 228, height: 84, rx: 10, fill: '#7f9196'}),
    el('rect', {x: -114, y: -42, width: 228, height: 84, rx: 10, fill: 'none', stroke: '#33403f', 'stroke-width': 2}),
    ...stains,
    // the pillow at the head
    el('rect', {x: -108, y: -32, width: 44, height: 64, rx: 12, fill: '#c9cbc2', stroke: '#8d8f86', 'stroke-width': 1.5}),
    // the sheet, half off, hanging over the foot end into the water
    el('path', {
      d: 'M-40 -44 C10 -50 70 -40 116 -46 C132 -20 136 20 118 48 C80 52 20 44 -36 46 C-46 20 -50 -10 -40 -44 Z',
      fill: '#d4d4cb',
    }),
    el('path', {d: 'M116 -46 C150 -40 170 -10 166 20 C160 44 140 58 118 48 C136 20 132 -20 116 -46 Z', fill: '#b8bab1'}),
    el('path', {
      d: 'M-20 -30 C20 -10 50 -20 90 -8 M-28 20 C10 30 60 18 104 30 M40 -42 C46 -10 40 20 50 44',
      stroke: '#9c9e95',
      'stroke-width': 2,
      fill: 'none',
    }),
    // the restraint straps, undone, the ends hanging off the sides
    ...[-70, 54].map((sx) =>
      el('g', {}, [
        el('rect', {x: sx, y: -50, width: 15, height: 100, fill: '#4f3520', stroke: '#24170c', 'stroke-width': 1.5}),
        el('rect', {x: sx - 2, y: -14, width: 19, height: 14, fill: 'none', stroke: '#c3c7c4', 'stroke-width': 2.5, rx: 2}),
        el('path', {
          d: `M${sx + 7} 50 C${sx + 4} 66 ${sx + 16} 80 ${sx + 10} 96`,
          stroke: '#4f3520',
          'stroke-width': 13,
          fill: 'none',
        }),
        el('path', {
          d: `M${sx + 7} -50 C${sx + 12} -62 ${sx} -74 ${sx + 4} -84`,
          stroke: '#4f3520',
          'stroke-width': 13,
          fill: 'none',
        }),
      ]),
    ),
  ]);
}

/** A drip stand that fell over, its bag burst. */
function ivStand() {
  const legs = [];
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 + 0.3;
    legs.push(...tube(`M0 0 L${n(Math.cos(a) * 26)} ${n(Math.sin(a) * 26)}`, 3.5));
    legs.push(el('circle', {cx: Math.cos(a) * 28, cy: Math.sin(a) * 28, r: 4, fill: '#1a1b1b'}));
  }
  return el('g', {transform: `translate(${n(X(300))} ${n(Y(-118))}) rotate(-36)`}, [
    el('path', {d: 'M0 6 L210 6', stroke: '#000', 'stroke-width': 6, opacity: 0.45, filter: 'url(#blur4)'}),
    ...legs,
    ...tube('M0 0 L210 0', 3.5),
    ...tube('M210 -24 L210 24', 3),
    el('path', {
      d: 'M226 30 q16 4 22 -6 q2 -14 -10 -20 q-14 -2 -16 10 z',
      fill: '#c8d3cf',
      opacity: 0.55,
      stroke: '#7d8885',
      'stroke-width': 1,
    }),
    el('path', {d: 'M226 20 C240 40 236 60 250 72', stroke: '#c4cccb', 'stroke-width': 1.5, fill: 'none', opacity: 0.7}),
  ]);
}

/** A steel chair knocked onto its back. */
function chair() {
  return el('g', {transform: `translate(${n(X(-150))} ${n(Y(72))}) rotate(-34)`}, [
    propShadow(110, 90, 6, 10),
    el('rect', {x: -36, y: -30, width: 56, height: 60, fill: '#5c6b5f', stroke: '#1e2420', 'stroke-width': 2, rx: 4}),
    el('rect', {x: 26, y: -32, width: 26, height: 64, fill: '#4b584e', stroke: '#1e2420', 'stroke-width': 2, rx: 3}),
    ...tube('M-34 -30 L-46 -40', 4),
    ...tube('M-34 30 L-46 40', 4),
    ...tube('M18 -30 L30 -40', 4),
    ...tube('M18 30 L30 40', 4),
    el('circle', {cx: -47, cy: -41, r: 3.5, fill: '#121313'}),
    el('circle', {cx: -47, cy: 41, r: 3.5, fill: '#121313'}),
    el('circle', {cx: 31, cy: -41, r: 3.5, fill: '#121313'}),
    el('circle', {cx: 31, cy: 41, r: 3.5, fill: '#121313'}),
  ]);
}

/** A yellow mop bucket and its mop. */
function mopBucket() {
  return el('g', {transform: `translate(${n(X(465))} ${n(Y(-178))}) rotate(8)`}, [
    propShadow(120, 90, 6, 10),
    el('rect', {x: -48, y: -38, width: 96, height: 76, rx: 14, fill: '#b9922a', stroke: '#4a3a10', 'stroke-width': 3}),
    el('rect', {x: -40, y: -30, width: 56, height: 60, rx: 10, fill: '#1b2420'}),
    el('ellipse', {cx: -16, cy: -6, rx: 16, ry: 9, fill: '#3b4b44', opacity: 0.6}),
    el('rect', {x: 20, y: -30, width: 22, height: 60, rx: 4, fill: '#8a6c1d', stroke: '#4a3a10', 'stroke-width': 2}),
    el('path', {d: 'M24 -22 h14 M24 -12 h14 M24 -2 h14 M24 8 h14 M24 18 h14', stroke: '#4a3a10', 'stroke-width': 2}),
    ...tube('M-12 0 L-180 70', 5),
    el('path', {
      d: 'M-178 60 c-16 -4 -34 6 -40 18 c-6 14 6 30 22 30 c20 -2 30 -14 30 -28 c0 -10 -6 -18 -12 -20 z',
      fill: '#8f8a78',
      stroke: '#4c4838',
      'stroke-width': 2,
    }),
    el('path', {
      d: 'M-200 70 c-4 10 -2 22 6 28 M-190 64 c-2 14 0 26 8 32 M-180 66 c0 12 4 22 12 26',
      stroke: '#5f5a49',
      'stroke-width': 2,
      fill: 'none',
    }),
  ]);
}

/** Where the ceiling came down: tiles of it, plaster, a broken tube. @param {Rng} rng */
function ceilingFall(rng) {
  const out = [el('ellipse', {cx: X(-140), cy: Y(-188), rx: 120, ry: 60, fill: '#d8d4c4', opacity: 0.18, filter: 'url(#blur8)'})];
  for (let k = 0; k < 9; k++) {
    const x = X(-140 + rng.range(-60, 60));
    const y = Y(-188 + rng.range(-28, 28));
    const s = rng.range(18, 34);
    const pts = /** @type {[number, number][]} */ ([
      [-s, -s * rng.range(0.6, 1)],
      [s * rng.range(0.5, 1), -s],
      [s, s * rng.range(0.2, 0.9)],
      [-s * rng.range(0.3, 0.9), s],
    ]);
    const holes = [];
    for (let h = 0; h < 10; h++) {
      holes.push(el('circle', {cx: rng.range(-s * 0.6, s * 0.6), cy: rng.range(-s * 0.6, s * 0.6), r: 1.1, fill: '#8d8a7d'}));
    }
    out.push(
      el('g', {transform: `translate(${n(x)} ${n(y)}) rotate(${n(rng.range(0, 360))})`}, [
        el('path', {d: poly(pts), fill: '#000', opacity: 0.45, transform: 'translate(3 5)', filter: 'url(#blur2)'}),
        el('path', {d: poly(pts), fill: rng.pick(['#cfcab8', '#c2bda9', '#b5af99']), stroke: '#6d695c', 'stroke-width': 1.5}),
        ...holes,
      ]),
    );
  }
  for (let k = 0; k < 16; k++) {
    const x = X(-140 + rng.range(-80, 80));
    const y = Y(-188 + rng.range(-40, 40));
    const pts = wobblyRing(rng, x, y, rng.range(4, 10), rng.range(3, 8), 0.4, 6);
    out.push(el('path', {d: poly(pts), fill: rng.pick(['#7c7a70', '#8f8b7e', '#5d5b53']), stroke: '#2e2d29', 'stroke-width': 1}));
  }
  out.push(
    el('g', {transform: `translate(${n(X(-90))} ${n(Y(-160))}) rotate(14)`}, [
      el('rect', {x: -70, y: -6, width: 80, height: 12, rx: 6, fill: '#e2e6e1', stroke: '#8b918c', 'stroke-width': 1.5}),
      el('rect', {
        x: 22,
        y: -5,
        width: 44,
        height: 11,
        rx: 5,
        fill: '#dfe3de',
        stroke: '#8b918c',
        'stroke-width': 1.5,
        transform: 'rotate(9)',
      }),
      el('rect', {x: -76, y: -5, width: 8, height: 10, fill: '#9a9b96'}),
    ]),
  );
  return out;
}

/** The floor drain, rusted. */
function drain() {
  const x = X(40);
  const y = Y(-25);
  const slots = [];
  for (let k = -3; k <= 3; k++)
    slots.push(el('rect', {x: x - 24, y: y + k * 7 - 2, width: 48, height: 3.4, fill: '#050606', rx: 1.5}));
  return [
    el('circle', {cx: x, cy: y, r: 44, fill: '#5a3417', opacity: 0.45, filter: 'url(#blur8)'}),
    el('circle', {cx: x, cy: y, r: 32, fill: '#2a2a27', stroke: '#141413', 'stroke-width': 3}),
    el('circle', {cx: x, cy: y, r: 28, fill: '#3e3a33'}),
    ...slots,
  ];
}

/** "3:07", scrawled on the plaster by the open door. @param {Rng} rng */
function scrawl(rng) {
  return el('path', {
    d: strokeText('3:07', X(-178), Y(262), 36, {wobble: 2.4, rng, spacing: 0.3}),
    stroke: '#4a1813',
    'stroke-width': 4.2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    fill: 'none',
    opacity: 0.85,
  });
}

/** the gradients and filters every SVG layer of the level uses */
function defs() {
  return [
    blurFilter('blur2', 2),
    blurFilter('blur4', 4),
    blurFilter('blur8', 8),
    el('linearGradient', {id: 'plaster', x1: 0, y1: 0, x2: 0, y2: 1}, [
      el('stop', {offset: 0, 'stop-color': '#4e4d3a'}),
      el('stop', {offset: 0.35, 'stop-color': '#7f7d60'}),
      el('stop', {offset: 1, 'stop-color': '#8f8b6c'}),
    ]),
    el('linearGradient', {id: 'pipe', x1: 0, y1: 0, x2: 0, y2: 1}, [
      el('stop', {offset: 0, 'stop-color': '#2b221b'}),
      el('stop', {offset: 0.3, 'stop-color': '#7a5b40'}),
      el('stop', {offset: 0.55, 'stop-color': '#5b3f28'}),
      el('stop', {offset: 1, 'stop-color': '#1c140f'}),
    ]),
    el('linearGradient', {id: 'doorPaint', x1: 0, y1: 0, x2: 1, y2: 1}, [
      el('stop', {offset: 0, 'stop-color': '#62756a'}),
      el('stop', {offset: 1, 'stop-color': '#45544b'}),
    ]),
    el('linearGradient', {id: 'doorRust', x1: 0, y1: 0, x2: 0, y2: 1}, [
      el('stop', {offset: 0, 'stop-color': '#5b3a20', 'stop-opacity': 0}),
      el('stop', {offset: 1, 'stop-color': '#5b3a20', 'stop-opacity': 0.85}),
    ]),
    el('linearGradient', {id: 'void', x1: 0, y1: 0, x2: 0, y2: 1}, [
      el('stop', {offset: 0, 'stop-color': '#000'}),
      el('stop', {offset: 1, 'stop-color': '#0b100e'}),
    ]),
    el('radialGradient', {id: 'bulb', cx: 0.42, cy: 0.4, r: 0.6}, [
      el('stop', {offset: 0, 'stop-color': '#f3d690'}),
      el('stop', {offset: 0.5, 'stop-color': '#c78f3e'}),
      el('stop', {offset: 1, 'stop-color': '#5b3a16'}),
    ]),
  ];
}

/**
 * The north wall mirrored in the water at its foot, rippled and fading with the distance — the one
 * reflection that is baked; the demo adds the moving glints of the lamps.
 * @param {Float32Array} img
 */
export function reflectWall(img) {
  const axis = Y(FLOOR_TOP);
  const reach = 80 * PX;
  for (let py = Math.ceil(axis); py < axis + reach; py++) {
    const d = (py - axis) / reach;
    const strength = 0.34 * (1 - d) ** 1.6;
    for (let px = 0; px < IMG_W; px++) {
      const ripple = Math.sin(px * 0.045 + py * 0.31) * 2.2 + Math.sin(px * 0.013 - py * 0.17) * 3.5;
      const sy = Math.round(2 * axis - py + ripple * (0.3 + d));
      const sx = Math.round(px + Math.sin(py * 0.21) * 1.5);
      if (sy < 0 || sx < 0 || sx >= IMG_W) continue;
      const i = (py * IMG_W + px) * 3;
      const j = (sy * IMG_W + sx) * 3;
      img[i] = lerp(img[i], img[j] * 0.8, strength);
      img[i + 1] = lerp(img[i + 1], img[j + 1] * 0.85, strength);
      img[i + 2] = lerp(img[i + 2], img[j + 2] * 0.85, strength);
    }
  }
}

/**
 * Renders the level. Returns the RGB float image, `IMG_W` × `IMG_H`.
 * @returns {Promise<Float32Array>}
 */
export async function renderWardC() {
  const rng = new Rng(307);
  const img = new Float32Array(IMG_W * IMG_H * 3);
  for (let py = 0; py < IMG_H; py++) {
    for (let px = 0; px < IMG_W; px++) {
      const u = (px + 0.5) / PX + WORLD.left;
      const v = WORLD.top - (py + 0.5) / PX;
      const c = shadeFloor(u, v);
      const i = (py * IMG_W + px) * 3;
      img[i] = c[0];
      img[i + 1] = c[1];
      img[i + 2] = c[2];
    }
  }
  over(img, await rasterize(svgDoc(IMG_W, IMG_H, defs(), submerged(rng)), IMG_W, IMG_H));
  for (let py = Math.floor(Y(FLOOR_TOP)); py < Math.ceil(Y(FLOOR_BOTTOM)); py++) {
    for (let px = 0; px < IMG_W; px++) {
      const i = (py * IMG_W + px) * 3;
      const c = underWater([img[i], img[i + 1], img[i + 2]], (px + 0.5) / PX + WORLD.left, WORLD.top - (py + 0.5) / PX);
      img[i] = c[0];
      img[i + 1] = c[1];
      img[i + 2] = c[2];
    }
  }
  const body = [
    ...northWall(rng),
    ...cellDoor(rng, -470, 'C-04', false),
    ...cellDoor(rng, -60, 'C-07', true),
    ...cellDoor(rng, 150, 'C-09', false),
    ...cellDoor(rng, 480, 'C-12', false),
    // the count, on the plaster between C-09 and the lamp, running down over the tiles
    tallyMarks(rng, 196, 286, 270, 223, 13, '#4a1813', 0.85, 2.2),
    tallyMarks(rng, 196, 300, 216, 180, 11, '#d9d3b8', 0.55, 1.6),
    scrawl(rng),
    ...WALL_LAMPS.flatMap(([x, y]) => wallLamp(x, y)),
    ...southWall(),
    ...drain(),
    ...ceilingFall(rng),
    chair(),
    ivStand(),
    gurney(),
    wheelchair(),
    mopBucket(),
  ];
  over(img, await rasterize(svgDoc(IMG_W, IMG_H, defs(), body), IMG_W, IMG_H));
  reflectWall(img);
  return img;
}

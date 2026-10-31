// stage-masks/rift: the sprites of "Deep Listening" in one atlas — the reels of the tape recorder
// (clean, and grown over in the deep), the jellyfish that is the dish of the deep (its bell and its
// arms apart, so the demo can pulse the one and sway the other), the leviathan that passes behind
// the window, four strands of kelp, a fish, a bubble and a soft glow. Each frame is an SVG document
// of its own in pixels (y down), drawn at 2 texels per unit, packed by lib/pack.
import {Img, Rng} from '../../lib/image.mjs';
import {pack} from '../../lib/pack.mjs';
import {blurFilter, el, n, rasterize, svgDoc} from './kit.mjs';

/**
 * @typedef {object} Frame
 * @property {string} name
 * @property {number} w in pixels
 * @property {number} h
 * @property {(rng: Rng) => string[]} draw the body, centred on (0, 0), in pixels
 */

const defs = [blurFilter('b1', 1), blurFilter('b2', 2), blurFilter('b4', 4), blurFilter('b8', 8), blurFilter('b16', 16)];

/** a ring path through `count` points for an SVG `d`, closed */
const ring = (/** @type {number} */ r, /** @type {number} */ count = 48) => {
  let d = '';
  for (let k = 0; k < count; k++) {
    const a = (k / count) * Math.PI * 2;
    d += `${k ? 'L' : 'M'}${n(Math.cos(a) * r)} ${n(Math.sin(a) * r)}`;
  }
  return `${d}Z`;
};

/** A reel of tape, 84 units across: a pack of brown tape behind an aluminium flange with three windows. @param {boolean} drowned @param {Rng} rng */
function reel(drowned, rng) {
  const out = [];
  const R = 80;
  out.push(el('circle', {r: 64, fill: drowned ? '#1a2420' : '#3a2416'}));
  for (let k = 0; k < 9; k++)
    out.push(el('circle', {r: 30 + k * 3.8, fill: 'none', stroke: drowned ? '#22302a' : '#4a3020', 'stroke-width': 0.8}));
  // the flange, with three windows cut through it (even-odd)
  let d = ring(R, 96);
  for (let k = 0; k < 3; k++) {
    const a0 = (k / 3) * Math.PI * 2 + 0.25;
    const a1 = a0 + 1.45;
    const pts = [];
    for (let j = 0; j <= 12; j++) {
      const a = a0 + ((a1 - a0) * j) / 12;
      pts.push([Math.cos(a) * 68, Math.sin(a) * 68]);
    }
    for (let j = 12; j >= 0; j--) {
      const a = a0 + ((a1 - a0) * j) / 12;
      pts.push([Math.cos(a) * 26, Math.sin(a) * 26]);
    }
    d += `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}Z`;
  }
  out.push(
    el('path', {
      d,
      fill: drowned ? '#5a6a66' : '#b8b4a8',
      'fill-rule': 'evenodd',
      stroke: drowned ? '#1a2422' : '#4a4840',
      'stroke-width': 2,
    }),
  );
  out.push(el('circle', {r: R - 3, fill: 'none', stroke: drowned ? '#7a8a86' : '#e8e4d8', 'stroke-width': 1.2, opacity: 0.6}));
  // the hub
  out.push(el('circle', {r: 18, fill: drowned ? '#3a4442' : '#8a867a', stroke: '#2a2824', 'stroke-width': 1.5}));
  out.push(el('circle', {r: 7, fill: '#1a1a18'}));
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * Math.PI * 2;
    out.push(el('rect', {x: -2, y: 6, width: 4, height: 8, fill: '#1a1a18', transform: `rotate(${n((a * 180) / Math.PI)})`}));
  }
  if (drowned) {
    // barnacles and weed on the flange
    for (let k = 0; k < 26; k++) {
      const a = rng.range(0, Math.PI * 2);
      const r = rng.range(30, 76);
      const s = rng.range(2.5, 6);
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      out.push(
        el('circle', {cx: x, cy: y, r: s, fill: '#9aa8a0', stroke: '#2a3632', 'stroke-width': 1}),
        el('circle', {cx: x, cy: y, r: s * 0.4, fill: '#18221f'}),
      );
    }
    for (let k = 0; k < 5; k++) {
      const a = rng.range(0, Math.PI * 2);
      out.push(
        el('path', {
          d: `M${n(Math.cos(a) * 40)} ${n(Math.sin(a) * 40)}Q${n(Math.cos(a + 0.4) * 70)} ${n(Math.sin(a + 0.4) * 70)} ${n(Math.cos(a + 0.2) * 80)} ${n(Math.sin(a + 0.2) * 80)}`,
          stroke: '#2a4a2a',
          'stroke-width': 3,
          fill: 'none',
          'stroke-linecap': 'round',
        }),
      );
    }
  }
  return out;
}

/** The bell of the jellyfish, 200 × 130 units: a translucent dome, canals, four glowing gonads, a rim of lights. @param {Rng} rng */
function jellyBell(rng) {
  const out = [];
  const w = 190;
  const h = 120;
  const bell = `M${-w} 60C${-w} ${-h * 1.1} ${w} ${-h * 1.1} ${w} 60C${w * 0.6} 46 ${-w * 0.6} 46 ${-w} 60Z`;
  out.push(
    el('radialGradient', {id: 'bellG', cx: 0, cy: -20, r: 220, gradientUnits: 'userSpaceOnUse'}, [
      el('stop', {offset: 0, 'stop-color': '#c8ffff', 'stop-opacity': 0.55}),
      el('stop', {offset: 0.7, 'stop-color': '#4ad0e0', 'stop-opacity': 0.4}),
      el('stop', {offset: 1, 'stop-color': '#1a8aa0', 'stop-opacity': 0.55}),
    ]),
  );
  out.push(el('path', {d: bell, fill: '#5ae8f0', opacity: 0.25, filter: 'url(#b16)'}));
  out.push(el('path', {d: bell, fill: 'url(#bellG)'}));
  // radial canals
  for (let k = 0; k < 16; k++) {
    const t = (k + 0.5) / 16;
    const x = -w + t * 2 * w;
    out.push(
      el('path', {
        d: `M0 ${-h * 0.75}Q${n(x * 0.55)} ${n(-h * 0.6)} ${n(x * 0.97)} 52`,
        stroke: '#e8ffff',
        'stroke-width': 1.4,
        fill: 'none',
        opacity: 0.35,
      }),
    );
  }
  // four gonads, horseshoes of light
  for (let k = 0; k < 4; k++) {
    const x = -105 + k * 70;
    out.push(
      el('path', {
        d: `M${x - 22} -10C${x - 24} -46 ${x + 24} -46 ${x + 22} -10`,
        stroke: '#9afff0',
        'stroke-width': 9,
        fill: 'none',
        opacity: 0.35,
        filter: 'url(#b4)',
      }),
    );
    out.push(
      el('path', {
        d: `M${x - 22} -10C${x - 24} -46 ${x + 24} -46 ${x + 22} -10`,
        stroke: '#e0fff8',
        'stroke-width': 3.5,
        fill: 'none',
        opacity: 0.85,
      }),
    );
  }
  // the rim: a thicker edge and a row of lights
  out.push(
    el('path', {
      d: `M${-w} 60C${-w * 0.6} 46 ${w * 0.6} 46 ${w} 60`,
      stroke: '#c8ffff',
      'stroke-width': 4,
      fill: 'none',
      opacity: 0.7,
    }),
  );
  for (let k = 0; k <= 30; k++) {
    const t = k / 30;
    const x = -w + t * 2 * w;
    const y = 60 - Math.sin(t * Math.PI) * 13.5;
    out.push(
      el('circle', {cx: x, cy: y, r: 6, fill: '#7affff', opacity: 0.35, filter: 'url(#b4)'}),
      el('circle', {cx: x, cy: y, r: 2.2, fill: '#f0ffff'}),
    );
  }
  // the highlight of the dome
  out.push(
    el('path', {
      d: `M${-w * 0.6} -40C${-w * 0.4} ${-h * 0.95} ${w * 0.1} ${-h * 1.02} ${w * 0.3} ${-h * 0.92}`,
      stroke: '#ffffff',
      'stroke-width': 5,
      fill: 'none',
      opacity: 0.35,
      filter: 'url(#b2)',
    }),
  );
  void rng;
  return out;
}

/** The arms of the jellyfish, 170 × 300 units, hanging from the top: frilled oral arms and long thin tentacles. @param {Rng} rng */
function jellyArms(rng) {
  const out = [];
  const top = -290;
  // long thin tentacles from the rim
  for (let k = 0; k < 26; k++) {
    const x0 = -165 + (k / 25) * 330;
    const len = rng.range(380, 580);
    const sway = rng.range(-30, 30);
    out.push(
      el('path', {
        d: `M${n(x0)} ${top}C${n(x0 + sway)} ${n(top + len * 0.35)} ${n(x0 - sway)} ${n(top + len * 0.7)} ${n(x0 + sway * 0.5)} ${n(top + len)}`,
        stroke: '#9af0f0',
        'stroke-width': rng.range(0.8, 1.8),
        fill: 'none',
        opacity: rng.range(0.25, 0.6),
      }),
    );
  }
  // four frilled oral arms in the middle
  for (let k = 0; k < 4; k++) {
    const x0 = -36 + k * 24;
    const len = rng.range(380, 500);
    let left = '';
    let right = '';
    for (let j = 0; j <= 40; j++) {
      const t = j / 40;
      const y = top + t * len;
      const cx = x0 + Math.sin(t * 5 + k) * 18 * t;
      const wdt = (16 - t * 12) * (1 + 0.35 * Math.sin(t * 60 + k * 2));
      left += `${j ? 'L' : 'M'}${n(cx - wdt)} ${n(y)}`;
      right = `L${n(cx + wdt)} ${n(y)}${right}`;
    }
    const d = `${left}${right}Z`;
    out.push(
      el('path', {d, fill: '#5ad8e8', opacity: 0.3, filter: 'url(#b4)'}),
      el('path', {d, fill: '#b8fff8', opacity: 0.4, stroke: '#e8ffff', 'stroke-width': 1}),
    );
  }
  return out;
}

/**
 * The leviathan, 650 × 230 units, swimming to the left: an eel's length of dark body under a frill
 * that runs along its back, a long jaw of needle teeth, one pale eye, two rows of lights. Soft at
 * the edges: it is far off in the murk.
 * @param {Rng} rng
 */
function leviathan(rng) {
  const out = [];
  const top = (/** @type {number} */ x) =>
    -70 - 40 * Math.sin(((x + 640) / 1280) * Math.PI) ** 0.6 + (x > 300 ? (x - 300) * 0.12 : 0);
  const bottom = (/** @type {number} */ x) =>
    60 + 34 * Math.sin(((x + 640) / 1280) * Math.PI) ** 0.6 - (x > 300 ? (x - 300) * 0.14 : 0);
  let d = 'M-640 -6';
  for (let x = -630; x <= 640; x += 10) d += `L${x} ${n(top(x))}`;
  for (let x = 640; x >= -630; x -= 10) d += `L${x} ${n(bottom(x))}`;
  d += 'Z';
  // the dorsal frill: a ragged membrane on spines along the back
  let frill = `M-420 ${n(top(-420))}`;
  for (let x = -420; x <= 600; x += 14) {
    const h = 30 + 26 * Math.sin((x + 420) * 0.006) + rng.range(-8, 8);
    frill += `L${x} ${n(top(x) - h)}L${x + 7} ${n(top(x + 7) - h * 0.55)}`;
  }
  frill += `L600 ${n(top(600))}Z`;
  out.push(el('path', {d: frill, fill: '#0a2a30', opacity: 0.85, filter: 'url(#b2)'}));
  let spines = '';
  for (let x = -410; x <= 590; x += 14)
    spines += `M${x} ${n(top(x))}L${x - 4} ${n(top(x) - 40 - 20 * Math.sin((x + 420) * 0.006))}`;
  out.push(el('path', {d: spines, stroke: '#0c3034', 'stroke-width': 1.6, opacity: 0.7}));
  out.push(el('path', {d, fill: '#063038', opacity: 0.5, filter: 'url(#b16)'}));
  out.push(el('path', {d, fill: '#0a2c33', filter: 'url(#b1)'}));
  // the light from above along its back
  out.push(
    el('path', {
      d: `M-600 ${n(top(-600) + 6)}${Array.from({length: 60}, (_, k) => `L${-600 + k * 20} ${n(top(-600 + k * 20) + 6)}`).join('')}`,
      stroke: '#2a6a70',
      'stroke-width': 5,
      fill: 'none',
      opacity: 0.6,
      filter: 'url(#b2)',
    }),
  );
  // the flank catches a little of the light from above
  out.push(
    el('path', {
      d: `M-560 ${n(top(-560) + 14)}C-200 -110 200 -100 600 -10`,
      stroke: '#0e3c42',
      'stroke-width': 10,
      fill: 'none',
      opacity: 0.5,
      filter: 'url(#b8)',
    }),
  );
  // the jaw: a long line, needle teeth crossing it
  out.push(el('path', {d: 'M-640 -2C-580 14 -520 22 -430 18', stroke: '#010709', 'stroke-width': 4, fill: 'none'}));
  let teeth = '';
  for (let k = 0; k < 16; k++) {
    const x = -628 + k * 12;
    const y = -2 + (k / 16) * 18;
    const up = k % 2 ? 1 : -1;
    teeth += `M${x} ${n(y)}L${n(x + 3)} ${n(y + up * rng.range(9, 16))}`;
  }
  out.push(el('path', {d: teeth, stroke: '#a8c0b8', 'stroke-width': 1.6, 'stroke-linecap': 'round', opacity: 0.8}));
  // the eye, far too big
  out.push(el('ellipse', {cx: -500, cy: -40, rx: 38, ry: 30, fill: '#a8e0d0', opacity: 0.22, filter: 'url(#b8)'}));
  out.push(el('ellipse', {cx: -500, cy: -40, rx: 22, ry: 18, fill: '#b8d8c4'}));
  out.push(el('ellipse', {cx: -500, cy: -40, rx: 21, ry: 17, fill: 'none', stroke: '#4a6a60', 'stroke-width': 2}));
  out.push(el('ellipse', {cx: -498, cy: -40, rx: 3.5, ry: 16, fill: '#020808'}));
  out.push(el('ellipse', {cx: -507, cy: -48, rx: 4, ry: 2.5, fill: '#ffffff', opacity: 0.75}));
  // two rows of lights along the flank
  for (let row = 0; row < 2; row++) {
    for (let k = 0; k < 26; k++) {
      const x = -420 + k * 40 + row * 20;
      if (x > 600) continue;
      const y = row ? bottom(x) - 22 : (top(x) + bottom(x)) / 2 + 8;
      const r = row ? 2.2 : 3;
      out.push(
        el('circle', {cx: x, cy: y, r: r * 3, fill: '#3affe8', opacity: 0.35, filter: 'url(#b4)'}),
        el('circle', {cx: x, cy: y, r, fill: '#d8fff8'}),
      );
    }
  }
  return out;
}

/**
 * A strand of kelp, rooted at the bottom middle: a wavy stipe, blades on both sides, a float at the
 * base of each. `h` is the height in pixels.
 * @param {number} h @param {number} seed
 */
function kelp(h, seed) {
  return (/** @type {Rng} */ _rng) => {
    const rng = new Rng(seed);
    const out = [];
    const bottom = h / 2 - 2;
    const stipe = (/** @type {number} */ t) => Math.sin(t * 7 + seed) * 10 * t;
    let d = '';
    for (let j = 0; j <= 40; j++) {
      const t = j / 40;
      d += `${j ? 'L' : 'M'}${n(stipe(t))} ${n(bottom - t * (h - 8))}`;
    }
    out.push(el('path', {d, stroke: '#2a3a18', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round'}));
    const count = Math.floor(h / 38);
    for (let k = 1; k <= count; k++) {
      const t = k / (count + 0.6);
      const x = stipe(t);
      const y = bottom - t * (h - 8);
      const side = k % 2 ? 1 : -1;
      const len = rng.range(46, 64) * (1 - t * 0.3);
      const wdt = rng.range(14, 20);
      const tip = [x + side * len, y - len * 0.9];
      const blade = `M${n(x)} ${n(y)}C${n(x + side * wdt * 1.6)} ${n(y - 6)} ${n(tip[0] + side * 4)} ${n(tip[1] + wdt)} ${n(tip[0])} ${n(tip[1])}C${n(tip[0] - side * wdt)} ${n(tip[1] + 4)} ${n(x + side * 4)} ${n(y - wdt)} ${n(x)} ${n(y)}Z`;
      out.push(el('path', {d: blade, fill: '#3a5222', stroke: '#1e2c10', 'stroke-width': 1}));
      out.push(
        el('path', {
          d: `M${n(x)} ${n(y)}Q${n(x + side * len * 0.5)} ${n(y - len * 0.3)} ${n(tip[0])} ${n(tip[1])}`,
          stroke: '#6a8a3a',
          'stroke-width': 1,
          fill: 'none',
          opacity: 0.7,
        }),
      );
      out.push(el('circle', {cx: x + side * 4, cy: y - 2, r: 4, fill: '#5a6a2a', stroke: '#22300f', 'stroke-width': 1}));
    }
    // the edge facing the light of the deep: a thin cyan rim
    out.push(el('path', {d, stroke: '#5ad8c8', 'stroke-width': 1, fill: 'none', opacity: 0.35, transform: 'translate(2 0)'}));
    return out;
  };
}

/** A small fish of the deep, 40 × 14 units, swimming left, a light at its chin. */
function fish() {
  return [
    el('path', {d: 'M-38 0C-30 -12 0 -14 20 -6L38 -14L32 0L38 14L20 6C0 14 -30 12 -38 0Z', fill: '#0a2a30'}),
    el('path', {d: 'M-30 4C-10 9 10 8 20 5', stroke: '#2a6a70', 'stroke-width': 1.5, fill: 'none'}),
    el('circle', {cx: -26, cy: -3, r: 2.5, fill: '#c8f0e8'}),
    el('circle', {cx: -36, cy: 6, r: 4, fill: '#5affe8', opacity: 0.5, filter: 'url(#b2)'}),
    el('circle', {cx: -36, cy: 6, r: 1.5, fill: '#e8fff8'}),
  ];
}

/** A bubble, 12 units across: a thin bright ring and a highlight. */
function bubble() {
  return [
    el('circle', {r: 10, fill: '#a0f0f0', opacity: 0.12}),
    el('circle', {r: 10, fill: 'none', stroke: '#d8ffff', 'stroke-width': 1.6, opacity: 0.75}),
    el('ellipse', {cx: -3.5, cy: -4, rx: 3, ry: 2, fill: '#ffffff', opacity: 0.85}),
  ];
}

/** @type {Frame[]} */
const FRAMES = [
  {name: 'reel-night', w: 168, h: 168, draw: (rng) => reel(false, rng)},
  {name: 'reel-drowned', w: 168, h: 168, draw: (rng) => reel(true, rng)},
  {name: 'jelly-bell', w: 420, h: 300, draw: (rng) => jellyBell(rng)},
  {name: 'jelly-arms', w: 380, h: 600, draw: (rng) => jellyArms(rng)},
  {name: 'leviathan', w: 1300, h: 460, draw: (rng) => leviathan(rng)},
  {name: 'kelp-a', w: 128, h: 680, draw: kelp(680, 11)},
  {name: 'kelp-b', w: 128, h: 520, draw: kelp(520, 23)},
  {name: 'kelp-c', w: 128, h: 600, draw: kelp(600, 37)},
  {name: 'kelp-d', w: 128, h: 440, draw: kelp(440, 41)},
  {name: 'fish', w: 84, h: 32, draw: () => fish()},
  {name: 'bubble', w: 24, h: 24, draw: () => bubble()},
  {
    name: 'glow',
    w: 64,
    h: 64,
    draw: () => [
      el('radialGradient', {id: 'glowG', cx: 0, cy: 0, r: 31, gradientUnits: 'userSpaceOnUse'}, [
        el('stop', {offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 1}),
        el('stop', {offset: 0.25, 'stop-color': '#ffffff', 'stop-opacity': 0.55}),
        el('stop', {offset: 1, 'stop-color': '#ffffff', 'stop-opacity': 0}),
      ]),
      el('circle', {r: 32, fill: 'url(#glowG)'}),
    ],
  },
];

export async function renderSprites() {
  const rng = new Rng(9191);
  const inputs = [];
  for (const frame of FRAMES) {
    const body = el('g', {transform: `translate(${frame.w / 2} ${frame.h / 2})`}, frame.draw(rng));
    const data = await rasterize(svgDoc(frame.w, frame.h, defs, [body]), frame.w, frame.h);
    inputs.push({name: frame.name, img: new Img(frame.w, frame.h, new Uint8Array(data))});
  }
  // a sheet 2048 wide, no taller than the frames need: a power-of-two height would leave half of it empty
  return pack(inputs, {padding: 6, width: 2048, powerOfTwo: false});
}

// stage-masks/found-footage: what stands between the birches — a dome tent with a broken pole and a
// door left open on the dark, the figure that keeps its distance, the shine of its eyes, and three
// clumps of undergrowth for the foreground. Each frame is an SVG document of its own in pixels (y
// down, centred on (0, 0)), drawn at 2 texels per unit, in neutral greys: the demo tints them.
import {Rng} from '../../lib/image.mjs';
import {blurFilter, el, n, poly} from '../spotlight/svg.mjs';

export const PROP_DEFS = [blurFilter('b1', 1), blurFilter('b2', 2), blurFilter('b4', 4), blurFilter('b8', 8)];

/** The dome tent, 260 × 150 units: its ground line at y = +130 px. */
export function tent() {
  const out = [];
  const g = 130;
  out.push(
    el('radialGradient', {id: 'tentShade', cx: -40, cy: -40, r: 260, gradientUnits: 'userSpaceOnUse'}, [
      el('stop', {offset: 0, 'stop-color': '#c8c8c2'}),
      el('stop', {offset: 0.7, 'stop-color': '#8a8a84'}),
      el('stop', {offset: 1, 'stop-color': '#5a5a56'}),
    ]),
  );
  // the shadow on the ground
  out.push(el('ellipse', {cx: 10, cy: g + 2, rx: 250, ry: 16, fill: '#000', opacity: 0.6, filter: 'url(#b8)'}));
  // the body: the right side sags where its pole snapped
  const body = 'M-236 130C-226 40 -150 -96 -36 -112C34 -120 70 -96 96 -70C120 -46 128 -10 160 6C196 24 226 70 240 130Z';
  out.push(el('path', {d: body, fill: 'url(#tentShade)'}));
  // the pole sleeves
  out.push(el('path', {d: 'M-200 130C-170 10 -110 -96 -30 -110', stroke: '#5c5c58', 'stroke-width': 5, fill: 'none'}));
  out.push(el('path', {d: 'M-60 130C-60 20 -40 -80 -30 -110', stroke: '#5c5c58', 'stroke-width': 4, fill: 'none', opacity: 0.8}));
  out.push(
    el('path', {d: 'M-30 -110C40 -116 84 -80 100 -60C116 -40 124 -16 150 0', stroke: '#5c5c58', 'stroke-width': 5, fill: 'none'}),
  );
  // the broken pole pokes out through the fabric
  out.push(el('path', {d: 'M150 0L176 -26', stroke: '#9a9a94', 'stroke-width': 4, 'stroke-linecap': 'round'}));
  out.push(el('path', {d: 'M176 -26L181 -31', stroke: '#d8d8d2', 'stroke-width': 3, 'stroke-linecap': 'round'}));
  // creases where the fabric gave
  for (const d of [
    'M100 -40C110 0 130 40 136 90',
    'M128 -10C150 20 170 60 176 120',
    'M60 -86C76 -40 90 20 92 80',
    'M-120 -40C-110 0 -96 60 -94 126',
  ]) {
    out.push(el('path', {d, stroke: '#4a4a46', 'stroke-width': 2.5, fill: 'none', opacity: 0.7}));
    out.push(el('path', {d, stroke: '#e0e0da', 'stroke-width': 1.2, fill: 'none', opacity: 0.35, transform: 'translate(-3 0)'}));
  }
  // the door: zipped half open, a black triangle of inside, the flap folded back
  out.push(el('path', {d: 'M-120 130C-110 70 -84 10 -46 -26C-30 20 -24 80 -20 130Z', fill: '#050505'}));
  out.push(el('path', {d: 'M-46 -26C-30 20 -24 80 -20 130L10 130C2 80 -14 20 -46 -26Z', fill: '#76766f'}));
  out.push(
    el('path', {
      d: 'M-46 -26C-30 20 -24 80 -20 130',
      stroke: '#2a2a28',
      'stroke-width': 2,
      fill: 'none',
      'stroke-dasharray': '3 2',
    }),
  );
  out.push(
    el('path', {
      d: 'M-46 -26C-84 10 -110 70 -120 130',
      stroke: '#2a2a28',
      'stroke-width': 2,
      fill: 'none',
      'stroke-dasharray': '3 2',
    }),
  );
  // three long tears in the side
  for (let k = 0; k < 3; k++) {
    const x = 20 + k * 22;
    out.push(
      el('path', {
        d: `M${x} ${-40 + k * 6}C${x + 10} ${0 + k * 4} ${x + 14} ${40} ${x + 12} ${70 - k * 6}`,
        stroke: '#080808',
        'stroke-width': 5 - k,
        fill: 'none',
        'stroke-linecap': 'round',
      }),
    );
  }
  // guy lines to their pegs
  for (const [x0, y0, x1] of [
    [-150, -40, -258],
    [120, -50, 252],
    [-36, -112, -180],
  ]) {
    out.push(el('path', {d: `M${x0} ${y0}L${x1} ${g + 4}`, stroke: '#b8b8b2', 'stroke-width': 1.4, opacity: 0.7}));
    out.push(el('path', {d: `M${x1} ${g + 4}L${x1 + 3} ${g - 6}`, stroke: '#d0d0ca', 'stroke-width': 2.5}));
  }
  // a boot lying on its side in front of the door
  out.push(
    el('path', {
      d: 'M-6 128L-6 108L12 106L16 118L44 120C50 121 52 126 50 130L-6 130Z',
      fill: '#2e2e2c',
      stroke: '#575753',
      'stroke-width': 1.5,
    }),
  );
  out.push(el('path', {d: 'M-4 112L12 110', stroke: '#8a8a84', 'stroke-width': 1.2}));
  return out;
}

/** The figure, 40 × 120 units at the frame's size: far too thin, arms to the knees, standing still. */
export function figure() {
  const out = [];
  out.push(
    el('linearGradient', {id: 'figShade', x1: -20, y1: 0, x2: 20, y2: 0, gradientUnits: 'userSpaceOnUse'}, [
      el('stop', {offset: 0, 'stop-color': '#9a9a96'}),
      el('stop', {offset: 0.45, 'stop-color': '#e2e2de'}),
      el('stop', {offset: 1, 'stop-color': '#8a8a86'}),
    ]),
  );
  out.push(el('ellipse', {cx: 0, cy: 118, rx: 26, ry: 4, fill: '#000', opacity: 0.5, filter: 'url(#b2)'}));
  // legs, body, arms, neck and head as one outline
  const body = poly([
    [-6, 120],
    [-8, 40],
    [-11, 0],
    [-14, -42],
    [-18, -58],
    [-23, -54],
    [-26, -20],
    [-27, 20],
    [-25, 52],
    [-21, 54],
    [-19, 20],
    [-16, -30],
    [-12, -60],
    [-5, -68],
    [-4, -80],
    [5, -80],
    [6, -68],
    [13, -60],
    [17, -30],
    [20, 20],
    [22, 56],
    [26, 54],
    [28, 20],
    [27, -20],
    [24, -54],
    [19, -58],
    [15, -42],
    [11, 0],
    [8, 40],
    [6, 120],
    [2, 120],
    [1, 50],
    [-1, 50],
    [-2, 120],
  ]);
  out.push(el('path', {d: body, fill: 'url(#figShade)', 'stroke-linejoin': 'round'}));
  // long fingers
  for (const [x, s] of [
    [-23, -1],
    [24, 1],
  ]) {
    for (let k = 0; k < 3; k++) {
      out.push(
        el('path', {
          d: `M${x + k * 1.6 * s} 52L${x + k * 1.8 * s + s} ${66 + k * 2}`,
          stroke: '#cfcfcb',
          'stroke-width': 1.3,
          'stroke-linecap': 'round',
        }),
      );
    }
  }
  // the head, tilted, two dark sockets
  out.push(el('ellipse', {cx: 1, cy: -94, rx: 10, ry: 15, fill: '#e6e6e2', transform: 'rotate(-9 1 -94)'}));
  out.push(el('ellipse', {cx: -3, cy: -96, rx: 2.6, ry: 3.4, fill: '#141414'}));
  out.push(el('ellipse', {cx: 5, cy: -97, rx: 2.6, ry: 3.4, fill: '#141414'}));
  return out;
}

/** The shine of two eyes caught in the camera's light, 20 × 10 units: white, for an additive tint. */
export function eyeshine() {
  const out = [];
  for (const x of [-7, 7]) {
    out.push(el('circle', {cx: x, cy: 0, r: 7, fill: '#fff', opacity: 0.5, filter: 'url(#b2)'}));
    out.push(el('circle', {cx: x, cy: 0, r: 2.6, fill: '#fff'}));
  }
  return out;
}

/**
 * Undergrowth for the foreground, 220 × 150 units, rooted at the bottom middle: bracken, a
 * bramble or a tuft of dead grass.
 * @param {'bracken' | 'bramble' | 'grass'} kind @param {number} seed
 */
export function undergrowth(kind, seed) {
  const rng = new Rng(seed);
  const out = [];
  const base = 150;
  const fill = '#bdbdb7';
  if (kind === 'bracken') {
    for (let f = 0; f < 5; f++) {
      const a0 = -Math.PI / 2 + rng.range(-0.9, 0.9);
      const len = rng.range(150, 260);
      const bend = rng.range(0.6, 1.3) * (a0 < -Math.PI / 2 ? -1 : 1);
      let x = rng.range(-30, 30);
      let y = base;
      let a = a0;
      const step = len / 14;
      let d = `M${n(x)} ${n(y)}`;
      for (let k = 0; k < 14; k++) {
        a += (bend * 0.09 * k) / 14;
        const nx = x + Math.cos(a) * step;
        const ny = y + Math.sin(a) * step;
        d += `L${n(nx)} ${n(ny)}`;
        // a pair of leaflets at each joint, shorter towards the tip
        const pl = (1 - k / 14) * 30 + 7;
        for (const s of [-1, 1]) {
          // a leaflet droops a little: a lobe from the stalk outwards and down
          const la = a + s * 1.15 + 0.25;
          const mx = nx + Math.cos(la) * pl * 0.5;
          const my = ny + Math.sin(la) * pl * 0.5;
          out.push(
            el('ellipse', {
              cx: n(mx),
              cy: n(my),
              rx: n(pl * 0.5),
              ry: n(pl * 0.17 + 1.5),
              fill,
              transform: `rotate(${n((la * 180) / Math.PI)} ${n(mx)} ${n(my)})`,
            }),
          );
        }
        x = nx;
        y = ny;
      }
      out.push(el('path', {d, stroke: fill, 'stroke-width': 3, fill: 'none', 'stroke-linecap': 'round'}));
    }
  } else if (kind === 'bramble') {
    for (let f = 0; f < 4; f++) {
      let x = rng.range(-40, 40);
      let y = base;
      let a = -Math.PI / 2 + rng.range(-1.1, 1.1);
      let d = `M${n(x)} ${n(y)}`;
      const segments = 18;
      for (let k = 0; k < segments; k++) {
        a += rng.range(-0.25, 0.25) + (k > segments * 0.5 ? 0.12 : 0) * Math.sign(Math.cos(a));
        const nx = x + Math.cos(a) * 13;
        const ny = y + Math.sin(a) * 13;
        d += `L${n(nx)} ${n(ny)}`;
        // thorns
        const s = k % 2 ? 1 : -1;
        out.push(
          el('path', {
            d: poly([
              [nx, ny],
              [nx + Math.cos(a + s * 1.9) * 7, ny + Math.sin(a + s * 1.9) * 7],
              [nx + Math.cos(a) * 3, ny + Math.sin(a) * 3],
            ]),
            fill,
          }),
        );
        if (k % 4 === 2) {
          const la = a + s * 1.1;
          const lx = nx + Math.cos(la) * 16;
          const ly = ny + Math.sin(la) * 16;
          out.push(
            el('ellipse', {
              cx: n(lx),
              cy: n(ly),
              rx: 11,
              ry: 6,
              fill,
              transform: `rotate(${n((la * 180) / Math.PI)} ${n(lx)} ${n(ly)})`,
            }),
          );
        }
        x = nx;
        y = ny;
      }
      out.push(
        el('path', {d, stroke: fill, 'stroke-width': 3.5, fill: 'none', 'stroke-linejoin': 'round', 'stroke-linecap': 'round'}),
      );
    }
  } else {
    for (let k = 0; k < 46; k++) {
      const x = rng.range(-90, 90);
      const h = rng.range(60, 200) * (1 - Math.abs(x) / 140);
      const lean = rng.range(-50, 50) + x * 0.3;
      out.push(
        el('path', {
          d: `M${n(x - 2.5)} ${base}Q${n(x + lean * 0.4)} ${n(base - h * 0.6)} ${n(x + lean)} ${n(base - h)}Q${n(x + lean * 0.4 + 2)} ${n(base - h * 0.6)} ${n(x + 2.5)} ${base}Z`,
          fill: k % 3 ? fill : '#9a9a94',
        }),
      );
    }
  }
  return out;
}

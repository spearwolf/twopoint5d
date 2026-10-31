// stage-masks/portal: the sprites of "The Painting in the Hallway" in one atlas. For the hallway:
// a wall sconce in profile (the wall at its left edge), the brass picture lamp over the portrait and
// a soft glow. For the moor in the painting, all lit by the moon from the upper left: the lone house
// with one lit window, the walker in a long coat, a dead hawthorn bent by the wind, two standing
// stones and three clumps of heather. Each frame is an SVG document of its own in pixels (y down),
// drawn at `tx` texels per unit, packed by lib/pack.
import {Img, Rng} from '../../lib/image.mjs';
import {pack} from '../../lib/pack.mjs';
import {blurFilter, el, n, rasterize, svgDoc} from './kit.mjs';

/**
 * @typedef {object} Frame
 * @property {string} name
 * @property {number} w in units
 * @property {number} h in units
 * @property {number} tx texels per unit
 * @property {(u: (v: number) => number, rng: Rng) => string[]} draw the body in pixels, (0, 0) the
 *   top left of the frame; `u` turns units into pixels
 */

const defs = [
  blurFilter('b1', 1),
  blurFilter('b2', 2),
  blurFilter('b4', 4),
  blurFilter('b8', 8),
  el('linearGradient', {id: 'brassV', x1: 0, y1: 0, x2: 0, y2: 1}, [
    el('stop', {offset: 0, 'stop-color': '#f0d08a'}),
    el('stop', {offset: 0.3, 'stop-color': '#a8792f'}),
    el('stop', {offset: 0.7, 'stop-color': '#5a3a14'}),
    el('stop', {offset: 1, 'stop-color': '#24170a'}),
  ]),
  el('linearGradient', {id: 'brassH', x1: 0, y1: 0, x2: 1, y2: 0}, [
    el('stop', {offset: 0, 'stop-color': '#3a250c'}),
    el('stop', {offset: 0.35, 'stop-color': '#e8c47a'}),
    el('stop', {offset: 0.6, 'stop-color': '#9a6c28'}),
    el('stop', {offset: 1, 'stop-color': '#2a1a08'}),
  ]),
  el('radialGradient', {id: 'tulip', cx: 0.4, cy: 0.35, r: 0.8}, [
    el('stop', {offset: 0, 'stop-color': '#fff1cf'}),
    el('stop', {offset: 0.45, 'stop-color': '#e9b878'}),
    el('stop', {offset: 1, 'stop-color': '#8a5a2a'}),
  ]),
  el('radialGradient', {id: 'glowG'}, [
    el('stop', {offset: 0, 'stop-color': '#ffffff', 'stop-opacity': 1}),
    el('stop', {offset: 0.2, 'stop-color': '#ffffff', 'stop-opacity': 0.6}),
    el('stop', {offset: 0.55, 'stop-color': '#ffffff', 'stop-opacity': 0.15}),
    el('stop', {offset: 1, 'stop-color': '#ffffff', 'stop-opacity': 0}),
  ]),
  el('linearGradient', {id: 'stoneG', x1: 0, y1: 0, x2: 1, y2: 0.3}, [
    el('stop', {offset: 0, 'stop-color': '#8fa8a4'}),
    el('stop', {offset: 0.35, 'stop-color': '#4a5a5a'}),
    el('stop', {offset: 1, 'stop-color': '#1a2224'}),
  ]),
  el('linearGradient', {id: 'coatG', x1: 0, y1: 0, x2: 1, y2: 0}, [
    el('stop', {offset: 0, 'stop-color': '#4a5e60'}),
    el('stop', {offset: 0.18, 'stop-color': '#1c2426'}),
    el('stop', {offset: 1, 'stop-color': '#0a0d0f'}),
  ]),
  el('linearGradient', {id: 'wallG', x1: 0, y1: 0, x2: 1, y2: 0}, [
    el('stop', {offset: 0, 'stop-color': '#5d6e6e'}),
    el('stop', {offset: 1, 'stop-color': '#2c3638'}),
  ]),
  el('linearGradient', {id: 'roofG', x1: 0, y1: 0, x2: 0, y2: 1}, [
    el('stop', {offset: 0, 'stop-color': '#3e4c50'}),
    el('stop', {offset: 1, 'stop-color': '#161c20'}),
  ]),
  el('linearGradient', {id: 'fadeDown', x1: 0, y1: 0, x2: 0, y2: 1}, [
    el('stop', {offset: 0, 'stop-color': '#fff', 'stop-opacity': 1}),
    el('stop', {offset: 0.82, 'stop-color': '#fff', 'stop-opacity': 1}),
    el('stop', {offset: 1, 'stop-color': '#fff', 'stop-opacity': 0}),
  ]),
  el('mask', {id: 'fadeMask', maskContentUnits: 'objectBoundingBox'}, el('rect', {width: 1, height: 1, fill: 'url(#fadeDown)'})),
];

/** points to an SVG path, in pixels already */
const path = (/** @type {number[][]} */ pts, close = true) =>
  `M${pts.map(([x, y]) => `${n(x)} ${n(y)}`).join('L')}${close ? 'Z' : ''}`;

/** A wall sconce in profile, 48 × 64 units: a brass plate on the wall at the left, an arm, a tulip of frosted glass. */
function sconce(/** @type {(v: number) => number} */ u) {
  return [
    // the back plate on the wall
    el('rect', {x: u(0), y: u(22), width: u(5), height: u(30), rx: u(2), fill: 'url(#brassH)'}),
    el('ellipse', {cx: u(5), cy: u(37), rx: u(3), ry: u(6), fill: 'url(#brassV)'}),
    // the arm: out from the plate, down, and up again into the cup
    el('path', {
      d: `M${u(6)} ${u(38)}C${u(18)} ${u(40)} ${u(22)} ${u(50)} ${u(28)} ${u(46)}C${u(33)} ${u(43)} ${u(31)} ${u(36)} ${u(30)} ${u(32)}`,
      fill: 'none',
      stroke: 'url(#brassV)',
      'stroke-width': u(2.6),
      'stroke-linecap': 'round',
    }),
    el('circle', {cx: u(28), cy: u(46.5), r: u(2.2), fill: '#c9a058'}),
    // the cup and the tulip of glass
    el('path', {d: `M${u(24)} ${u(32)}L${u(36)} ${u(32)}L${u(34)} ${u(28)}L${u(26)} ${u(28)}Z`, fill: 'url(#brassV)'}),
    el('path', {
      d: `M${u(25)} ${u(28)}C${u(18)} ${u(22)} ${u(16)} ${u(10)} ${u(20)} ${u(4)}C${u(24)} ${u(8)} ${u(26)} ${u(5)} ${u(30)} ${u(2)}C${u(34)} ${u(5)} ${u(36)} ${u(8)} ${u(40)} ${u(4)}C${u(44)} ${u(10)} ${u(42)} ${u(22)} ${u(35)} ${u(28)}Z`,
      fill: 'url(#tulip)',
      stroke: '#6a4420',
      'stroke-width': u(0.4),
    }),
    // ribs of the glass
    el('path', {
      d: `M${u(30)} ${u(27)}C${u(28)} ${u(18)} ${u(29)} ${u(9)} ${u(30)} ${u(3)}`,
      fill: 'none',
      stroke: '#fff7e0',
      'stroke-width': u(0.5),
      opacity: 0.6,
    }),
    el('path', {
      d: `M${u(26)} ${u(26)}C${u(22)} ${u(18)} ${u(21)} ${u(10)} ${u(22)} ${u(5)}`,
      fill: 'none',
      stroke: '#a26a34',
      'stroke-width': u(0.4),
      opacity: 0.6,
    }),
  ];
}

/** The picture lamp over the portrait, 130 × 44 units: two arms from a plate up on the wall, a long hood. */
function pictureLamp(/** @type {(v: number) => number} */ u) {
  return [
    el('rect', {x: u(57), y: u(0), width: u(16), height: u(7), rx: u(2), fill: 'url(#brassV)'}),
    el('path', {
      d: `M${u(60)} ${u(5)}C${u(40)} ${u(10)} ${u(30)} ${u(20)} ${u(28)} ${u(28)}`,
      fill: 'none',
      stroke: 'url(#brassV)',
      'stroke-width': u(2),
    }),
    el('path', {
      d: `M${u(70)} ${u(5)}C${u(90)} ${u(10)} ${u(100)} ${u(20)} ${u(102)} ${u(28)}`,
      fill: 'none',
      stroke: 'url(#brassV)',
      'stroke-width': u(2),
    }),
    // the hood: a half cylinder, lit from the lamp of the hallway, dark inside
    el('rect', {x: u(4), y: u(26), width: u(122), height: u(14), rx: u(7), fill: 'url(#brassV)'}),
    el('rect', {x: u(6), y: u(36), width: u(118), height: u(5), rx: u(2.5), fill: '#1a1006'}),
    el('rect', {x: u(10), y: u(38), width: u(110), height: u(2), rx: u(1), fill: '#ffd9a0', opacity: 0.9}),
    el('ellipse', {cx: u(5), cy: u(33), rx: u(3), ry: u(7), fill: '#3a250c'}),
    el('ellipse', {cx: u(125), cy: u(33), rx: u(3), ry: u(7), fill: '#e0b86a'}),
  ];
}

/** A soft white glow, 64 units at 1 texel per unit, for additive tints. */
const glow = (/** @type {(v: number) => number} */ u) => [el('circle', {cx: u(32), cy: u(32), r: u(32), fill: 'url(#glowG)'})];

/**
 * The lone house on the moor, 300 × 230 units: two storeys of rough stone with a steep slate roof and
 * a chimney, a lean-to at the right, four windows dark and one lit, the moon on the left gables.
 */
function house(/** @type {(v: number) => number} */ u, /** @type {Rng} */ rng) {
  const out = [];
  const g = [];
  // the lean-to and the main block, the roofs, the chimney
  g.push(
    el('path', {
      d: path([
        [u(200), u(140)],
        [u(290), u(166)],
        [u(290), u(230)],
        [u(200), u(230)],
      ]),
      fill: '#242e30',
    }),
  );
  g.push(
    el('path', {
      d: path([
        [u(196), u(134)],
        [u(296), u(162)],
        [u(296), u(170)],
        [u(196), u(144)],
      ]),
      fill: '#3a4648',
    }),
  );
  g.push(el('rect', {x: u(40), y: u(110), width: u(165), height: u(120), fill: 'url(#wallG)'}));
  g.push(
    el('path', {
      d: path([
        [u(30), u(114)],
        [u(122), u(36)],
        [u(214), u(114)],
      ]),
      fill: 'url(#roofG)',
    }),
  );
  g.push(
    el('path', {
      d: path([
        [u(30), u(114)],
        [u(122), u(36)],
        [u(126), u(40)],
        [u(38), u(116)],
      ]),
      fill: '#7d9494',
      opacity: 0.8,
    }),
  );
  g.push(el('rect', {x: u(150), y: u(30), width: u(20), height: u(50), fill: '#2a3436'}));
  g.push(el('rect', {x: u(150), y: u(30), width: u(6), height: u(50), fill: '#6d8282'}));
  g.push(el('rect', {x: u(146), y: u(26), width: u(28), height: u(7), fill: '#3c4a4c'}));
  // rough stone courses
  for (let row = 0; row < 12; row++) {
    const y = 114 + row * 10;
    let x = 42 + (row % 2) * 7;
    while (x < 203) {
      const w = rng.range(10, 20);
      g.push(
        el('rect', {
          x: u(x),
          y: u(y),
          width: u(Math.min(w, 203 - x) - 1.2),
          height: u(8.6),
          rx: u(1.5),
          fill: '#000',
          opacity: rng.range(0.05, 0.25),
        }),
      );
      x += w;
    }
  }
  // slates: rows of short lines on the roof
  for (let row = 0; row < 8; row++) {
    const y = 50 + row * 8.5;
    const half = ((y - 36) / 78) * 92;
    g.push(
      el('path', {
        d: `M${u(122 - half)} ${u(y)}L${u(122 + half)} ${u(y)}`,
        stroke: '#0e1416',
        'stroke-width': u(0.7),
        opacity: 0.7,
      }),
    );
  }
  // the windows: dark, but for the lit one low on the left, and the door
  const win = (/** @type {number} */ x, /** @type {number} */ y, /** @type {boolean} */ lit) => {
    g.push(el('rect', {x: u(x - 2), y: u(y - 2), width: u(22), height: u(30), fill: '#4a5858'}));
    g.push(el('rect', {x: u(x), y: u(y), width: u(18), height: u(26), fill: lit ? '#ffb455' : '#06090b'}));
    if (lit) {
      g.push(el('rect', {x: u(x + 2), y: u(y + 2), width: u(14), height: u(22), fill: '#ffe2a0'}));
      // someone inside, standing at the window
      g.push(
        el('path', {
          d: `M${u(x + 6)} ${u(y + 26)}L${u(x + 7)} ${u(y + 12)}C${u(x + 7)} ${u(y + 6)} ${u(x + 13)} ${u(y + 6)} ${u(x + 13)} ${u(y + 12)}L${u(x + 14)} ${u(y + 26)}Z`,
          fill: '#3a1c08',
          opacity: 0.85,
        }),
      );
    }
    g.push(
      el('path', {
        d: `M${u(x + 9)} ${u(y)}L${u(x + 9)} ${u(y + 26)}M${u(x)} ${u(y + 13)}L${u(x + 18)} ${u(y + 13)}`,
        stroke: lit ? '#4a2208' : '#26302f',
        'stroke-width': u(1.4),
      }),
    );
  };
  win(60, 128, false);
  win(160, 128, false);
  win(110, 128, false);
  win(60, 180, true);
  win(160, 180, false);
  g.push(el('rect', {x: u(106), y: u(178), width: u(26), height: u(52), fill: '#080b0c'}));
  g.push(el('rect', {x: u(104), y: u(176), width: u(30), height: u(4), fill: '#4a5858'}));
  // a broken fence in front
  for (let k = 0; k < 9; k++) {
    const x = 4 + k * 34 + rng.range(-4, 4);
    const lean = rng.range(-4, 4);
    g.push(el('path', {d: `M${u(x)} ${u(232)}L${u(x + lean)} ${u(200)}`, stroke: '#1a2022', 'stroke-width': u(3)}));
  }
  g.push(
    el('path', {
      d: `M${u(4)} ${u(208)}Q${u(80)} ${u(216)} ${u(140)} ${u(210)}`,
      fill: 'none',
      stroke: '#1a2022',
      'stroke-width': u(1),
    }),
  );
  out.push(el('g', {mask: 'url(#fadeMask)'}, g));
  return out;
}

/**
 * The walker, 34 × 84 units: a thin figure in a long coat coming straight at you, arms hanging, its
 * head tilted, a pale face with nothing in it but two hollows. The moon on its left edge.
 */
function walker(/** @type {(v: number) => number} */ u) {
  return [
    // the coat, from narrow shoulders to a ragged hem
    el('path', {
      d: `M${u(10)} ${u(20)}C${u(12)} ${u(17)} ${u(22)} ${u(17)} ${u(24)} ${u(20)}L${u(27)} ${u(40)}L${u(31)} ${u(80)}L${u(27)} ${u(82)}L${u(24)} ${u(79)}L${u(20)} ${u(83)}L${u(16)} ${u(79)}L${u(12)} ${u(83)}L${u(8)} ${u(79)}L${u(3)} ${u(81)}L${u(7)} ${u(40)}Z`,
      fill: 'url(#coatG)',
    }),
    // the arms, hanging too long
    el('path', {
      d: `M${u(9)} ${u(22)}C${u(5)} ${u(34)} ${u(4)} ${u(46)} ${u(4)} ${u(56)}L${u(7)} ${u(56)}C${u(8)} ${u(46)} ${u(9)} ${u(36)} ${u(11)} ${u(28)}Z`,
      fill: '#26302f',
    }),
    el('path', {
      d: `M${u(25)} ${u(22)}C${u(29)} ${u(34)} ${u(30)} ${u(46)} ${u(30)} ${u(56)}L${u(27)} ${u(56)}C${u(26)} ${u(46)} ${u(25)} ${u(36)} ${u(23)} ${u(28)}Z`,
      fill: '#0d1113',
    }),
    el('ellipse', {cx: u(5.5), cy: u(58), rx: u(2), ry: u(3), fill: '#b9c6bf'}),
    el('ellipse', {cx: u(28.5), cy: u(58), rx: u(2), ry: u(3), fill: '#6a7672'}),
    // the head, tilted, with hair falling to one side
    el('g', {transform: `rotate(-9 ${u(17)} ${u(12)})`}, [
      el('ellipse', {cx: u(17), cy: u(11), rx: u(5.4), ry: u(7), fill: '#d6ddd4'}),
      el('ellipse', {cx: u(18.5), cy: u(11.5), rx: u(4), ry: u(6.5), fill: '#9aa7a2', opacity: 0.6}),
      el('ellipse', {cx: u(15), cy: u(10), rx: u(1.3), ry: u(1.8), fill: '#0b0e10'}),
      el('ellipse', {cx: u(19.4), cy: u(10), rx: u(1.3), ry: u(1.8), fill: '#0b0e10'}),
      el('path', {
        d: `M${u(11)} ${u(8)}C${u(12)} ${u(1)} ${u(22)} ${u(1)} ${u(23)} ${u(8)}L${u(24)} ${u(22)}L${u(21)} ${u(15)}C${u(21)} ${u(8)} ${u(14)} ${u(4)} ${u(12)} ${u(10)}Z`,
        fill: '#0a0c0e',
      }),
    ]),
    // moonlight on its left edge
    el('path', {
      d: `M${u(10)} ${u(21)}L${u(7)} ${u(40)}L${u(3.5)} ${u(80)}`,
      fill: 'none',
      stroke: '#9fc7bd',
      'stroke-width': u(0.7),
      opacity: 0.8,
    }),
  ];
}

/** A dead hawthorn bent by the wind, 260 × 300 units: branches grown by recursion, all leaning right. */
function tree(/** @type {(v: number) => number} */ u, /** @type {Rng} */ rng) {
  /** @type {string[]} */
  const dark = [];
  /** @type {string[]} */
  const lit = [];
  const grow = (
    /** @type {number} */ x,
    /** @type {number} */ y,
    /** @type {number} */ a,
    /** @type {number} */ len,
    /** @type {number} */ w,
    /** @type {number} */ depth,
  ) => {
    const bend = 0.35;
    const mx = x + Math.cos(a + bend * 0.5) * len * 0.5;
    const my = y - Math.sin(a + bend * 0.5) * len * 0.5;
    const ex = x + Math.cos(a - bend * 0.4 * (1 - depth * 0.1)) * len;
    const ey = y - Math.sin(a) * len;
    const d = `M${n(u(x))} ${n(u(y))}Q${n(u(mx))} ${n(u(my))} ${n(u(ex))} ${n(u(ey))}`;
    dark.push(el('path', {d, fill: 'none', stroke: '#0a1012', 'stroke-width': u(w), 'stroke-linecap': 'round'}));
    if (w > 1.2)
      lit.push(
        el('path', {
          d,
          fill: 'none',
          stroke: '#87aaa2',
          'stroke-width': u(w * 0.22),
          'stroke-linecap': 'round',
          transform: `translate(${-u(w * 0.35)} ${-u(w * 0.1)})`,
          opacity: 0.75,
        }),
      );
    if (depth >= 6 || len < 7) return;
    const kids = depth < 2 ? 2 : rng.int(2, 3);
    for (let k = 0; k < kids; k++) {
      // the wind: every branch is pulled towards the right, away from the moor's prevailing west
      const spread = rng.range(-0.75, 0.75);
      const na = a + spread - 0.12 * (a - 0.6);
      grow(ex, ey, na, len * rng.range(0.62, 0.8), Math.max(0.6, w * 0.62), depth + 1);
    }
  };
  grow(95, 300, 1.25, 95, 15, 0);
  // the roots in the turf
  dark.push(
    el('path', {
      d: `M${u(60)} ${u(300)}Q${u(90)} ${u(288)} ${u(95)} ${u(292)}Q${u(110)} ${u(286)} ${u(140)} ${u(300)}Z`,
      fill: '#0a1012',
    }),
  );
  return [...dark, ...lit];
}

/** A standing stone, `w` × `h` units, leaning, lichen on it, the moon on its left face. */
function stone(/** @type {number} */ w, /** @type {number} */ h, /** @type {number} */ lean) {
  return (/** @type {(v: number) => number} */ u, /** @type {Rng} */ rng) => {
    const pts = [
      [w * 0.12, h],
      [w * 0.08 + lean, h * 0.35],
      [w * 0.3 + lean, h * 0.06],
      [w * 0.55 + lean, h * 0.02],
      [w * 0.86 + lean * 0.6, h * 0.22],
      [w * 0.92, h],
    ];
    const out = [el('path', {d: path(pts.map(([x, y]) => [u(x), u(y)])), fill: 'url(#stoneG)'})];
    for (let k = 0; k < 14; k++) {
      const x = rng.range(w * 0.2, w * 0.8);
      const y = rng.range(h * 0.15, h * 0.9);
      out.push(
        el('ellipse', {
          cx: u(x),
          cy: u(y),
          rx: u(rng.range(0.8, 3)),
          ry: u(rng.range(0.6, 2)),
          fill: rng.pick(['#9fb48a', '#6c7a5a', '#c7c9a0']),
          opacity: rng.range(0.25, 0.6),
        }),
      );
    }
    for (let k = 0; k < 5; k++) {
      const x = rng.range(w * 0.25, w * 0.75);
      out.push(
        el('path', {
          d: `M${u(x)} ${u(h * 0.2)}l${u(rng.range(-3, 3))} ${u(rng.range(8, 20))}`,
          stroke: '#0c1214',
          'stroke-width': u(0.8),
          opacity: 0.6,
        }),
      );
    }
    out.push(el('rect', {x: 0, y: u(h - 6), width: u(w), height: u(6), fill: '#0d1412', opacity: 0.9, filter: 'url(#b4)'}));
    return out;
  };
}

/** A clump of heather, 90 × 36 units: stems fanning out, tiny flowers, the tips lit by the moon. */
function heather(/** @type {number} */ seed) {
  return (/** @type {(v: number) => number} */ u) => {
    const rng = new Rng(seed);
    const out = [];
    const stems = 70;
    for (let k = 0; k < stems; k++) {
      const x0 = 45 + rng.range(-26, 26);
      const len = rng.range(10, 32) * (1 - Math.abs(x0 - 45) / 60);
      const a = Math.PI / 2 + (x0 - 45) / 40 + rng.range(-0.3, 0.3);
      const x1 = x0 + Math.cos(a) * len;
      const y1 = 36 - Math.sin(a) * len;
      out.push(
        el('path', {
          d: `M${u(x0)} ${u(36)}Q${u((x0 + x1) / 2 + rng.range(-3, 3))} ${u((36 + y1) / 2)} ${u(x1)} ${u(y1)}`,
          fill: 'none',
          stroke: rng.pick(['#1a2420', '#24302a', '#121a18']),
          'stroke-width': u(rng.range(0.8, 1.6)),
          'stroke-linecap': 'round',
        }),
      );
      for (let f = 0; f < 3; f++) {
        const t = 0.6 + f * 0.15;
        out.push(
          el('circle', {
            cx: u(x0 + (x1 - x0) * t + rng.range(-1, 1)),
            cy: u(36 + (y1 - 36) * t),
            r: u(rng.range(0.6, 1.2)),
            fill: rng.pick(['#5a3e5a', '#7a5a78', '#3e2c40']),
            opacity: 0.9,
          }),
        );
      }
      if (x1 < 45) out.push(el('circle', {cx: u(x1), cy: u(y1), r: u(0.7), fill: '#a9c9bd', opacity: 0.8}));
    }
    out.unshift(el('ellipse', {cx: u(45), cy: u(35), rx: u(36), ry: u(6), fill: '#0b110f', filter: 'url(#b4)'}));
    return out;
  };
}

/** @type {Frame[]} */
export const FRAMES = [
  {name: 'sconce', w: 48, h: 64, tx: 4, draw: sconce},
  {name: 'picture-lamp', w: 130, h: 44, tx: 5, draw: pictureLamp},
  {name: 'glow', w: 64, h: 64, tx: 1, draw: glow},
  {name: 'house', w: 300, h: 234, tx: 2, draw: house},
  {name: 'walker', w: 34, h: 84, tx: 4, draw: walker},
  {name: 'tree', w: 260, h: 300, tx: 2, draw: tree},
  {name: 'stone-a', w: 40, h: 92, tx: 3, draw: stone(40, 92, 3)},
  {name: 'stone-b', w: 58, h: 62, tx: 3, draw: stone(58, 62, -4)},
  {name: 'heather-a', w: 90, h: 36, tx: 4, draw: heather(11)},
  {name: 'heather-b', w: 90, h: 36, tx: 4, draw: heather(23)},
  {name: 'heather-c', w: 90, h: 36, tx: 4, draw: heather(37)},
];

export async function renderSprites() {
  const rng = new Rng(7171);
  const inputs = [];
  for (const frame of FRAMES) {
    const w = Math.round(frame.w * frame.tx);
    const h = Math.round(frame.h * frame.tx);
    const u = (/** @type {number} */ v) => v * frame.tx;
    const data = await rasterize(svgDoc(w, h, defs, frame.draw(u, rng)), w, h);
    inputs.push({name: frame.name, img: new Img(w, h, new Uint8Array(data))});
  }
  const {sheet, frames} = pack(inputs, {padding: 6, width: 2048, powerOfTwo: false});
  /** @type {Record<string, {w: number, h: number}>} */
  const units = {};
  for (const frame of FRAMES) units[frame.name] = {w: frame.w, h: frame.h};
  return {sheet, frames, units};
}

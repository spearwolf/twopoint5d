// stage-masks/resolution: the photograph of "Séance Photographs", twice — a widow in mourning
// black seated in a studio of the 1870s (a painted backdrop with a column and a drape, a carpet, a
// carved chair, a table with lilies under a fringed cloth), and the same plate as the spirit
// photographer sold it: a veiled figure standing behind her chair with its hands on her shoulders,
// ectoplasm streaming from her lips, the whole plate gone cold and glowing.
//
// Both are drawn from one SVG scene in grey values, rasterised at 2 texels per unit, then finished
// per pixel: the canvas of the backdrop, a lens vignette, grain, foxing and silvering at the rim,
// and the toning — warm albumen sepia for the living plate, a cold blue-black with ectoplasm green
// for the spirit plate. The arched window of the cabinet card is the alpha of both.
import sharp from 'sharp';
import {fbm, Rng} from '../../lib/image.mjs';
import {blobPath, el, rasterize, rgrad, sat, smoothstep, vgrad, worldDoc} from '../rift/kit.mjs';
import {insideWindow, PHOTO, PX} from './layout.mjs';

const FRAME = {left: -PHOTO.w / 2, right: PHOTO.w / 2, bottom: -PHOTO.h / 2, top: PHOTO.h / 2};
export const PHOTO_W = PHOTO.w * PX;
export const PHOTO_H = PHOTO.h * PX;

/** the floor line of the studio, where the carpet meets the backdrop */
const FLOOR = -118;
/** the sitter: the middle of her head */
const HEAD = {x: 14, y: 64};
/** the spirit: the middle of its veiled head */
const SPIRIT = {x: -10, y: 134};

/** a grey as an SVG colour @param {number} v 0..1 */
const g = (v) => {
  const c = Math.round(sat(v) * 255);
  return `rgb(${c},${c},${c})`;
};

/** @param {[number, number][]} pts */
const smooth = (pts) => blobPath(pts);

/** The painted backdrop: a column on a plinth at the left, a heavy drape at the right. */
function backdrop() {
  const out = [];
  // the column: a fluted shaft with a capital, painted pale and soft
  const cx = -104;
  out.push(el('rect', {x: cx - 22, y: FLOOR + 30, width: 44, height: 200, fill: 'url(#shaft)', opacity: 0.85}));
  for (let i = -2; i <= 2; i++) {
    out.push(el('rect', {x: cx + i * 8 - 1.2, y: FLOOR + 32, width: 2.4, height: 196, fill: g(0.38), opacity: 0.55}));
  }
  out.push(el('rect', {x: cx - 30, y: FLOOR + 228, width: 60, height: 10, fill: g(0.62)}));
  out.push(el('rect', {x: cx - 26, y: FLOOR + 238, width: 52, height: 6, fill: g(0.5)}));
  out.push(el('rect', {x: cx - 34, y: FLOOR, width: 68, height: 30, fill: g(0.55)}));
  out.push(el('rect', {x: cx - 38, y: FLOOR + 26, width: 76, height: 6, fill: g(0.64)}));
  // a balustrade running behind, painted in the haze of the backdrop
  out.push(el('rect', {x: -140, y: FLOOR + 52, width: 280, height: 6, fill: g(0.5), opacity: 0.6}));
  out.push(el('rect', {x: -140, y: FLOOR + 2, width: 280, height: 4, fill: g(0.42), opacity: 0.5}));
  for (let x = -66; x < 140; x += 17) {
    out.push(
      el('path', {
        d: `M${x - 4} ${FLOOR + 6}C${x - 7} ${FLOOR + 20} ${x - 1} ${FLOOR + 30} ${x - 3} ${FLOOR + 52}L${x + 3} ${FLOOR + 52}C${x + 1} ${FLOOR + 30} ${x + 7} ${FLOOR + 20} ${x + 4} ${FLOOR + 6}Z`,
        fill: g(0.46),
        opacity: 0.55,
      }),
    );
  }
  // the drape: heavy velvet folds from the top right, gathered by a tasselled cord
  const folds = [];
  for (let i = 0; i < 7; i++) {
    const x0 = 64 + i * 13;
    const tone = i % 2 ? 0.16 : 0.26;
    folds.push(
      el('path', {
        d: `M${x0} 200C${x0 + 4} 120 ${x0 + 30 - i * 2} 60 ${x0 + 40 - i * 3} 10C${x0 + 44} -40 ${x0 + 36} -90 ${x0 + 40} ${FLOOR - 10}L${x0 + 56} ${FLOOR - 10}C${x0 + 54} -80 ${x0 + 58} -30 ${x0 + 54} 14C${x0 + 46} 70 ${x0 + 20} 130 ${x0 + 14} 200Z`,
        fill: g(tone),
      }),
    );
  }
  out.push(el('g', {filter: 'url(#soft2)'}, folds));
  out.push(el('ellipse', {cx: 122, cy: 18, rx: 14, ry: 6, fill: g(0.5)}));
  out.push(el('path', {d: 'M118 16C114 0 112 -14 116 -26L124 -26C126 -12 126 2 126 16Z', fill: g(0.42)}));
  return out;
}

/** The carpet: a floral pattern in perspective, darker to the front. */
function carpet() {
  const out = [el('rect', {x: -140, y: -190, width: 280, height: FLOOR + 190, fill: 'url(#floor)'})];
  for (let row = 0; row < 6; row++) {
    const y = FLOOR - 8 - row * row * 3.2 - row * 6;
    const ry = 2 + row * 1.1;
    const step = 30 + row * 8;
    for (let x = -150 + (row % 2) * step * 0.5; x < 150; x += step) {
      out.push(el('ellipse', {cx: x, cy: y, rx: ry * 2.6, ry, fill: g(0.3), opacity: 0.6}));
      out.push(el('ellipse', {cx: x, cy: y, rx: ry * 1.1, ry: ry * 0.45, fill: g(0.12), opacity: 0.7}));
    }
  }
  return out;
}

/** The table at the left: a round top under a fringed cloth, a vase of lilies, a small portrait. */
function table() {
  const out = [];
  const x = -92;
  const top = -26;
  // the pedestal and its claw feet
  out.push(
    el('path', {d: `M${x - 5} ${top - 60}L${x + 5} ${top - 60}L${x + 7} ${FLOOR - 40}L${x - 7} ${FLOOR - 40}Z`, fill: g(0.1)}),
  );
  out.push(
    el('path', {
      d: `M${x - 28} ${FLOOR - 46}Q${x} ${FLOOR - 30} ${x + 28} ${FLOOR - 46}L${x + 24} ${FLOOR - 40}Q${x} ${FLOOR - 26} ${x - 24} ${FLOOR - 40}Z`,
      fill: g(0.08),
    }),
  );
  // the cloth: falls in folds, with a fringe
  out.push(
    el('path', {
      d: `M${x - 42} ${top}C${x - 46} ${top - 30} ${x - 50} ${top - 50} ${x - 46} ${top - 62}L${x + 46} ${top - 62}C${x + 50} ${top - 50} ${x + 46} ${top - 30} ${x + 42} ${top}Z`,
      fill: 'url(#cloth)',
    }),
  );
  for (let i = -44; i <= 44; i += 3) {
    out.push(el('rect', {x: x + i - 0.5, y: top - 70, width: 1, height: 8, fill: g(0.36), opacity: 0.8}));
  }
  for (let i = -3; i <= 3; i++) {
    out.push(
      el('path', {
        d: `M${x + i * 13} ${top - 4}Q${x + i * 14 + 3} ${top - 34} ${x + i * 15} ${top - 60}`,
        stroke: g(0.12),
        'stroke-width': 2.4,
        fill: 'none',
        opacity: 0.6,
      }),
    );
  }
  out.push(el('ellipse', {cx: x, cy: top, rx: 42, ry: 7, fill: g(0.46)}));
  // a small portrait in a stand: a man, long gone
  out.push(
    el('rect', {x: x + 10, y: top + 2, width: 22, height: 28, fill: g(0.55), transform: `rotate(-6 ${x + 21} ${top + 16})`}),
  );
  out.push(
    el('rect', {x: x + 13, y: top + 5, width: 16, height: 22, fill: g(0.2), transform: `rotate(-6 ${x + 21} ${top + 16})`}),
  );
  out.push(
    el('ellipse', {cx: x + 21.5, cy: top + 19, rx: 4, ry: 5, fill: g(0.6), transform: `rotate(-6 ${x + 21} ${top + 16})`}),
  );
  out.push(
    el('path', {
      d: `M${x + 14} ${top + 6}Q${x + 21} ${top + 14} ${x + 28} ${top + 6}`,
      fill: g(0.12),
      transform: `rotate(-6 ${x + 21} ${top + 16})`,
    }),
  );
  // the vase and the lilies, white trumpets that catch the light of the skylight
  out.push(
    el('path', {
      d: smooth([
        [x - 16, top + 1],
        [x - 13, top + 16],
        [x - 19, top + 32],
        [x - 21, top + 42],
        [x - 27, top + 42],
        [x - 29, top + 32],
        [x - 35, top + 16],
        [x - 32, top + 1],
      ]),
      fill: 'url(#vase)',
    }),
  );
  const stems = [
    [-30, 108, -10],
    [-14, 96, 8],
    [-44, 90, -22],
    [-22, 122, 2],
    [-38, 70, -16],
  ];
  for (const [dx, h, lean] of stems) {
    const sx = x - 24;
    const ex = x + dx + lean;
    const ey = top + h;
    out.push(
      el('path', {
        d: `M${sx} ${top + 40}Q${sx + lean * 0.3} ${top + h * 0.6} ${ex} ${ey}`,
        stroke: g(0.18),
        'stroke-width': 1.6,
        fill: 'none',
      }),
    );
    // the trumpet of the lily: six petals flaring away from the stem
    const flower = [];
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + lean * 0.05;
      const px = ex + Math.cos(a) * 9;
      const py = ey + Math.sin(a) * 6 + 4;
      flower.push(
        el('path', {
          d: `M${ex} ${ey - 3}Q${(ex + px) / 2 + Math.sin(a) * 3} ${(ey + py) / 2 - Math.cos(a) * 2} ${px} ${py}Q${(ex + px) / 2 - Math.sin(a) * 2} ${(ey + py) / 2 + Math.cos(a) * 3} ${ex} ${ey - 3}Z`,
          fill: g(0.86 - (k % 3) * 0.08),
        }),
      );
    }
    out.push(el('g', {}, flower));
    out.push(el('circle', {cx: ex, cy: ey + 1, r: 1.6, fill: g(0.4)}));
    // two long leaves on each stem
    out.push(
      el('path', {
        d: `M${sx + lean * 0.2} ${top + 60}Q${sx + lean * 0.2 + 16} ${top + 70} ${sx + lean * 0.2 + 22} ${top + 82}Q${sx + lean * 0.2 + 8} ${top + 72} ${sx + lean * 0.2} ${top + 60}Z`,
        fill: g(0.2),
      }),
    );
  }
  return out;
}

/** The carved chair behind the sitter: a tall back with finials and buttoned upholstery. */
function chair() {
  const out = [];
  const cx = HEAD.x;
  out.push(el('path', {d: `M${cx - 44} -10L${cx - 40} 96Q${cx} 112 ${cx + 40} 96L${cx + 44} -10Z`, fill: 'url(#upholstery)'}));
  for (let row = 0; row < 4; row++) {
    for (let col = -2; col <= 2; col++) {
      const bx = cx + col * 17 + (row % 2) * 8.5;
      if (Math.abs(bx - cx) > 34) continue;
      out.push(el('circle', {cx: bx, cy: 82 - row * 22, r: 1.6, fill: g(0.04)}));
    }
  }
  for (const side of [-1, 1]) {
    const px = cx + side * 44;
    out.push(el('path', {d: `M${px - 5} -60L${px + 5} -60L${px + 4} 98L${px - 4} 98Z`, fill: g(0.12)}));
    out.push(el('circle', {cx: px, cy: 102, r: 6, fill: g(0.2)}));
    out.push(el('circle', {cx: px - 1.5, cy: 104, r: 2, fill: g(0.45)}));
    out.push(el('path', {d: `M${px - 4} 107Q${px} 118 ${px + 4} 107Z`, fill: g(0.18)}));
    // the arm of the chair, a curl of carved wood beside the skirt
    out.push(
      el('path', {
        d: `M${px} -6Q${px + side * 18} -2 ${px + side * 16} -22Q${px + side * 12} -30 ${px + side * 2} -24Z`,
        fill: g(0.16),
      }),
    );
    out.push(el('circle', {cx: px + side * 14, cy: -16, r: 3, fill: g(0.38)}));
  }
  out.push(el('path', {d: `M${cx - 40} 96Q${cx} 116 ${cx + 40} 96Q${cx} 108 ${cx - 40} 96Z`, fill: g(0.3)}));
  out.push(el('path', {d: `M${cx - 8} 108Q${cx} 122 ${cx + 8} 108Q${cx} 114 ${cx - 8} 108Z`, fill: g(0.34)}));
  return out;
}

/** The sitter: a widow in mourning black, her hands folded over a handkerchief. */
function sitter() {
  const out = [];
  const {x, y} = HEAD;
  // the skirt: a bell of black silk over the lap down to the carpet, folds catching the skylight
  out.push(
    el('path', {
      d: smooth([
        [x - 26, 4],
        [x - 52, -30],
        [x - 70, -90],
        [x - 82, -150],
        [x - 40, -160],
        [x, -162],
        [x + 44, -160],
        [x + 84, -150],
        [x + 72, -90],
        [x + 54, -30],
        [x + 26, 4],
        [x, 8],
      ]),
      fill: 'url(#silk)',
    }),
  );
  const folds = [];
  for (let i = -4; i <= 4; i++) {
    folds.push(
      el('path', {
        d: `M${x + i * 7} -36Q${x + i * 12} -100 ${x + i * 17} -156`,
        stroke: g(i % 2 ? 0.2 : 0.02),
        'stroke-width': i % 2 ? 2.2 : 3.4,
        fill: 'none',
      }),
    );
  }
  out.push(el('g', {filter: 'url(#soft1)'}, folds));
  // the lap, where the light falls
  out.push(el('ellipse', {cx: x, cy: -34, rx: 46, ry: 12, fill: g(0.2), filter: 'url(#soft3)'}));
  // the bodice: fitted, buttoned, a jet brooch at the collar
  out.push(
    el('path', {
      d: smooth([
        [x - 20, 6],
        [x - 26, 24],
        [x - 40, 36],
        [x - 24, 44],
        [x, 46],
        [x + 24, 44],
        [x + 40, 36],
        [x + 26, 24],
        [x + 20, 6],
        [x, 2],
      ]),
      fill: 'url(#bodice)',
    }),
  );
  for (let i = 0; i < 6; i++) out.push(el('circle', {cx: x, cy: 40 - i * 6.4, r: 0.9, fill: g(0.4)}));
  // the sleeves: full at the shoulder, narrow to the wrist, the arms bent to the lap
  for (const side of [-1, 1]) {
    out.push(
      el('path', {
        d: smooth([
          [x + side * 28, 42],
          [x + side * 44, 34],
          [x + side * 48, 10],
          [x + side * 42, -16],
          [x + side * 24, -30],
          [x + side * 12, -26],
          [x + side * 26, -14],
          [x + side * 32, 8],
          [x + side * 24, 26],
        ]),
        fill: g(0.07),
      }),
    );
    out.push(
      el('path', {
        d: `M${x + side * 40} 30Q${x + side * 46} 6 ${x + side * 36} -14`,
        stroke: g(0.24),
        'stroke-width': 1.6,
        fill: 'none',
        filter: 'url(#soft1)',
      }),
    );
    out.push(
      el('path', {
        d: `M${x + side * 22} -26Q${x + side * 18} -30 ${x + side * 14} -27`,
        stroke: g(0.78),
        'stroke-width': 2.2,
        fill: 'none',
      }),
    );
  }
  // the hands, folded, and the handkerchief between them
  out.push(
    el('path', {
      d: smooth([
        [x - 16, -24],
        [x - 4, -20],
        [x + 8, -24],
        [x + 14, -32],
        [x + 2, -36],
        [x - 12, -34],
      ]),
      fill: 'url(#skin)',
    }),
  );
  out.push(
    el('path', {
      d: smooth([
        [x + 2, -30],
        [x + 12, -32],
        [x + 17, -40],
        [x + 9, -42],
        [x + 3, -38],
      ]),
      fill: g(0.72),
    }),
  );
  out.push(el('path', {d: `M${x - 10} -27Q${x - 2} -30 ${x + 6} -27`, stroke: g(0.42), 'stroke-width': 0.8, fill: 'none'}));
  out.push(el('circle', {cx: x - 4, cy: -27.6, r: 1.3, fill: g(0.95)}));
  // the neck and the collar of white lace, scalloped
  out.push(el('path', {d: `M${x - 6} ${y - 22}L${x + 6} ${y - 22}L${x + 7} ${y - 12}L${x - 7} ${y - 12}Z`, fill: g(0.62)}));
  const lace = [];
  for (let i = -5; i <= 5; i++) lace.push(el('circle', {cx: x + i * 2.4, cy: y - 22 - Math.abs(i) * 0.5, r: 1.8, fill: g(0.92)}));
  out.push(el('g', {}, lace));
  out.push(el('ellipse', {cx: x, cy: y - 25, rx: 3.2, ry: 4, fill: g(0.05)}));
  out.push(el('ellipse', {cx: x - 0.8, cy: y - 24, rx: 1, ry: 1.3, fill: g(0.55)}));
  // the head: lit from the skylight at the upper left
  out.push(el('ellipse', {cx: x, cy: y, rx: 13, ry: 17, fill: 'url(#face)'}));
  // the hair: parted in the middle, drawn flat over the ears into a bun behind
  out.push(el('ellipse', {cx: x + 2, cy: y + 13, rx: 12, ry: 6, fill: g(0.08)}));
  out.push(
    el('path', {
      d: `M${x - 13} ${y - 2}Q${x - 15} ${y + 15} ${x} ${y + 17}Q${x + 15} ${y + 15} ${x + 13} ${y - 2}Q${x + 9} ${y + 9} ${x} ${y + 10}Q${x - 9} ${y + 9} ${x - 13} ${y - 2}Z`,
      fill: g(0.07),
    }),
  );
  out.push(el('path', {d: `M${x} ${y + 16.5}L${x} ${y + 10}`, stroke: g(0.5), 'stroke-width': 0.7}));
  out.push(
    el('path', {
      d: `M${x - 9} ${y + 12}Q${x - 4} ${y + 15} ${x - 1} ${y + 14}`,
      stroke: g(0.3),
      'stroke-width': 0.7,
      fill: 'none',
    }),
  );
  // a widow's cap of black crape, a point on the brow
  out.push(
    el('path', {d: `M${x - 15} ${y + 8}Q${x} ${y + 26} ${x + 15} ${y + 8}Q${x} ${y + 20} ${x - 15} ${y + 8}Z`, fill: g(0.03)}),
  );
  // the face: tired eyes in shadow, the nose lit from the left, a mouth pressed thin
  const face = [];
  for (const ex of [-4.8, 4.8]) {
    face.push(el('ellipse', {cx: x + ex, cy: y + 3, rx: 3.6, ry: 2.3, fill: g(0.3), filter: 'url(#soft1)'}));
    face.push(el('ellipse', {cx: x + ex, cy: y + 2.6, rx: 1.9, ry: 1, fill: g(0.08)}));
    face.push(
      el('path', {
        d: `M${x + ex - 3.4} ${y + 6.4}Q${x + ex} ${y + 7.8} ${x + ex + 3.4} ${y + 6.2}`,
        stroke: g(0.16),
        'stroke-width': 0.9,
        fill: 'none',
      }),
    );
  }
  face.push(
    el('path', {
      d: `M${x + 1} ${y + 1}L${x + 2.6} ${y - 6}L${x + 0.4} ${y - 6.6}`,
      stroke: g(0.36),
      'stroke-width': 0.9,
      fill: 'none',
    }),
  );
  face.push(
    el('path', {
      d: `M${x - 3.6} ${y - 10.2}Q${x} ${y - 9.4} ${x + 3.6} ${y - 10.4}`,
      stroke: g(0.24),
      'stroke-width': 1.1,
      fill: 'none',
    }),
  );
  face.push(el('ellipse', {cx: x + 6, cy: y - 3, rx: 4, ry: 6, fill: g(0.3), opacity: 0.4, filter: 'url(#soft2)'}));
  out.push(el('g', {}, face));
  return out;
}

/**
 * The spirit, the part behind the chair: a veiled head and shoulders over the back of the chair,
 * the veil falling on behind it and spilling out at both sides, thinning to nothing. White on
 * transparent.
 */
function spiritBody() {
  const out = [];
  const {x, y} = SPIRIT;
  out.push(
    el('path', {
      d: smooth([
        [x, y + 22],
        [x + 13, y + 16],
        [x + 16, y - 2],
        [x + 22, y - 22],
        [x + 46, y - 36],
        [x + 70, y - 70],
        [x + 84, y - 140],
        [x + 76, y - 230],
        [x + 20, y - 250],
        [x - 50, y - 236],
        [x - 78, y - 150],
        [x - 66, y - 70],
        [x - 42, y - 36],
        [x - 18, y - 22],
        [x - 14, y - 2],
        [x - 13, y + 16],
      ]),
      fill: 'url(#veil)',
      filter: 'url(#soft1)',
    }),
  );
  const pleats = [];
  for (let i = -5; i <= 5; i++) {
    pleats.push(
      el('path', {
        d: `M${x + i * 2} ${y - 6}Q${x + i * 7} ${y - 60} ${x + i * 15} ${y - 240}`,
        stroke: '#fff',
        'stroke-opacity': i % 2 ? 0.4 : 0.1,
        'stroke-width': 2.4,
        fill: 'none',
      }),
    );
  }
  out.push(el('g', {filter: 'url(#soft2)'}, pleats));
  // the face under the veil: hollows where the eyes should be, a mouth that hangs open
  for (const [ex, ey, rx, ry, op] of [
    [-5, 1, 3.6, 3.2, 0.42],
    [5.5, 0.6, 3.6, 3.2, 0.42],
    [0.4, -9, 1.6, 2.2, 0.2],
  ]) {
    out.push(el('ellipse', {cx: x + ex, cy: y + ey, rx, ry, fill: '#000', opacity: op, filter: 'url(#soft2)'}));
  }
  return out;
}

/** The spirit's long pale hands, laid on her shoulders from behind: in front of everything. */
function spiritHands() {
  const out = [];
  for (const [side, hx] of /** @type {[number, number][]} */ ([
    [-1, HEAD.x - 27],
    [1, HEAD.x + 29],
  ])) {
    const hy = 41;
    // the hand lies on the shoulder, the fingers hang down over the front of it
    out.push(
      el('path', {
        d: smooth([
          [hx - 8, hy + 3],
          [hx, hy + 6],
          [hx + 8, hy + 3],
          [hx + 7, hy - 3],
          [hx - 7, hy - 3],
        ]),
        fill: '#fff',
        opacity: 0.62,
      }),
    );
    const fingers = [];
    for (let k = 0; k < 4; k++) {
      const fx = hx + (k - 1.5) * 2.9;
      const len = k === 1 || k === 2 ? 14 : 11;
      fingers.push(
        el('path', {
          d: `M${fx} ${hy}Q${fx - side * 1.2} ${hy - len * 0.55} ${fx - side * 0.4} ${hy - len}`,
          stroke: '#fff',
          'stroke-width': 2.4,
          'stroke-linecap': 'round',
          fill: 'none',
          opacity: 0.62,
        }),
      );
    }
    out.push(el('g', {filter: 'url(#soft05)'}, fingers));
    // the wrist goes back over her shoulder into the veil behind
    out.push(
      el('path', {
        d: `M${hx + side * 2} ${hy + 4}Q${hx + side * 10} ${hy + 22} ${SPIRIT.x + side * 30} ${SPIRIT.y - 44}`,
        stroke: '#fff',
        'stroke-opacity': 0.22,
        'stroke-width': 7,
        'stroke-linecap': 'round',
        fill: 'none',
        filter: 'url(#soft1)',
      }),
    );
  }
  return out;
}

/** The ectoplasm from her lips: a fall of gauzy matter over her chest into the lap. */
function ectoplasm() {
  const {x, y} = HEAD;
  const out = [];
  const strands = [
    [0, 9, 0.7],
    [-3, 5, 0.55],
    [4, 4, 0.5],
    [-1, 2, 0.9],
  ];
  for (const [dx, width, op] of strands) {
    out.push(
      el('path', {
        d: `M${x + dx * 0.3} ${y - 11}C${x + dx - 2} ${y - 26} ${x + dx * 3 + 6} ${y - 44} ${x + dx * 2 - 4} ${y - 62}C${x + dx * 4 - 12} ${y - 78} ${x + dx * 3 + 8} ${y - 92} ${x + dx * 5 - 2} ${y - 104}`,
        stroke: '#fff',
        'stroke-width': width,
        'stroke-linecap': 'round',
        'stroke-opacity': op,
        fill: 'none',
      }),
    );
  }
  // where it pools in her lap
  out.push(el('ellipse', {cx: x - 2, cy: y - 104, rx: 22, ry: 7, fill: '#fff', opacity: 0.55}));
  return [el('g', {filter: 'url(#soft1)'}, out)];
}

const DEFS = [
  vgrad('shaft', 0, 160, [
    [0, '#6a6a6a'],
    [1, '#8e8e8e'],
  ]),
  vgrad('floor', -190, FLOOR, [
    [0, '#1a1a1a'],
    [1, '#4a4a4a'],
  ]),
  vgrad('cloth', -90, -26, [
    [0, '#1c1c1c'],
    [1, '#3a3a3a'],
  ]),
  vgrad('vase', -26, 16, [
    [0, '#2a2a2a'],
    [1, '#7a7a7a'],
  ]),
  vgrad('upholstery', -10, 120, [
    [0, '#0e0e0e'],
    [1, '#2c2c2c'],
  ]),
  vgrad('silk', -160, 8, [
    [0, '#060606'],
    [0.6, '#151515'],
    [1, '#0c0c0c'],
  ]),
  vgrad('bodice', 2, 46, [
    [0, '#0a0a0a'],
    [1, '#1e1e1e'],
  ]),
  rgrad('face', HEAD.x - 5, HEAD.y + 6, 22, [
    [0, '#d8d8d8'],
    [0.55, '#a8a8a8'],
    [1, '#5a5a5a'],
  ]),
  rgrad('skin', HEAD.x - 6, -24, 22, [
    [0, '#d0d0d0'],
    [1, '#8a8a8a'],
  ]),
  vgrad('veil', SPIRIT.y - 214, SPIRIT.y + 26, [
    [0, '#ffffff', 0],
    [0.45, '#ffffff', 0.38],
    [0.85, '#ffffff', 0.72],
    [1, '#ffffff', 0.8],
  ]),
  el('filter', {id: 'soft05', x: '-50%', y: '-50%', width: '200%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 0.6})),
  el('filter', {id: 'soft1', x: '-50%', y: '-50%', width: '200%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 1})),
  el('filter', {id: 'soft2', x: '-50%', y: '-50%', width: '200%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 2.4})),
  el('filter', {id: 'soft3', x: '-50%', y: '-50%', width: '200%', height: '200%'}, el('feGaussianBlur', {stdDeviation: 6})),
];

/** @typedef {[number, number, number]} RGB */

/**
 * The toning of a grey value: the living plate in warm albumen sepia, the spirit plate cold.
 * @param {number} l @param {boolean} cold @returns {RGB}
 */
function tone(l, cold) {
  if (!cold) {
    // shadows a warm umber, highlights the cream of albumen paper
    return [sat(0.05 + l * 0.98), sat(0.03 + l * 0.82 + l * l * 0.05), sat(0.02 + l * 0.58 + l * l * 0.2)];
  }
  // a blue-black plate whose highlights turn the green of ectoplasm
  return [sat(0.01 + l * 0.46 + l * l * 0.2), sat(0.03 + l * 0.82), sat(0.06 + l * 0.7 + l * l * 0.04)];
}

/**
 * Renders both plates. Straight alpha: the arched window of the card, anti-aliased.
 * @returns {Promise<{living: Buffer, spirit: Buffer}>}
 */
export async function renderPhotographs() {
  const w = PHOTO_W;
  const h = PHOTO_H;
  const doc = (/** @type {string[]} */ body) => worldDoc(DEFS, body, FRAME);
  // the studio in two depths, so that the spirit can stand between them
  const back = await rasterize(doc([...backdrop(), ...carpet(), ...table()]), w, h);
  const front = await rasterize(doc([...chair(), ...sitter()]), w, h);
  const body = await rasterize(doc(spiritBody()), w, h);
  const hands = await rasterize(doc([...spiritHands(), ...ectoplasm()]), w, h);
  const halo = await rasterize(
    doc([el('g', {filter: 'url(#soft3)'}, [...spiritBody(), ...spiritHands(), ...ectoplasm()])]),
    w,
    h,
  );

  const rng = new Rng(1873);
  // foxing: brown spots of age, the same on both plates
  const spots = [];
  for (let i = 0; i < 26; i++)
    spots.push({x: rng.range(-140, 140), y: rng.range(-190, 190), r: rng.range(0.6, 3.2), a: rng.range(0.15, 0.5)});

  const living = new Float32Array(w * h * 4);
  const spiritPlate = new Float32Array(w * h * 4);
  for (let py = 0; py < h; py++) {
    const y = FRAME.top - (py + 0.5) / PX;
    for (let px = 0; px < w; px++) {
      const x = FRAME.left + (px + 0.5) / PX;
      const i = py * w + px;
      const j = i * 4;
      // the backdrop canvas: a mottled grey, lighter where the skylight falls behind the sitter
      let bg = 0.36 + (fbm(x * 0.018, y * 0.018, 11, 5) - 0.5) * 0.22;
      bg += 0.2 * Math.exp(-((x - 10) ** 2 + (y - 70) ** 2) / (2 * 90 * 90));
      const lBack = bg + (back[j] / 255 - bg) * (back[j + 3] / 255);
      const fa = front[j + 3] / 255;
      const fl = front[j] / 255;
      // the skylight from the upper left, a soft fall-off to the floor; the lens vignette
      const vx = x / 140;
      const vy = (y - 10) / 190;
      const light =
        (0.82 + 0.3 * smoothstep(-190, 190, y - x * 0.3)) * (1 - 0.55 * Math.min(1, (vx * vx * 0.9 + vy * vy) * 0.6) ** 1.6);
      // grain, and silvering: the shadows of an old albumen print turn mirror-like at the rim
      const grain = (rng.next() - 0.5) * 0.05 + (fbm(x * 0.9, y * 0.9, 3, 2) - 0.5) * 0.04;
      const fade = 0.25 * sat(1 - insideWindow(x, y) / 16);
      let fox = 0;
      for (const sp of spots) {
        const d = Math.hypot(x - sp.x, y - sp.y);
        if (d < sp.r * 2) fox = Math.max(fox, sp.a * (1 - smoothstep(sp.r * 0.6, sp.r * 2, d)));
      }

      const lLiving = sat((lBack + (fl - lBack) * fa) * light + grain);
      const warm = tone(lLiving, false);
      living[j] = sat(warm[0] * (1 - fox * 0.3) + fade * 0.22);
      living[j + 1] = sat(warm[1] * (1 - fox * 0.5) + fade * 0.2);
      living[j + 2] = sat(warm[2] * (1 - fox * 0.7) + fade * 0.18);

      // the spirit plate: the studio sinks into the dark, the spirit stands between its depths
      const ba = body[j + 3] / 255;
      const veil = ba * (0.55 + 0.45 * fbm(x * 0.06, y * 0.03, 41, 3)) * (body[j] / 255);
      let ls = lBack * 0.55;
      ls = ls + (0.95 - ls) * veil + (ba - veil) * -ls;
      ls = ls + (fl * 0.62 - ls) * fa;
      const ha = hands[j + 3] / 255;
      ls = ls + (0.97 - ls) * ha;
      // the glow of the spirit, and a mist that hangs in the plate
      ls += (halo[j + 3] / 255) * 0.34 + smoothstep(0.5, 0.82, fbm(x * 0.02 + 7, y * 0.012, 23, 5)) * 0.14;
      const lSpirit = sat(ls * (0.4 + 0.6 * light) + grain * 1.3);
      const cold = tone(lSpirit, true);
      spiritPlate[j] = sat(cold[0] + fade * 0.1);
      spiritPlate[j + 1] = sat(cold[1] + fade * 0.24);
      spiritPlate[j + 2] = sat(cold[2] + fade * 0.22);

      // the arched window of the card is the alpha, anti-aliased over one texel
      const a = sat(insideWindow(x, y) * PX + 0.5);
      living[j + 3] = a;
      spiritPlate[j + 3] = a;
    }
  }
  return {living: await encode(living, w, h), spirit: await encode(spiritPlate, w, h)};
}

/**
 * A breath of softness, as a lens and a print give a photograph, then webp with alpha.
 * @param {Float32Array} rgbaf @param {number} w @param {number} h
 */
async function encode(rgbaf, w, h) {
  const bytes = new Uint8Array(w * h * 4);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.round(sat(rgbaf[i]) * 255);
  const soft = await sharp(Buffer.from(bytes.buffer), {raw: {width: w, height: h, channels: 4}})
    .blur(0.55)
    .raw()
    .toBuffer();
  // the blur would bleed the rim: put the alpha back and keep no colour where it is 0
  for (let i = 0; i < bytes.length; i += 4) {
    soft[i + 3] = bytes[i + 3];
    if (bytes[i + 3] === 0) soft[i] = soft[i + 1] = soft[i + 2] = 0;
  }
  return sharp(soft, {raw: {width: w, height: h, channels: 4}})
    .webp({quality: 90, alphaQuality: 95, effort: 6, smartSubsample: true})
    .toBuffer();
}

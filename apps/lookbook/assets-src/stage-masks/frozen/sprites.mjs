// stage-masks/frozen: the sprites of "The Moth Chapel" — the four faces the demo wraps around the
// spheres of the sitters' heads, the planchette, and two moths that flutter at the window. Every
// sprite is SVG, rasterised by sharp's librsvg.
//
// A face is an equirectangular map of a whole head, 512 × 256 texels for 360° × 180°: longitude 0
// (the middle of the face) in the middle, the crown at the top row, the neck at the bottom. It is
// drawn 8 texels wider on each side with what lies across the seam at the back of the head, so a
// sampler that reads up to its edge never sees the padding of the atlas.
import {Img} from '../../lib/image.mjs';
import {pack} from '../../lib/pack.mjs';
import {blurFilter, el, rasterize, svgDoc} from '../spotlight/svg.mjs';

/** texels of a face map for 360°, and its height for 180° */
export const FACE_W = 512;
export const FACE_H = 256;
/** the strip of the far side of the seam on each side of a face map */
export const FACE_WRAP = 8;
/**
 * @typedef {object} FaceSpec
 * @property {string} name
 * @property {string} skin @property {string} skinDark @property {string} lips
 * @property {string} hair @property {string} hairLight
 * @property {string} iris
 * @property {'parted' | 'bald' | 'side'} style
 * @property {boolean} bun
 * @property {boolean} rolled the eyes turned up, the whites showing
 * @property {boolean} [whiskers] @property {boolean} [wrinkles] @property {boolean} [earrings]
 */

/** @type {FaceSpec[]} */
const FACES = [
  {
    name: 'face-medium',
    skin: '#dcc4ae',
    skinDark: '#9a7a66',
    lips: '#6e3e40',
    hair: '#17110e',
    hairLight: '#3a2c24',
    iris: '#5d5a58',
    style: 'parted',
    bun: true,
    rolled: true,
  },
  {
    name: 'face-widower',
    skin: '#d2a88c',
    skinDark: '#8a5e48',
    lips: '#8a5450',
    hair: '#8c8680',
    hairLight: '#c8c2b8',
    iris: '#8a989c',
    style: 'bald',
    bun: false,
    rolled: false,
    whiskers: true,
    wrinkles: true,
  },
  {
    name: 'face-sister',
    skin: '#e4d0c0',
    skinDark: '#a08474',
    lips: '#8a5a58',
    hair: '#4a2214',
    hairLight: '#8a4a2c',
    iris: '#6c7a62',
    style: 'parted',
    bun: true,
    rolled: false,
    earrings: true,
  },
  {
    name: 'face-nephew',
    skin: '#d6baa2',
    skinDark: '#8e6c58',
    lips: '#7e5048',
    hair: '#241810',
    hairLight: '#4e3624',
    iris: '#2c2018',
    style: 'side',
    bun: false,
    rolled: false,
  },
];

/** @param {number} v */
const f = (v) => (Math.round(v * 100) / 100).toString();

/** an eye at (x, y) of the face, in texels from the middle of the face @param {FaceSpec} s @param {number} x @param {number} y @param {number} side */
function eye(s, x, y, side) {
  const w = 12.5;
  const almond = `M${f(x - w)} ${f(y)}Q${f(x)} ${f(y - 7.5)} ${f(x + w)} ${f(y - 0.5)}Q${f(x)} ${f(y + 5.5)} ${f(x - w)} ${f(y)}Z`;
  const id = `eye-${s.name}-${side}-${Math.round(x)}`;
  const out = [
    // the socket, darker, a little above
    el('ellipse', {cx: x, cy: y - 2, rx: 18, ry: 10.5, fill: s.skinDark, 'fill-opacity': 0.42, filter: 'url(#soft3)'}),
    el('ellipse', {cx: x, cy: y + 6, rx: 12, ry: 4, fill: s.skinDark, 'fill-opacity': 0.3, filter: 'url(#soft2)'}),
    el('clipPath', {id}, el('path', {d: almond})),
    el('path', {d: almond, fill: '#e6ddd0'}),
  ];
  const iy = s.rolled ? y - 7.5 : y - 0.5;
  out.push(
    el('g', {'clip-path': `url(#${id})`}, [
      el('circle', {cx: x + side * 0.6, cy: iy, r: 5.2, fill: s.iris}),
      el('circle', {
        cx: x + side * 0.6,
        cy: iy,
        r: 5.2,
        fill: 'none',
        stroke: '#141010',
        'stroke-width': 0.9,
        'stroke-opacity': 0.7,
      }),
      el('circle', {cx: x + side * 0.6, cy: iy, r: s.rolled ? 1.6 : 2.1, fill: '#070505'}),
      // the lid's shadow on the ball
      el('path', {
        d: `M${f(x - w)} ${f(y - 3)}Q${f(x)} ${f(y - 9.5)} ${f(x + w)} ${f(y - 3.5)}L${f(x + w)} ${f(y - 9)}L${f(x - w)} ${f(y - 9)}Z`,
        fill: '#000',
        'fill-opacity': 0.28,
      }),
    ]),
  );
  out.push(
    el('path', {
      d: `M${f(x - w - 1)} ${f(y + 0.4)}Q${f(x)} ${f(y - 8.2)} ${f(x + w + 1)} ${f(y - 0.6)}`,
      stroke: '#1a110e',
      'stroke-width': 1.6,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
    el('path', {
      d: `M${f(x - w + 2)} ${f(y - 5)}Q${f(x)} ${f(y - 12.5)} ${f(x + w - 1)} ${f(y - 5.5)}`,
      stroke: s.skinDark,
      'stroke-width': 1,
      fill: 'none',
      'stroke-opacity': 0.7,
    }),
    el('path', {
      d: `M${f(x - w + 1)} ${f(y + 0.8)}Q${f(x)} ${f(y + 6)} ${f(x + w - 1)} ${f(y)}`,
      stroke: s.skinDark,
      'stroke-width': 0.7,
      fill: 'none',
      'stroke-opacity': 0.6,
    }),
  );
  return out;
}

/** strands of hair: thin curves from (x0, y0) bent by `bend`, `count` of them across `spread` @param {FaceSpec} s */
function strands(s, x0, y0, x1, y1, count, spread, bend, seed) {
  const out = [];
  let r = seed;
  const rand = () => {
    r = (r * 16807) % 2147483647;
    return r / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const t = count > 1 ? i / (count - 1) - 0.5 : 0;
    const ox = t * spread;
    const c = rand() < 0.5 ? s.hairLight : '#000';
    out.push(
      el('path', {
        d: `M${f(x0 + ox)} ${f(y0)}Q${f((x0 + x1) / 2 + ox + bend)} ${f((y0 + y1) / 2)} ${f(x1 + ox * 1.1 + (rand() - 0.5) * 3)} ${f(y1)}`,
        stroke: c,
        'stroke-width': 0.6 + rand() * 0.7,
        'stroke-opacity': c === '#000' ? 0.35 : 0.5,
        fill: 'none',
      }),
    );
  }
  return out;
}

/** One copy of a head map, its front in the middle at (0, 0). @param {FaceSpec} s */
function head(s) {
  const out = [];
  const hairTop = s.style === 'bald' ? -100 : 30;
  // the neck all round below, the hair (or the scalp) above
  out.push(el('rect', {x: -256, y: -128, width: 512, height: 256, fill: s.skin}));
  if (s.style !== 'bald') out.push(el('rect', {x: -256, y: -128, width: 512, height: hairTop + 128, fill: s.hair}));
  else {
    // a fringe of grey round the back and the sides, the scalp bare
    out.push(
      el('path', {
        d: 'M-256 -30L-150 -30Q-118 -26 -104 -8L-100 34L-256 34ZM256 -30L150 -30Q118 -26 104 -8L100 34L256 34Z',
        fill: s.hair,
      }),
    );
    out.push(...strands(s, -200, -28, -196, 32, 40, 110, 4, 7), ...strands(s, 200, -28, 196, 32, 40, 110, -4, 11));
    for (let i = 0; i < 9; i++) {
      out.push(el('circle', {cx: -60 + i * 15, cy: -70 + (i % 3) * 9, r: 2 + (i % 2), fill: s.skinDark, 'fill-opacity': 0.25}));
    }
  }
  // the face
  out.push(
    el('path', {
      d:
        s.style === 'bald'
          ? 'M-108 -4C-108 -70 -60 -128 0 -128C60 -128 108 -70 108 -4L114 128L-114 128Z'
          : 'M-112 -6C-110 -44 -64 -58 0 -60C64 -58 110 -44 112 -6L116 40L118 128L-118 128L-116 40Z',
      fill: s.skin,
    }),
  );
  if (s.style === 'parted') {
    // hair down from a middle parting, over the ears, to the bun behind
    out.push(
      el('path', {
        d: 'M0 -62C-40 -60 -96 -50 -118 -8L-132 20L-160 30L-160 -128L160 -128L160 30L132 20L118 -8C96 -50 40 -60 0 -62Z',
        fill: s.hair,
      }),
    );
    for (let k = 0; k < 6; k++) {
      out.push(
        ...strands(s, -2, -64 - k * 10, -126 - k * 6, 14 - k * 16, 14, 8, -26 + k * 3, 3 + k),
        ...strands(s, 2, -64 - k * 10, 126 + k * 6, 14 - k * 16, 14, 8, 26 - k * 3, 5 + k),
      );
    }
    out.push(el('path', {d: 'M0 -128L0 -62', stroke: s.skinDark, 'stroke-width': 1.2, 'stroke-opacity': 0.8}));
  } else if (s.style === 'side') {
    out.push(
      el('path', {
        d: 'M-30 -64C-70 -60 -104 -44 -114 -8L-118 6L-150 6L-150 -128L150 -128L150 6L118 6L114 -8C104 -50 50 -70 -30 -64Z',
        fill: s.hair,
      }),
    );
    out.push(...strands(s, -30, -66, 110, -10, 24, 8, -18, 13), ...strands(s, -34, -66, -112, -6, 12, 6, -10, 17));
    out.push(...strands(s, -256, -110, -256, 20, 40, 180, 0, 19), ...strands(s, 256, -110, 256, 20, 40, 180, 0, 23));
    // a whorl at the crown
    out.push(
      el('path', {
        d: 'M250 -96c6 -4 12 2 8 8c-6 8 -18 2 -16 -8c2 -12 20 -14 26 -2',
        stroke: s.hairLight,
        'stroke-width': 1,
        fill: 'none',
        'stroke-opacity': 0.6,
      }),
    );
  }
  // ears
  const showEars = s.style !== 'parted';
  if (showEars) {
    for (const side of [-1, 1]) {
      out.push(el('ellipse', {cx: side * 124, cy: -2, rx: 8, ry: 15, fill: s.skin, stroke: s.skinDark, 'stroke-width': 1}));
      out.push(
        el('path', {
          d: `M${side * 122} -10Q${side * 128} -2 ${side * 122} 8`,
          stroke: s.skinDark,
          'stroke-width': 1.4,
          fill: 'none',
        }),
      );
    }
  }
  if (s.earrings) {
    for (const side of [-1, 1])
      out.push(el('circle', {cx: side * 128, cy: 18, r: 2.6, fill: '#e8e2d4', stroke: '#8a8070', 'stroke-width': 0.5}));
  }
  if (s.whiskers) {
    for (const side of [-1, 1]) {
      out.push(
        el('path', {
          d: `M${side * 112} -6L${side * 112} 30Q${side * 98} 54 ${side * 72} 46L${side * 70} 26Q${side * 90} 18 ${side * 96} -6Z`,
          fill: s.hair,
        }),
      );
      out.push(...strands(s, side * 104, -4, side * 82, 44, 18, 20, side * -6, 29 + side));
    }
  }
  // the features of the face, drawn small and grown to the proportions of a head on a sphere
  const features = [];
  // brows
  for (const side of [-1, 1]) {
    features.push(
      el('path', {
        d: `M${side * 13} -21Q${side * 28} ${s.whiskers ? -30 : -27} ${side * 44} -19`,
        stroke: s.style === 'bald' ? s.hairLight : s.hair,
        'stroke-width': s.whiskers ? 4.2 : 2.8,
        fill: 'none',
        'stroke-linecap': 'round',
      }),
    );
  }
  // eyes
  features.push(...eye(s, -27, -9, -1), ...eye(s, 27, -9, 1));
  // nose: a shadow down one side, the ridge, nostrils
  features.push(
    el('path', {
      d: 'M-3 -10Q-8 6 -9 14Q-4 18 0 17',
      stroke: s.skinDark,
      'stroke-width': 2.4,
      fill: 'none',
      'stroke-opacity': 0.45,
      filter: 'url(#soft2)',
    }),
  );
  features.push(el('path', {d: 'M2 -8L3 12', stroke: '#fff', 'stroke-width': 2, 'stroke-opacity': 0.18, filter: 'url(#soft2)'}));
  features.push(el('ellipse', {cx: -5, cy: 17, rx: 2.6, ry: 1.4, fill: '#2a1a14', 'fill-opacity': 0.7}));
  features.push(el('ellipse', {cx: 5, cy: 17, rx: 2.6, ry: 1.4, fill: '#2a1a14', 'fill-opacity': 0.7}));
  features.push(el('ellipse', {cx: 0, cy: 21, rx: 9, ry: 3, fill: s.skinDark, 'fill-opacity': 0.25, filter: 'url(#soft2)'}));
  // cheeks hollow, a shadow under the cheekbone
  for (const side of [-1, 1])
    features.push(
      el('ellipse', {cx: side * 42, cy: 18, rx: 12, ry: 16, fill: s.skinDark, 'fill-opacity': 0.25, filter: 'url(#soft3)'}),
    );
  // the mouth: a thin grim line, the lower lip
  features.push(
    el('path', {
      d: 'M-15 31Q-6 28 0 29Q6 28 15 31',
      stroke: '#2a1612',
      'stroke-width': 1.4,
      fill: 'none',
      'stroke-linecap': 'round',
    }),
  );
  features.push(el('path', {d: 'M-12 31Q0 27 12 31Q0 29 -12 31Z', fill: s.lips, 'fill-opacity': 0.8}));
  features.push(el('path', {d: 'M-11 32Q0 38 11 32Q0 34 -11 32Z', fill: s.lips, 'fill-opacity': 0.55}));
  features.push(el('ellipse', {cx: 0, cy: 42, rx: 9, ry: 3, fill: s.skinDark, 'fill-opacity': 0.3, filter: 'url(#soft2)'}));
  if (s.wrinkles) {
    for (const y of [-40, -47, -54]) {
      features.push(
        el('path', {
          d: `M-32 ${y}Q0 ${y - 4} 32 ${y}`,
          stroke: s.skinDark,
          'stroke-width': 1,
          fill: 'none',
          'stroke-opacity': 0.55,
        }),
      );
    }
    for (const side of [-1, 1]) {
      features.push(
        el('path', {
          d: `M${side * 10} 14Q${side * 20} 26 ${side * 18} 38`,
          stroke: s.skinDark,
          'stroke-width': 1.1,
          fill: 'none',
          'stroke-opacity': 0.6,
        }),
      );
      features.push(
        el('path', {
          d: `M${side * 40} -8l${side * 6} -3M${side * 41} -4l${side * 7} 0`,
          stroke: s.skinDark,
          'stroke-width': 0.8,
          'stroke-opacity': 0.6,
        }),
      );
    }
  }
  // the jaw and the neck below it in shadow
  features.push(
    el('path', {d: 'M-60 56Q0 76 60 56L64 72Q0 92 -64 72Z', fill: s.skinDark, 'fill-opacity': 0.35, filter: 'url(#soft3)'}),
  );
  out.push(el('g', {transform: 'translate(0 -2) scale(1.38)'}, features));
  if (s.bun) {
    // the bun at the back of the head, coiled
    for (const cx of [-256, 256]) {
      out.push(el('circle', {cx, cy: -22, r: 30, fill: s.hair}));
      for (let i = 0; i < 4; i++) {
        out.push(
          el('circle', {
            cx,
            cy: -22,
            r: 8 + i * 6,
            fill: 'none',
            stroke: i % 2 ? s.hairLight : '#000',
            'stroke-width': 1,
            'stroke-opacity': 0.45,
          }),
        );
      }
    }
  }
  return out;
}

/** The face maps, padded across the seam. */
async function renderFace(/** @type {FaceSpec} */ s) {
  const w = FACE_W + 2 * FACE_WRAP;
  const h = FACE_H;
  const copy = head(s);
  const body = [-FACE_W, 0, FACE_W].map((dx) =>
    el('g', {transform: `translate(${FACE_WRAP + FACE_W / 2 + dx} ${FACE_H / 2})`}, copy),
  );
  const svg = svgDoc(w, h, [blurFilter('soft2', 2), blurFilter('soft3', 3)], body);
  return new Img(w, h, new Uint8Array(await rasterize(svg, w, h)));
}

/** The planchette, seen from the window: a heart of dark wood pointing up, a brass lens near its tip, its shadow. */
async function renderPlanchette() {
  const w = 84;
  const h = 68;
  const heart = 'M0 -25C14 -14 34 -2 32 12C30 24 12 26 0 18C-12 26 -30 24 -32 12C-34 -2 -14 -14 0 -25Z';
  const defs = [
    blurFilter('pl-blur', 2.5),
    el('linearGradient', {id: 'pl-wood', x1: 0, y1: 0, x2: 0, y2: 1}, [
      el('stop', {offset: 0, 'stop-color': '#5a3a20'}),
      el('stop', {offset: 1, 'stop-color': '#2e1c0e'}),
    ]),
  ];
  const rays = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    rays.push(
      el('path', {
        d: `M${f(Math.cos(a) * 11)} ${f(-9 + Math.sin(a) * 9)}L${f(Math.cos(a) * 14.5)} ${f(-9 + Math.sin(a) * 11.5)}`,
        stroke: '#c49a50',
        'stroke-width': 0.8,
        'stroke-opacity': 0.7,
      }),
    );
  }
  const body = [
    el('g', {transform: `translate(${w / 2} ${h / 2})`}, [
      el('path', {d: heart, transform: 'translate(4 5)', fill: '#000', 'fill-opacity': 0.6, filter: 'url(#pl-blur)'}),
      el('path', {d: heart, fill: 'url(#pl-wood)', stroke: '#1a0e06', 'stroke-width': 1.4}),
      el('path', {d: 'M0 -21C12 -12 28 -2 27 10', stroke: '#8a6034', 'stroke-width': 1.2, fill: 'none', 'stroke-opacity': 0.7}),
      ...rays,
      el('circle', {cx: 0, cy: -9, r: 8.5, fill: '#cfe0d8', 'fill-opacity': 0.22}),
      el('circle', {cx: 0, cy: -9, r: 8.5, fill: 'none', stroke: '#b08a3e', 'stroke-width': 2.6}),
      el('circle', {cx: 0, cy: -9, r: 8.5, fill: 'none', stroke: '#5a4018', 'stroke-width': 0.6}),
      el('path', {d: 'M-5 -13Q-2 -16 2 -15', stroke: '#fff', 'stroke-width': 1.2, 'stroke-opacity': 0.7, fill: 'none'}),
      el('path', {d: 'M-14 12Q0 6 14 12', stroke: '#c49a50', 'stroke-width': 0.7, fill: 'none', 'stroke-opacity': 0.6}),
    ]),
  ];
  return new Img(w, h, new Uint8Array(await rasterize(svgDoc(w, h, defs, body), w, h)));
}

/** A moth from above, wings spread, its head up. @param {string} name @param {{fore: string, hind: string, band: string, spot: string, edge: string, body: string, fur: string}} c */
async function renderMoth(name, c) {
  const w = 100;
  const h = 76;
  const wing = [];
  for (const s of [-1, 1]) {
    wing.push(
      el('path', {
        d: `M${s * 3} -8C${s * 18} -26 ${s * 44} -30 ${s * 48} -20C${s * 46} -6 ${s * 30} 4 ${s * 4} 2Z`,
        fill: c.fore,
        stroke: c.edge,
        'stroke-width': 0.8,
      }),
      el('path', {
        d: `M${s * 3} 0C${s * 20} 4 ${s * 34} 14 ${s * 28} 26C${s * 18} 32 ${s * 6} 22 ${s * 2} 10Z`,
        fill: c.hind,
        stroke: c.edge,
        'stroke-width': 0.8,
      }),
      el('path', {
        d: `M${s * 10} -14C${s * 22} -18 ${s * 36} -18 ${s * 44} -14`,
        stroke: c.band,
        'stroke-width': 2.2,
        fill: 'none',
        'stroke-opacity': 0.8,
      }),
      el('path', {
        d: `M${s * 8} -4C${s * 22} -6 ${s * 34} -6 ${s * 42} -10`,
        stroke: c.band,
        'stroke-width': 1,
        fill: 'none',
        'stroke-opacity': 0.6,
      }),
      el('circle', {cx: s * 28, cy: -14, r: 4.2, fill: c.spot}),
      el('circle', {cx: s * 28, cy: -14, r: 1.7, fill: '#0e0a08'}),
      el('circle', {cx: s * 18, cy: 16, r: 5, fill: 'none', stroke: c.band, 'stroke-width': 1.2}),
      el('path', {d: `M${s * 2} -11C${s * 4} -20 ${s * 6} -27 ${s * 12} -32`, stroke: c.edge, 'stroke-width': 0.9, fill: 'none'}),
    );
    for (let i = 0; i < 5; i++) {
      wing.push(el('path', {d: `M${s * (12 + i * 2)} -32l${s * -1.5} -2.4`, stroke: c.edge, 'stroke-width': 0.5}));
    }
  }
  const body = [
    el('g', {transform: `translate(${w / 2} ${h / 2 + 2})`}, [
      ...wing,
      el('ellipse', {cx: 0, cy: 4, rx: 4.2, ry: 15, fill: c.body}),
      el('ellipse', {cx: 0, cy: -8, rx: 5, ry: 5.5, fill: c.fur}),
      el('circle', {cx: 0, cy: -14, r: 3.4, fill: c.body}),
      ...[0, 4, 8, 12].map((y) =>
        el('path', {d: `M-3.6 ${y}Q0 ${y + 1.6} 3.6 ${y}`, stroke: c.edge, 'stroke-width': 0.6, fill: 'none'}),
      ),
    ]),
  ];
  return {name, img: new Img(w, h, new Uint8Array(await rasterize(svgDoc(w, h, [], body), w, h)))};
}

/** Every sprite, packed into one atlas. */
export async function renderSprites() {
  const inputs = [];
  for (const s of FACES) inputs.push({name: s.name, img: await renderFace(s)});
  inputs.push({name: 'planchette', img: await renderPlanchette()});
  inputs.push(
    await renderMoth('moth-pale', {
      fore: '#cbbfa8',
      hind: '#b8a88e',
      band: '#6e5e4a',
      spot: '#d8c48a',
      edge: '#4a3e30',
      body: '#8a7a64',
      fur: '#d8ccb6',
    }),
  );
  inputs.push(
    await renderMoth('moth-dusk', {
      fore: '#8a7462',
      hind: '#a07a5e',
      band: '#3a2c22',
      spot: '#c8a06a',
      edge: '#2a2018',
      body: '#5a4a3c',
      fur: '#a89480',
    }),
  );
  return pack(inputs, {padding: 6, width: 1080, powerOfTwo: false});
}

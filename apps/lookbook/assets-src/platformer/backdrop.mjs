// The Turrican-style world of the platformer: an alien dusk sky with a ringed planet, far crags,
// a machine city in the middle distance — three parallax layers, each 512 pixels wide and
// seamless horizontally — and a 16-pixel tile set of tech platforms.
import {ditherRamp, fbm, hex, Img, ramp, Rng} from '../lib/image.mjs';

/** @typedef {import('../lib/image.mjs').RGBA} RGBA */

export const LAYER_W = 512;
export const LAYER_H = 216;

/**
 * Draws into an image whose x wraps around, so shapes may cross the seam.
 * @param {Img} img
 */
const wrapped = (img) => ({
  /**
   * @param {number} x
   * @param {number} y
   * @param {RGBA} c
   */
  set(x, y, c) {
    img.set(((Math.floor(x) % img.width) + img.width) % img.width, y, c);
  },
  /**
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @param {RGBA} c
   */
  rect(x, y, w, h, c) {
    for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) this.set(i, j, c);
  },
});

const SKY = ['#0a0628', '#1a0e4a', '#331a72', '#5a2a8e', '#8e3a9a', '#c8507e', '#f07a6e', '#ffb070', '#ffd890'].map(hex);

export function sky() {
  const img = new Img(LAYER_W, LAYER_H);
  const horizon = 176;
  const colours = ramp(SKY, 17);
  img.paint((x, y) => ditherRamp(colours, (y / horizon) ** 1.35, x, y));
  const rng = new Rng(7);
  for (let i = 0; i < 260; i++) {
    const x = rng.int(0, LAYER_W - 1);
    const y = Math.floor(rng.next() ** 1.8 * 120);
    const bright = rng.next();
    img.set(x, y, bright > 0.92 ? hex('#ffffff') : bright > 0.6 ? hex('#a8b8ff') : hex('#6a6ab8'));
    if (bright > 0.985) {
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ])
        img.set(x + dx, y + dy, hex('#8888d0'));
    }
  }
  planet(img, 372, 64, 34, true);
  planet(img, 118, 38, 8, false);
  return img;
}

/**
 * A banded, dithered planet lit from the lower right (the sunset), optionally with a ring.
 * @param {Img} img
 * @param {number} cx
 * @param {number} cy
 * @param {number} r
 * @param {boolean} ring
 */
function planet(img, cx, cy, r, ring) {
  const colours = ramp(['#0e1030', '#1e3060', '#2e6a8e', '#5ab0b8', '#c8f0d8'].map(hex), 9);
  const light = [0.55, 0.45, 0.7];
  const ringColours = ['#5a3a7a', '#9a6aa8', '#e0b0c8'].map(hex);
  const ringAt = (/** @type {number} */ x, /** @type {number} */ y) => {
    const u = (x + 0.5 - cx) / (r * 1.9);
    const v = (y + 0.5 - cy) / (r * 0.42);
    const d = u * u + v * v;
    return d > 0.62 && d < 1 ? ringColours[Math.floor(((d - 0.62) / 0.38) * 3) % 3] : undefined;
  };
  // the far half of the ring, then the planet, then the near half
  if (ring)
    for (let y = cy - r; y < cy; y++)
      for (let x = cx - 2 * r; x < cx + 2 * r; x++) {
        const c = ringAt(x, y);
        if (c) img.set(x, y, c);
      }
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      const nx = (x + 0.5 - cx) / r;
      const ny = (y + 0.5 - cy) / r;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      const band = 0.12 * Math.sin(ny * 9 + Math.sin(nx * 3) * 0.8);
      const lit = Math.max(0, nx * light[0] + ny * light[1] + nz * light[2]) * 0.95 + band;
      img.set(x, y, ditherRamp(colours, lit, x, y));
    }
  }
  if (ring)
    for (let y = cy; y < cy + r; y++)
      for (let x = cx - 2 * r; x < cx + 2 * r; x++) {
        const c = ringAt(x, y);
        if (c) img.set(x, y, c);
      }
}

export function mountains() {
  const img = new Img(LAYER_W, LAYER_H);
  const rng = new Rng(11);
  const spires = Array.from({length: 10}, () => ({x: rng.int(0, LAYER_W - 1), w: rng.range(10, 26), h: rng.range(24, 70)}));
  const top = Array.from({length: LAYER_W}, (_, x) => {
    let h = 70 + 46 * fbm(x / 128, 0.5, 3, 4, 4);
    for (const s of spires) {
      const dx = Math.min(Math.abs(x - s.x), LAYER_W - Math.abs(x - s.x));
      h += s.h * Math.max(0, 1 - dx / s.w) ** 1.6;
    }
    return Math.round(LAYER_H - h);
  });
  const body = ramp(['#4a2c78', '#2e1c58', '#1c1240', '#140c30'].map(hex), 8);
  const rim = hex('#f08aa0');
  const rimSoft = hex('#9a4c94');
  img.paint((x, y) => {
    const d = y - top[x];
    if (d < 0) return undefined;
    if (d === 0) return rim;
    if (d < 3 && (top[(x + 1) % LAYER_W] > top[x] || d === 1)) return rimSoft;
    const crag = fbm(x / 10, y / 22, 5, 3, LAYER_W / 10);
    const t = Math.min(1, d / 90) + (crag - 0.5) * 0.5;
    return ditherRamp(body, t, x, y);
  });
  return img;
}

const STEEL = {
  dark: hex('#141a2c'),
  body: hex('#1e2840'),
  band: hex('#283452'),
  lit: hex('#3a4c70'),
  edge: hex('#5a74a0'),
  teal: hex('#5ef0ff'),
  amber: hex('#ffc040'),
  red: hex('#ff4060'),
};

export function machines() {
  const img = new Img(LAYER_W, LAYER_H);
  const w = wrapped(img);
  const rng = new Rng(23);
  const ground = 192;

  /** @param {number} x0 @param {number} width @param {number} height */
  const tower = (x0, width, height) => {
    const y0 = ground - height;
    w.rect(x0, y0, width, height, STEEL.body);
    w.rect(x0, y0, 1, height, STEEL.lit);
    w.rect(x0 + width - 1, y0, 1, height, STEEL.dark);
    for (let y = y0 + 6; y < ground; y += rng.int(8, 14)) w.rect(x0 + 1, y, width - 2, 1, STEEL.band);
    for (let y = y0 + 4; y < ground - 4; y += 4) {
      for (let x = x0 + 2; x < x0 + width - 2; x += 3) {
        const roll = rng.next();
        if (roll < 0.12) w.set(x, y, rng.next() < 0.7 ? STEEL.teal : STEEL.amber);
      }
    }
    w.rect(x0 - 1, y0, width + 2, 2, STEEL.edge);
    const ax = x0 + rng.int(2, width - 3);
    const ah = rng.int(6, 16);
    w.rect(ax, y0 - ah, 1, ah, STEEL.lit);
    w.set(ax, y0 - ah - 1, STEEL.red);
  };

  /** @param {number} cx @param {number} r */
  const dome = (cx, r) => {
    for (let y = ground - r; y < ground; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const nx = (x + 0.5 - cx) / r;
        const ny = (y + 0.5 - ground) / r;
        if (nx * nx + ny * ny > 1) continue;
        const lit = -nx * 0.6 - ny * 0.8;
        w.set(x, y, lit > 0.75 ? STEEL.edge : lit > 0.45 ? STEEL.lit : lit > 0 ? STEEL.band : STEEL.body);
      }
    }
    for (let i = -r + 3; i < r - 2; i += 4)
      w.set(cx + i, ground - Math.round(Math.sqrt(Math.max(0, r * r - i * i)) * 0.45), STEEL.teal);
  };

  /** @param {number} x0 @param {number} height */
  const chimney = (x0, height) => {
    const y0 = ground - height;
    w.rect(x0, y0, 7, height, STEEL.body);
    w.rect(x0, y0, 1, height, STEEL.lit);
    for (let i = 0; i < 6; i++) w.rect(x0, y0 + 2 + i * 2, 7, 1, i % 2 ? STEEL.amber : STEEL.dark);
    w.rect(x0 - 1, y0, 9, 2, STEEL.edge);
  };

  for (let i = 0; i < 7; i++) chimney(rng.int(0, LAYER_W - 1), rng.int(90, 150));
  for (let i = 0; i < 14; i++) tower(rng.int(0, LAYER_W - 1), rng.int(12, 28), rng.int(50, 130));
  for (let i = 0; i < 6; i++) dome(rng.int(0, LAYER_W - 1), rng.int(12, 24));
  for (let i = 0; i < 5; i++) {
    const y = rng.int(150, 182);
    const x0 = rng.int(0, LAYER_W - 1);
    const len = rng.int(40, 120);
    w.rect(x0, y, len, 1, STEEL.edge);
    w.rect(x0, y + 1, len, 2, STEEL.lit);
    w.rect(x0, y + 3, len, 1, STEEL.dark);
    for (let x = x0 + 6; x < x0 + len; x += 18) w.rect(x, y - 1, 2, 6, STEEL.band);
  }
  w.rect(0, ground, LAYER_W, LAYER_H - ground, STEEL.dark);
  w.rect(0, ground, LAYER_W, 1, STEEL.edge);
  for (let x = 3; x < LAYER_W; x += 8) w.set(x, ground + 3, STEEL.teal);
  return img;
}

const T = {
  outline: hex('#0c0e1a'),
  dark: hex('#1a2238'),
  plate: hex('#2c3a5c'),
  plateLit: hex('#46608c'),
  edge: hex('#8ab0e0'),
  shine: hex('#e0f4ff'),
  rivet: hex('#0f1424'),
  glow: hex('#5ef0ff'),
  glowDim: hex('#2a9ab8'),
  amber: hex('#ffc040'),
  amberDark: hex('#a86a10'),
};

/** The tiles, 16 × 16 unless noted; drawn so neighbours meet without a seam. */
export function tiles() {
  /** @type {{name: string, img: Img}[]} */
  const out = [];
  const tile = (/** @type {string} */ name, /** @type {number} */ h, /** @type {(img: Img) => void} */ draw) => {
    const img = new Img(16, h);
    draw(img);
    out.push({name, img});
  };
  /** the top surface of the ground: a bright lip, a glow strip, riveted plate */
  const groundTop = (/** @type {Img} */ img) => {
    img.fillRect(0, 0, 16, 16, T.plate);
    img.fillRect(0, 0, 16, 1, T.shine);
    img.fillRect(0, 1, 16, 1, T.edge);
    img.fillRect(0, 2, 16, 1, T.plateLit);
    img.fillRect(0, 5, 16, 1, T.glow);
    img.fillRect(0, 6, 16, 1, T.glowDim);
    img.fillRect(0, 9, 16, 1, T.dark);
    img.fillRect(0, 15, 16, 1, T.dark);
    img.set(3, 12, T.rivet);
    img.set(11, 12, T.rivet);
    img.set(7, 3, T.plateLit);
  };
  tile('ground-top', 16, groundTop);
  tile('ground-top-left', 16, (img) => {
    groundTop(img);
    img.fillRect(0, 0, 1, 16, T.outline);
    img.fillRect(1, 1, 1, 15, T.plateLit);
    img.set(0, 0, [0, 0, 0, 0]);
  });
  tile('ground-top-right', 16, (img) => {
    groundTop(img);
    img.fillRect(15, 0, 1, 16, T.outline);
    img.fillRect(14, 1, 1, 15, T.dark);
    img.set(15, 0, [0, 0, 0, 0]);
  });
  tile('ground', 16, (img) => {
    img.fillRect(0, 0, 16, 16, T.dark);
    img.strokeRect(0, 0, 16, 16, T.rivet);
    img.fillRect(1, 1, 14, 1, T.plate);
    img.fillRect(1, 1, 1, 14, T.plate);
    for (const [x, y] of [
      [3, 3],
      [12, 3],
      [3, 12],
      [12, 12],
    ])
      img.set(x, y, T.plateLit);
    img.fillRect(6, 7, 4, 2, T.glowDim);
  });
  const platform = (/** @type {Img} */ img) => {
    img.fillRect(0, 0, 16, 8, T.plate);
    img.fillRect(0, 0, 16, 1, T.shine);
    img.fillRect(0, 1, 16, 1, T.edge);
    img.fillRect(0, 4, 16, 1, T.amber);
    img.fillRect(0, 7, 16, 1, T.outline);
    for (let x = 0; x < 16; x += 4) img.fillRect(x, 5, 2, 2, T.amberDark);
  };
  tile('platform', 8, platform);
  tile('platform-left', 8, (img) => {
    platform(img);
    img.fillRect(0, 0, 1, 8, T.outline);
    img.set(0, 0, [0, 0, 0, 0]);
    img.set(0, 7, [0, 0, 0, 0]);
  });
  tile('platform-right', 8, (img) => {
    platform(img);
    img.fillRect(15, 0, 1, 8, T.outline);
    img.set(15, 0, [0, 0, 0, 0]);
    img.set(15, 7, [0, 0, 0, 0]);
  });
  tile('girder', 16, (img) => {
    img.fillRect(2, 0, 2, 16, T.plateLit);
    img.fillRect(12, 0, 2, 16, T.plate);
    img.line(4, 0, 11, 7, T.plate);
    img.line(4, 15, 11, 8, T.plate);
    img.line(4, 7, 11, 0, T.dark);
    img.line(4, 8, 11, 15, T.dark);
    img.fillRect(1, 0, 1, 16, T.outline);
    img.fillRect(14, 0, 1, 16, T.outline);
  });
  tile('crate', 16, (img) => {
    img.fillRect(0, 0, 16, 16, T.plate);
    img.strokeRect(0, 0, 16, 16, T.outline);
    img.fillRect(1, 1, 14, 1, T.edge);
    img.fillRect(1, 1, 1, 14, T.plateLit);
    img.fillRect(14, 2, 1, 13, T.dark);
    img.fillRect(2, 14, 13, 1, T.dark);
    for (let i = 0; i < 12; i++) {
      const c = Math.floor(i / 2) % 2 ? T.outline : T.amber;
      img.set(2 + i, 6, c);
      img.set(2 + i, 9, c);
      img.set(3 + i, 7, c);
      img.set(3 + i, 8, c);
    }
    img.set(4, 4, T.glow);
    img.set(5, 4, T.glow);
  });
  tile('lamp', 16, (img) => {
    img.fillRect(7, 4, 2, 12, T.plate);
    img.fillRect(7, 4, 1, 12, T.plateLit);
    img.fillRect(5, 1, 6, 3, T.glow);
    img.fillRect(6, 0, 4, 1, T.shine);
    img.fillRect(5, 4, 6, 1, T.outline);
    img.fillRect(6, 15, 4, 1, T.outline);
  });
  return out;
}

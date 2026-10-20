// rope-bridge: textures that repeat along a segment — rope, chain, vine, a light-saber blade — the
// planks, posts and a hilt of the bridge, and a dark cave in three seamless parallax layers, in the
// mood of Hollow Knight's caverns.
import {fbm, hex, Img, mix, ramp, Rng, withAlpha} from '../lib/image.mjs';
import {texturePackerHash} from '../lib/formats.mjs';
import {check} from '../lib/output.mjs';
import {pack} from '../lib/pack.mjs';

/** @typedef {import('../lib/image.mjs').RGBA} RGBA */

const OUTLINE = hex('#120c10');

/**
 * Twisted hemp, 64 × 16: three strands per 16 pixels of length, rows 1–14, shaded as a cylinder.
 * Repeats along x with a period of 16.
 */
function rope() {
  const shades = ramp(['#4a3018', '#7a5428', '#b08848', '#e0c080', '#f4e0a8'].map(hex), 5);
  const img = new Img(64, 16);
  img.paint((x, y) => {
    if (y < 1 || y > 14) return undefined;
    if (y === 1 || y === 14) return OUTLINE;
    const v = (y + 0.5 - 8) / 6.5; // -1 … 1 across
    const round = Math.sqrt(Math.max(0, 1 - v * v));
    const twist = (x + y * 0.9) % (16 / 3);
    const groove = twist < 1 ? -0.45 : twist < 2 ? 0.15 : 0;
    const t = Math.max(0, Math.min(0.999, 0.15 + 0.7 * round - 0.3 * v + groove));
    return shades[Math.floor(t * shades.length)];
  });
  return img;
}

/** Iron chain, 64 × 16: a link face-on, then one edge-on, period 32. */
function chain() {
  const img = new Img(64, 16);
  const iron = {dark: hex('#262a36'), mid: hex('#4e5668'), lit: hex('#8a96ac'), shine: hex('#d8e2f0')};
  for (const cx of [8, 40]) {
    // face-on: an oval ring
    for (let y = 1; y < 15; y++) {
      for (let x = cx - 10; x <= cx + 10; x++) {
        const u = (x + 0.5 - cx) / 10;
        const v = (y + 0.5 - 8) / 7;
        const d = u * u + v * v;
        const inner = (u / 0.72) ** 2 + (v / 0.52) ** 2;
        if (d > 1 || inner < 1) continue;
        const lit = -u * 0.4 - v * 0.9;
        img.set(((x % 64) + 64) % 64, y, lit > 0.6 ? iron.shine : lit > 0.2 ? iron.lit : lit > -0.4 ? iron.mid : iron.dark);
      }
    }
  }
  for (const cx of [24, 56]) {
    // edge-on: a bar with rounded ends, through the neighbours' holes
    for (let y = 6; y < 10; y++) {
      for (let x = cx - 12; x <= cx + 12; x++) {
        const u = (x + 0.5 - cx) / 12;
        const v = (y + 0.5 - 8) / 2;
        if (u * u * u * u + v * v > 1) continue;
        img.set(((x % 64) + 64) % 64, y, v < -0.5 ? iron.lit : v > 0.4 ? iron.dark : iron.mid);
      }
    }
  }
  img.outline(OUTLINE);
  return img;
}

/** A hanging vine, 64 × 16: a stem with leaves, period 32. */
function vine() {
  const img = new Img(64, 16);
  const stem = [hex('#1e3a2a'), hex('#2e5a3a')];
  const leaf = [hex('#2a6a4a'), hex('#4aa070'), hex('#9ae0b0')];
  for (let x = 0; x < 64; x++) {
    const y = Math.round(8 + Math.sin((x / 32) * Math.PI * 2) * 1.5);
    img.set(x, y, stem[1]);
    img.set(x, y + 1, stem[0]);
  }
  /** @type {[number, number][]} where a leaf starts, and whether it points up (−1) or down (1) */
  const leaves = [
    [4, -1],
    [14, 1],
    [22, -1],
    [36, -1],
    [46, 1],
    [54, -1],
  ];
  for (const [lx, dir] of leaves) {
    for (let i = 0; i < 6; i++) {
      const w = i < 1 || i > 4 ? 1 : 2;
      for (let k = 0; k < w; k++) {
        const x = lx + i + k;
        const y = 8 + dir * (1 + Math.round(i * 0.8));
        img.set(x % 64, y, i > 3 ? leaf[2] : k ? leaf[0] : leaf[1]);
      }
    }
  }
  img.outline(OUTLINE);
  return img;
}

/**
 * A weathered plank seen from the side, 32 × 8.
 * @param {number} seed
 */
function plank(seed) {
  const rng = new Rng(seed);
  const wood = ramp(['#2e1c12', '#5a3a22', '#86583a', '#b88a5e', '#d8b080'].map(hex), 5);
  const img = new Img(32, 8);
  const knot = rng.int(6, 25);
  const crack = rng.next() < 0.6 ? rng.int(4, 27) : -10;
  img.paint((x, y) => {
    if (x === 0 || x === 31) return y > 0 && y < 7 ? OUTLINE : undefined;
    if (y === 0 || y === 7) return OUTLINE;
    const grain = fbm(x / 6, y * 1.7, seed, 3) - 0.5;
    let t = 0.58 - (y - 1) * 0.07 + grain * 0.5;
    if (y === 1) t += 0.25;
    if (Math.hypot(x - knot, (y - 4) * 1.6) < 1.6) t = 0.1;
    if (Math.abs(x - crack - (y - 4) * 0.4) < 0.6 && y > 2) t = 0.05;
    return wood[Math.max(0, Math.min(4, Math.floor(t * 5)))];
  });
  img.set(3, 3, hex('#9aa2b0'));
  img.set(28, 3, hex('#9aa2b0'));
  return img;
}

/** A bridge post, 16 × 48, with rope wound round its top; it stands on the bottom edge. */
function post() {
  const img = new Img(16, 48);
  const wood = ramp(['#24160e', '#4a3020', '#74503a', '#a07850'].map(hex), 4);
  const ropeC = [hex('#7a5428'), hex('#b08848'), hex('#e0c080')];
  img.paint((x, y) => {
    if (x < 3 || x > 12) return undefined;
    const u = (x + 0.5 - 8) / 5;
    let t = 0.55 - u * 0.35 + (fbm(x * 0.8, y / 7, 31, 2) - 0.5) * 0.4;
    if (y < 2) t = 0.95 - (x - 3) * 0.06;
    return wood[Math.max(0, Math.min(3, Math.floor(t * 4)))];
  });
  for (let y = 6; y < 15; y++) {
    for (let x = 2; x <= 13; x++) {
      const k = (x + y * 1.2) % 3;
      img.set(x, y, k < 1 ? ropeC[0] : k < 2 ? ropeC[1] : ropeC[2]);
    }
  }
  img.outline(OUTLINE);
  return img;
}

/** The blade of a light saber, 64 × 16, white: a hot core, a soft edge. For `Tint` above 1. */
function blade() {
  const img = new Img(64, 16);
  img.paint((_, y) => {
    const d = Math.abs(y + 0.5 - 8);
    if (d < 2.5) return [255, 255, 255, 255];
    const t = (d - 2.5) / 5.5;
    return withAlpha([255, 255, 255, 255], 255 * Math.max(0, 1 - t) ** 2.2);
  });
  return img;
}

/** The hilt of a light saber, 32 × 12, the emitter at the right end. */
function hilt() {
  const img = new Img(32, 12);
  const metal = ramp(['#1e2028', '#4a4e5a', '#8a90a0', '#d0d6e2', '#ffffff'].map(hex), 5);
  const black = hex('#16161c');
  for (let x = 1; x < 31; x++) {
    // a narrow pommel, the grip, a wider emitter shroud
    const top = x < 4 ? 3 : x >= 25 ? 1 : 2;
    for (let y = top; y <= 11 - top; y++) {
      const v = (y + 0.5 - 6) / 5;
      const lit = 0.6 - v * 0.5;
      let c = metal[Math.max(0, Math.min(4, Math.floor(lit * 5)))];
      if (x >= 8 && x < 20 && x % 2 === 0 && y > top) c = black; // grip ridges
      if (x === 4 || x === 24) c = metal[1];
      if (x === 22 && (y === 5 || y === 6)) c = hex('#ff3a3a'); // activation stud
      img.set(x, y, c);
    }
  }
  img.outline(OUTLINE);
  return img;
}

/** A soft round glow, 16 × 16, white, for lumafly particles. */
function mote() {
  const img = new Img(16, 16);
  img.paint((x, y) => {
    const d = Math.hypot(x + 0.5 - 8, y + 0.5 - 8) / 8;
    if (d >= 1) return undefined;
    return withAlpha([255, 255, 255, 255], 255 * (1 - d) ** 2.5);
  });
  return img;
}

/** A hanging lantern, 16 × 24, its glass a pale cyan; hang it by the ring at the top. */
function lantern() {
  const img = new Img(16, 24);
  const iron = [hex('#1c1e26'), hex('#3a3e4c'), hex('#6a7084')];
  const glass = [hex('#9af0ff'), hex('#e8ffff'), hex('#5ac8e0')];
  img.strokeRect(6, 0, 4, 3, iron[1]);
  img.fillRect(7, 3, 2, 2, iron[1]);
  img.fillRect(3, 5, 10, 2, iron[2]);
  img.fillRect(4, 7, 8, 11, glass[0]);
  img.fillRect(6, 9, 3, 6, glass[1]);
  img.fillRect(10, 8, 1, 9, glass[2]);
  img.fillRect(4, 7, 1, 11, iron[1]);
  img.fillRect(11, 7, 1, 11, iron[1]);
  img.fillRect(7, 7, 1, 11, iron[0]);
  img.fillRect(3, 18, 10, 2, iron[2]);
  img.fillRect(5, 20, 6, 1, iron[1]);
  img.outline(OUTLINE);
  return img;
}

const W = 512;
const H = 288;

/**
 * A ceiling and floor profile, seamless over W: the height of rock at each x.
 * @param {number} seed
 * @param {number} base
 * @param {number} rough
 * @param {number} spikes
 * @param {number} spikeLen
 */
function profile(seed, base, rough, spikes, spikeLen) {
  const rng = new Rng(seed);
  const list = Array.from({length: spikes}, () => ({
    x: rng.int(0, W - 1),
    w: rng.range(4, 12),
    h: rng.range(spikeLen * 0.4, spikeLen),
  }));
  return Array.from({length: W}, (_, x) => {
    let h = base + rough * fbm(x / 64, seed, seed, 4, W / 64);
    for (const s of list) {
      const dx = Math.min(Math.abs(x - s.x), W - Math.abs(x - s.x));
      h += s.h * Math.max(0, 1 - dx / s.w) ** 2;
    }
    return h;
  });
}

/**
 * Rock between a ceiling profile and a floor profile, shaded darker away from the open cave, a
 * rim of light on the edges that face it.
 * @param {number[]} ceil
 * @param {number[]} floor
 * @param {{body: RGBA[], rim: RGBA, seed: number}} look
 */
function rockLayer(ceil, floor, look) {
  const img = new Img(W, H);
  img.paint((x, y) => {
    const fromCeil = ceil[x] - y; // > 0 inside the ceiling rock
    const fromFloor = y - (H - floor[x]); // > 0 inside the floor rock
    const depth = Math.max(fromCeil, fromFloor);
    if (depth <= 0) return undefined;
    if (depth < 1.5) return look.rim;
    const tex = fbm(x / 14, y / 14, look.seed, 3, W / 14);
    const t = Math.min(0.999, depth / 60 + (tex - 0.5) * 0.35);
    return look.body[Math.max(0, Math.floor(t * look.body.length))];
  });
  return img;
}

function caveBack() {
  const img = new Img(W, H);
  const haze = ramp(['#0a0e1c', '#121a30', '#1c2a46', '#24385a'].map(hex), 32);
  img.paint((x, y) => {
    const glow = Math.exp(-(((y - H * 0.55) / (H * 0.35)) ** 2));
    const n = fbm(x / 48, y / 48, 41, 4, W / 48);
    return haze[Math.max(0, Math.min(31, Math.floor((glow * 0.72 + n * 0.28) * 31)))];
  });
  // distant pillars, a shade lighter than the dark
  const rng = new Rng(43);
  for (let i = 0; i < 9; i++) {
    const cx = rng.int(0, W - 1);
    const w = rng.range(10, 30);
    for (let y = 0; y < H; y++) {
      const wobble = Math.sin(y / 23 + i) * 3;
      for (let dx = -w; dx <= w; dx++) {
        const x = (((cx + dx + Math.round(wobble)) % W) + W) % W;
        const edge = 1 - Math.abs(dx) / w;
        img.set(x, y, mix(img.get(x, y), hex('#0c1222'), Math.min(1, edge * 3) * 0.7));
      }
    }
  }
  // light shafts from cracks above, fading downward
  for (const sx of [70, 230, 390]) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const along = x - sx - y * 0.35;
        const dist = Math.min(Math.abs(along), W - Math.abs(along));
        const beam = Math.exp(-((dist / 10) ** 2)) * (1 - y / H) * 0.35;
        if (beam > 0.01) img.set(x, y, mix(img.get(x, y), hex('#8ab4d8'), beam));
      }
    }
  }
  return img;
}

/** @param {import('../lib/output.mjs').Output} out */
export function generate(out) {
  const frames = [
    {name: 'rope', img: rope()},
    {name: 'chain', img: chain()},
    {name: 'vine', img: vine()},
    {name: 'saber-blade', img: blade()},
    {name: 'saber-hilt', img: hilt()},
    {name: 'plank-0', img: plank(1)},
    {name: 'plank-1', img: plank(2)},
    {name: 'plank-2', img: plank(3)},
    {name: 'post', img: post()},
    {name: 'lantern', img: lantern()},
    {name: 'mote', img: mote()},
  ];
  // the segment textures repeat along x: every column equals the one 32 pixels on, so the frame
  // tiles without a seam
  for (const name of ['rope', 'chain', 'vine', 'saber-blade']) {
    const img = /** @type {Img} */ (frames.find((f) => f.name === name)?.img);
    for (let y = 0; y < img.height; y++) {
      for (let x = 0; x < 32; x++)
        check(img.get(x, y).join() === img.get(x + 32, y).join(), `${name} repeats every 32 pixels (${x}, ${y})`);
    }
  }
  const {sheet, frames: packed} = pack(frames, {padding: 2, keepOrder: true});
  out.png('bridge.png', sheet);
  out.json('bridge.json', texturePackerHash(packed, {image: 'bridge.png', width: sheet.width, height: sheet.height}));

  out.png('cave-back.png', caveBack());
  out.png(
    'cave-mid.png',
    rockLayer(profile(51, 26, 40, 22, 60), profile(52, 30, 36, 6, 24), {
      body: ramp(['#1a2440', '#141c32', '#0e1424'].map(hex), 6),
      rim: hex('#4a6a9a'),
      seed: 53,
    }),
  );
  out.png(
    'cave-front.png',
    rockLayer(profile(61, 10, 30, 14, 80), profile(62, 22, 28, 8, 30), {
      body: ramp(['#0a0c14', '#06070c', '#030406'].map(hex), 4),
      rim: hex('#2a3a5a'),
      seed: 63,
    }),
  );
}

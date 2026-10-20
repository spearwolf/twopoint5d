// swaying-grass: a night meadow — grass blades, tufts, flowers that glow, reeds and a fern, each
// drawn as an image of its own with its foot on the middle of the bottom row, packed into one sheet
// in free-tex-packer's JSON layout. Plus a backdrop and a strip of ground.
import {ditherRamp, fbm, hex, Img, mix, ramp, Rng} from '../lib/image.mjs';
import {freeTexPackerHash} from '../lib/formats.mjs';
import {check} from '../lib/output.mjs';
import {pack} from '../lib/pack.mjs';

/** @typedef {import('../lib/image.mjs').RGBA} RGBA */

const GRASS = ramp(['#0e2622', '#16403a', '#24645a', '#3a9070', '#7ad08a', '#c8f0a0'].map(hex), 6);
const OUTLINE = hex('#08141a');

/**
 * Draws a tapering, curving blade into `img`, its foot at (x0, bottom row).
 * @param {Img} img
 * @param {{x0: number, height: number, width: number, bend: number, colours?: RGBA[], lean?: number}} b
 */
function blade(img, b) {
  const colours = b.colours ?? GRASS;
  const bottom = img.height - 1;
  for (let i = 0; i <= b.height; i++) {
    const t = i / b.height;
    const cx = b.x0 + b.bend * t * t + (b.lean ?? 0) * t;
    const w = Math.max(1, b.width * (1 - t) ** 0.8);
    const y = bottom - i;
    const left = Math.round(cx - w / 2);
    const right = Math.max(left, Math.round(cx + w / 2) - 1);
    for (let x = left; x <= right; x++) {
      const side = right === left ? 0.5 : (x - left) / (right - left);
      const shade = 0.2 + t * 0.65 + (side < 0.4 ? 0.15 : 0);
      img.set(x, y, colours[Math.min(colours.length - 1, Math.floor(shade * colours.length))]);
    }
  }
}

/**
 * @param {number} w
 * @param {number} h
 * @param {(img: Img) => void} draw
 */
function plant(w, h, draw) {
  const img = new Img(w, h);
  draw(img);
  img.outline(OUTLINE);
  return img;
}

/**
 * A stem from the foot up to (x, y), curving.
 * @param {Img} img
 * @param {number} topX
 * @param {number} topY
 * @param {RGBA} colour
 */
function stem(img, topX, topY, colour) {
  const footX = Math.floor(img.width / 2);
  const bottom = img.height - 1;
  for (let y = bottom; y >= topY; y--) {
    const t = (bottom - y) / (bottom - topY);
    img.set(Math.round(footX + (topX - footX) * t * t), y, colour);
  }
}

export function plants() {
  const rng = new Rng(5);
  /** @type {{name: string, img: Img}[]} */
  const out = [];

  // single blades: heights from short to tall, leaning both ways
  [
    [7, 22, 3, 2],
    [7, 30, 3, -2],
    [9, 38, 4, 3],
    [9, 44, 4, -4],
    [11, 52, 4, 5],
    [11, 60, 5, -5],
  ].forEach(([w, h, width, bend], i) => {
    out.push({
      name: `blade-${i}`,
      img: plant(w + 2, h + 2, (img) => blade(img, {x0: Math.floor((w + 2) / 2), height: h, width, bend})),
    });
  });

  // tufts: blades fanning out of one foot
  [
    [20, 20, 5],
    [26, 28, 7],
    [32, 36, 9],
  ].forEach(([w, h, n], i) => {
    out.push({
      name: `tuft-${i}`,
      img: plant(w, h, (img) => {
        for (let k = 0; k < n; k++) {
          const s = (k / (n - 1)) * 2 - 1;
          blade(img, {
            x0: w / 2 + s * 2,
            height: Math.round(h * (0.55 + 0.4 * (1 - Math.abs(s))) - 2 + rng.int(-1, 1)),
            width: 3,
            bend: s * w * 0.35,
          });
        }
      }),
    });
  });

  // flowers
  out.push({
    name: 'daisy',
    img: plant(13, 30, (img) => {
      stem(img, 7, 6, hex('#3a9070'));
      blade(img, {x0: 6, height: 9, width: 3, bend: -4});
      for (const [dx, dy] of [
        [-3, 0],
        [3, 0],
        [0, -3],
        [0, 3],
        [-2, -2],
        [2, -2],
        [-2, 2],
        [2, 2],
      ])
        img.set(7 + dx, 4 + dy, hex('#f4f8ff'));
      img.fillRect(5, 4, 5, 1, hex('#f4f8ff'));
      img.fillRect(7, 2, 1, 5, hex('#f4f8ff'));
      img.fillRect(6, 3, 3, 3, hex('#ffd040'));
      img.set(6, 3, hex('#fff0a0'));
    }),
  });
  out.push({
    name: 'poppy',
    img: plant(13, 34, (img) => {
      stem(img, 5, 8, hex('#3a9070'));
      blade(img, {x0: 7, height: 10, width: 3, bend: 4});
      img.ellipse(5.5, 5.5, 4.2, 3.6, hex('#d02a3a'));
      img.ellipse(4.5, 4.5, 2, 1.6, hex('#ff6a5a'));
      img.fillRect(5, 6, 2, 2, hex('#1a0c14'));
    }),
  });
  out.push({
    name: 'bluebell',
    img: plant(15, 32, (img) => {
      const s = hex('#2e7a5a');
      stem(img, 6, 3, s);
      for (let x = 6; x <= 11; x++) img.set(x, 3 + Math.round((x - 6) * 0.3), s);
      for (const [bx, by] of [
        [11, 6],
        [8, 9],
        [4, 7],
      ]) {
        img.fillRect(bx - 1, by - 2, 3, 3, hex('#5a7af0'));
        img.set(bx - 2, by + 1, hex('#3a4ac0'));
        img.set(bx + 2, by + 1, hex('#3a4ac0'));
        img.fillRect(bx - 1, by + 1, 3, 1, hex('#8aa8ff'));
        img.set(bx, by - 3, s);
      }
    }),
  });
  out.push({
    name: 'glowcap',
    img: plant(11, 36, (img) => {
      stem(img, 5, 9, hex('#24645a'));
      img.ellipse(5.5, 5.5, 4, 4.5, hex('#5af0e0'));
      img.ellipse(4.5, 4, 2.2, 2.2, hex('#e0fff8'));
      img.fillRect(2, 8, 7, 1, hex('#2ab0b0'));
      img.set(5, 1, hex('#ffffff'));
    }),
  });
  out.push({
    name: 'lumen-lily',
    img: plant(15, 40, (img) => {
      stem(img, 7, 10, hex('#24645a'));
      blade(img, {x0: 7, height: 14, width: 4, bend: -6});
      blade(img, {x0: 7, height: 11, width: 3, bend: 6});
      const pink = [hex('#ff8ad0'), hex('#ffd0f0'), hex('#c84aa0')];
      img.fillRect(5, 5, 5, 5, pink[0]);
      img.fillRect(4, 3, 2, 4, pink[0]);
      img.fillRect(9, 3, 2, 4, pink[0]);
      img.fillRect(6, 2, 3, 3, pink[1]);
      img.fillRect(5, 9, 5, 1, pink[2]);
      img.set(7, 1, hex('#ffffff'));
    }),
  });

  // reeds: a cattail on a long stem, with a leaf
  [
    [11, 56, 1],
    [11, 64, -1],
    [13, 72, 1],
  ].forEach(([w, h, side], i) => {
    out.push({
      name: `reed-${i}`,
      img: plant(w, h, (img) => {
        const mid = Math.floor(w / 2);
        for (let y = 2; y < h; y++) img.set(mid, y, y < 14 ? hex('#7a9a5a') : hex('#3a7a5a'));
        img.fillRect(mid - 1, 6, 3, 9, hex('#6a3a1e'));
        img.fillRect(mid - 1, 6, 1, 9, hex('#9a5a2e'));
        img.set(mid, 1, hex('#7a9a5a'));
        blade(img, {x0: mid, height: Math.round(h * 0.7), width: 3, bend: side * (w / 2 - 1)});
      }),
    });
  });

  // a fern: a curved spine with leaflets
  out.push({
    name: 'fern',
    img: plant(30, 34, (img) => {
      for (const dir of [-1, 1]) {
        for (let i = 0; i < 26; i++) {
          const t = i / 26;
          const x = 15 + dir * (t * 12 + t * t * 2);
          const y = 33 - t * 28 + t * t * 12;
          img.set(x, y, GRASS[3]);
          if (i % 3 === 0 && i > 2) {
            const len = Math.round(5 * (1 - t) + 1);
            for (let k = 1; k <= len; k++) img.set(x + dir * k * 0.4, y - k, GRASS[4]);
          }
        }
      }
      for (let y = 8; y < 34; y++) img.set(15, y, GRASS[2]);
    }),
  });
  return out;
}

/** The night meadow behind the plants, 512 × 256, seamless horizontally. */
function backdrop() {
  const W = 512;
  const H = 256;
  const img = new Img(W, H);
  const sky = ramp(['#06081a', '#0e1634', '#1a2a50', '#2a4a6a', '#3e6a7a'].map(hex), 14);
  img.paint((x, y) => ditherRamp(sky, (y / 170) ** 1.2, x, y));
  const rng = new Rng(9);
  for (let i = 0; i < 140; i++)
    img.set(rng.int(0, W - 1), Math.floor(rng.next() ** 2 * 120), rng.next() > 0.8 ? hex('#ffffff') : hex('#8aa0d0'));
  // a big pale moon
  img.ellipse(400, 54, 22, 22, hex('#e8f0e0'));
  img.ellipse(394, 50, 5, 4, hex('#c8d4c8'));
  img.ellipse(408, 62, 4, 3, hex('#c8d4c8'));
  // two rows of hills
  /** @type {[number, number, number, RGBA, RGBA][]} */
  const hills = [
    [150, 26, 71, hex('#16303a'), hex('#2a5a5a')],
    [184, 20, 72, hex('#0e2024'), hex('#1e4440')],
  ];
  for (const [base, amp, seed, body, rim] of hills) {
    for (let x = 0; x < W; x++) {
      const top = Math.round(base - amp * fbm(x / 96, 0.3, seed, 3, W / 96));
      for (let y = top; y < H; y++) img.set(x, y, y === top ? rim : body);
    }
  }
  // fireflies over the grass
  for (let i = 0; i < 40; i++) {
    const x = rng.int(0, W - 1);
    const y = rng.int(150, 240);
    img.set(x, y, hex('#e0ff9a'));
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      img.set(x + dx, y + dy, mix(img.get(x + dx, y + dy), hex('#b0e070'), 0.5));
  }
  return img;
}

/** A strip of ground the plants stand in, 128 × 24, seamless horizontally; grass edge at the top. */
function ground() {
  const img = new Img(128, 24);
  const soil = ramp(['#1a1418', '#2a2026', '#3a2c2e'].map(hex), 3);
  img.paint((x, y) => {
    const edge = 3 + Math.round(2 * Math.sin((x / 128) * Math.PI * 6) + fbm(x / 8, 0, 3, 2, 16) * 2);
    if (y < edge - 2) return undefined;
    if (y < edge) return GRASS[(x + y) % 3 === 0 ? 4 : 3];
    if (y === edge) return GRASS[2];
    const n = fbm(x / 5, y / 5, 13, 2, 128 / 5);
    if (n > 0.72) return hex('#4a3a3a');
    return soil[Math.min(2, Math.floor((1 - y / 24) * 2 + n))];
  });
  return img;
}

/** @param {import('../lib/output.mjs').Output} out */
export function generate(out) {
  const list = plants();
  for (const {name, img} of list) {
    const box = img.opaqueBounds();
    check(box, `${name} is not empty`);
    check(box.y + box.h === img.height, `${name} stands on its bottom row`);
    const foot = Math.floor(img.width / 2);
    check(
      [-1, 0, 1].some((d) => img.alpha(foot + d, img.height - 1) === 255),
      `${name} has its foot in the middle of the bottom row`,
    );
  }
  const {sheet, frames} = pack(list, {padding: 2});
  out.png('meadow.png', sheet);
  out.json('meadow.json', freeTexPackerHash(frames, {image: 'meadow.png', width: sheet.width, height: sheet.height}));
  out.png('meadow-back.png', backdrop());
  out.png('meadow-ground.png', ground());
}

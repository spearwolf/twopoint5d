// vector-balls: the shaded balls of an Amiga vector-ball demo — one ball per colour, banded
// shading in eight steps, a hard white highlight at the upper left and a faint bounce light at the
// lower right. Plus a soft floor shadow.
import {hsl, Img, mix, ramp, withAlpha} from '../lib/image.mjs';
import {check} from '../lib/output.mjs';
import {texturePackerHash} from '../lib/formats.mjs';
import {pack} from '../lib/pack.mjs';

const SIZE = 32;
const BANDS = 8;

/** name → [hue, saturation]; `white` is grey, made for `Tint` */
const COLOURS = /** @type {const} */ ({
  red: [0, 0.85],
  orange: [28, 0.95],
  yellow: [52, 0.95],
  green: [120, 0.7],
  cyan: [185, 0.85],
  blue: [222, 0.85],
  purple: [275, 0.7],
  pink: [320, 0.8],
  white: [0, 0],
});

const LIGHT = normalize([-0.55, -0.6, 0.58]);
const HALF = normalize([LIGHT[0], LIGHT[1], LIGHT[2] + 1]);

/** @param {number[]} v */
function normalize(v) {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
}

/**
 * @param {number} hue
 * @param {number} sat
 */
function ball(hue, sat) {
  const colours = ramp([hsl(hue, sat, 0.07), hsl(hue, sat, 0.3), hsl(hue, sat, 0.52), hsl(hue, sat * 0.75, 0.78)], BANDS);
  const img = new Img(SIZE, SIZE);
  const r = SIZE / 2;
  img.paint((x, y) => {
    const nx = (x + 0.5 - r) / (r - 0.25);
    const ny = (y + 0.5 - r) / (r - 0.25);
    const d2 = nx * nx + ny * ny;
    if (d2 > 1) return undefined;
    const nz = Math.sqrt(1 - d2);
    const diffuse = Math.max(0, nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2]);
    const bounce = 0.22 * Math.max(0, -(nx * LIGHT[0] + ny * LIGHT[1])) * (1 - nz);
    const spec = Math.max(0, nx * HALF[0] + ny * HALF[1] + nz * HALF[2]) ** 40;
    if (spec > 0.55) return [255, 255, 255, 255];
    if (spec > 0.25) return mix(colours[BANDS - 1], [255, 255, 255, 255], 0.6);
    const v = Math.min(0.999, 0.08 + 0.92 * diffuse + bounce);
    return colours[Math.floor(v * BANDS)];
  });
  return img;
}

function shadow() {
  const img = new Img(SIZE, 12);
  img.paint((x, y) => {
    const u = (x + 0.5 - SIZE / 2) / (SIZE / 2);
    const v = (y + 0.5 - 6) / 6;
    const d = u * u + v * v;
    if (d >= 1) return undefined;
    // four alpha steps, no gradient: the shadow stays pixel art
    return withAlpha([8, 4, 24, 255], 40 * Math.ceil((1 - d) * 4));
  });
  return img;
}

/** @param {import('../lib/output.mjs').Output} out */
export function generate(out) {
  const inputs = Object.entries(COLOURS).map(([name, [h, s]]) => ({name: `ball-${name}`, img: ball(h, s)}));
  inputs.push({name: 'ball-shadow', img: shadow()});
  const {sheet, frames} = pack(inputs, {padding: 2, keepOrder: true});
  check(
    frames.every((f) => !f.trimmed),
    'balls are packed untrimmed',
  );
  out.png('balls.png', sheet);
  out.json('balls.json', texturePackerHash(frames, {image: 'balls.png', width: sheet.width, height: sheet.height}));
}

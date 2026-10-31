// stage-masks/matte-ink: the photograph of the title card — a gothic house standing in the black
// water of a flooded marsh at night, in a fog that swallows the tree line, under a moon. Drawn as
// SVG silhouettes in grey (far trees, near trees, the house with its boards, windows and shingles,
// dead trees, reeds), each layer rasterised alone and laid into the fog at its own depth; the sky,
// the mist, the water and its reflection are worked out per pixel in JavaScript. A monochrome
// picture with a cool silver tone, the look of an old nitrate print — the grain and the flicker
// come at run time.
import sharp from 'sharp';
import {fbm, Rng} from '../../lib/image.mjs';
import {el, poly, rasterize} from '../spotlight/svg.mjs';
import {box, IMG_H, IMG_W, PX, WORLD, worldDoc} from '../rift/kit.mjs';

/** the waterline of the marsh, in units */
export const WATER_Y = -160;
/** the moon, in units */
export const MOON = {x: 400, y: 200, r: 24};
/** the lit window in the tower, in units (the demo lets it flicker) */
export const LIT_WINDOW = {x: 140 + -145 * 0.95, y: WATER_Y + 125 * 0.95};

/** @param {number} e0 @param {number} e1 @param {number} x */
const ss = (e0, e1, x) => {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
};

/** A grey as an SVG colour. @param {number} l 0…1 */
const grey = (l) => {
  const v = Math.round(Math.min(1, Math.max(0, l)) * 255);
  return `rgb(${v},${v},${v})`;
};

/**
 * A bare tree: a trunk that splits again and again, as tapered strokes.
 * @param {Rng} rng @param {number} x @param {number} y @param {number} len @param {number} angle radians, 0 is up
 * @param {number} width @param {number} depth @param {string} colour @param {string[]} out
 */
function branch(rng, x, y, len, angle, width, depth, colour, out) {
  // a branch bends on its way: three segments, each turned a little
  let px = x;
  let py = y;
  let a = angle;
  const segs = 3;
  for (let s = 0; s < segs; s++) {
    a += rng.range(-0.22, 0.22);
    const nx = px + Math.sin(a) * (len / segs);
    const ny = py + Math.cos(a) * (len / segs);
    const w0 = width * (1 - (s / segs) * 0.35);
    const w1 = width * (1 - ((s + 1) / segs) * 0.35);
    // a tapered quad, so the trunk narrows towards its crown
    const ox0 = Math.cos(a) * w0 * 0.5;
    const oy0 = -Math.sin(a) * w0 * 0.5;
    const ox1 = Math.cos(a) * w1 * 0.5;
    const oy1 = -Math.sin(a) * w1 * 0.5;
    out.push(
      el('path', {
        d: poly([
          [px - ox0, py - oy0],
          [nx - ox1, ny - oy1],
          [nx + ox1, ny + oy1],
          [px + ox0, py + oy0],
        ]),
        fill: colour,
        stroke: colour,
        'stroke-width': 0.5,
        'stroke-linejoin': 'round',
      }),
    );
    px = nx;
    py = ny;
  }
  if (depth <= 0 || width < 0.7) return;
  const kids = rng.int(2, 3);
  for (let k = 0; k < kids; k++) {
    const spread = rng.range(0.35, 0.9) * (k % 2 === 0 ? 1 : -1);
    branch(rng, px, py, len * rng.range(0.55, 0.78), a + spread, width * 0.62, depth - 1, colour, out);
  }
}

/** A tree line as one closed silhouette: a jagged top over x, filled down to `bottom`. */
function treeLine(
  /** @type {Rng} */ rng,
  /** @type {number} */ base,
  /** @type {number} */ amp,
  /** @type {number} */ spikeEvery,
  /** @type {number} */ spikeH,
  /** @type {number} */ seed,
  /** @type {number} */ bottom,
) {
  /** @type {[number, number][]} */
  const pts = [[WORLD.left, bottom]];
  for (let x = WORLD.left; x <= WORLD.right; x += 2) {
    let y = base + (fbm(x * 0.006, 0, seed, 4) - 0.5) * amp * 2;
    // conifers: narrow spikes at irregular places
    // overlapping crowns: the highest of the spikes of this cell and its neighbours wins
    const cell = Math.floor(x / spikeEvery);
    let top = 0;
    for (let c = cell - 2; c <= cell + 2; c++) {
      const r = new Rng(c * 7919 + seed);
      const cx = c * spikeEvery + r.range(0, 1) * spikeEvery;
      const hh = spikeH * r.range(0.25, 1) ** 1.5;
      const ww = spikeEvery * r.range(0.5, 1.1);
      const d = Math.abs(x - cx);
      // a ragged conifer: narrow at the top, the branches jagged on the way down
      if (d < ww) top = Math.max(top, hh * (1 - d / ww) ** 1.6 * (0.85 + 0.3 * fbm(x * 0.25, c, seed + 3, 2)));
    }
    y += top + (rng.next() - 0.5) * 1.5;
    pts.push([x, y]);
  }
  pts.push([WORLD.right, bottom]);
  return poly(pts);
}

/** The house, in its own units: the waterline at y = 0, scaled and moved by the caller. */
function house() {
  const out = [];
  const wall = grey(0.2);
  const wallLit = grey(0.27);
  const trim = grey(0.36);
  const roof = grey(0.11);
  const dark = grey(0.02);
  // the tower and the main block stand on the water and go on under it
  out.push(box(-110, -30, 130, 120, {fill: wall}));
  // boards: thin dark lines every 6 units, a lit edge under each
  for (let y = -24; y < 120; y += 6) {
    out.push(box(-110, y, 130, y + 0.8, {fill: grey(0.13)}));
    out.push(box(-110, y + 0.8, 130, y + 1.4, {fill: grey(0.25)}));
  }
  // the right corner board catches the moon
  out.push(box(124, -30, 130, 120, {fill: wallLit}));
  out.push(box(-110, -30, -105, 120, {fill: trim}));
  // the tower
  out.push(box(-175, -30, -115, 172, {fill: wall}));
  for (let y = -24; y < 170; y += 6) out.push(box(-175, y, -115, y + 0.8, {fill: grey(0.13)}));
  out.push(box(-121, -30, -115, 172, {fill: wallLit}));
  out.push(box(-179, 166, -111, 174, {fill: trim}));
  // the hip roof, its eaves, a hole where the shingles went
  out.push(
    el('path', {
      d: poly([
        [-126, 118],
        [146, 118],
        [96, 186],
        [-76, 186],
      ]),
      fill: roof,
    }),
  );
  for (let y = 124; y < 186; y += 5) {
    const t = (y - 118) / 68;
    out.push(box(-126 + 50 * t, y, 146 - 50 * t, y + 0.7, {fill: grey(0.17)}));
  }
  out.push(el('path', {d: 'M-30 150 L-12 158 L-4 146 L-20 140 Z', fill: dark}));
  out.push(box(-128, 116, 148, 121, {fill: trim}));
  // the front gable with a round window
  out.push(
    el('path', {
      d: poly([
        [-48, 118],
        [68, 118],
        [10, 208],
      ]),
      fill: roof,
    }),
  );
  out.push(
    el('path', {
      d: poly([
        [-38, 121],
        [58, 121],
        [10, 196],
      ]),
      fill: wall,
    }),
  );
  out.push(el('path', {d: 'M-50 116 L10 210 L70 116', fill: 'none', stroke: trim, 'stroke-width': 3}));
  out.push(el('circle', {cx: 10, cy: 148, r: 14, fill: trim}));
  out.push(el('circle', {cx: 10, cy: 148, r: 11, fill: dark}));
  out.push(el('path', {d: 'M10 137 L10 159 M-1 148 L21 148', stroke: trim, 'stroke-width': 1.6}));
  // the conical roof of the tower and its finial with a weathervane
  out.push(
    el('path', {
      d: poly([
        [-186, 170],
        [-104, 170],
        [-145, 268],
      ]),
      fill: roof,
    }),
  );
  for (let y = 176; y < 262; y += 6) {
    const t = (y - 170) / 98;
    out.push(box(-186 + 41 * t, y, -104 - 41 * t, y + 0.7, {fill: grey(0.17)}));
  }
  out.push(el('path', {d: 'M-145 266 L-145 292', stroke: grey(0.08), 'stroke-width': 2}));
  out.push(
    el('path', {d: 'M-160 284 L-130 284 M-156 284 L-160 288 M-134 284 L-128 281', stroke: grey(0.08), 'stroke-width': 1.6}),
  );
  // two chimneys, one of them broken off
  out.push(box(84, 150, 102, 218, {fill: grey(0.14)}));
  out.push(box(81, 214, 105, 221, {fill: grey(0.22)}));
  out.push(el('path', {d: 'M-62 160 L-46 160 L-46 196 L-52 200 L-56 194 L-62 199 Z', fill: grey(0.14)}));
  // windows: a frame, the dark glass, the mullions, and missing panes darker still
  /** @param {number} cx @param {number} y0 @param {number} w @param {number} h @param {{lit?: boolean, broken?: boolean, shutter?: number}} [o] */
  const window = (cx, y0, w, h, o = {}) => {
    out.push(box(cx - w / 2 - 3, y0 - 3, cx + w / 2 + 3, y0 + h + 5, {fill: trim}));
    out.push(box(cx - w / 2, y0, cx + w / 2, y0 + h, {fill: o.lit ? grey(0.93) : grey(0.06)}));
    if (o.broken) {
      out.push(
        el('path', {
          d: poly([
            [cx - w / 2, y0 + h],
            [cx + 2, y0 + h],
            [cx - 3, y0 + h * 0.62],
            [cx - w / 2, y0 + h * 0.4],
          ]),
          fill: dark,
        }),
      );
    }
    const bar = o.lit ? grey(0.18) : trim;
    out.push(box(cx - 0.9, y0, cx + 0.9, y0 + h, {fill: bar}));
    out.push(box(cx - w / 2, y0 + h * 0.5 - 0.9, cx + w / 2, y0 + h * 0.5 + 0.9, {fill: bar}));
    out.push(box(cx - w / 2 - 5, y0 + h + 4, cx + w / 2 + 5, y0 + h + 7, {fill: grey(0.3)}));
    if (o.shutter !== undefined) {
      // a shutter hanging from one hinge
      out.push(
        el('path', {
          d: poly([
            [cx + w / 2 + 4, y0 + h + 2],
            [cx + w / 2 + 14, y0 + h + 2 - o.shutter],
            [cx + w / 2 + 14 + o.shutter * 0.5, y0 - o.shutter],
            [cx + w / 2 + 4, y0],
          ]),
          fill: grey(0.13),
          stroke: grey(0.08),
          'stroke-width': 0.6,
        }),
      );
    }
  };
  window(-85, 64, 20, 40);
  window(-40, 64, 20, 40, {broken: true});
  window(60, 64, 20, 40, {shutter: 4});
  window(105, 64, 20, 40);
  window(-85, -8, 20, 38);
  window(105, -8, 20, 38, {broken: true});
  window(-145, 112, 16, 32, {lit: true});
  window(-145, 50, 16, 32, {broken: true});
  // the porch: its roof on two posts and a railing, the water up to the handrail
  out.push(box(-12, -30, 32, 44, {fill: dark}));
  out.push(
    el('path', {
      d: poly([
        [-46, 46],
        [66, 46],
        [58, 60],
        [-38, 60],
      ]),
      fill: roof,
    }),
  );
  out.push(box(-48, 43, 68, 47, {fill: trim}));
  for (const x of [-40, 60]) out.push(box(x - 2.2, -30, x + 2.2, 43, {fill: trim}));
  out.push(box(-40, 12, 60, 14.5, {fill: trim}));
  for (let x = -36; x < 60; x += 6) out.push(box(x - 0.7, -30, x + 0.7, 12, {fill: grey(0.27)}));
  return out;
}

/** Near trees and the reeds of the foreground, in units of the world. @param {Rng} rng */
function nearTrees(rng) {
  const out = [];
  branch(rng, -470, WATER_Y - 20, 120, -0.08, 15, 6, grey(0.05), out);
  branch(rng, -352, WATER_Y - 20, 80, 0.22, 9, 5, grey(0.07), out);
  branch(rng, 545, WATER_Y - 20, 110, -0.18, 13, 6, grey(0.05), out);
  return out;
}

/** @param {Rng} rng */
function reeds(rng) {
  const out = [];
  /** @param {number} x0 @param {number} x1 @param {number} count @param {number} hMax */
  const clump = (x0, x1, count, hMax) => {
    for (let i = 0; i < count; i++) {
      const x = rng.range(x0, x1);
      const y = -330;
      const h = rng.range(0.35, 1) * hMax;
      const lean = rng.range(-0.35, 0.35) * h;
      const top = [x + lean, y + h];
      const ctrl = [x + lean * 0.2, y + h * 0.6];
      const w = rng.range(1.2, 2.6);
      out.push(
        el('path', {
          d: `M${x - w} ${y} Q${ctrl[0]} ${ctrl[1]} ${top[0]} ${top[1]} Q${ctrl[0] + w} ${ctrl[1]} ${x + w} ${y} Z`,
          fill: grey(0.015),
        }),
      );
      // now and then a cattail on top
      if (rng.next() < 0.18) {
        const a = Math.atan2(lean, h);
        out.push(
          el('ellipse', {
            cx: top[0] - Math.sin(a) * 9,
            cy: top[1] - Math.cos(a) * 9,
            rx: 3.2,
            ry: 11,
            transform: `rotate(${(-a * 180) / Math.PI} ${top[0] - Math.sin(a) * 9} ${top[1] - Math.cos(a) * 9})`,
            fill: grey(0.02),
          }),
        );
      }
    }
  };
  clump(-620, -360, 70, 175);
  clump(330, 620, 64, 150);
  clump(-120, 40, 14, 70);
  return out;
}

/** @returns {Promise<Buffer>} the opaque webp of the photograph */
export async function renderHouse() {
  const rng = new Rng(1931);
  const w = IMG_W;
  const h = IMG_H;
  const doc = (/** @type {string[]} */ body) => worldDoc([], body);
  const layers = [
    // far trees: the far shore, almost gone in the fog
    {
      body: [el('path', {d: treeLine(rng, WATER_Y + 40, 14, 12, 70, 11, WATER_Y - 40), fill: grey(0.1)})],
      fog: 0.78,
    },
    // nearer trees, a darker band
    {
      body: [el('path', {d: treeLine(rng, WATER_Y + 14, 10, 9, 44, 23, WATER_Y - 40), fill: grey(0.06)})],
      fog: 0.56,
    },
    {body: [el('g', {transform: `translate(140 ${WATER_Y}) scale(0.95)`}, house())], fog: 0.3},
    {body: nearTrees(rng), fog: 0.12},
  ];
  const rasters = [];
  for (const layer of layers) rasters.push({img: await rasterize(doc(layer.body), w, h), fog: layer.fog});
  const reedImg = await rasterize(doc(reeds(rng)), w, h);

  // the scene above the water, luminance per pixel
  const lum = new Float32Array(w * h);
  const waterRow = Math.round((WORLD.top - WATER_Y) * PX);
  for (let py = 0; py < h; py++) {
    const y = WORLD.top - (py + 0.5) / PX;
    for (let px = 0; px < w; px++) {
      const x = WORLD.left + (px + 0.5) / PX;
      // the sky: darker above, the fog bright at the horizon, clouds in the fog
      let l = 0.16 + 0.38 * (1 - ss(WATER_Y, WORLD.top, y)) ** 1.6;
      l += (fbm(x * 0.004, y * 0.009, 5, 5) - 0.5) * 0.09;
      const dx = x - MOON.x;
      const dy = y - MOON.y;
      const d = Math.hypot(dx, dy);
      l += 0.34 * Math.exp(-(d * d) / (2 * 70 * 70)) + 0.16 * Math.exp(-d / 260);
      // the moon itself, softened by the fog, with a darker sea on its face
      const disc = 1 - ss(MOON.r - 2.5, MOON.r + 1.5, d);
      const sea = fbm(dx * 0.08 + 3, dy * 0.08, 77, 3);
      l = l + disc * (0.92 - sea * 0.25 - l);
      // the ground mist: a bright band that rises from the water
      const mist = Math.exp(-(((y - WATER_Y) / 46) ** 2)) * (0.55 + 0.45 * fbm(x * 0.008, y * 0.03, 9, 4));
      const i = py * w + px;
      for (const {img, fog} of rasters) {
        const a = img[i * 4 + 3] / 255;
        if (a === 0) continue;
        // the fog of the layer's depth, thicker near the water
        const f = Math.min(1, fog + (1 - fog) * mist * 0.7);
        const fogL = 0.44 + 0.1 * (1 - ss(WATER_Y, 200, y));
        const ll = (img[i * 4] / 255) * (1 - f) + fogL * f;
        l = l + (ll - l) * a;
      }
      l += mist * 0.12;
      lum[i] = l;
    }
  }
  // the glow of the lit window and of the moon spills over what is in front
  const glow = (/** @type {number} */ x, /** @type {number} */ y) => {
    const dx = x - LIT_WINDOW.x;
    const dy = y - LIT_WINDOW.y;
    return 0.22 * Math.exp(-(dx * dx + dy * dy) / (2 * 26 * 26));
  };

  // the water: the scene mirrored about the waterline, broken by ripples, darker and duller
  const rgb = new Float32Array(w * h * 4);
  for (let py = 0; py < h; py++) {
    const y = WORLD.top - (py + 0.5) / PX;
    for (let px = 0; px < w; px++) {
      const x = WORLD.left + (px + 0.5) / PX;
      const i = py * w + px;
      let l;
      if (py < waterRow) {
        l = lum[i] + glow(x, y);
      } else {
        const depth = WATER_Y - y;
        // long horizontal ripples, stronger further out
        const ripple =
          (fbm(x * 0.012, y * 0.3, 31, 4) - 0.5) * (3 + depth * 0.16) +
          Math.sin(y * 0.7 + fbm(x * 0.01, y * 0.05, 32, 2) * 9) * (0.4 + depth * 0.012);
        const ry = WATER_Y + depth;
        const sx = Math.min(w - 1, Math.max(0, Math.round((x + ripple - WORLD.left) * PX)));
        // a little blur down the reflection: three rows
        let sum = 0;
        for (let k = -1; k <= 1; k++) {
          const sy = Math.min(waterRow - 1, Math.max(0, Math.round((WORLD.top - ry) * PX) + k * 2));
          sum += lum[sy * w + sx];
        }
        l = (sum / 3) * (0.62 - Math.min(0.25, depth * 0.0018)) + glow(x + ripple, ry) * 0.7;
        // glints on the ripples where the moon is mirrored
        const mdx = (x - MOON.x) / 70;
        const glint = Math.exp(-mdx * mdx) * Math.max(0, fbm(x * 0.05, y * 0.6, 41, 2) - 0.58) * 2.2;
        l += glint * (1 - Math.min(1, depth / 160));
        // the mist lies on the water too
        l += Math.exp(-((depth / 22) ** 2)) * 0.1;
      }
      // reeds stand in front of water and fog alike
      const ra = reedImg[i * 4 + 3] / 255;
      l = l + (reedImg[i * 4] / 255 - l) * ra;
      // a lens vignette, and a gentle toe
      const vx = x / 600;
      const vy = y / 320;
      l *= 1 - 0.38 * Math.min(1, (vx * vx + vy * vy) * 0.55) ** 1.4;
      l = Math.max(0, l) ** 1.08;
      // a cool silver tone, the paper of the print a touch warmer in the highlights
      rgb[i * 4] = l * (0.9 + 0.08 * l);
      rgb[i * 4 + 1] = l * 0.96;
      rgb[i * 4 + 2] = l * (1.05 - 0.05 * l);
      rgb[i * 4 + 3] = 1;
    }
  }
  // a breath of softness, as a lens and a print give a photograph
  const bytes = new Uint8Array(w * h * 3);
  for (let p = 0, i = 0; i < bytes.length; p += 4, i += 3) {
    for (let c = 0; c < 3; c++) bytes[i + c] = Math.round(Math.min(1, Math.max(0, rgb[p + c])) * 255);
  }
  return sharp(Buffer.from(bytes.buffer), {raw: {width: w, height: h, channels: 3}})
    .blur(0.6)
    .webp({quality: 86, effort: 6, smartSubsample: true})
    .toBuffer();
}

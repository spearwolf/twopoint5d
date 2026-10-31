// stage-masks/resolution: the wall of "Séance Photographs" — the back parlour of a spirit
// photographer, a flocked paper gone nearly black, a picture rail, three ebonised frames hung on
// cords, each with a gilt slip and an aged cream mat around an arched window, a brass plaque under
// each, a dado rail and the top of a dark wainscot. The windows are left dark: the demo lays the
// photographs into them. Lit softly from above each frame.
import {fbm, Rng} from '../../lib/image.mjs';
import {box, el, encodeWebpRGB, rasterize, sat, smoothstep, vgrad, worldDoc} from '../rift/kit.mjs';
import {FRAME, MAT, PANELS, PHOTO, PLAQUE, PX, WALL, windowPath} from './layout.mjs';

export const WALL_W = (WALL.right - WALL.left) * PX;
export const WALL_H = (WALL.top - WALL.bottom) * PX;

/** the picture rail and the dado rail, in units */
const RAIL_Y = 292;
const DADO_Y = -276;

/** One frame: cords to the rail, the ebonised moulding, the gilt slip, the mat, the plaque. */
function frame(/** @type {{x: number, y: number}} */ {x, y}) {
  const out = [];
  const hw = PHOTO.w / 2 + MAT + FRAME;
  const top = y + PHOTO.h / 2 + MAT + FRAME;
  const bottom = y - PHOTO.h / 2 - MAT - FRAME;
  // the cords from two hooks on the rail to the back of the frame
  out.push(
    el('path', {
      d: `M${x} ${RAIL_Y - 6}L${x - hw + 40} ${top - 6}M${x} ${RAIL_Y - 6}L${x + hw - 40} ${top - 6}`,
      stroke: '#5a4630',
      'stroke-width': 1.4,
      fill: 'none',
    }),
  );
  out.push(el('path', {d: `M${x - 5} ${RAIL_Y - 2}Q${x} ${RAIL_Y - 14} ${x + 5} ${RAIL_Y - 2}Z`, fill: '#8a6a3a'}));
  // the shadow of the frame on the wall, down and soft
  out.push(box(x - hw + 6, bottom - 14, x + hw + 10, top - 6, {fill: '#000', opacity: 0.7, filter: 'url(#shadow)'}));
  // the moulding: ebonised wood, a bevel lit from above
  out.push(box(x - hw, bottom, x + hw, top, {fill: 'url(#ebony)'}));
  out.push(box(x - hw + 3, bottom + 3, x + hw - 3, top - 3, {fill: 'none', stroke: '#2a2622', 'stroke-width': 1.2}));
  out.push(
    el('path', {
      d: `M${x - hw} ${top}L${x + hw} ${top}L${x + hw - FRAME} ${top - FRAME}L${x - hw + FRAME} ${top - FRAME}Z`,
      fill: '#3a342e',
      opacity: 0.8,
    }),
  );
  out.push(
    el('path', {
      d: `M${x - hw} ${bottom}L${x + hw} ${bottom}L${x + hw - FRAME} ${bottom + FRAME}L${x - hw + FRAME} ${bottom + FRAME}Z`,
      fill: '#000',
      opacity: 0.5,
    }),
  );
  // a band of incised gilt lines in the moulding
  out.push(
    box(x - hw + 9, bottom + 9, x + hw - 9, top - 9, {fill: 'none', stroke: '#8c6c34', 'stroke-width': 0.8, opacity: 0.7}),
  );
  // the gilt slip around the mat, beaded
  const mw = PHOTO.w / 2 + MAT;
  out.push(box(x - mw - 4, y - PHOTO.h / 2 - MAT - 4, x + mw + 4, y + PHOTO.h / 2 + MAT + 4, {fill: 'url(#gilt)'}));
  for (let k = -mw; k <= mw; k += 4) {
    out.push(el('circle', {cx: x + k, cy: y + PHOTO.h / 2 + MAT + 2, r: 1.1, fill: '#e2c47a', opacity: 0.6}));
    out.push(el('circle', {cx: x + k, cy: y - PHOTO.h / 2 - MAT - 2, r: 1.1, fill: '#5a4420', opacity: 0.7}));
  }
  // the mat: aged cream card, the window cut with a bevel that catches the light
  out.push(box(x - mw, y - PHOTO.h / 2 - MAT, x + mw, y + PHOTO.h / 2 + MAT, {fill: 'url(#mat)'}));
  out.push(el('path', {d: windowPath(2.5), transform: `translate(${x} ${y})`, fill: '#efe2c0'}));
  out.push(el('path', {d: windowPath(0.5), transform: `translate(${x} ${y})`, fill: '#0b0907'}));
  // the plaque: brass, a beaded edge, two screws; the demo writes on it
  const py = y + PLAQUE.dy;
  out.push(
    box(x - PLAQUE.w / 2 + 3, py - PLAQUE.h / 2 - 4, x + PLAQUE.w / 2 + 5, py + PLAQUE.h / 2 - 2, {
      fill: '#000',
      opacity: 0.6,
      filter: 'url(#shadow)',
    }),
  );
  out.push(
    el('rect', {x: x - PLAQUE.w / 2, y: py - PLAQUE.h / 2, width: PLAQUE.w, height: PLAQUE.h, rx: 3, fill: 'url(#brass)'}),
  );
  out.push(
    el('rect', {
      x: x - PLAQUE.w / 2 + 3,
      y: py - PLAQUE.h / 2 + 3,
      width: PLAQUE.w - 6,
      height: PLAQUE.h - 6,
      rx: 2,
      fill: 'none',
      stroke: '#3a2a12',
      'stroke-width': 0.8,
      opacity: 0.8,
    }),
  );
  for (const sx of [-1, 1]) {
    const cx = x + sx * (PLAQUE.w / 2 - 9);
    out.push(el('circle', {cx, cy: py, r: 2.6, fill: '#4a3818'}));
    out.push(el('path', {d: `M${cx - 2} ${py - 0.6}L${cx + 2} ${py + 0.6}`, stroke: '#1a1208', 'stroke-width': 0.8}));
  }
  return out;
}

const DEFS = [
  vgrad('ebony', -260, 300, [
    [0, '#0a0908'],
    [1, '#1c1916'],
  ]),
  vgrad('gilt', -200, 260, [
    [0, '#4a3818'],
    [0.5, '#a08040'],
    [1, '#c8a45a'],
  ]),
  vgrad('mat', -200, 260, [
    [0, '#8a7c62'],
    [1, '#c2b392'],
  ]),
  vgrad('brass', -246, -212, [
    [0, '#5a4420'],
    [0.5, '#9a7c40'],
    [1, '#6a5228'],
  ]),
  vgrad('rail', -10, 10, [
    [0, '#0c0907'],
    [1, '#2a1f17'],
  ]),
  el('filter', {id: 'shadow', x: '-20%', y: '-20%', width: '140%', height: '140%'}, el('feGaussianBlur', {stdDeviation: 7})),
];

/** Renders the wall, opaque. @returns {Promise<Buffer>} */
export async function renderWall() {
  const w = WALL_W;
  const h = WALL_H;
  const body = [];
  // the picture rail and the dado rail with the top of the wainscot below it
  body.push(box(WALL.left, RAIL_Y - 5, WALL.right, RAIL_Y + 7, {fill: '#1e1712'}));
  body.push(box(WALL.left, RAIL_Y + 5, WALL.right, RAIL_Y + 7, {fill: '#4a3a2a'}));
  body.push(box(WALL.left, WALL.bottom, WALL.right, DADO_Y, {fill: '#0e0a08'}));
  body.push(box(WALL.left, DADO_Y - 4, WALL.right, DADO_Y + 6, {fill: '#24190f'}));
  body.push(box(WALL.left, DADO_Y + 4, WALL.right, DADO_Y + 6, {fill: '#5a4430'}));
  for (let x = -560; x < 600; x += 140)
    body.push(box(x, WALL.bottom, x + 110, DADO_Y - 14, {fill: 'none', stroke: '#22180f', 'stroke-width': 2}));
  for (const p of PANELS) body.push(...frame(p));
  const svg = await rasterize(worldDoc(DEFS, body, WALL), w, h);

  const rng = new Rng(1888);
  const out = new Float32Array(w * h * 4);
  for (let py = 0; py < h; py++) {
    const y = WALL.top - (py + 0.5) / PX;
    for (let px = 0; px < w; px++) {
      const x = WALL.left + (px + 0.5) / PX;
      const i = py * w + px;
      // the flock: a damask diaper of lozenges, tone on tone, a bruised violet gone almost black
      const u = (x / 46) % 1;
      const v = (y / 64) % 1;
      const du = Math.abs(((u + 1) % 1) - 0.5);
      const dv = Math.abs(((v + 1) % 1) - 0.5);
      const lozenge =
        (1 - smoothstep(0.32, 0.38, du + dv * 0.72)) * 0.5 + (1 - smoothstep(0.06, 0.1, Math.abs(du + dv * 0.72 - 0.42))) * 0.35;
      const stain = fbm(x * 0.004, y * 0.006, 77, 5);
      let r = 0.07 + lozenge * 0.05;
      let g = 0.048 + lozenge * 0.03;
      let b = 0.078 + lozenge * 0.06;
      const damp = smoothstep(0.55, 0.75, stain) * 0.4;
      r *= 1 - damp;
      g *= 1 - damp * 0.6;
      b *= 1 - damp;
      const sa = svg[i * 4 + 3] / 255;
      r += (svg[i * 4] / 255 - r) * sa;
      g += (svg[i * 4 + 1] / 255 - g) * sa;
      b += (svg[i * 4 + 2] / 255 - b) * sa;
      // the light: a soft pool above each frame, and the room falling off to the corners
      let light = 0.32;
      for (const p of PANELS) {
        const dx = (x - p.x) / 230;
        const dy = (y - p.y - 120) / 330;
        light += 1.05 * Math.exp(-(dx * dx + dy * dy) * 1.6);
      }
      light *= 1 - 0.6 * sat((x / 600) ** 2 * 0.6 + ((y + 40) / 360) ** 2 * 0.5);
      const grain = (rng.next() - 0.5) * 0.012;
      out[i * 4] = sat(r * light + grain);
      out[i * 4 + 1] = sat(g * light + grain);
      out[i * 4 + 2] = sat(b * light + grain);
      out[i * 4 + 3] = 1;
    }
  }
  return encodeWebpRGB(out, w, h);
}

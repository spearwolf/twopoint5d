// stage-masks/found-footage: "Found Footage", the art of the demo stage-masks-shared — a night walk
// through a birch wood on a camcorder: five birch trunks, a tent, the figure, the shine of its
// eyes and three clumps of undergrowth in one atlas, and a strip of forest floor that repeats along
// x. (The directory is not called `shared/`: that name is kept for art several demos use.)
// README.md documents every file.
import sharp from 'sharp';
import {texturePackerHash} from '../../lib/formats.mjs';
import {Img} from '../../lib/image.mjs';
import {check} from '../../lib/output.mjs';
import {pack} from '../../lib/pack.mjs';
import {encodeWebpRGBA} from '../rift/kit.mjs';
import {el, rasterize, svgDoc} from '../spotlight/svg.mjs';
import {renderTrunk, TRUNKS} from './birch.mjs';
import {GROUND_H, GROUND_W, renderGround} from './ground.mjs';
import {eyeshine, figure, PROP_DEFS, tent, undergrowth} from './props.mjs';

/** @typedef {import('../../lib/output.mjs').Output} Output */

const DIR = 'found-footage';

/** @type {{name: string, w: number, h: number, draw: () => string[]}[]} */
const PROPS = [
  {name: 'tent', w: 520, h: 300, draw: tent},
  {name: 'figure', w: 80, h: 240, draw: figure},
  {name: 'eyeshine', w: 40, h: 20, draw: eyeshine},
  {name: 'bracken', w: 440, h: 300, draw: () => undergrowth('bracken', 5)},
  {name: 'bramble', w: 440, h: 300, draw: () => undergrowth('bramble', 6)},
  {name: 'grass', w: 440, h: 300, draw: () => undergrowth('grass', 7)},
];

/** @param {Output} out */
export async function generate(out) {
  const inputs = [];
  for (const spec of TRUNKS) inputs.push({name: spec.name, img: await renderTrunk(spec)});
  for (const prop of PROPS) {
    const body = el('g', {transform: `translate(${prop.w / 2} ${prop.h / 2})`}, prop.draw());
    const data = await rasterize(svgDoc(prop.w, prop.h, PROP_DEFS, [body]), prop.w, prop.h);
    inputs.push({name: prop.name, img: new Img(prop.w, prop.h, new Uint8Array(data))});
  }
  const {sheet, frames} = pack(inputs, {padding: 6, width: 2048, powerOfTwo: false});
  check(sheet.height <= 2048, `the sprite atlas fits 2048 × 2048, got ${sheet.width} × ${sheet.height}`);
  sheet.clearTransparent();
  const webp = await sharp(Buffer.from(sheet.data.buffer, sheet.data.byteOffset, sheet.data.length), {
    raw: {width: sheet.width, height: sheet.height, channels: 4},
  })
    .webp({quality: 90, alphaQuality: 95, effort: 6, smartSubsample: true})
    .toBuffer();
  out.bytes(`${DIR}/sprites.webp`, webp);
  out.json(`${DIR}/sprites.json`, texturePackerHash(frames, {image: 'sprites.webp', width: sheet.width, height: sheet.height}));
  out.bytes(`${DIR}/ground.webp`, await encodeWebpRGBA(await renderGround(), GROUND_W, GROUND_H));
}

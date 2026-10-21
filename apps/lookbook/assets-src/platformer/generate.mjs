// platformer: the kung-fu fighter and the goblin as Aseprite sheets, the goblin's palette, the
// Turrican-style parallax layers and the tile set.
import {asepriteHash, texturePackerHash} from '../lib/formats.mjs';
import {hex, Img, toHex} from '../lib/image.mjs';
import {check} from '../lib/output.mjs';
import {pack} from '../lib/pack.mjs';
import {machines, mountains, sky, tiles} from './backdrop.mjs';
import * as fighter from './fighter.mjs';
import * as goblin from './goblin.mjs';

/**
 * @template P
 * @param {string} title
 * @param {{name: string, direction: 'forward' | 'pingpong', repeat?: number, color: string, frames: [P, number][]}[]} animations
 * @param {(pose: P) => Img} draw
 * @param {{w: number, h: number}} canvas
 * @param {{x: number, y: number}} pivot
 */
function asepriteSheet(title, animations, draw, canvas, pivot) {
  /** @type {Img[]} */
  const images = [];
  /** @type {number[]} */
  const durations = [];
  /** @type {import('../lib/formats.mjs').AsepriteTag[]} */
  const tags = [];
  for (const anim of animations) {
    const from = images.length;
    for (const [pose, ms] of anim.frames) {
      images.push(draw(pose));
      durations.push(ms);
    }
    tags.push({name: anim.name, from, to: images.length - 1, direction: anim.direction, repeat: anim.repeat, color: anim.color});
  }
  images.forEach((img, i) => {
    check(img.width === canvas.w && img.height === canvas.h, `${title}: every frame is ${canvas.w} × ${canvas.h}`);
    const box = img.opaqueBounds();
    check(box && box.x > 0 && box.x + box.w < canvas.w && box.y > 0, `${title}: frame ${i} touches the left, right or top edge`);
  });
  // the first animation stands: its feet are on the pivot's row
  for (let i = tags[0].from; i <= tags[0].to; i++) {
    const box = images[i].opaqueBounds();
    check(box && box.y + box.h - 1 === pivot.y, `${title}: frame ${i} stands on row ${pivot.y}`);
  }
  const {sheet, frames} = pack(
    images.map((img, i) => ({name: String(i), img, trim: true})),
    {padding: 2},
  );
  const json = asepriteHash({
    title,
    frames,
    durations,
    tags,
    slices: [{name: 'pivot', color: '#ff0000ff', keys: [{frame: 0, bounds: {x: 0, y: 0, w: canvas.w, h: canvas.h}, pivot}]}],
    image: `${title}.png`,
    width: sheet.width,
    height: sheet.height,
  });
  return {sheet, json, images};
}

/** @param {import('../lib/output.mjs').Output} out */
export function generate(out) {
  const hero = asepriteSheet(
    'fighter',
    fighter.ANIMATIONS,
    fighter.drawFighter,
    {w: fighter.CANVAS, h: fighter.CANVAS},
    fighter.PIVOT,
  );
  out.png('fighter.png', hero.sheet);
  out.json('fighter.json', hero.json);

  const gob = asepriteSheet('goblin', goblin.ANIMATIONS, goblin.drawGoblin, {w: goblin.WIDTH, h: goblin.HEIGHT}, goblin.PIVOT);
  const palette = new Img(16, goblin.VARIANTS.length);
  goblin.VARIANTS.forEach((variant, y) => {
    check(variant.colours.length === 16, `goblin palette row ${y} has 16 entries`);
    variant.colours.forEach((c, x) => palette.set(x, y, hex(c)));
  });
  const source = new Set(goblin.VARIANTS[0].colours.map((c) => toHex(hex(c))));
  check(source.size === 16, 'the 16 source colours of the goblin are distinct');
  const used = gob.sheet.opaqueColours();
  for (const c of used) check(source.has(c), `goblin colour ${c} is in palette row 0`);
  out.png('goblin.png', gob.sheet);
  out.json('goblin.json', gob.json);
  out.png('goblin-palette.png', palette);

  out.png('sky.png', sky());
  out.png('mountains.png', mountains());
  out.png('machines.png', machines());

  const set = pack(tiles(), {padding: 2, keepOrder: true});
  out.png('tiles.png', set.sheet);
  out.json('tiles.json', texturePackerHash(set.frames, {image: 'tiles.png', width: set.sheet.width, height: set.sheet.height}));
}

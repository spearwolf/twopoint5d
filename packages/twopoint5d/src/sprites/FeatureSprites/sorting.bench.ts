import {PerspectiveCamera} from 'three/webgpu';
import {test} from 'vitest';

import {TexturedSpriteKind} from '../presets.js';
import {FeatureSprites} from './FeatureSprites.js';

const options = {time: 500, warmupTime: 200};

const COUNT = 10_000;

// a small deterministic generator, so that every run sorts the same pools
const lcg = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

const makeSprites = () => {
  const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: COUNT});
  const all = Array.from({length: COUNT}, () => sprites.createSprite()!);
  return {sprites, all};
};

// what a render does to the buffers after an update(): three takes the update ranges up as it uploads them
const uploaded = <Api extends object>(sprites: FeatureSprites<Api>) => {
  for (const buffer of sprites.geometry!.instancedBuffers.values()) buffer.clearUpdateRanges();
};

test('sorting 10 000 textured sprites', async ({bench}) => {
  const random = lcg(1);

  // shuffled: every sort turns the order over, so each one moves every sprite
  const shuffled = makeSprites();
  for (const sprite of shuffled.all) sprite.setPosition(random() * 1000, random() * 1000, 0);
  const descending = {descending: true};
  let turn = false;

  // nearly sorted: ten sprites step out of line per frame, the frame of a y-sorted game
  const nearly = makeSprites();
  nearly.all.forEach((sprite, i) => sprite.setPosition(0, i, 0));
  nearly.sprites.sortBy('y');
  let step = 0;

  // sorted: the order holds, nothing moves
  const sorted = makeSprites();
  sorted.all.forEach((sprite, i) => sprite.setPosition(0, i, 0));
  sorted.sprites.sortBy('y');

  // a cloud of billboards under a camera that circles it
  const cloud = makeSprites();
  for (const sprite of cloud.all) sprite.setPosition(random() * 200 - 100, random() * 200 - 100, random() * 200 - 100);
  const camera = new PerspectiveCamera(60, 1, 0.1, 1000);
  let angle = 0;

  await bench.compare(
    bench("sortBy('y'), shuffled, the order turned over every time", () => {
      turn = !turn;
      shuffled.sprites.sortBy('y', turn ? descending : undefined);
    }),
    bench("sortBy('y'), ten sprites out of line", () => {
      for (let k = 0; k < 10; k++) {
        const i = (step * 997 + k * 1009) % COUNT;
        const sprite = nearly.sprites.spritePool!.getVO(i)!;
        sprite.y += k % 2 === 0 ? 3 : -3;
      }
      step++;
      nearly.sprites.sortBy('y');
    }),
    bench("sortBy('y'), in order", () => {
      sorted.sprites.sortBy('y');
    }),
    bench("sortBy('y') shuffled, then update()", () => {
      turn = !turn;
      shuffled.sprites.sortBy('y', turn ? descending : undefined);
      shuffled.sprites.update();
      uploaded(shuffled.sprites);
    }),
    bench('sortByViewDepth(), the camera circling the cloud', () => {
      angle += 0.05;
      camera.position.set(Math.sin(angle) * 300, 50, Math.cos(angle) * 300);
      camera.lookAt(0, 0, 0);
      cloud.sprites.sortByViewDepth(camera);
    }),
    options,
  );

  for (const {sprites} of [shuffled, nearly, sorted, cloud]) sprites.dispose();
});

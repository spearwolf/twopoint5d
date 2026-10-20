import {PerspectiveCamera} from 'three/webgpu';
import {test} from 'vitest';

import {TexturedSpriteKind} from '../presets.js';
import {FeatureSprites} from './FeatureSprites.js';

const options = {time: 500, warmupTime: 200};

const COUNT = 10_000;

// how many orders of y the random benches take turns with: every iteration meets a random order it
// did not just sort
const PERMUTATIONS = 16;

// a small deterministic generator, so that every run sorts the same pools
const lcg = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};

// every bench sorts a mesh of its own: no bench starts from the order another one left behind
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

  // the y of every slot, one random order per set, built before anything is measured
  const orders = Array.from({length: PERMUTATIONS}, () => Float32Array.from({length: COUNT}, () => random() * 1000));

  // writes the next random order into the slots of a mesh — in the beforeEach hook, outside the
  // measured call
  const shuffler = <Api extends object>(sprites: FeatureSprites<Api>) => {
    const pool = sprites.spritePool!;
    let next = 0;
    return () => {
      const ys = orders[next]!;
      next = (next + 1) % PERMUTATIONS;
      for (let i = 0; i < COUNT; i++) (pool.getVO(i) as unknown as {y: number}).y = ys[i]!;
    };
  };

  const shuffled = makeSprites();
  const shuffledUpdated = makeSprites();

  // nearly sorted: ten sprites step out of line per frame, the frame of a y-sorted game
  const nearly = makeSprites();
  nearly.all.forEach((sprite, i) => sprite.setPosition(0, i, 0));
  nearly.sprites.sortBy('y');
  let step = 0;
  const stepOutOfLine = () => {
    const pool = nearly.sprites.spritePool!;
    for (let k = 0; k < 10; k++) {
      const sprite = pool.getVO((step * 997 + k * 1009) % COUNT)!;
      sprite.y += k % 2 === 0 ? 3 : -3;
    }
    step++;
  };

  // sorted: the order holds, nothing moves
  const sorted = makeSprites();
  sorted.all.forEach((sprite, i) => sprite.setPosition(0, i, 0));
  sorted.sprites.sortBy('y');

  // a cloud of billboards under a camera that circles it, a twentieth of a radian per frame
  const cloud = makeSprites();
  for (const sprite of cloud.all) sprite.setPosition(random() * 200 - 100, random() * 200 - 100, random() * 200 - 100);
  const camera = new PerspectiveCamera(60, 1, 0.1, 1000);
  let angle = 0;
  const circle = () => {
    angle += 0.05;
    camera.position.set(Math.sin(angle) * 300, 50, Math.cos(angle) * 300);
    camera.lookAt(0, 0, 0);
  };

  await bench.compare(
    bench("sortBy('y'), a random order", {beforeEach: shuffler(shuffled.sprites)}, () => {
      shuffled.sprites.sortBy('y');
    }),
    bench(
      "sortBy('y'), a random order, then update()",
      {beforeEach: shuffler(shuffledUpdated.sprites), afterEach: () => uploaded(shuffledUpdated.sprites)},
      () => {
        shuffledUpdated.sprites.sortBy('y');
        shuffledUpdated.sprites.update();
      },
    ),
    bench("sortBy('y'), ten sprites out of line", {beforeEach: stepOutOfLine}, () => {
      nearly.sprites.sortBy('y');
    }),
    bench("sortBy('y'), in order", () => {
      sorted.sprites.sortBy('y');
    }),
    bench('sortByViewDepth(), the camera circling the cloud', {beforeEach: circle}, () => {
      cloud.sprites.sortByViewDepth(camera);
    }),
    options,
  );

  for (const {sprites} of [shuffled, shuffledUpdated, nearly, sorted, cloud]) sprites.dispose();
});

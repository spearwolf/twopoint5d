import {test} from 'vitest';

import {AnimatedSpritesGeometry} from './AnimatedSprites/AnimatedSpritesGeometry.js';
import {TexturedSprites} from './TexturedSprites/TexturedSprites.js';

const options = {time: 500, warmupTime: 200};

test('a frame of 10 000 textured sprites', async ({bench}) => {
  const sprites = new TexturedSprites(10_000);
  const all = Array.from({length: 10_000}, () => sprites.createSprite()!);
  let n = 0;

  const moveAll = () => {
    n++;
    for (let i = 0; i < all.length; i++) {
      const sprite = all[i]!;
      sprite.setPosition(i, n, 2);
      sprite.rotation = n;
    }
  };

  await bench.compare(
    bench('move and turn every sprite', moveAll),
    bench('move every sprite, then update()', () => {
      moveAll();
      sprites.update();
    }),
    bench('update() after moving one sprite', () => {
      all[0]!.setPosition(++n, 0, 0);
      sprites.update();
    }),
    options,
  );

  sprites.dispose();
});

test('a frame of 10 000 animated sprites', async ({bench}) => {
  const geometry = new AnimatedSpritesGeometry(10_000);
  const all = Array.from({length: 10_000}, () => geometry.instancedPool.createVO()!);
  let n = 0;

  await bench('move every sprite, then update()', () => {
    n++;
    for (let i = 0; i < all.length; i++) {
      const sprite = all[i]!;
      sprite.setPosition(i, n, 2);
      sprite.rotation = n;
    }
    geometry.update();
  }).run(options);

  geometry.dispose();
});

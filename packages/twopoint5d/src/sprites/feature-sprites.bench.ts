import {test} from 'vitest';

import type {TextureAtlasFrame} from '../texture/TextureAtlas.js';
import {TextureCoords} from '../texture/TextureCoords.js';
import {FeatureSprites} from './FeatureSprites/FeatureSprites.js';
import {FeatureSpritesGeometry} from './FeatureSprites/FeatureSpritesGeometry.js';
import {prepareSpriteFrame} from './features/AtlasFrame.js';
import {AnimatedSpriteKind, TexturedSpriteKind} from './presets.js';

const options = {time: 500, warmupTime: 200};

// s, t, u, v of the coords come out as 0.25, 0.5, 0.75, 1
const frame: TextureAtlasFrame = {coords: new TextureCoords(new TextureCoords(0, 0, 4, 2), 1, 1, 3, 2)};

// a frame TexturePacker trimmed, so that setFrame() works out the margins as well
const trimmedFrame: TextureAtlasFrame<unknown> = {
  coords: new TextureCoords(new TextureCoords(0, 0, 8, 4), 5, 0, 2, 1),
  data: {trimmed: true, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}},
};

test('feature sprites — a frame of 10 000 textured sprites', async ({bench}) => {
  const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 10_000});
  const all = Array.from({length: 10_000}, () => sprites.createSprite()!);
  const prepared = prepareSpriteFrame(frame);
  const preparedTrimmed = prepareSpriteFrame(trimmedFrame);
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
    bench('feature sprites — move and turn every sprite', moveAll),
    bench('feature sprites — move every sprite, then update()', () => {
      moveAll();
      sprites.update();
    }),
    bench('feature sprites — update() after moving one sprite', () => {
      all[0]!.setPosition(++n, 0, 0);
      sprites.update();
    }),
    bench('feature sprites — re-frame every sprite with setFrame()', () => {
      n++;
      for (let i = 0; i < all.length; i++) {
        all[i]!.setFrame((i + n) & 1 ? frame : trimmedFrame);
      }
    }),
    bench('feature sprites — re-frame every sprite with setPreparedFrame()', () => {
      n++;
      for (let i = 0; i < all.length; i++) {
        all[i]!.setPreparedFrame((i + n) & 1 ? prepared : preparedTrimmed);
      }
    }),
    options,
  );

  sprites.dispose();
});

test('feature sprites — a frame of 10 000 animated sprites', async ({bench}) => {
  const geometry = new FeatureSpritesGeometry(AnimatedSpriteKind, 10_000);
  const all = Array.from({length: 10_000}, () => geometry.instancedPool.createVO()!);
  let n = 0;

  await bench('feature sprites — move every sprite, then update()', () => {
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

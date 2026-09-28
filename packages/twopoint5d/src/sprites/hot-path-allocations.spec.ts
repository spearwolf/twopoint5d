import {Color} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import type {TextureAtlasFrame} from '../texture/TextureAtlas.js';
import {TextureCoords} from '../texture/TextureCoords.js';
import {AnimatedSpritesGeometry} from './AnimatedSprites/AnimatedSpritesGeometry.js';
import {prepareSpriteFrame} from './TexturedSprites/TexturedSprite.js';
import {TexturedSprites} from './TexturedSprites/TexturedSprites.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths measured below
// 0.4 B per call when these limits were set — the noise of a few hundred bytes per round,
// spread over a thousand calls
const BYTES_PER_CALL_LIMIT = 1;

// a vertex object from Object.create(proto) with two fields measured 56 B when this limit was set,
// one built with property descriptors 552 B
const BYTES_PER_VERTEX_OBJECT_LIMIT = 128;

// s, t, u, v of the coords come out as 0.25, 0.5, 0.75, 1
const frame: TextureAtlasFrame = {coords: new TextureCoords(new TextureCoords(0, 0, 4, 2), 1, 1, 3, 2)};

// the frame data TexturePacker writes for a sprite of 5 × 4 trimmed to 2 × 1 at (1, 2): its margins are
// 1/5, 2/4, 2/5 and 1/4 — four different values, so that a mix-up of two sides shows
const trimmedFrame: TextureAtlasFrame = {
  coords: new TextureCoords(new TextureCoords(0, 0, 8, 4), 5, 0, 2, 1),
  data: {trimmed: true, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}},
};

const tint = new Color(0.8, 0.4, 0.2);

describe('sprites on the hot path', () => {
  test('moving, turning, re-framing and tinting a textured sprite allocates nothing per call', async () => {
    const sprites = new TexturedSprites(1000);
    const all = Array.from({length: 1000}, () => sprites.createSprite()!);

    // position and color are fractional: V8 boxes a fractional value that crosses a call it does
    // not inline as an argument of its own, and in a loop this full some calls stay un-inlined —
    // the methods of the sprite have to hand their values on without that. The rotation stays
    // integral: a fractional value the loop itself writes through an accessor V8 does not inline
    // is boxed by the loop, not by the library
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        const sprite = all[i]!;
        sprite.setPosition(i * 0.5 + 0.25, 1.5, 2.5);
        sprite.rotation = i;
        sprite.setFrame(i & 1 ? frame : trimmedFrame);
        sprite.setColor(tint, 0.5);
      }
    });
    const bytesPerCall = bytesPerRound / (all.length * 4);

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

    sprites.dispose();
  });

  test('moving a textured sprite by x and y alone and tinting it without an alpha allocates nothing per call', async () => {
    const sprites = new TexturedSprites(1000);
    const all = Array.from({length: 1000}, () => sprites.createSprite()!);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        const sprite = all[i]!;
        sprite.setPosition(i * 0.5 + 0.25, 1.5);
        sprite.setColor(tint);
      }
    });
    const bytesPerCall = bytesPerRound / (all.length * 2);

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

    sprites.dispose();
  });

  test('re-framing a textured sprite with a prepared frame allocates nothing per call', async () => {
    const sprites = new TexturedSprites(1000);
    const all = Array.from({length: 1000}, () => sprites.createSprite()!);
    const prepared = prepareSpriteFrame(frame);
    const preparedTrimmed = prepareSpriteFrame(trimmedFrame);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        all[i]!.setPreparedFrame(i & 1 ? prepared : preparedTrimmed);
      }
    });
    const bytesPerCall = bytesPerRound / all.length;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

    sprites.dispose();
  });

  test('moving and animating an animated sprite allocates nothing per call', async () => {
    const geometry = new AnimatedSpritesGeometry(1000);
    const pool = geometry.instancedPool;
    const all = Array.from({length: 1000}, () => pool.createVO()!);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        const sprite = all[i]!;
        sprite.setPosition(i * 0.5 + 0.25, 1.5, 2.5);
        sprite.rotation = i;
        sprite.animOffset = i;
      }
    });
    const bytesPerCall = bytesPerRound / (all.length * 3);

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

    geometry.dispose();
  });

  test('moving an animated sprite by x and y alone allocates nothing per call', async () => {
    const geometry = new AnimatedSpritesGeometry(1000);
    const pool = geometry.instancedPool;
    const all = Array.from({length: 1000}, () => pool.createVO()!);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        all[i]!.setPosition(i * 0.5 + 0.25, 1.5);
      }
    });
    const bytesPerCall = bytesPerRound / all.length;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

    geometry.dispose();
  });

  test('createSprite() allocates the sprite and nothing else', async () => {
    const sprites = new TexturedSprites(1100);
    for (let i = 0; i < 1000; i++) sprites.createSprite();

    // created at the end and freed as the last slot, so the pool stays at 1000 sprites in use;
    // the voInitialize hook of the sprite runs inside the measurement
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < 100; i++) {
        const sprite = sprites.createSprite()!;
        sprites.freeSprite(sprite);
      }
    });
    const bytesPerSprite = bytesPerRound / 100;

    expect(bytesPerSprite, `${bytesPerSprite.toFixed(2)} bytes per sprite`).toBeLessThan(BYTES_PER_VERTEX_OBJECT_LIMIT);

    sprites.dispose();
  });

  test('update() of textured sprites allocates nothing per call', async () => {
    const sprites = new TexturedSprites(1000);
    for (let i = 0; i < 1000; i++) sprites.createSprite();
    sprites.update();

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < 1000; i++) sprites.update();
    });
    const bytesPerCall = bytesPerRound / 1000;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

    sprites.dispose();
  });

  test('update() of animated sprites allocates nothing per call', async () => {
    const geometry = new AnimatedSpritesGeometry(1000);
    for (let i = 0; i < 1000; i++) geometry.instancedPool.createVO();
    geometry.update();

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < 1000; i++) geometry.update();
    });
    const bytesPerCall = bytesPerRound / 1000;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

    geometry.dispose();
  });
});

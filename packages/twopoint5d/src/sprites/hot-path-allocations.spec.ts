import {Color} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

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

    // the loop hands the setters whole numbers from its counter, constants and objects, and no
    // fractional value it works out itself: V8 boxes such a value at each call it leaves
    // un-inlined, and which calls it inlines shifts with its inlining budget, which the counters
    // of block coverage use up sooner — the loop would measure a heap number of its own per
    // sprite. The fractional values here come from the constants, from `tint` and from the
    // frames, and the setters read the last two themselves: a setter that hands one of them on
    // as an argument of its own allocates in this round wherever V8 leaves that call un-inlined.
    // That the setters hand the values of their caller on in one array is checked by the two
    // tests after the allocation tests of the setters
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        const sprite = all[i]!;
        sprite.setPosition(i, 1.5, 2.5);
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
        sprite.setPosition(i, 1.5);
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
        sprite.setPosition(i, 1.5, 2.5);
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
        all[i]!.setPosition(i, 1.5);
      }
    });
    const bytesPerCall = bytesPerRound / all.length;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);

    geometry.dispose();
  });

  // a value its caller works out reaches a setter unboxed where V8 inlines the setter into the
  // caller, and it stays unboxed only while the setter does not hand it on as an argument of its
  // own to a call V8 leaves un-inlined — which the rounds above cannot show for such a value (see
  // the first of them). So these check what the setters hand on: one array, which the generated
  // setter copies into the buffer. The setters write the same array again on the next call, so
  // every call is checked before the next one
  test('a textured sprite hands the values of setSize(), setPosition() and setColor() on in one array', () => {
    const sprites = new TexturedSprites(1);
    const sprite = sprites.createSprite()!;
    const setQuadSize = vi.spyOn(sprite, 'setQuadSize');
    const setInstancePosition = vi.spyOn(sprite, 'setInstancePosition');
    const setColorValues = vi.spyOn(sprite, 'setColorValues');

    sprite.setSize(0.25, 0.75);
    expect(setQuadSize.mock.calls).toEqual([[[0.25, 0.75]]]);

    sprite.setPosition(0.25, 1.5, 2.5);
    expect(setInstancePosition.mock.calls).toEqual([[[0.25, 1.5, 2.5]]]);
    setInstancePosition.mockClear();
    sprite.setPosition(0.75, 1.25);
    expect(setInstancePosition.mock.calls).toEqual([[[0.75, 1.25]]]);

    sprite.setColor(new Color(0.5, 0.25, 0.125), 0.5);
    expect(setColorValues.mock.calls).toEqual([[[0.5, 0.25, 0.125, 0.5]]]);
    setColorValues.mockClear();
    sprite.setColor(new Color(0.75, 0.5, 0.25));
    expect(setColorValues.mock.calls).toEqual([[[0.75, 0.5, 0.25]]]);

    sprites.dispose();
  });

  test('an animated sprite hands the values of setSize() and setPosition() on in one array', () => {
    const geometry = new AnimatedSpritesGeometry(1);
    const sprite = geometry.instancedPool.createVO()!;
    const setQuadSize = vi.spyOn(sprite, 'setQuadSize');
    const setInstancePosition = vi.spyOn(sprite, 'setInstancePosition');

    sprite.setSize(0.25, 0.75);
    expect(setQuadSize.mock.calls).toEqual([[[0.25, 0.75]]]);

    sprite.setPosition(0.25, 1.5, 2.5);
    expect(setInstancePosition.mock.calls).toEqual([[[0.25, 1.5, 2.5]]]);
    setInstancePosition.mockClear();
    sprite.setPosition(0.75, 1.25);
    expect(setInstancePosition.mock.calls).toEqual([[[0.75, 1.25]]]);

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

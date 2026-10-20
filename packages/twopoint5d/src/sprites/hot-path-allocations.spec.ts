import {Color, DirectionalLight, Euler, Object3D, PerspectiveCamera, Quaternion} from 'three/webgpu';
import {describe, expect, test, vi} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import type {TextureAtlasFrame} from '../texture/TextureAtlas.js';
import {TextureCoords} from '../texture/TextureCoords.js';
import {lightOf} from './bindings/lightOf.js';
import {planeOf} from './bindings/planeOf.js';
import {FeatureSprites} from './FeatureSprites/FeatureSprites.js';
import {FeatureSpritesGeometry} from './FeatureSprites/FeatureSpritesGeometry.js';
import {AtlasFrame, prepareSpriteFrame} from './features/AtlasFrame.js';
import {Fade} from './features/Fade.js';
import {FlatPlacement, flatPlacement} from './features/FlatPlacement.js';
import {Flash} from './features/Flash.js';
import {InstancePosition} from './features/InstancePosition.js';
import {Orientation} from './features/Orientation.js';
import {PaletteSwap} from './features/PaletteSwap.js';
import {QuadSize} from './features/QuadSize.js';
import {tableFrame} from './features/TableFrame.js';
import {TextureColor} from './features/TextureColor.js';
import {Yaw} from './features/Yaw.js';
import {ReflectionPass, ShadowPass} from './passes/passPresets.js';
import {AnimatedSpriteKind, TexturedSpriteKind} from './presets.js';
import {QuadBase} from './SpriteBase.js';
import {defineSprite} from './defineSprite.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths measured below
// 0.4 B per call when these limits were set — the noise of a few hundred bytes per round,
// spread over a thousand calls
const BYTES_PER_CALL_LIMIT = 1;

// a vertex object from Object.create(proto) with two fields measured 56 B when this limit was set,
// one built with property descriptors 552 B
const BYTES_PER_VERTEX_OBJECT_LIMIT = 128;

const frame: TextureAtlasFrame = {coords: new TextureCoords(new TextureCoords(0, 0, 4, 2), 1, 1, 3, 2)};
const trimmedFrame: TextureAtlasFrame<unknown> = {
  coords: new TextureCoords(new TextureCoords(0, 0, 8, 4), 5, 0, 2, 1),
  data: {trimmed: true, spriteSourceSize: {x: 1, y: 2, w: 2, h: 1}, sourceSize: {w: 5, h: 4}},
};
const tint = new Color(0.8, 0.4, 0.2);

describe('sprites on the hot path', () => {
  test('picking the frame and the view of a table sprite and its palette row allocates nothing per call', async () => {
    const TableSprite = defineSprite({
      base: QuadBase,
      features: [InstancePosition, FlatPlacement, QuadSize, Yaw, tableFrame({views: 8}), TextureColor, PaletteSwap],
    });
    const sprites = new FeatureSprites(TableSprite, {capacity: 1000, attributeUsage: {dynamic: ['frameIndex', 'yaw']}});
    const all = Array.from({length: 1000}, () => sprites.createSprite()!);

    // whole numbers from the counter and constants alone: see the first test of this file
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        const sprite = all[i]!;
        sprite.frameIndex = (i & 3) * 8;
        sprite.yaw = i;
        sprite.paletteRow = i & 3;
        sprites.setUniform('paletteShift', i);
      }
    });
    const bytesPerCall = bytesPerRound / (all.length * 4);

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });

  test('moving, turning, re-framing and tinting a textured sprite allocates nothing per call', async () => {
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1000});
    const all = Array.from({length: 1000}, () => sprites.createSprite()!);

    // the loop hands the setters whole numbers from its counter, constants and objects, and no
    // fractional value it works out itself: V8 boxes such a value at each call it leaves
    // un-inlined, and which calls it inlines shifts with its inlining budget, which the counters
    // of block coverage use up sooner — the loop would measure a heap number of its own per
    // sprite. The fractional values here come from the constants, from `tint` and from the
    // frames, and the setters read the last two themselves: a setter that hands one of them on
    // as an argument of its own allocates in this round wherever V8 leaves that call un-inlined.
    // That the setters hand the values of their caller on in one array is checked by the tests
    // `setPosition() hands its values on in one array` in `features/placement.spec.ts`,
    // `setSize() writes width and height, in one array` in `features/local-transforms.spec.ts`
    // and `setColor() hands its values on in one array` in `features/frame-and-color.spec.ts`
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        const sprite = all[i]!;
        sprite.setSize(i, 2.5);
        sprite.setPosition(i, 1.5, 2.5);
        sprite.rotation = i;
        sprite.setFrame(i & 1 ? frame : trimmedFrame);
        sprite.setColor(tint, 0.5);
      }
    });
    const bytesPerCall = bytesPerRound / (all.length * 5);

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });

  test('moving a textured sprite by x and y alone and tinting it without an alpha allocates nothing per call', async () => {
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1000});
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
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1000});
    const all = Array.from({length: 1000}, () => sprites.createSprite()!);
    const prepared = prepareSpriteFrame(frame);
    const preparedTrimmed = prepareSpriteFrame(trimmedFrame);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) all[i]!.setPreparedFrame(i & 1 ? prepared : preparedTrimmed);
    });

    expect(bytesPerRound / all.length).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });

  test('moving and animating an animated sprite allocates nothing per call', async () => {
    const geometry = new FeatureSpritesGeometry(AnimatedSpriteKind, 1000);
    const all = Array.from({length: 1000}, () => geometry.instancedPool.createVO()!);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        const sprite = all[i]!;
        sprite.setPosition(i, 1.5, 2.5);
        sprite.rotation = i;
        sprite.animOffset = i;
      }
    });

    expect(bytesPerRound / (all.length * 3)).toBeLessThan(BYTES_PER_CALL_LIMIT);
    geometry.dispose();
  });

  test('moving and turning a sprite by its yaw allocates nothing per call', async () => {
    const kind = defineSprite({
      base: QuadBase,
      features: [InstancePosition, flatPlacement({plane: 'xz', orientation: 'yaw'}), Yaw, QuadSize, AtlasFrame, TextureColor],
    });
    const sprites = new FeatureSprites(kind, {capacity: 1000, attributeUsage: {dynamic: ['yaw']}});
    const all = Array.from({length: 1000}, () => sprites.createSprite()!);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        const sprite = all[i]!;
        sprite.setPosition(i, 1.5, 2.5);
        sprite.yaw = i;
      }
      sprites.update();
    });

    expect(bytesPerRound / (all.length * 2)).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });

  test('turning a sprite by a quaternion or by setYaw() allocates nothing per call', async () => {
    const kind = defineSprite({
      base: QuadBase,
      features: [InstancePosition, flatPlacement({orientation: 'quaternion'}), Orientation, QuadSize, AtlasFrame, TextureColor],
    });
    const sprites = new FeatureSprites(kind, {capacity: 1000, attributeUsage: {dynamic: ['orientation']}});
    const all = Array.from({length: 1000}, () => sprites.createSprite()!);
    const tilted = new Quaternion().setFromEuler(new Euler(-0.6, 2.4, 0.1));

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        const sprite = all[i]!;
        sprite.setQuaternion(tilted);
        sprite.setYaw(i);
      }
      sprites.update();
    });

    expect(bytesPerRound / (all.length * 2)).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });

  test('fading and flashing a sprite allocates nothing per call', async () => {
    const kind = defineSprite({
      base: QuadBase,
      features: [InstancePosition, FlatPlacement, QuadSize, AtlasFrame, TextureColor, Fade, Flash],
    });
    const sprites = new FeatureSprites(kind, {capacity: 1000});
    const all = Array.from({length: 1000}, () => sprites.createSprite()!);
    // the tuple a caller keeps for its flashes, written once
    const hit: [number, number, number, number] = [1, 0.25, 0.25, 0.75];

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < all.length; i++) {
        const sprite = all[i]!;
        sprite.fade = 0.5;
        sprite.setFlash(hit);
        sprite.flashAmount = i & 1;
      }
      sprites.update();
    });

    expect(bytesPerRound / (all.length * 3)).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });

  test('createSprite() allocates the sprite and nothing else, every initialize() included', async () => {
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1100});
    for (let i = 0; i < 1000; i++) sprites.createSprite();

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < 100; i++) sprites.freeSprite(sprites.createSprite()!);
    });

    expect(bytesPerRound / 100).toBeLessThan(BYTES_PER_VERTEX_OBJECT_LIMIT);
    sprites.dispose();
  });

  test('createSprite() on a full pool allocates nothing once it has warned', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 10});
    for (let i = 0; i < 11; i++) sprites.createSprite();

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < 1000; i++) sprites.createSprite();
    });

    expect(bytesPerRound / 1000).toBeLessThan(BYTES_PER_CALL_LIMIT);
    expect(warn).toHaveBeenCalledOnce();
    sprites.dispose();
  });

  test('update() of textured and of animated sprites allocates nothing per call', async () => {
    const textured = new FeatureSprites(TexturedSpriteKind, {capacity: 1000});
    const animated = new FeatureSprites(AnimatedSpriteKind, {capacity: 1000});
    for (let i = 0; i < 1000; i++) {
      textured.createSprite();
      animated.createSprite();
    }
    textured.update();
    animated.update();

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < 1000; i++) {
        textured.update();
        animated.update();
      }
    });

    expect(bytesPerRound / 2000).toBeLessThan(BYTES_PER_CALL_LIMIT);
    textured.dispose();
    animated.dispose();
  });

  test('update() of sprites with a shadow and a reflection pass allocates nothing per call', async () => {
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1000, passes: [ShadowPass, ReflectionPass]});
    for (let i = 0; i < 1000; i++) sprites.createSprite();
    sprites.update();

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < 1000; i++) sprites.update();
    });

    expect(bytesPerRound / 1000).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });

  test('update() with a plane and a light binding and a pass with a hook allocates nothing per call', async () => {
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1000, passes: [ShadowPass]});
    for (let i = 0; i < 1000; i++) sprites.createSprite();
    const ground = new Object3D();
    ground.rotation.x = -Math.PI / 2;
    const sun = new DirectionalLight();
    sun.position.set(3, 10, 2);
    const lamp = new Object3D();
    lamp.position.set(0, 20, 0);
    sprites.bindUniform('groundPlane', planeOf(ground));
    sprites.bindUniform('shadowLight', lightOf(sun));
    sprites.update();

    const sunBytes = await measureSettledBytes(() => {
      for (let i = 0; i < 1000; i++) sprites.update();
    });
    sprites.bindUniform('shadowLight', lightOf(lamp));
    sprites.update();
    const lampBytes = await measureSettledBytes(() => {
      for (let i = 0; i < 1000; i++) sprites.update();
    });

    expect(sunBytes / 1000).toBeLessThan(BYTES_PER_CALL_LIMIT);
    expect(lampBytes / 1000).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });

  test('sortByViewDepth() and sortBy() of sprites with a pass, and the update() after them, allocate nothing per call', async () => {
    const sprites = new FeatureSprites(TexturedSpriteKind, {capacity: 1000, passes: [ReflectionPass]});
    for (let i = 0; i < 1000; i++) {
      // fractional values, written here and read by the sorts straight from the buffer
      sprites.createSprite()!.setPosition(((i * 7919) % 1000) / 3, ((i * 104729) % 1000) / 7, ((i * 1299709) % 1000) / 9);
    }
    // two cameras that see the sprites from opposite sides, set up once: each round turns the order over
    const front = new PerspectiveCamera(60, 1, 0.1, 1000);
    front.position.set(0, 0, 500);
    front.lookAt(0, 0, 0);
    const back = new PerspectiveCamera(60, 1, 0.1, 1000);
    back.position.set(0, 0, -500);
    back.lookAt(0, 0, 0);
    const descending = {descending: true};
    sprites.update();

    // whole numbers, counted in the round: every call has to move, or the round measured no sort
    let calls = 0;
    let moved = 0;
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < 10; i++) {
        if (sprites.sortByViewDepth(front)) moved++;
        sprites.update();
        if (sprites.sortByViewDepth(back)) moved++;
        sprites.update();
        if (sprites.sortBy('y')) moved++;
        if (sprites.sortBy('y', descending)) moved++;
        calls += 4;
      }
    });

    expect(moved, 'the sorts that moved a sprite').toBe(calls);
    expect(bytesPerRound / 60).toBeLessThan(BYTES_PER_CALL_LIMIT);
    sprites.dispose();
  });
});

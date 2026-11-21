import {readFileSync} from 'node:fs';
import {Texture} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import {AsepriteJson, type AsepriteJsonData} from '../texture/AsepriteJson.js';
import {ParallaxProjection} from '../stage/ParallaxProjection.js';
import {anchorOf, artFrameOf, depthScaleInto, layoutLayerInto, type LayerBox} from './artLayout.js';
import type {StageArtOptions} from './artOptions.js';
import {type ArtPose, POSE_DEG, POSE_DEPTH, POSE_SIZE, POSE_X, POSE_Y, POSE_SCALE_X, POSE_SCALE_Y} from './artPose.js';
import {artTrack, rampAt} from './artTrack.js';
import {StageArt} from './StageArt.js';

// see hot-path-allocations.spec.ts of the sprites: a call that allocates anything costs 16 B at least
const BYTES_PER_CALL_LIMIT = 1;

const CALLS = 1000;

// the kitchen of the fixtures, an Aseprite sheet of six layers of four frames each, laid out and sorted once
const kitchen = (options: StageArtOptions = {}): StageArt => {
  const json: AsepriteJsonData = JSON.parse(readFileSync(new URL('./fixtures/kitchen-aseprite.json', import.meta.url), 'utf8'));
  const art = new StageArt({atlas: AsepriteJson.parse(json)[0], texture: new Texture()}, {pxPerUnit: 2, ...options});
  art.update();
  return art;
};

describe('stage art on the hot path', () => {
  test('sampling a track of three eased keys allocates nothing per call', async () => {
    const track = artTrack(
      [
        {at: 0, x: 412, y: 380, deg: 0, opacity: 1, frame: 0, visible: true},
        {at: 0.6, deg: 35, ease: 'ease-out'},
        {at: 1.4, deg: 95, frame: 1, ease: 'ease-in'},
      ],
      {ease: 'ease-in-out', playback: 'pingpong'},
    );
    const looped = artTrack(
      [
        {at: 0, x: 1, opacity: 0},
        {at: 2, x: 9, opacity: 1},
      ],
      {playback: 'loop'},
    );
    const pose: ArtPose = {};

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) {
        // whole numbers: the time is counted in hundredths by the caller of a real frame
        track.sample(i % 3, pose);
        track.sample(i % 2, pose);
        looped.sample(i % 5, pose);
        track.isMoving(i % 3);
      }
    });

    expect(bytesPerRound / (CALLS * 4)).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('a ramp allocates nothing per call', async () => {
    // a double kept in a variable of the closure is a heap number of its own: keep the sum in a typed array
    const sum = new Float64Array(1);
    // one call site per round: with both in one loop V8 may inline only one of them — the budget of a
    // caller, not a property of rampAt() —, and the fraction the other answers is boxed, 16 bytes
    const linear = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) sum[0]! += rampAt(i % 5, 1, 2);
    });
    const eased = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) sum[0]! += rampAt(i % 5, 1, 2, 'ease-in-out');
    });

    expect(sum[0]).toBeGreaterThan(0);
    expect(linear / CALLS, 'linear').toBeLessThan(BYTES_PER_CALL_LIMIT);
    expect(eased / CALLS, 'ease-in-out').toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('laying a layer out allocates nothing per call', async () => {
    const frame = artFrameOf('StageArt', 2, [400, 300], [440, 340], {width: 800, height: 600});
    const box: LayerBox = {x: 440, y: 210, w: 120, h: 80};
    const pose = new Float64Array(POSE_SIZE * 2);
    pose[POSE_SIZE + POSE_X] = 500;
    pose[POSE_SIZE + POSE_Y] = 250;
    pose[POSE_SIZE + POSE_DEPTH] = 600;
    pose[POSE_SIZE + POSE_DEG] = 35;
    pose[POSE_SIZE + POSE_SCALE_X] = 1;
    pose[POSE_SIZE + POSE_SCALE_Y] = 1;
    const out = new Float64Array(6);
    const k = new Float64Array(1);
    const anchor = new Float64Array(2);
    // keep the sums in a typed array: a double in a closure variable is a heap number of its own
    const sum = new Float64Array(1);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) {
        // whole numbers: a fraction handed in is boxed at the call
        depthScaleInto(300, i % 7, frame, k);
        layoutLayerInto(frame, pose, 1, box, k, out);
        anchorOf(box, 500, 250, anchor);
        sum[0]! += out[0]! + out[5]! + anchor[1]!;
      }
    });

    expect(Number.isFinite(sum[0])).toBe(true);
    expect(bytesPerRound / (CALLS * 3)).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('setting a pose, sampling a track into a layer and taking the change allocate nothing per call', async () => {
    const art = kitchen();
    const carafe = art.layer('carafe5');
    // the poses a caller keeps and writes again: whole numbers alone, see the first test of the sprites' spec
    const move: ArtPose = {x: 0, y: 0, deg: 0};
    const look: ArtPose = {opacity: 1, frame: 0, scaleX: 1, depth: 0, order: 0};
    const tilt = artTrack(
      [
        {at: 0, x: 109, y: 121, deg: 0, opacity: 1, frame: 0},
        {at: 1, deg: 35, ease: 'ease-out'},
        {at: 2, deg: 95, frame: 2, opacity: 0},
      ],
      {playback: 'pingpong'},
    );
    const changes = new Uint32Array(1);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) {
        move.x = i;
        move.y = i & 7;
        move.deg = i % 360;
        art.set('steam', move);
        look.opacity = i & 1;
        look.frame = i & 3;
        look.scaleX = (i & 3) + 1;
        look.depth = i & 1;
        look.order = (i & 3) - 2;
        carafe.set(look);
        art.apply('ladle', tilt, i % 3);
        carafe.apply(tilt, i % 3);
        if (art.takeChanged()) changes[0]!++;
      }
    });

    expect(changes[0]).toBeGreaterThan(0);
    expect(bytesPerRound / (CALLS * 5)).toBeLessThan(BYTES_PER_CALL_LIMIT);
    art.dispose();
  });

  test('an update() without a sort and the frame of a tag allocate nothing per call', async () => {
    const art = kitchen();
    const steam = art.layer('steam');
    const move: ArtPose = {x: 0, deg: 0, opacity: 1, frame: 0};
    const frames = new Uint32Array(1);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) {
        move.x = i;
        move.deg = i % 360;
        move.opacity = i & 1;
        move.frame = steam.frameAt('puff', i % 3);
        frames[0]! += move.frame;
        steam.set(move);
        art.update();
      }
    });

    expect(frames[0]).toBeGreaterThan(0);
    expect(bytesPerRound / (CALLS * 3)).toBeLessThan(BYTES_PER_CALL_LIMIT);
    art.dispose();
  });

  test('set() of a depth layer under a ParallaxProjection, and an update() at the same distance, allocate nothing per call', async () => {
    const projection = new ParallaxProjection('xy|bottom-left', {fit: 'fill', distanceToProjectionPlane: 300});
    projection.updateViewRect(800, 600);
    const art = kitchen({projection});
    const window = art.layer('window');
    // whole numbers handed in; the k of the depth, (300 + 41 / 2) / 300, is a fraction the art works
    // out. The depth is checked against the camera at every call and stays, so update() does not sort
    const move: ArtPose = {x: 0, y: 0, depth: 41};
    const look: ArtPose = {depth: 41, scaleX: 1};
    art.set('window', move);
    art.update();
    const shown = new Uint32Array(1);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) {
        move.x = i;
        move.y = i & 7;
        art.set('window', move);
        look.scaleX = (i & 1) + 1;
        window.set(look);
        art.update();
        shown[0]! += window.sprite.visible;
      }
    });

    expect(shown[0]).toBeGreaterThan(0);
    expect(bytesPerRound / (CALLS * 3)).toBeLessThan(BYTES_PER_CALL_LIMIT);
    art.dispose();
  });
});

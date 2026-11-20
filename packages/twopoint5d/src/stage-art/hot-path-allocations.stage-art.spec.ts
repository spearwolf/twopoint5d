import {describe, expect, test} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import {anchorOf, artFrameOf, depthScaleInto, layoutLayerInto, type LayerBox} from './artLayout.js';
import {type ArtPose, POSE_DEG, POSE_DEPTH, POSE_SIZE, POSE_X, POSE_Y, POSE_SCALE_X, POSE_SCALE_Y} from './artPose.js';
import {artTrack, rampAt} from './artTrack.js';

// see hot-path-allocations.spec.ts of the sprites: a call that allocates anything costs 16 B at least
const BYTES_PER_CALL_LIMIT = 1;

const CALLS = 1000;

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
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) {
        sum[0]! += rampAt(i % 5, 1, 2);
        sum[0]! += rampAt(i % 5, 1, 2, 'ease-in-out');
      }
    });

    expect(sum[0]).toBeGreaterThan(0);
    expect(bytesPerRound / (CALLS * 2)).toBeLessThan(BYTES_PER_CALL_LIMIT);
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
        layoutLayerInto(frame, pose, 1, box, k[0]!, out);
        anchorOf(box, 500, 250, anchor);
        sum[0]! += out[0]! + out[5]! + anchor[1]!;
      }
    });

    expect(Number.isFinite(sum[0])).toBe(true);
    expect(bytesPerRound / (CALLS * 3)).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });
});

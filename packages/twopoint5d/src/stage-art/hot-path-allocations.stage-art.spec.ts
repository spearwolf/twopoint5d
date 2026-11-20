import {describe, expect, test} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import type {ArtPose} from './artPose.js';
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
});

import {describe, expect, test} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import {animationFrameAt, type AnimationTiming} from './animationFrameAt.js';
import {AtlasFrameTable} from './AtlasFrameTable.js';
import {TexturePackerJson} from './TexturePackerJson.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths of the other
// modules measure well below 1 B per call
const BYTES_PER_FRAME_LIMIT = 1;

// a plain, a turned and a trimmed frame, so that update() takes every path it has
const [atlas] = TexturePackerJson.parse({
  frames: {
    plain: {frame: {x: 0, y: 0, w: 2, h: 4}},
    turned: {frame: {x: 2, y: 0, w: 4, h: 2}, rotated: true},
    trimmed: {
      frame: {x: 4, y: 0, w: 2, h: 1},
      trimmed: true,
      spriteSourceSize: {x: 1, y: 2, w: 2, h: 1},
      sourceSize: {w: 5, h: 4},
    },
  },
  meta: {image: 'sheet.png', size: {w: 8, h: 4}},
});

describe('texture on the hot path', () => {
  test('AtlasFrameTable#update() allocates nothing per frame', async () => {
    const frames = Array.from({length: AtlasFrameTable.MaxFrames}, (_, i) => atlas.get(i % atlas.size)!);
    const table = new AtlasFrameTable(frames);

    const bytesPerRound = await measureSettledBytes(() => table.update());
    const bytesPerFrame = bytesPerRound / table.size;

    expect(bytesPerFrame, `${bytesPerFrame.toFixed(2)} bytes per frame`).toBeLessThan(BYTES_PER_FRAME_LIMIT);
  });

  test('animationFrameAt() allocates nothing for an animation with durations', async () => {
    const attack: AnimationTiming = {
      playback: 'pingpong',
      frameCount: 8,
      duration: 1.2,
      durations: [0.1, 0.2, 0.1, 0.3, 0.1, 0.1, 0.2, 0.1],
    };
    const CALLS = 1000;
    // whole seconds and fractions of a constant table, never a fractional value worked out by the round
    const seconds = [0, 1, 2, 3, 4, 5, 6, 7, -1, -2];

    let sum = 0;
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) sum += animationFrameAt(attack, seconds[i % seconds.length]!);
    });
    const bytesPerCall = bytesPerRound / CALLS;

    expect(sum).toBeGreaterThanOrEqual(0);
    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_FRAME_LIMIT);
  });
});

import {describe, expect, test} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
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
});

import {describe, expect, test} from 'vitest';

import {measureSettledBytes} from '../../testing/measureSettledBytes.js';
import {truncateArray} from '../../utils/truncateArray.js';
import {ChunkQuadTreeNode} from './ChunkQuadTreeNode.js';
import {StringDataChunk2D} from './StringDataChunk2D.js';

// a call that allocates anything costs 16 B at least; for rounds of a thousand calls. When this
// limit was set, a point query with an out array measured 0.01 B
const BYTES_PER_CALL_LIMIT = 1;

const CALLS_PER_ROUND = 1000;

describe('ChunkQuadTreeNode on the hot path', () => {
  test('findChunksAt() with an out array allocates nothing', async () => {
    // 16 × 16 chunks of 8 × 8 cells
    const chunks: StringDataChunk2D[] = [];
    for (let row = 0; row < 16; row++) {
      for (let column = 0; column < 16; column++) {
        chunks.push(new StringDataChunk2D({x: column * 8, y: row * 8, width: 8, height: 8, data: 'A'.repeat(64)}));
      }
    }
    const root = new ChunkQuadTreeNode(chunks);
    root.subdivide();

    // emptied with truncateArray(): `length = 0` gives the backing store up, and the next push
    // builds it again
    const out: StringDataChunk2D[] = [];
    // a Smi, so that keeping count allocates nothing inside the round
    let found = 0;
    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS_PER_ROUND; i++) {
        truncateArray(out);
        // runs through the 128 × 128 cells of the chunks, a different point on every call
        root.findChunksAt((i * 37) & 127, (i * 91) & 127, out);
        found += out.length;
      }
    });
    const bytesPerCall = bytesPerRound / CALLS_PER_ROUND;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    expect(found, 'chunks found').toBeGreaterThan(0);
  });
});

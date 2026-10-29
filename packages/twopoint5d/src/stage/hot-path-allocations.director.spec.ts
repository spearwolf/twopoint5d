import {describe, expect, test} from 'vitest';
import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import {StageDirector} from './StageDirector.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths below
// measure a small fraction of a byte per call, the noise of a round spread over its calls
const BYTES_PER_CALL_LIMIT = 1;
const CALLS = 1000;

const stage = (name: string): IStage & IRenderable => ({name, resize() {}, updateFrame() {}, renderTo() {}});

describe('StageDirector on the hot path', () => {
  test('updateFrame() with a running transition allocates nothing per call', async () => {
    const director = new StageDirector();
    director.resize(64, 64);
    const from = stage('from');
    const to = stage('to');
    director.setStack([stage('below'), from]);
    // long enough that no round reaches its end
    director.replace(from, to, {duration: 1e9, easing: 'ease-in-out'});
    // the first frame starts the transition and builds the order of the layers
    director.updateFrame(0, 0, 0);

    const bytesPerRound = await measureSettledBytes(() => {
      for (let i = 0; i < CALLS; i++) director.updateFrame(0, 1, 0);
    });
    const bytesPerCall = bytesPerRound / CALLS;

    expect(bytesPerCall, `${bytesPerCall.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    director.dispose();
  });
});

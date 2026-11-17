import {describe, expect, test} from 'vitest';

import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import type {Easing} from '../utils/easing.js';
import {CameraRig} from './CameraRig.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D} from './Stage2D.js';

// a call that allocates anything costs 16 B at least; the allocation-free paths below measure a
// small fraction of a byte per call, the noise of a round spread over its calls
const BYTES_PER_CALL_LIMIT = 1;
const CALLS = 1000;

// a move longer than every round of a measurement together, which steps by whole seconds: the
// rounds hand the rig whole numbers and constants alone (AGENTS.md), and the move never arrives
const LONG_MOVE = 1e9;

const makeRig = (kind: 'parallax' | 'orthographic' = 'parallax') => {
  const projection =
    kind === 'parallax'
      ? new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640, pixelSnap: true})
      : new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 640, pixelSnap: true});
  const stage = new Stage2D(projection);
  // an odd size: pixelSnap gives the base a view offset, which the rig copies in every write
  stage.resize(801, 601);
  return new CameraRig(stage);
};

const bytesPerCall = async (round: () => void) => (await measureSettledBytes(round)) / CALLS;

describe('CameraRig on the hot path', () => {
  test.each<[string, Easing]>([
    ['ease-in-out', 'ease-in-out'],
    ['ease-in', 'ease-in'],
    ['ease-out', 'ease-out'],
    ['linear', 'linear'],
  ])("step(), write() and compose() during a move eased by '%s' allocate nothing", async (_name, easing) => {
    const rig = makeRig();
    rig.reframe({lift: 0.25}, LONG_MOVE);
    void rig.moveTo({position: [400, -300, 150], look: {yaw: 1, pitch: 0}, zoom: 2}, LONG_MOVE, {easing});
    let moved = 0;

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        if (rig.step(1)) moved++;
        rig.write();
        rig.compose();
      }
    });

    expect(rig.busy, 'the move is still under way').toBe(true);
    expect(moved, 'every step moved the camera').toBeGreaterThan(CALLS);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('step() and write() during a move under an OrthographicProjection allocate nothing', async () => {
    const rig = makeRig('orthographic');
    void rig.moveTo({position: [400, -300], zoom: 2}, LONG_MOVE);

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        rig.step(1);
        rig.write();
      }
    });

    expect(rig.busy).toBe(true);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('jump() with a pose the caller keeps and rewrites allocates nothing', async () => {
    const rig = makeRig();
    const position: [number, number, number] = [0, 0, 300];
    const look = {yaw: 0, pitch: 0};
    const pose = {position, look, zoom: 1};

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        position[0] = i;
        position[1] = -i;
        position[2] = 100 + (i % 7);
        look.yaw = i % 3;
        pose.zoom = 1 + (i % 4);
        rig.jump(pose);
        rig.step(1);
        rig.write();
      }
    });

    expect(rig.camera.position.x).toBe(CALLS - 1);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('look() while moving allocates nothing', async () => {
    const rig = makeRig();
    void rig.moveTo({position: [400, -300]}, LONG_MOVE);
    const look = {yaw: 0, pitch: 0};

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        look.yaw = i % 5;
        look.pitch = (i % 3) - 1;
        rig.look(look);
        rig.step(1);
        rig.write();
      }
    });

    expect(rig.busy).toBe(true);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });
});

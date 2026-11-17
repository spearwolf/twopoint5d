import {Vector3} from 'three/webgpu';
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

  // A pose a caller rewrites in every frame carries fractions — the position of a player, a drag
  // angle. The rounds copy them from these tables of constants, made before the measurement: the
  // round works out no fraction itself (AGENTS.md), and the rig reads heap numbers as a frame does.
  const XS = [12.25, -7.5, 103.125, 0.375, -64.0625, 31.75, -0.5, 250.875];
  const YS = [-3.75, 18.5, -0.125, 77.25, 5.0625, -41.5, 0.875, 9.375];
  const DISTANCES = [150.5, 299.25, 120.75, 88.125, 210.5, 175.25, 64.5, 133.375];
  const YAWS = [0.125, -0.75, 1.5, -0.0625, 0.375, -1.25, 0.6875, -0.4375];
  // two past the pitch limit of 85°, so the clamp runs as well
  const PITCHES = [0.25, -0.5, 1.625, -0.875, 0.0625, -1.5625, 0.4375, -0.1875];
  const ZOOMS = [1.25, 0.75, 2.5, 1.125, 0.5, 3.75, 1.5, 0.875];

  test('jump() with a tuple pose the caller keeps and rewrites with fractions allocates nothing', async () => {
    const rig = makeRig();
    const position: [number, number, number] = [0.5, 0.5, 300.5];
    const look = {yaw: 0.5, pitch: 0.5};
    const pose = {position, look, zoom: 1.5};

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        const k = i & 7;
        position[0] = XS[k]!;
        position[1] = YS[k]!;
        position[2] = DISTANCES[k]!;
        look.yaw = YAWS[k]!;
        look.pitch = PITCHES[k]!;
        pose.zoom = ZOOMS[k]!;
        rig.jump(pose);
        rig.step(1);
        rig.write();
      }
    });

    expect(rig.camera.position.x).toBeCloseTo(XS[(CALLS - 1) & 7]!, 9);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('jump() with a Vector3 position the caller keeps and rewrites with fractions allocates nothing', async () => {
    const rig = makeRig();
    // a Vector3, as a player keeps its position, rather than an {x, y, z} literal: a literal shares
    // its hidden class with every literal of that shape in the process, and once one of them holds
    // anything but a number there, each fraction the round writes into it is a new heap number —
    // the cost of the round's own writes, measured with no call of the rig at all
    const position = new Vector3(0.5, 0.5, 300.5);
    const pose = {position, zoom: 1.5};

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        const k = i & 7;
        position.x = XS[k]!;
        position.y = YS[k]!;
        position.z = DISTANCES[k]!;
        pose.zoom = ZOOMS[k]!;
        rig.jump(pose);
        rig.step(1);
        rig.write();
      }
    });

    expect(rig.camera.position.y).toBeCloseTo(YS[(CALLS - 1) & 7]!, 9);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('look() with fractions while moving allocates nothing', async () => {
    const rig = makeRig();
    void rig.moveTo({position: [400, -300]}, LONG_MOVE);
    const look = {yaw: 0.5, pitch: 0.5};

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        const k = i & 7;
        look.yaw = YAWS[k]!;
        look.pitch = PITCHES[k]!;
        rig.look(look);
        rig.step(1);
        rig.write();
      }
    });

    expect(rig.busy).toBe(true);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });
});

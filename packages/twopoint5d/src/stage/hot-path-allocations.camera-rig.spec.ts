import {on} from '@spearwolf/eventize';
import {Group, OrthographicCamera, PerspectiveCamera, Vector3} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {OnStageAfterCameraChanged} from '../events.js';
import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import type {Easing} from '../utils/easing.js';
import {CameraProjection} from './CameraProjection.js';
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

const makeProjection = (kind: 'parallax' | 'orthographic') =>
  kind === 'parallax'
    ? new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640, pixelSnap: true})
    : new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 640, pixelSnap: true});

const makeRig = (kind: 'parallax' | 'orthographic' = 'parallax') => {
  const projection = makeProjection(kind);
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

  // A lens change runs as a perspective camera over the base of the projection the stage has: out
  // of an orthographic projection the rig has swapped its camera by the first step — in the warm-up
  // round —, and compose() and write() keep the swapped camera over the orthographic base. The swap
  // itself is announced once, by the stage, and the arrival assigns the projection: both allocate,
  // as the start of a move and a placement may.
  test.each<['parallax' | 'orthographic', 'parallax' | 'orthographic']>([
    ['parallax', 'orthographic'],
    ['orthographic', 'parallax'],
  ])('step(), write() and compose() through a lens change out of a %s projection allocate nothing', async (from, to) => {
    const rig = makeRig(from);
    const changed: unknown[] = [];
    on(rig.stage, OnStageAfterCameraChanged, (_stage: unknown, previous: unknown) => changed.push(previous));
    void rig.moveTo(makeProjection(to), LONG_MOVE, {depth: 40, easing: 'linear'});
    let moved = 0;

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        if (rig.step(1)) moved++;
        rig.write();
        rig.compose();
      }
    });

    expect(rig.busy, 'the lens change is still under way').toBe(true);
    expect(rig.camera).toBeInstanceOf(PerspectiveCamera);
    expect(changed, 'swapped once, out of an orthographic projection alone').toEqual(
      from === 'orthographic' ? [expect.any(OrthographicCamera)] : [],
    );
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

  // A source an animation moves: its position, the one of its parent and its lens, copied from
  // these tables of constants, so that the round works out no fraction itself (AGENTS.md). The
  // calls are measured directly — needsPlacement() and updateCamera() of the projection, placeBase(),
  // compose() and write() of a rig —: the events a Stage2D emits on the path cost what every eventize
  // emit costs, and are not the projection's to remove.
  const FOVS = [50.5, 38.25, 61.125, 44.75, 72.5, 33.375, 55.0625, 47.25];
  const ORTHO_ZOOMS = [1.25, 0.75, 2.5, 1.125, 0.5, 3.75, 1.5, 0.875];

  const makeSource = <C extends PerspectiveCamera | OrthographicCamera>(source: C) => {
    const parent = new Group();
    parent.position.set(10, 20, 30);
    parent.rotation.set(0, 0.25, 0);
    parent.add(source);
    return {parent, source};
  };

  const moveSource = (parent: Group, source: PerspectiveCamera | OrthographicCamera, i: number) => {
    const k = i & 7;
    source.position.x = XS[k]!;
    source.position.y = YS[k]!;
    source.position.z = DISTANCES[k]!;
    parent.position.x = YS[k]!;
    if ((source as PerspectiveCamera).isPerspectiveCamera) (source as PerspectiveCamera).fov = FOVS[k]!;
    else source.zoom = ORTHO_ZOOMS[k]!;
  };

  test.each<['perspective' | 'orthographic', 'contain' | 'cover']>([
    ['perspective', 'contain'],
    ['perspective', 'cover'],
    ['orthographic', 'contain'],
    ['orthographic', 'cover'],
  ])(
    'CameraProjection: needsPlacement() and updateCamera() of a moving %s source under %s allocate nothing',
    async (kind, fit) => {
      const {parent, source} = makeSource(
        kind === 'perspective' ? new PerspectiveCamera(50, 16 / 9, 0.5, 500) : new OrthographicCamera(-8, 8, 4.5, -4.5, 0.5, 500),
      );
      const projection = new CameraProjection(source, {fit});
      // narrower than 16:9, so that contain widens the lens and cover keeps it, and the other way round
      projection.updateViewRect(801, 601);
      const camera = projection.createCamera();
      let placed = 0;

      const bytes = await bytesPerCall(() => {
        for (let i = 0; i < CALLS; i++) {
          moveSource(parent, source, i);
          if (projection.needsPlacement(camera)) {
            projection.updateCamera(camera);
            placed++;
          }
        }
      });

      expect(placed, 'the source moved in every call').toBeGreaterThanOrEqual(CALLS);
      expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
    },
  );

  test('CameraProjection: needsPlacement() of a source that stands allocates nothing', async () => {
    const {source} = makeSource(new PerspectiveCamera(50, 16 / 9, 0.5, 500));
    const projection = new CameraProjection(source);
    projection.updateViewRect(801, 601);
    const camera = projection.createCamera();
    let placed = 0;

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) if (projection.needsPlacement(camera)) placed++;
    });

    expect(placed).toBe(0);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  test('CameraProjection: the placement of a moving source under a rig — placeBase(), compose(), write() — allocates nothing', async () => {
    const {parent, source} = makeSource(new PerspectiveCamera(50, 16 / 9, 0.5, 500));
    const projection = new CameraProjection(source);
    const stage = new Stage2D(projection);
    stage.resize(801, 601);
    const rig = new CameraRig(stage);
    void rig.moveTo({position: [3, -2], zoom: 2}, LONG_MOVE);
    let moved = 0;

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        moveSource(parent, source, i);
        if (projection.needsPlacement(rig.camera)) {
          rig.placeBase(projection);
          rig.compose();
        }
        if (rig.step(1)) moved++;
        rig.write();
      }
    });

    expect(rig.busy).toBe(true);
    expect(moved, 'every step moved the camera').toBeGreaterThan(CALLS);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });
});

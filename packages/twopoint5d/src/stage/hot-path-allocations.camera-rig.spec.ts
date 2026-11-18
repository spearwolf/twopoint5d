import {on} from '@spearwolf/eventize';
import {
  AnimationClip,
  AnimationMixer,
  Group,
  Object3D,
  OrthographicCamera,
  PerspectiveCamera,
  Vector3,
  VectorKeyframeTrack,
} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {OnStageAfterCameraChanged} from '../events.js';
import {measureSettledBytes} from '../testing/measureSettledBytes.js';
import type {Easing} from '../utils/easing.js';
import {CameraProjection} from './CameraProjection.js';
import {CameraRig} from './CameraRig.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D} from './Stage2D.js';
import {StageDirector} from './StageDirector.js';

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

// The cases run in the order they are written, and the order matters: the feedback V8 collected in
// the cases before shapes the code it runs a case with. The direct needsPlacement() after the cases
// that follow cameras of both kinds is the one that caught the 16 bytes of §4.2 of the proposal.
// A failure is reproduced with the whole file (`pnpm test:allocations`), never with `-t` or a case
// on its own.
describe('CameraRig on the hot path, in the order of its cases: later cases run with the feedback of earlier ones', () => {
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

  // A camera target, resolved in every frame: through the move to it, and locked on after it. A
  // CameraProjection as the target of a move is resolved the same way. Its case comes after the
  // orthographic one on purpose: with the feedback of both kinds of camera, a step that asked the
  // projection through needsPlacement() for a source that stood cost 16 bytes.
  test.each<
    [
      'a move to a moving camera' | 'a lock-on onto a moving camera' | 'a move to a CameraProjection of a moving camera',
      'perspective' | 'orthographic',
    ]
  >([
    ['a move to a moving camera', 'perspective'],
    ['a lock-on onto a moving camera', 'perspective'],
    ['a lock-on onto a moving camera', 'orthographic'],
    ['a move to a CameraProjection of a moving camera', 'perspective'],
  ])('step(), write() and compose() during %s (%s) allocate nothing', async (what, kind) => {
    const {parent, source} = makeSource(
      kind === 'perspective' ? new PerspectiveCamera(50, 16 / 9, 0.5, 500) : new OrthographicCamera(-8, 8, 4.5, -4.5, 0.5, 500),
    );
    const rig = makeRig();
    if (what === 'a move to a moving camera') void rig.moveTo(source, LONG_MOVE);
    else if (what === 'a move to a CameraProjection of a moving camera') void rig.moveTo(new CameraProjection(source), LONG_MOVE);
    else rig.jump(source);
    let moved = 0;

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        moveSource(parent, source, i);
        if (rig.step(1)) moved++;
        rig.write();
        rig.compose();
      }
    });

    expect(rig.busy).toBe(true);
    expect(rig.camera).toBeInstanceOf(kind === 'perspective' ? PerspectiveCamera : OrthographicCamera);
    expect(moved, 'every step moved the camera').toBeGreaterThan(CALLS);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  // After the cases that follow cameras of both kinds, with the feedback of both: asked from the rig,
  // this call cost 16 bytes for a source that stood, which the rig avoids by placing instead of asking
  // (#followTarget() of CameraRig.ts). Asked directly, it allocates nothing — a regression of
  // CameraProjection#needsPlacement() itself shows here.
  test('CameraProjection: needsPlacement() of a source that stands, after the rig followed cameras of both kinds, allocates nothing', async () => {
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

  // An Object3D the rig follows — a player under a parent, moved from the tables of constants: through
  // the move to it, stuck to it after it, and trailing it by smooth, which never settles here since the
  // player moves on in every step.
  test.each<['a move to a moving object' | 'a lock-on onto a moving object' | 'a lock-on onto a moving object with smooth']>([
    ['a move to a moving object'],
    ['a lock-on onto a moving object'],
    ['a lock-on onto a moving object with smooth'],
  ])('step(), write() and compose() during %s allocate nothing', async (what) => {
    const parent = new Group();
    parent.position.set(10, 20, 30);
    parent.rotation.set(0, 0, 0.25);
    const player = new Group();
    parent.add(player);
    const rig = makeRig();
    rig.jump({position: [0, 0, 200.5], zoom: 1.5});
    if (what === 'a move to a moving object') void rig.moveTo(player, LONG_MOVE, {offset: [0, 40]});
    else void rig.moveTo(player, 0, {offset: [0.5, 40.25, 150.75], smooth: what.endsWith('smooth') ? 0.25 : 0});
    let moved = 0;

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        const k = i & 7;
        player.position.x = XS[k]!;
        player.position.y = YS[k]!;
        parent.position.x = DISTANCES[k]!;
        if (rig.step(1)) moved++;
        rig.write();
        rig.compose();
      }
    });

    expect(rig.busy).toBe(true);
    expect(moved, 'every step moved the camera').toBeGreaterThan(CALLS);
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

  // A page that scrolls through a scene: a track of a pose, a camera an AnimationMixer flies — its
  // clip scrubbed through the span of its key — and another pose, its progress asked by a damped
  // lerp() in every round. The progress is copied from this table of constants and asked anew
  // before the glide settles: with smooth 0.125 a step of a second closes all but a few thousandths
  // of the gap, so the shown progress runs through both stretches and the span of the clip, and it
  // never settles, since the asked progress moves by a quarter or more from one round to the next.
  //
  // The rig sets the time of the clip and calls `getMixer().update(0)`; what that call costs is
  // three's, as an eventize emit is eventize's (§4.8 of the proposal): AnimationMixer#update() hands
  // the time of the clip to each of its interpolants, and V8 boxes it there where it is a fraction —
  // 16 bytes per keyframe track and update, measured with the mixer alone, none with a whole time.
  // So the round stands in for the update of the mixer of the clip: it counts the calls and moves the
  // camera from the tables of constants, as the clip would. It measures the rig's own path — the
  // progress, the stretch, the time it works out and writes into the action, the call, the camera
  // the key places. That the update puts the camera where the clip says is held by
  // `CameraRig.spec.ts`, and that a paused action applies its time by `animationMixer.spec.ts`.
  const PROGRESSES = [0.125, 0.875, 0.375, 0.625, 0.0625, 0.9375, 0.25, 0.75];
  const SMOOTH = {smooth: 0.125};

  test('step(), write() and compose() with a damped lerp() on a track with a clip allocate nothing', async () => {
    const camera = new PerspectiveCamera(40, 16 / 9, 0.5, 2000);
    const mixer = new AnimationMixer(camera);
    const action = mixer.clipAction(
      new AnimationClip('fly', 2, [new VectorKeyframeTrack('.position', [0, 1, 2], [0, 0, 500, 120, 40, 450, 200, 0, 400])]),
    );
    action.play().paused = true;
    let updates = 0;
    mixer.update = () => {
      const k = updates++ & 7;
      camera.position.x = XS[k]!;
      camera.position.y = YS[k]!;
      camera.position.z = DISTANCES[k]!;
      return mixer;
    };
    const rig = makeRig();
    rig.track([
      {at: 0, shot: {position: [0, 0], zoom: 1.5}},
      {at: 0.25, until: 0.75, shot: camera, clip: action, ease: 'ease-in-out'},
      {at: 1, shot: {position: [100, 50, 200]}, ease: 'ease-out'},
    ]);
    let moved = 0;

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        rig.lerp(PROGRESSES[i & 7]!, SMOOTH);
        if (rig.step(1)) moved++;
        rig.write();
        rig.compose();
      }
    });

    expect(rig.busy, 'the glide never settles').toBe(true);
    expect(updates, 'the clip was scrubbed').toBeGreaterThan(CALLS);
    expect(moved, 'every step moved the camera').toBeGreaterThan(CALLS);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });

  // A flight across a manual transition of a director, as a scroll drives one: both rigs step,
  // write and compose in every round, the progress copied from a table of constants, so that the
  // blend runs through the whole flight and both of its ends. The look lies on top of the flight,
  // and anchors — turned, scaled evenly and moved in every round — carry the shot between the
  // worlds. A lens change stays inside its ends: there both rigs swap the kind of their camera,
  // which the stage announces, and an announcement allocates, as the swap of a lens change on one
  // stage does.
  //
  // The write of the progress is the caller's, and so is what it costs: in a round this large V8
  // may leave the setter of the transition un-inlined, and a fraction the round loads from an array
  // of doubles is boxed for the call — 16 bytes per round, charged to the round itself by the
  // sampling heap profiler, none to the rigs. So the tables hold their numbers as tagged elements,
  // heap numbers that exist already, which the round hands the setter as they are.
  const taggedTable = (values: readonly number[]): readonly number[] => {
    const table: unknown[] = [''];
    table.pop();
    table.push(...values);
    return table as number[];
  };
  const FLIGHT_PROGRESSES = taggedTable([0, 0.125, 0.875, 0.375, 1, 0.625, 0.0625, 0.9375]);
  const LENS_CHANGE_PROGRESSES = taggedTable([0.5, 0.125, 0.875, 0.375, 0.25, 0.625, 0.0625, 0.9375]);
  const ANCHOR_XS = [0, 12.5, -40.25, 3.75, 100.5, -0.125, 64, -7.5];

  test.each<[string, 'parallax' | 'orthographic', readonly number[]]>([
    ['between two parallax projections', 'parallax', FLIGHT_PROGRESSES],
    ['with a lens change into an orthographic projection', 'orthographic', LENS_CHANGE_PROGRESSES],
  ])('step(), write() and compose() of both rigs during a flight %s allocate nothing', async (_name, toKind, progresses) => {
    const director = new StageDirector();
    director.resize(801, 601);
    const from = makeRig();
    const to = makeRig(toKind);
    from.jump({position: [40, -30, 500], look: {yaw: 0.25, pitch: 0}});
    to.jump({position: [-120, 60], zoom: 1.5});
    director.show(from.stage);
    const transition = director.replace(from.stage, to.stage, {manual: true});
    director.updateFrame(0, 0, 0);
    const marker = new Object3D();
    marker.position.set(100, 20, 0);
    const origin = new Object3D();
    origin.rotation.z = 0.5;
    origin.scale.setScalar(2);
    CameraRig.across(transition, {anchors: [marker, origin], focus: 400});
    from.look({yaw: 0.125, pitch: 0.0625});
    let moved = 0;

    const bytes = await bytesPerCall(() => {
      for (let i = 0; i < CALLS; i++) {
        const k = i & 7;
        transition.progress = progresses[k]!;
        origin.position.x = ANCHOR_XS[k]!;
        if (from.step(1)) moved++;
        to.step(1);
        from.write();
        to.write();
        from.compose();
        to.compose();
      }
    });

    expect(from.busy && to.busy, 'the flight is still under way').toBe(true);
    expect(moved, 'every step moved the camera').toBeGreaterThan(CALLS);
    expect(bytes, `${bytes.toFixed(2)} bytes per call`).toBeLessThan(BYTES_PER_CALL_LIMIT);
  });
});

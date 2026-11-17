import {on} from '@spearwolf/eventize';
import {Matrix4, Object3D, OrthographicCamera, type PerspectiveCamera, Quaternion, Vector3} from 'three/webgpu';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {OnStageTransitionEnd} from '../events.js';
import {CameraRig, type CameraTarget} from './CameraRig.js';
import {OrthographicProjection} from './OrthographicProjection.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D} from './Stage2D.js';
import {StageDirector} from './StageDirector.js';
import type {StageTransition} from './StageTransition.js';

type Kind = 'parallax' | 'orthographic';

const makeProjection = (kind: Kind) =>
  kind === 'parallax'
    ? new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640})
    : new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 640});

const makeRig = (name: string, kind: Kind = 'parallax') => {
  const stage = new Stage2D(makeProjection(kind));
  stage.name = name;
  stage.resize(800, 600);
  return {stage, rig: new CameraRig(stage)};
};

interface Setup {
  director: StageDirector;
  a: Stage2D;
  b: Stage2D;
  rigA: CameraRig;
  rigB: CameraRig;
  transition: StageTransition;
  frame(deltaTime?: number): void;
}

let frameNo = 0;

/**
 * A director that shows `a`, and a transition from `a` to `b`: manual, unless `duration` is given,
 * when it runs linearly. `before` puts the rigs where the flight finds them.
 */
const setup = (
  options: {
    from?: Kind;
    to?: Kind;
    duration?: number;
    outgoing?: 'run' | 'freeze';
    before?: (s: Omit<Setup, 'transition'>) => void;
  } = {},
): Setup => {
  const director = new StageDirector();
  director.resize(800, 600);
  const {stage: a, rig: rigA} = makeRig('a', options.from);
  const {stage: b, rig: rigB} = makeRig('b', options.to);
  const frame = (deltaTime = 0.25) => director.updateFrame(frameNo, deltaTime, frameNo++);
  director.show(a);
  options.before?.({director, a, b, rigA, rigB, frame});
  const transition = director.replace(
    a,
    b,
    options.duration === undefined
      ? {manual: true, outgoing: options.outgoing}
      : {duration: options.duration, easing: 'linear', outgoing: options.outgoing},
  );
  return {director, a, b, rigA, rigB, transition, frame};
};

/** The world state of a camera, to compare by value. */
const stateOf = (camera: PerspectiveCamera | OrthographicCamera) => {
  camera.updateMatrixWorld();
  return {
    kind: camera.type,
    position: camera.position.toArray(),
    quaternion: camera.quaternion.toArray(),
    projection: [...camera.projectionMatrix.elements],
    near: camera.near,
    far: camera.far,
  };
};

const expectClose = (actual: readonly number[], expected: readonly number[], digits = 6) => {
  expect(actual.length).toBe(expected.length);
  actual.forEach((value, i) => expect(value, `component ${i}`).toBeCloseTo(expected[i]!, digits));
};

const directionOf = (camera: PerspectiveCamera | OrthographicCamera) => camera.getWorldDirection(new Vector3());

/** The visible height of an orthographic camera. */
const heightOf = (camera: OrthographicCamera) => (camera.top - camera.bottom) / camera.zoom;

const hasSettled = async (promise: Promise<unknown>) => {
  let settled = false;
  void promise.then(() => void (settled = true));
  await new Promise((resolve) => setTimeout(resolve, 0));
  return settled;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CameraRig.across()', () => {
  describe('the blend', () => {
    const POSE_A: CameraTarget = {position: [100, 50, 400]};
    const POSE_B: CameraTarget = {position: [-200, 150, 600], zoom: 1.5};

    const flying = () => {
      const s = setup({
        before: ({rigA, rigB}) => {
          rigA.jump(POSE_A);
          rigB.jump(POSE_B);
        },
      });
      s.frame();
      return s;
    };

    it('shows the picture of from at progress 0 and stands exactly on the target of to at 1, on both rigs', () => {
      const s = flying();
      const before = {a: stateOf(s.rigA.camera), b: stateOf(s.rigB.camera)};
      const flight = CameraRig.across(s.transition);
      expect(flight.transition).toBe(s.transition);

      s.transition.progress = 0;
      s.frame();
      expect(stateOf(s.rigA.camera)).toEqual(before.a);
      expect(stateOf(s.rigB.camera).position).toEqual(before.a.position);

      s.transition.progress = 1;
      s.frame();
      expect(stateOf(s.rigB.camera)).toEqual(before.b);
      expectClose(s.rigA.camera.position.toArray(), before.b.position);
    });

    it('shows one blended shot on both rigs at progress ½', () => {
      const s = flying();
      CameraRig.across(s.transition);
      s.transition.progress = 0.5;
      s.frame();
      expectClose(s.rigA.camera.position.toArray(), [-50, 100, 500]);
      expect(s.rigB.camera.position.toArray()).toEqual(s.rigA.camera.position.toArray());
      expect(s.rigB.camera.projectionMatrix.elements).toEqual(s.rigA.camera.projectionMatrix.elements);
    });

    it('eases the progress of the transition by the easing of the flight', () => {
      const s = flying();
      CameraRig.across(s.transition, {easing: (t) => t * t});
      s.transition.progress = 0.5;
      s.frame();
      // a quarter of the way
      expectClose(s.rigA.camera.position.toArray(), [25, 75, 450]);
    });

    it('flies to the target of the options, in the world of to', () => {
      const s = flying();
      CameraRig.across(s.transition, {to: {position: [0, 0, 800]}});
      s.transition.progress = 1;
      s.frame();
      expectClose(s.rigB.camera.position.toArray(), [0, 0, 800]);
      s.transition.progress = 0.5;
      s.frame();
      expectClose(s.rigA.camera.position.toArray(), [50, 25, 600]);
    });

    it('step() answers the motion of the flight', () => {
      const s = flying();
      CameraRig.across(s.transition);
      s.transition.progress = 0.25;
      expect(s.rigA.step(0.1)).toBe(true);
      expect(s.rigA.step(0.1)).toBe(false);
      expect(s.rigA.busy).toBe(true);
      s.transition.progress = 0.5;
      expect(s.rigA.step(0.1)).toBe(true);
      expect(s.rigB.step(0.1)).toBe(true);
    });
  });

  describe('anchors', () => {
    // the marker of a city on a map, and the origin of the city: the city is the map turned by a
    // quarter about z, scaled by 2 and moved
    const anchorsOf = () => {
      const marker = new Object3D();
      marker.position.set(100, 20, 0);
      const origin = new Object3D();
      origin.position.set(-30, 40, 0);
      origin.rotation.z = Math.PI / 2;
      origin.scale.setScalar(2);
      const parent = new Object3D();
      parent.position.set(5, 0, 0);
      parent.add(origin);
      return {marker, origin, parent};
    };

    const carried = (marker: Object3D, origin: Object3D) => {
      marker.updateWorldMatrix(true, false);
      origin.updateWorldMatrix(true, false);
      return new Matrix4().copy(marker.matrixWorld).invert().premultiply(origin.matrixWorld);
    };

    it('carries the blended shot through the anchors: translation, rotation and a uniform scale of position, near and far', () => {
      const s = setup({before: ({rigA}) => rigA.jump({position: [100, 20, 300], look: {yaw: 0.2, pitch: 0.1}})});
      s.frame();
      const {marker, origin} = anchorsOf();
      CameraRig.across(s.transition, {to: {position: [-30, 40, 900]}, anchors: [marker, origin]});
      s.transition.progress = 0.5;
      s.frame();

      const m = carried(marker, origin);
      const a = s.rigA.camera as PerspectiveCamera;
      const b = s.rigB.camera as PerspectiveCamera;
      expectClose(b.position.toArray(), a.position.clone().applyMatrix4(m).toArray(), 4);
      const turn = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
      expectClose(b.quaternion.toArray(), a.quaternion.clone().premultiply(turn).toArray());
      expect(b.near).toBeCloseTo(2 * a.near, 6);
      expect(b.far).toBeCloseTo(2 * a.far, 3);
      expect(b.fov).toBeCloseTo(a.fov, 9);
    });

    it('takes the target of to in its world: the end, carried back, is where from flies to', () => {
      const s = setup({before: ({rigA}) => rigA.jump({position: [100, 20, 300]})});
      s.frame();
      const {marker, origin} = anchorsOf();
      CameraRig.across(s.transition, {to: {position: [-25, 40, 900]}, anchors: [marker, origin]});
      s.transition.progress = 1;
      s.frame();
      expectClose(s.rigB.camera.position.toArray(), [-25, 40, 900]);
      const back = carried(marker, origin).invert();
      expectClose(s.rigA.camera.position.toArray(), new Vector3(-25, 40, 900).applyMatrix4(back).toArray(), 4);
    });

    it('scales the height of an orthographic view', () => {
      const s = setup({from: 'orthographic', to: 'orthographic', before: ({rigA}) => rigA.jump({position: [100, 20]})});
      s.frame();
      const {marker, origin} = anchorsOf();
      CameraRig.across(s.transition, {anchors: [marker, origin]});
      s.transition.progress = 0.25;
      s.frame();
      expect(heightOf(s.rigB.camera as OrthographicCamera)).toBeCloseTo(2 * heightOf(s.rigA.camera as OrthographicCamera), 6);
    });

    it('reads the anchors anew in every frame', () => {
      const s = setup();
      s.frame();
      const marker = new Object3D();
      const origin = new Object3D();
      CameraRig.across(s.transition, {anchors: [marker, origin]});
      s.transition.progress = 0;
      s.frame();
      const x = s.rigB.camera.position.x;
      origin.position.x = 70;
      s.frame();
      expect(s.rigB.camera.position.x).toBeCloseTo(x + 70, 6);
    });

    it('refuses anchors scaled unevenly, or mirrored', () => {
      const s = setup();
      const marker = new Object3D();
      const origin = new Object3D();
      origin.scale.set(1, 2, 1);
      expect(() => CameraRig.across(s.transition, {anchors: [marker, origin]})).toThrow(
        new RangeError(
          'CameraRig.across(): the anchors must be scaled evenly on their three axes, got a scale of [1, 2, 1] between them',
        ),
      );
      origin.scale.set(-1, 1, 1);
      expect(() => CameraRig.across(s.transition, {anchors: [marker, origin]})).toThrow(/must not be mirrored/);
      expect(() => CameraRig.across(s.transition, {anchors: [marker] as any})).toThrow(
        'CameraRig.across(): anchors must be a pair of Object3D',
      );
    });
  });

  describe('a lens change across the flight', () => {
    it('runs as a dolly zoom on both rigs alike, and ends on the orthographic rest of to', () => {
      const s = setup({to: 'orthographic'});
      s.frame();
      const before = stateOf(s.rigB.camera);
      CameraRig.across(s.transition);
      s.transition.progress = 0.5;
      s.frame();
      expect(s.rigA.camera.type).toBe('PerspectiveCamera');
      expect(s.rigB.camera.type).toBe('PerspectiveCamera');
      expect(s.rigB.camera.position.toArray()).toEqual(s.rigA.camera.position.toArray());
      s.transition.progress = 1;
      s.frame();
      expect(stateOf(s.rigB.camera)).toEqual(before);
    });

    it('scales a focus through the anchors', () => {
      const s = setup({to: 'orthographic'});
      s.frame();
      const marker = new Object3D();
      const origin = new Object3D();
      origin.scale.setScalar(3);
      CameraRig.across(s.transition, {anchors: [marker, origin], focus: 200});
      s.transition.progress = 0.5;
      s.frame();
      const a = s.rigA.camera;
      const b = s.rigB.camera;
      expectClose(b.position.toArray(), a.position.clone().multiplyScalar(3).toArray(), 4);
      expect(b.near).toBeCloseTo(3 * a.near, 4);
    });
  });

  describe('the state of the rigs', () => {
    it('ends a running moveTo() of either rig where it stands, and resolves its promise', async () => {
      let moveA!: Promise<void>;
      let moveB!: Promise<void>;
      const s = setup({
        before: ({rigA, rigB, a, b}) => {
          moveA = rigA.moveTo({position: [300, 0, 500]}, 1);
          moveB = rigB.moveTo({position: [-300, 0, 500]}, 1);
          rigA.step(0.5);
          rigB.step(0.5);
          a.updateFrame(0, 0, 0);
          b.updateFrame(0, 0, 0);
        },
      });
      const standing = stateOf(s.rigA.camera);
      CameraRig.across(s.transition);
      expect(await hasSettled(moveA)).toBe(true);
      expect(await hasSettled(moveB)).toBe(true);
      s.transition.progress = 0;
      s.frame();
      expect(stateOf(s.rigA.camera)).toEqual(standing);
    });

    it('keeps a track and a damped lerp with their clocks stopped, as the state from goes back to', () => {
      const s = setup({
        before: ({rigA, a}) => {
          rigA.track({position: [0, 0, 400]}, {position: [400, 0, 400]});
          rigA.lerp(1, {smooth: 0.5});
          rigA.step(0.25);
          a.updateFrame(0, 0, 0);
        },
      });
      const gliding = stateOf(s.rigA.camera);
      CameraRig.across(s.transition);
      s.transition.progress = 0.5;
      for (let i = 0; i < 4; i++) {
        s.rigA.step(0.25);
        s.frame();
      }
      s.transition.cancel();
      s.a.updateFrame(0, 0, 0);
      expect(stateOf(s.rigA.camera)).toEqual(gliding);
      expect(s.rigA.busy).toBe(true);
      s.rigA.step(0.25);
      s.a.updateFrame(0, 0, 0);
      expect(s.rigA.camera.position.x).toBeGreaterThan(gliding.position[0]!);
    });

    it('keeps a lock-on, which follows its object again once from is back', () => {
      const player = new Object3D();
      player.position.set(50, 60, 0);
      const s = setup({before: ({rigA}) => rigA.jump(player)});
      CameraRig.across(s.transition);
      s.transition.progress = 0.5;
      s.frame();
      s.transition.cancel();
      player.position.set(-80, 10, 0);
      s.rigA.step(0.1);
      s.a.updateFrame(0, 0, 0);
      expectClose(s.rigA.camera.position.toArray().slice(0, 2), [-80, 10]);
    });

    it('refuses jump(), moveTo(), track() and lerp() during the flight, naming it', () => {
      const s = setup({before: ({rigB}) => rigB.track({}, {position: [1, 1]})});
      CameraRig.across(s.transition);
      const message = 'the rig takes part in a flight across a transition (CameraRig.across()) until the transition is over';
      expect(() => s.rigA.jump({})).toThrow(`CameraRig#jump(): ${message}`);
      expect(() => s.rigB.moveTo({}, 1)).toThrow(`CameraRig#moveTo(): ${message}`);
      expect(() => s.rigA.track({}, {})).toThrow(`CameraRig#track(): ${message}`);
      expect(() => s.rigB.lerp(0.5)).toThrow(`CameraRig#lerp(): ${message}`);
    });

    it('lays look() over the flight on both rigs, and to keeps it when it takes over', () => {
      const s = setup();
      s.frame();
      CameraRig.across(s.transition, {to: {position: [0, 0, 800]}});
      s.transition.progress = 0.5;
      s.frame();
      const straight = directionOf(s.rigA.camera);
      s.rigB.look({yaw: 0.3, pitch: 0.2});
      s.frame();
      const turned = directionOf(s.rigA.camera);
      expect(turned.angleTo(straight)).toBeGreaterThan(0.3);
      expectClose(directionOf(s.rigB.camera).toArray(), turned.toArray());

      s.transition.progress = 1;
      s.frame();
      const end = stateOf(s.rigB.camera);
      s.transition.complete();
      s.b.updateFrame(0, 0, 0);
      expectClose(stateOf(s.rigB.camera).quaternion, end.quaternion);
      expectClose(stateOf(s.rigB.camera).position, end.position);
    });

    it('lets from go back to its own look', () => {
      const s = setup({before: ({rigA}) => rigA.jump({look: {yaw: 0.1, pitch: 0}})});
      s.frame();
      const own = stateOf(s.rigA.camera);
      CameraRig.across(s.transition);
      s.rigA.look({yaw: -0.4, pitch: 0});
      s.frame();
      s.transition.cancel('end');
      s.a.updateFrame(0, 0, 0);
      expect(stateOf(s.rigA.camera)).toEqual(own);
    });
  });

  describe('the end follows the transition', () => {
    const POSE_B: CameraTarget = {position: [-200, 150, 600]};
    const TARGET: CameraTarget = {position: [10, 20, 700], zoom: 2};

    const flying = (duration?: number) => {
      const s = setup({
        duration,
        before: ({rigA, rigB}) => {
          rigA.jump({position: [100, 50, 400]});
          rigB.jump(POSE_B);
        },
      });
      const reference = makeRig('reference');
      reference.rig.jump(POSE_B);
      reference.stage.updateFrame(0, 0, 0);
      const ownB = stateOf(reference.rig.camera);
      reference.rig.jump(TARGET);
      reference.stage.updateFrame(0, 0, 0);
      const target = stateOf(reference.rig.camera);
      s.frame();
      const ownA = stateOf(s.rigA.camera);
      return {...s, ownA, ownB, target};
    };

    it('finished: to holds the target, from goes back — noticed in the frame of the stage, not by the promise', async () => {
      const s = flying(1);
      const flight = CameraRig.across(s.transition, {to: TARGET});
      s.frame(0.5);
      s.frame(0.5);
      expect(s.transition.state).toBe('finished');
      // synchronously, in the frame that ended the transition
      expect(stateOf(s.rigB.camera)).toEqual(s.target);
      expect(() => s.rigB.jump(TARGET)).not.toThrow();
      expect(() => s.rigA.jump({position: [100, 50, 400]})).not.toThrow();
      s.a.updateFrame(0, 0, 0);
      expect(stateOf(s.rigA.camera)).toEqual(s.ownA);
      await expect(flight.finished).resolves.toBeUndefined();
    });

    it('cancelled to the start: both go back', async () => {
      const s = flying();
      const flight = CameraRig.across(s.transition, {to: TARGET});
      s.transition.progress = 0.6;
      s.frame();
      s.transition.cancel('start');
      s.frame();
      s.b.updateFrame(0, 0, 0);
      expect(stateOf(s.rigA.camera)).toEqual(s.ownA);
      expect(stateOf(s.rigB.camera)).toEqual(s.ownB);
      await expect(flight.finished).resolves.toBeUndefined();
    });

    it('cancelled to the end: to holds the target, from goes back', () => {
      const s = flying();
      CameraRig.across(s.transition, {to: TARGET});
      s.transition.progress = 0.3;
      s.frame();
      s.transition.cancel('end');
      s.frame();
      expect(stateOf(s.rigB.camera)).toEqual(s.target);
      s.a.updateFrame(0, 0, 0);
      expect(stateOf(s.rigA.camera)).toEqual(s.ownA);
    });

    it('reverse() flies back by the progress, and both go back at the start', () => {
      const s = flying(1);
      CameraRig.across(s.transition, {to: TARGET});
      s.frame(0.5);
      s.frame(0.25);
      const at75 = s.rigA.camera.position.x;
      s.transition.reverse();
      s.frame(0.5);
      const at25 = s.rigA.camera.position.x;
      expect(at25).not.toBeCloseTo(at75, 3);
      expectClose([at25], [100 + (10 - 100) * 0.25]);
      s.frame(0.5);
      expect(s.transition.state).toBe('cancelled');
      expect(stateOf(s.rigA.camera)).toEqual(s.ownA);
      s.b.updateFrame(0, 0, 0);
      expect(stateOf(s.rigB.camera)).toEqual(s.ownB);
    });

    it('a manual transition flies the camera by its progress', () => {
      const s = flying();
      CameraRig.across(s.transition, {to: TARGET});
      for (const progress of [0.1, 0.9, 0.4]) {
        s.transition.progress = progress;
        s.frame();
        expectClose([s.rigA.camera.position.x], [100 + (10 - 100) * progress]);
      }
    });

    it('assigns a projection of the options to to once it takes over', () => {
      const s = setup();
      const projection = makeProjection('parallax');
      CameraRig.across(s.transition, {to: projection});
      s.transition.progress = 0.5;
      s.frame();
      expect(s.b.projection).not.toBe(projection);
      s.transition.complete();
      s.frame();
      expect(s.b.projection).toBe(projection);
    });

    it('resolves finished when the director is disposed without another frame', async () => {
      const s = flying();
      const flight = CameraRig.across(s.transition);
      s.director.dispose();
      await expect(flight.finished).resolves.toBeUndefined();
      expect(() => s.rigA.jump({})).not.toThrow();
      expect(() => s.rigB.jump({})).not.toThrow();
    });
  });

  describe('a rig disposed during the flight', () => {
    it('to disposed: from goes back to its state, finished resolves', async () => {
      const s = setup({before: ({rigA}) => rigA.jump({position: [100, 50, 400]})});
      s.frame();
      const ownA = stateOf(s.rigA.camera);
      const flight = CameraRig.across(s.transition, {to: {position: [0, 0, 900]}});
      s.transition.progress = 0.5;
      s.frame();
      s.rigB.dispose();
      expect(() => s.rigA.jump({position: [100, 50, 400]})).not.toThrow();
      s.a.updateFrame(0, 0, 0);
      expect(stateOf(s.rigA.camera)).toEqual(ownA);
      await expect(flight.finished).resolves.toBeUndefined();
    });

    it('from disposed while a moveTo() of to was awaited: the promise resolved, to goes back, finished resolves', async () => {
      let move!: Promise<void>;
      const s = setup({
        before: ({rigB}) => {
          rigB.jump({position: [-100, 0, 500]});
          move = rigB.moveTo({position: [100, 0, 500]}, 1);
        },
      });
      s.frame();
      const ownB = stateOf(s.rigB.camera);
      const flight = CameraRig.across(s.transition, {to: {position: [0, 0, 900]}});
      expect(await hasSettled(move)).toBe(true);
      s.transition.progress = 0.5;
      s.frame();
      s.rigA.dispose();
      s.b.updateFrame(0, 0, 0);
      expect(stateOf(s.rigB.camera)).toEqual(ownB);
      expect(() => s.rigB.jump({})).not.toThrow();
      await expect(flight.finished).resolves.toBeUndefined();
    });
  });

  describe('a frozen layer', () => {
    it('warns once per flight, naming the stage', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const s = setup({outgoing: 'freeze'});
      CameraRig.across(s.transition);
      s.frame();
      s.frame();
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        'CameraRig.across(): the layer of the stage "a" is frozen: it shows a still picture, not the flight',
      );
    });
  });

  describe('an end that no frame has seen yet', () => {
    it('complete() lets both rigs go at once: jump() works, busy is false, look() turns the rig itself', async () => {
      const s = setup();
      s.frame();
      const flight = CameraRig.across(s.transition, {to: {position: [0, 0, 800]}});
      s.transition.progress = 0.5;
      s.frame();
      s.transition.complete();
      expect(s.rigA.busy).toBe(false);
      expect(() => s.rigB.jump({position: [10, 10, 500]})).not.toThrow();
      expect(() => s.rigA.moveTo({}, 1)).not.toThrow();
      expect(await hasSettled(flight.finished)).toBe(true);
    });

    it('cancel() lets look() go to the rig, not to a flight that is over', () => {
      const s = setup();
      s.frame();
      CameraRig.across(s.transition);
      s.transition.cancel();
      s.rigA.look({yaw: 0.3, pitch: 0});
      s.a.updateFrame(0, 0, 0);
      const turned = directionOf(s.rigA.camera);
      expect(turned.x).toBeLessThan(-0.2);
    });

    it('a listener of OnStageTransitionEnd jumps a rig and chains the next flight', () => {
      const s = setup();
      s.frame();
      const {stage: c, rig: rigC} = makeRig('c');
      void rigC;
      CameraRig.across(s.transition, {to: {position: [0, 0, 800]}});
      s.transition.progress = 0.5;
      s.frame();
      let next: ReturnType<typeof CameraRig.across> | undefined;
      const errors: unknown[] = [];
      on(s.director, OnStageTransitionEnd, ({transition}: {transition: StageTransition}) => {
        if (transition !== s.transition) return;
        try {
          s.rigA.jump({position: [5, 5, 400]});
          next = CameraRig.across(s.director.replace(s.b, c, {manual: true}));
        } catch (error) {
          errors.push(error);
        }
      });
      s.transition.complete();
      expect(errors).toEqual([]);
      expect(next).toBeDefined();
      expect(() => s.rigB.jump({})).toThrow(/takes part in a flight/);
    });
  });

  describe('a look over a flight into an orthographic stage', () => {
    it('lies on the perspective blend alone, and stays off the orthographic camera of to once it takes over', () => {
      const s = setup({to: 'orthographic'});
      s.frame();
      const ownB = stateOf(s.rigB.camera);
      CameraRig.across(s.transition);
      expect(() => s.rigB.look({yaw: 0.2, pitch: 0})).toThrow(/orthographic projection takes no look/);
      s.transition.progress = 0.5;
      s.frame();
      const straight = directionOf(s.rigA.camera);
      s.rigA.look({yaw: 0.2, pitch: 0});
      s.frame();
      expect(directionOf(s.rigA.camera).angleTo(straight), 'turned on the perspective blend').toBeGreaterThan(0.1);

      s.transition.progress = 1;
      s.frame();
      expect(stateOf(s.rigB.camera), 'to stands unturned on its orthographic rest').toEqual(ownB);
      expect(s.rigA.camera.type).toBe('OrthographicCamera');
      expect(s.rigA.camera.quaternion.toArray()).toEqual(s.rigB.camera.quaternion.toArray());

      s.transition.complete();
      s.b.updateFrame(0, 0, 0);
      expect(stateOf(s.rigB.camera), 'the look of the flight stays off the orthographic camera').toEqual(ownB);
    });
  });

  describe('refusals', () => {
    it('refuses what is no transition, one that is over, and one without from or to', () => {
      const s = setup();
      expect(() => CameraRig.across({} as any)).toThrow(
        new TypeError('CameraRig.across(): transition must be a StageTransition, got {}'),
      );
      const fromNothing = s.director.show(makeRig('c').stage, {duration: 1});
      expect(() => CameraRig.across(fromNothing)).toThrow(
        'CameraRig.across(): the transition comes from nothing; a flight needs a stage on both sides',
      );
      const toNothing = s.director.hide(s.b, {duration: 1});
      expect(() => CameraRig.across(toNothing)).toThrow(
        'CameraRig.across(): the transition goes to nothing; a flight needs a stage on both sides',
      );
      expect(() => CameraRig.across(s.transition)).toThrow('CameraRig.across(): the transition is over');
    });

    it('refuses a stage without a rig', () => {
      const director = new StageDirector();
      director.resize(800, 600);
      const {stage: a} = makeRig('a');
      const b = new Stage2D(makeProjection('parallax'));
      b.name = 'bare';
      director.show(a);
      const transition = director.replace(a, b, {duration: 1});
      expect(() => CameraRig.across(transition)).toThrow(
        'CameraRig.across(): the stage "bare" the transition brings has no CameraRig',
      );
    });

    it('refuses a rig that takes part in a flight already, and options of the wrong kind', () => {
      const s = setup();
      expect(() => CameraRig.across(s.transition, 5 as any)).toThrow(
        new TypeError('CameraRig.across(): options must be an object, got 5'),
      );
      expect(() => CameraRig.across(s.transition, {focus: -1})).toThrow(RangeError);
      expect(() => CameraRig.across(s.transition, {easing: 'bounce' as any})).toThrow(/CameraRig.across\(\): easing must be/);
      expect(() => CameraRig.across(s.transition, {to: {zoom: 0}})).toThrow(
        'CameraRig.across(): zoom must be a finite number above 0, got 0',
      );
      CameraRig.across(s.transition);
      expect(() => CameraRig.across(s.transition)).toThrow(
        'CameraRig.across(): the CameraRig of the stage "a" takes part in a flight already',
      );
    });

    it('refuses a lens change without a focus where a side has no plane', () => {
      const s = setup();
      expect(() => CameraRig.across(s.transition, {to: new OrthographicCamera(-1, 1, 1, -1)})).toThrow(
        'CameraRig.across(): a lens change between a perspective and an orthographic camera needs a focus: a camera as the target has no projectionPlane, and the flight names no focus',
      );
      expect(() => CameraRig.across(s.transition, {to: new OrthographicCamera(-1, 1, 1, -1), focus: 100})).not.toThrow();
    });
  });
});

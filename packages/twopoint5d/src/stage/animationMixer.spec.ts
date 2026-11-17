import {AnimationClip, AnimationMixer, LoopOnce, Object3D, VectorKeyframeTrack} from 'three/webgpu';
import {describe, expect, it} from 'vitest';

// What the clip of a CameraRig track rests on (docs/proposals/camera-rig.md §4.6): the rig sets the
// `time` of an action the caller keeps enabled and paused and calls `mixer.update(0)`, and the mixer
// applies the action at that time. These specs pin that behaviour of three's AnimationMixer.

// an object moved along x from 0 to 10 within two seconds
const makeClip = () => new AnimationClip('scrub', 2, [new VectorKeyframeTrack('.position', [0, 2], [0, 0, 0, 10, 0, 0])]);

const makeAction = () => {
  const object = new Object3D();
  const mixer = new AnimationMixer(object);
  const action = mixer.clipAction(makeClip());
  return {object, mixer, action};
};

describe("three's AnimationMixer, as a CameraRig scrubs a clip", () => {
  it('applies the time of an enabled, paused action at update(0)', () => {
    const {object, mixer, action} = makeAction();
    action.play();
    action.paused = true;

    action.time = 0.5;
    mixer.update(0);
    expect(object.position.x).toBeCloseTo(2.5, 12);

    action.time = 1.5;
    mixer.update(0);
    expect(object.position.x, 'a later time').toBeCloseTo(7.5, 12);

    action.time = 0.25;
    mixer.update(0);
    expect(object.position.x, 'and back').toBeCloseTo(1.25, 12);
    expect(action.time, 'the time stays where it was set').toBe(0.25);
    expect(action.enabled).toBe(true);
    expect(action.paused).toBe(true);
  });

  it('applies the end of the clip at the time of its duration, without wrapping around or finishing', () => {
    for (const loop of [undefined, LoopOnce]) {
      const {object, mixer, action} = makeAction();
      if (loop !== undefined) action.setLoop(loop, 1);
      action.play();
      action.paused = true;

      action.time = 2;
      mixer.update(0);
      expect(object.position.x, `loop ${loop ?? 'default'}`).toBe(10);
      expect(action.time).toBe(2);
      expect(action.enabled).toBe(true);

      action.time = 0;
      mixer.update(0);
      expect(object.position.x, `loop ${loop ?? 'default'}, back at the start`).toBe(0);
    }
  });

  it('applies the other actions of the mixer along with it, without advancing them', () => {
    const {object, mixer, action} = makeAction();
    const other = new Object3D();
    other.name = 'other';
    object.add(other);
    const otherAction = mixer.clipAction(
      new AnimationClip('lift', 2, [new VectorKeyframeTrack('other.position', [0, 2], [0, 0, 0, 0, 4, 0])]),
    );
    action.play().paused = true;
    otherAction.play().paused = true;

    action.time = 1;
    otherAction.time = 0.5;
    mixer.update(0);
    expect(object.position.x).toBeCloseTo(5, 12);
    expect(other.position.y).toBeCloseTo(1, 12);
    expect(otherAction.time).toBe(0.5);
  });

  it('applies nothing of an action that was never played', () => {
    const {object, mixer, action} = makeAction();
    action.paused = true;
    action.time = 1;
    mixer.update(0);
    expect(object.position.x).toBe(0);
  });
});

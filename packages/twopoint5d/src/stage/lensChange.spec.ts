import {Quaternion, Vector3} from 'three/webgpu';
import {describe, expect, it} from 'vitest';
import {blendProgress, type CameraShot, createShot, shotsEqual} from './cameraShot.js';
import {blendLensChangeAtProgress, createLensChange, LENS_CHANGE_DISTANCE_CAP, lensChangeStep} from './lensChange.js';

const UP = new Vector3(0, 1, 0);

const shot = (fields: Partial<CameraShot> = {}): CameraShot => Object.assign(createShot(), fields);

// a perspective camera 300 in front of the plane z = 0, which shows 480 of it; an orthographic one
// 100 in front of it, which shows the same
const perspective = () => shot({kind: 'perspective', position: new Vector3(0, 0, 300), lens: 240 / 300, near: 0.1, far: 100000});
const orthographic = () => shot({kind: 'orthographic', position: new Vector3(0, 0, 100), lens: 480, near: 0.1, far: 100000});

const change = (fields: {depth?: number; containerSize?: number} = {}) =>
  Object.assign(createLensChange(), {focusA: 300, focusB: 100, depth: Number.NaN, containerSize: 800}, fields);

const blendAt = (e: number, a: CameraShot, b: CameraShot, lensChange = change()) => {
  blendProgress[0] = e;
  return blendLensChangeAtProgress(a, b, lensChange, createShot());
};

/** The visible height of a perspective shot that looks down -z at the plane z = 0. */
const heightOf = (s: CameraShot) => 2 * s.position.z * s.lens;

describe('lensChange', () => {
  it('answers the ends exactly at 0 and 1', () => {
    const a = perspective();
    const b = orthographic();
    expect(shotsEqual(blendAt(0, a, b), a)).toBe(true);
    expect(shotsEqual(blendAt(1, a, b), b)).toBe(true);
    expect(shotsEqual(blendAt(-1, a, b), a)).toBe(true);
    expect(shotsEqual(blendAt(2, a, b), b)).toBe(true);
  });

  it('keeps the visible height at the focus plane while the camera backs off, a perspective shot in between', () => {
    const a = perspective();
    const b = orthographic();
    let distance = 300;
    for (const e of [1e-6, 0.25, 0.5, 0.75, 1 - 1e-6]) {
      const s = blendAt(e, a, b);
      expect(s.kind).toBe('perspective');
      expect(heightOf(s)).toBeCloseTo(480, 6);
      expect(s.position.z).toBeGreaterThan(distance);
      distance = s.position.z;
      // near and far keep their distances from the focus plane
      expect(s.position.z - s.near).toBeCloseTo(299.9 * (1 - e) + 99.9 * e, 6);
    }
  });

  it('lets the strength fall in log space, from tan(fov / 2) to the one of the swap', () => {
    const a = perspective();
    const b = orthographic();
    const lensChange = change({depth: 40});
    const half = blendAt(0.5, a, b, lensChange);
    const swapLens = 480 / (2 * lensChange.swapDistance);
    expect(half.lens).toBeCloseTo(Math.sqrt(a.lens * swapLens), 12);
  });

  it('swaps where the parallax across the depth stays below half a unit of the container', () => {
    const lensChange = change({depth: 40});
    blendAt(0.5, perspective(), orthographic(), lensChange);
    expect(lensChange.swapDistance).toBe(40 * 802);
    expect(lensChange.swapStep).toBeLessThan(0.5);
    expect(lensChange.swapStep).toBe(lensChangeStep(lensChange.swapDistance, 40, 800));
    expect(lensChangeStep(lensChange.swapDistance * 0.99, 40, 800)).toBeGreaterThan(0.5);
  });

  it('takes the visible height as the depth by default, and caps the distance at 1000 times it', () => {
    const byDefault = change();
    blendAt(0.5, perspective(), orthographic(), byDefault);
    expect(byDefault.swapDistance).toBe(480 * 802);

    const deep = change({depth: 960});
    blendAt(0.5, perspective(), orthographic(), deep);
    expect(deep.swapDistance).toBe(LENS_CHANGE_DISTANCE_CAP * 480);
    expect(deep.swapStep).toBeGreaterThan(0.5);
    expect(Number.isFinite(deep.swapStep)).toBe(true);
  });

  it('needs no backing off for a scene flat enough for the perspective end', () => {
    const lensChange = change({depth: 0.01});
    const s = blendAt(0.5, perspective(), orthographic(), lensChange);
    expect(lensChange.swapDistance).toBeCloseTo(300, 9);
    expect(s.position.z).toBeCloseTo(300, 9);
  });

  it('runs the other way: from an orthographic shot, swapped at once and backing in', () => {
    const a = orthographic();
    const b = perspective();
    const lensChange = Object.assign(change({depth: 40}), {focusA: 100, focusB: 300});
    const first = blendAt(1e-9, a, b, lensChange);
    expect(first.kind).toBe('perspective');
    expect(first.position.z).toBeCloseTo(40 * 802, 3);
    expect(heightOf(first)).toBeCloseTo(480, 6);
    const last = blendAt(1 - 1e-9, a, b, lensChange);
    expect(last.position.z).toBeCloseTo(300, 3);
  });

  it('blends the focus points and turns about them', () => {
    const a = perspective();
    const b = orthographic();
    b.position.set(100, 0, 0);
    b.quaternion.copy(new Quaternion().setFromAxisAngle(UP, Math.PI / 2));
    // b looks along -x from x 100: its focus point is the origin, as the one of a
    const s = blendAt(0.5, a, b, Object.assign(change(), {focusB: 100}));
    const forward = new Vector3(0, 0, -1).applyQuaternion(s.quaternion);
    const focus = s.position.clone().addScaledVector(forward, s.position.length());
    expect(focus.length()).toBeLessThan(1e-6);
  });

  it('may write into its first shot', () => {
    const a = perspective();
    const b = orthographic();
    const expected = blendAt(0.25, a, b);
    blendProgress[0] = 0.25;
    blendLensChangeAtProgress(a, b, change(), a);
    expect(shotsEqual(a, expected)).toBe(true);
  });
});

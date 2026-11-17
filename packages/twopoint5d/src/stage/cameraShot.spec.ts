import {OrthographicCamera, PerspectiveCamera, Quaternion, Vector3} from 'three/webgpu';
import {describe, expect, it} from 'vitest';
import {blendShots, type CameraShot, createShot, perspectiveLens, shotsEqual, writeShot} from './cameraShot.js';

const DEG = Math.PI / 180;
const UP = new Vector3(0, 1, 0);

const shot = (fields: Partial<CameraShot> = {}): CameraShot => Object.assign(createShot(), fields);

const yawOf = (q: Quaternion) => {
  // the direction a camera with this orientation looks along, turned about the y axis from -z
  const dir = new Vector3(0, 0, -1).applyQuaternion(q);
  return Math.atan2(-dir.x, -dir.z);
};

describe('cameraShot', () => {
  describe('blendShots()', () => {
    const a = shot({
      position: new Vector3(0, 10, 100),
      quaternion: new Quaternion(),
      kind: 'perspective',
      lens: 0.5,
      near: 1,
      far: 1000,
      zoom: 1,
      lift: 0,
    });
    const b = shot({
      position: new Vector3(40, -10, 200),
      quaternion: new Quaternion().setFromAxisAngle(UP, 90 * DEG),
      kind: 'perspective',
      lens: 0.25,
      near: 3,
      far: 3000,
      zoom: 2,
      lift: 0.5,
    });

    it('answers the first shot at e = 0 and the second at e = 1, exactly', () => {
      expect(shotsEqual(blendShots(a, b, 0, createShot()), a)).toBe(true);
      expect(shotsEqual(blendShots(a, b, 1, createShot()), b)).toBe(true);
    });

    it('blends position, near, far and lift linearly, the orientation by slerp at e = ½', () => {
      const half = blendShots(a, b, 0.5, createShot());
      expect(half.position.toArray()).toEqual([20, 0, 150]);
      expect(half.near).toBe(2);
      expect(half.far).toBe(2000);
      expect(half.lift).toBe(0.25);
      expect(yawOf(half.quaternion)).toBeCloseTo(45 * DEG, 12);
      expect(half.kind).toBe('perspective');
    });

    it('blends the lens linearly and the zoom so that it stays the factor on the same base lens', () => {
      const half = blendShots(a, b, 0.5, createShot());
      expect(half.lens).toBe(0.375);
      // both ends have the base lens 0.5: the zoom of the blend is 0.5 / 0.375
      expect(half.zoom).toBeCloseTo(0.5 / 0.375, 14);
    });

    it('turns the short way: a blend from a yaw of 350° to one of 10° turns 20°, not 340°', () => {
      const from = shot({quaternion: new Quaternion().setFromAxisAngle(UP, 350 * DEG)});
      const to = shot({quaternion: new Quaternion().setFromAxisAngle(UP, 10 * DEG)});
      const half = blendShots(from, to, 0.5, createShot());
      expect(Math.abs(yawOf(half.quaternion))).toBeLessThan(1e-9);
      const quarter = blendShots(from, to, 0.25, createShot());
      expect(yawOf(quarter.quaternion)).toBeCloseTo(-5 * DEG, 9);
    });

    it('blends a perspective lens in tan(fov / 2): the middle of 30° and 90° is 2·atan((tan 15° + tan 45°) / 2)', () => {
      const from = shot({lens: perspectiveLens(30)});
      const to = shot({lens: perspectiveLens(90)});
      const half = blendShots(from, to, 0.5, createShot());
      const base = new PerspectiveCamera(60, 1.5, 1, 100);
      const camera = new PerspectiveCamera();
      writeShot(half, base, camera, 1.5);
      expect(camera.fov).toBeCloseTo((2 * Math.atan((Math.tan(15 * DEG) + Math.tan(45 * DEG)) / 2)) / DEG, 10);
    });

    it('may write into its first shot', () => {
      const from = shot({position: new Vector3(0, 0, 0), lens: 1});
      const to = shot({position: new Vector3(10, 0, 0), lens: 3});
      blendShots(from, to, 0.5, from);
      expect(from.position.x).toBe(5);
      expect(from.lens).toBe(2);
    });
  });

  describe('shotsEqual()', () => {
    const base = () =>
      shot({
        position: new Vector3(1, 2, 3),
        quaternion: new Quaternion().setFromAxisAngle(UP, 0.3),
        kind: 'perspective',
        lens: 0.4,
        near: 0.1,
        far: 100,
        zoom: 1.5,
        lift: 0.1,
      });

    it('is true for two shots with the same values', () => {
      expect(shotsEqual(base(), base())).toBe(true);
    });

    it.each<[string, (s: CameraShot) => void]>([
      ['position', (s) => void (s.position.y += 1e-9)],
      ['quaternion', (s) => void s.quaternion.setFromAxisAngle(UP, 0.30001)],
      ['kind', (s) => void (s.kind = 'orthographic')],
      ['lens', (s) => void (s.lens = 0.41)],
      ['near', (s) => void (s.near = 0.2)],
      ['far', (s) => void (s.far = 101)],
      ['zoom', (s) => void (s.zoom = 2)],
      ['lift', (s) => void (s.lift = 0)],
    ])('is false for a different %s', (_field, change) => {
      const other = base();
      change(other);
      expect(shotsEqual(base(), other)).toBe(false);
    });
  });

  describe('writeShot()', () => {
    it('gives a perspective camera the field of view of the base where the lens is the base lens, exactly', () => {
      const base = new PerspectiveCamera(37.3, 1.25, 0.5, 500);
      const camera = new PerspectiveCamera();
      writeShot(shot({lens: perspectiveLens(37.3), near: 0.5, far: 500}), base, camera, 1.25);
      expect(camera.fov).toBe(37.3);
      expect(camera.aspect).toBe(1.25);
      expect(camera.projectionMatrix.elements).toEqual(base.projectionMatrix.elements);
    });

    it('copies the view offset of a perspective base and adds the lift as a share of the picture height', () => {
      const base = new PerspectiveCamera(40, 2, 1, 100);
      base.setViewOffset(200, 100, 0.25, -0.5, 200, 100);
      const camera = new PerspectiveCamera();
      writeShot(shot({lens: perspectiveLens(40), near: 1, far: 100, lift: 0.2}), base, camera, 2);
      expect(camera.view).toMatchObject({enabled: true, fullWidth: 200, fullHeight: 100, offsetX: 0.25, width: 200, height: 100});
      expect(camera.view!.offsetY).toBeCloseTo(-0.5 + 0.2 * 100, 12);
    });

    it('moves the picture of a perspective camera up by the lift', () => {
      const base = new PerspectiveCamera(60, 1, 1, 100);
      const camera = new PerspectiveCamera();
      writeShot(shot({lens: perspectiveLens(60), near: 1, far: 100, lift: 0.25}), base, camera, 1);
      camera.updateMatrixWorld();
      // the point the camera looks at, straight ahead, lands a quarter of the picture height above the middle
      const ndc = new Vector3(0, 0, -10).project(camera);
      expect(ndc.y).toBeCloseTo(0.5, 12);

      writeShot(shot({lens: perspectiveLens(60), near: 1, far: 100, lift: 0}), base, camera, 1);
      expect(camera.view?.enabled ?? false).toBe(false);
    });

    it('copies the frustum of an orthographic base, zooms by the lens and lifts the picture', () => {
      const base = new OrthographicCamera(-160, 160, 91, -89, 0.1, 1000);
      const camera = new OrthographicCamera();
      writeShot(shot({kind: 'orthographic', lens: 180, near: 0.1, far: 1000}), base, camera, 320 / 180);
      expect([camera.left, camera.right, camera.top, camera.bottom, camera.zoom]).toEqual([-160, 160, 91, -89, 1]);
      expect(camera.projectionMatrix.elements).toEqual(base.projectionMatrix.elements);

      writeShot(shot({kind: 'orthographic', lens: 90, near: 0.1, far: 1000, lift: 0.25}), base, camera, 320 / 180);
      expect(camera.zoom).toBe(2);
      camera.updateMatrixWorld();
      // the middle of the frustum lies 1 unit above the point the camera looks at; zoomed by 2 and
      // lifted by a quarter of the picture, the point the camera looks at lands at
      // (0 - 1) / 45 + 0.5 in normalized device coordinates
      expect(new Vector3(0, 0, -10).project(camera).y).toBeCloseTo(-1 / 45 + 0.5, 12);
    });
  });
});

import {Vector2, Vector3} from 'three/webgpu';
import {describe, expect, it} from 'vitest';
import {createPoseValues, type PoseValues, readLook, readPose} from './cameraPose.js';

const SUBJECT = 'CameraRig#jump()';

const read = (pose: unknown, orthographic = false): PoseValues => {
  const out = createPoseValues();
  readPose(SUBJECT, pose, orthographic, out);
  return out;
};

describe('cameraPose', () => {
  describe('readPose()', () => {
    it('leaves every field to the rest for {}', () => {
      expect(read({})).toEqual({
        hasPosition: false,
        x: 0,
        y: 0,
        hasDistance: false,
        distance: 0,
        hasLook: false,
        yaw: 0,
        pitch: 0,
        zoom: 1,
      });
    });

    it('reads a tuple of 2 as x and y, the distance left to the rest', () => {
      expect(read({position: [10, -20]})).toMatchObject({hasPosition: true, x: 10, y: -20, hasDistance: false});
    });

    it('reads a tuple of 3 as x, y and the distance', () => {
      expect(read({position: [10, -20, 150]})).toMatchObject({
        hasPosition: true,
        x: 10,
        y: -20,
        hasDistance: true,
        distance: 150,
      });
    });

    it('reads anything with x and y, and an optional z', () => {
      expect(read({position: {x: 1, y: 2}})).toMatchObject({hasPosition: true, x: 1, y: 2, hasDistance: false});
      expect(read({position: new Vector2(3, 4)})).toMatchObject({hasPosition: true, x: 3, y: 4, hasDistance: false});
      expect(read({position: new Vector3(5, 6, 7)})).toMatchObject({
        hasPosition: true,
        x: 5,
        y: 6,
        hasDistance: true,
        distance: 7,
      });
    });

    it('reads the look and the zoom', () => {
      expect(read({look: {yaw: 0.5, pitch: -0.25}, zoom: 2})).toMatchObject({hasLook: true, yaw: 0.5, pitch: -0.25, zoom: 2});
    });

    it('ignores the distance under an orthographic projection, after it checked it', () => {
      expect(read({position: [10, 20, 999]}, true)).toMatchObject({hasPosition: true, x: 10, y: 20, hasDistance: false});
      expect(read({position: {x: 1, y: 2, z: 3}}, true)).toMatchObject({hasDistance: false});
      expect(() => read({position: [1, 2, Number.NaN]}, true)).toThrow(
        new RangeError('CameraRig#jump(): position[2] must be a finite number, got NaN'),
      );
    });

    it('takes a look of 0 under an orthographic projection, and refuses any other', () => {
      expect(read({look: {yaw: 0, pitch: 0}}, true)).toMatchObject({yaw: 0, pitch: 0});
      expect(() => read({look: {yaw: 0.1, pitch: 0}}, true)).toThrow(
        new RangeError('CameraRig#jump(): an OrthographicProjection takes no look other than 0, got {yaw: 0.1, pitch: 0}'),
      );
    });

    it.each<[string, unknown, Error]>([
      [
        'a target that is no object',
        42,
        new TypeError('CameraRig#jump(): target must be a CameraPose, a camera, a projection or an Object3D, got 42'),
      ],
      [
        'null',
        null,
        new TypeError('CameraRig#jump(): target must be a CameraPose, a camera, a projection or an Object3D, got null'),
      ],
      [
        'a position of the wrong shape',
        {position: [1]},
        new TypeError(
          'CameraRig#jump(): position must be a tuple of 2 or 3 numbers or an object with x, y and an optional z, got [1]',
        ),
      ],
      [
        'a position that is a number',
        {position: 5},
        new TypeError(
          'CameraRig#jump(): position must be a tuple of 2 or 3 numbers or an object with x, y and an optional z, got 5',
        ),
      ],
      [
        'a non-finite x of a tuple',
        {position: [Number.NaN, 0]},
        new RangeError('CameraRig#jump(): position[0] must be a finite number, got NaN'),
      ],
      [
        'an infinite y of a tuple',
        {position: [0, Number.POSITIVE_INFINITY]},
        new RangeError('CameraRig#jump(): position[1] must be a finite number, got Infinity'),
      ],
      ['a missing y', {position: {x: 1}}, new RangeError('CameraRig#jump(): position.y must be a finite number, got undefined')],
      [
        'a string z',
        {position: {x: 1, y: 2, z: '3'}},
        new RangeError('CameraRig#jump(): position.z must be a finite number, got "3"'),
      ],
      [
        'a look that is no object',
        {look: 1},
        new TypeError('CameraRig#jump(): look must be an object with yaw and pitch, got 1'),
      ],
      [
        'a non-finite yaw',
        {look: {yaw: Number.NaN, pitch: 0}},
        new RangeError('CameraRig#jump(): look.yaw must be a finite number, got NaN'),
      ],
      [
        'a missing pitch',
        {look: {yaw: 0}},
        new RangeError('CameraRig#jump(): look.pitch must be a finite number, got undefined'),
      ],
      ['a zoom of 0', {zoom: 0}, new RangeError('CameraRig#jump(): zoom must be a finite number above 0, got 0')],
      ['a negative zoom', {zoom: -2}, new RangeError('CameraRig#jump(): zoom must be a finite number above 0, got -2')],
      [
        'an infinite zoom',
        {zoom: Number.POSITIVE_INFINITY},
        new RangeError('CameraRig#jump(): zoom must be a finite number above 0, got Infinity'),
      ],
    ])('refuses %s', (_what, pose, error) => {
      expect(() => read(pose)).toThrow(error);
    });

    it('writes nothing into its target when it refuses', () => {
      const out = createPoseValues();
      readPose(SUBJECT, {position: [1, 2, 3], zoom: 2}, false, out);
      expect(() => readPose(SUBJECT, {position: [9, 9], zoom: -1}, false, out)).toThrow(RangeError);
      expect(out).toMatchObject({x: 1, y: 2, distance: 3, zoom: 2});
    });
  });

  describe('readLook()', () => {
    it('reads yaw and pitch, and refuses a look other than 0 under an orthographic projection', () => {
      const out = createPoseValues();
      readLook('CameraRig#look()', {yaw: 1, pitch: 0.5}, false, out);
      expect(out).toMatchObject({hasLook: true, yaw: 1, pitch: 0.5});
      expect(() => readLook('CameraRig#look()', {yaw: 0, pitch: 0.5}, true, out)).toThrow(
        new RangeError('CameraRig#look(): an OrthographicProjection takes no look other than 0, got {yaw: 0, pitch: 0.5}'),
      );
      expect(() => readLook('CameraRig#look()', undefined, false, out)).toThrow(
        new TypeError('CameraRig#look(): look must be an object with yaw and pitch, got undefined'),
      );
    });
  });
});

import {PerspectiveCamera, Plane as THREE_Plane, Vector3} from 'three/webgpu';
import {describe, expect, it} from 'vitest';

import {ProjectionPlane} from './ProjectionPlane.js';

describe('ProjectionPlane', () => {
  it('has predefined "xy" plane', () => {
    expect(ProjectionPlane.get('xy|bottom-left')).toBeInstanceOf(ProjectionPlane);
  });

  it('has predefined "xz" plane', () => {
    expect(ProjectionPlane.get('xz|top-left')).toBeInstanceOf(ProjectionPlane);
  });

  describe('getPointByDistance()', () => {
    it('xy', () => {
      const xy = ProjectionPlane.get('xy|bottom-left');
      const p = xy.getPointByDistance(7);
      expect(p.equals(new Vector3(0, 0, 7))).toBeTruthy();
    });

    it('xz', () => {
      const xz = ProjectionPlane.get('xz|top-left');
      const p = xz.getPointByDistance(7);
      expect(p.equals(new Vector3(0, 7, 0))).toBeTruthy();
    });
  });

  describe('getOrigin()', () => {
    it('xy', () => {
      const xy = ProjectionPlane.get('xy|bottom-left');
      const p = xy.getOrigin();
      expect(p.equals(new Vector3(0, 0, 0))).toBeTruthy();
    });

    it('xz', () => {
      const xz = ProjectionPlane.get('xz|top-left');
      const p = xz.getOrigin();
      expect(p.equals(new Vector3(0, 0, 0))).toBeTruthy();
    });

    it('xy|top-left', () => {
      const xy = ProjectionPlane.get('xy|top-left');
      const p = xy.getOrigin();
      expect(p.equals(new Vector3(0, 0, 0))).toBeTruthy();
    });

    it('xz|bottom-left', () => {
      const xz = ProjectionPlane.get('xz|bottom-left');
      const p = xz.getOrigin();
      expect(p.equals(new Vector3(0, 0, 0))).toBeTruthy();
    });

    it('custom plane with offset (constant = -5)', () => {
      // A plane with normal pointing along +z and constant -5
      // This means the plane is at z=5 (coplanarPoint returns normal * -constant)
      const customPlane = new THREE_Plane(new Vector3(0, 0, 1), -5);
      const pp = new ProjectionPlane(customPlane, new Vector3(0, 1, 0));
      const origin = pp.getOrigin();
      expect(origin.equals(new Vector3(0, 0, 5))).toBeTruthy();
    });

    it('custom plane with positive constant', () => {
      // A plane with normal pointing along +y and constant 3
      // This means the plane is at y=-3 (coplanarPoint returns normal * -constant)
      const customPlane = new THREE_Plane(new Vector3(0, 1, 0), 3);
      const pp = new ProjectionPlane(customPlane, new Vector3(0, 0, 1));
      const origin = pp.getOrigin();
      expect(origin.equals(new Vector3(0, -3, 0))).toBeTruthy();
    });

    it('uses target vector when provided', () => {
      const xy = ProjectionPlane.get('xy|bottom-left');
      const target = new Vector3(1, 2, 3);
      const result = xy.getOrigin(target);
      expect(result).toBe(target);
      expect(target.equals(new Vector3(0, 0, 0))).toBeTruthy();
    });

    it('creates new vector when target is not provided', () => {
      const xy = ProjectionPlane.get('xy|bottom-left');
      const p1 = xy.getOrigin();
      const p2 = xy.getOrigin();
      expect(p1).not.toBe(p2);
    });
  });

  describe('getForward()', () => {
    it('xy', () => {
      const xy = ProjectionPlane.get('xy|bottom-left');
      const p = xy.getForward();
      expect(p.equals(new Vector3(0, 0, -1))).toBeTruthy();
    });

    it('xz', () => {
      const xz = ProjectionPlane.get('xz|top-left');
      const p = xz.getForward();
      expect(p.equals(new Vector3(0, -1, 0))).toBeTruthy();
    });

    it('custom plane off the origin (constant = 1)', () => {
      const pp = new ProjectionPlane(new THREE_Plane(new Vector3(0, 0, 1), 1), new Vector3(0, 1, 0));
      expect(pp.getForward().equals(new Vector3(0, 0, -1))).toBeTruthy();
      expect(pp.getRight().equals(new Vector3(1, 0, 0))).toBeTruthy();
      expect(pp.getPoint(5, 4).equals(new Vector3(5, 4, -1))).toBeTruthy();
    });

    it('custom plane off the origin (constant = 5)', () => {
      const pp = new ProjectionPlane(new THREE_Plane(new Vector3(0, 0, 1), 5), new Vector3(0, 1, 0));
      expect(pp.getForward().equals(new Vector3(0, 0, -1))).toBeTruthy();
      expect(pp.getRight().equals(new Vector3(1, 0, 0))).toBeTruthy();
      expect(pp.getPoint(5, 4).equals(new Vector3(5, 4, -5))).toBeTruthy();
    });

    it('writes into and returns the target vector', () => {
      const xy = ProjectionPlane.get('xy|bottom-left');
      const target = new Vector3(7, 8, 9);
      const result = xy.getForward(target);
      expect(result).toBe(target);
      expect(target.equals(new Vector3(0, 0, -1))).toBeTruthy();
    });
  });

  describe('getRight()', () => {
    it('xy', () => {
      const xy = ProjectionPlane.get('xy|bottom-left');
      const p = xy.getRight();
      expect(p.equals(new Vector3(1, 0, 0))).toBeTruthy();
    });

    it('xz', () => {
      const xz = ProjectionPlane.get('xz|top-left');
      const p = xz.getRight();
      expect(p.equals(new Vector3(1, 0, 0))).toBeTruthy();
    });
  });

  describe('getPoint()', () => {
    it('xy|bottom-left', () => {
      const xy = ProjectionPlane.get('xy|bottom-left');
      const p = xy.getPoint(5, 4);
      expect(p.equals(new Vector3(5, 4, 0))).toBeTruthy();
    });

    it('xy|top-left', () => {
      const xy = ProjectionPlane.get('xy|top-left');
      const p = xy.getPoint(5, 4);
      expect(p.equals(new Vector3(5, -4, 0))).toBeTruthy();
    });

    it('xz|top-left', () => {
      const xz = ProjectionPlane.get('xz|top-left');
      const p = xz.getPoint(5, 4);
      expect(p.equals(new Vector3(5, 0, -4))).toBeTruthy();
    });

    it('xz|bottom-left', () => {
      const xz = ProjectionPlane.get('xz|bottom-left');
      const p = xz.getPoint(5, 4);
      expect(p.equals(new Vector3(5, 0, 4))).toBeTruthy();
    });
  });

  describe('constructor', () => {
    it('refuses a custom plane without up', () => {
      expect(() => new ProjectionPlane(new THREE_Plane(new Vector3(0, 0, 1)))).toThrow(
        'up is mandatory for a custom projection plane',
      );
    });
  });

  describe('clone()', () => {
    it('gives an equal plane that shares no vector with the original', () => {
      const original = new ProjectionPlane('xz|top-left');
      const clone = original.clone();
      expect(clone.equals(original)).toBe(true);
      expect(clone.plane).not.toBe(original.plane);
      expect(clone.up).not.toBe(original.up);
      clone.up.set(1, 0, 0);
      expect(original.up.equals(new Vector3(0, 0, -1))).toBe(true);
    });
  });

  describe('equals()', () => {
    it('is true for the same instance', () => {
      const plane = new ProjectionPlane('xy|bottom-left');
      expect(plane.equals(plane)).toBe(true);
    });

    it('is false for null', () => {
      expect(new ProjectionPlane('xy|bottom-left').equals(null as unknown as ProjectionPlane)).toBe(false);
    });

    it('is true for two planes of the same description', () => {
      expect(new ProjectionPlane('xy|bottom-left').equals(new ProjectionPlane('xy|bottom-left'))).toBe(true);
    });

    it('is false for another plane', () => {
      expect(new ProjectionPlane('xy|bottom-left').equals(new ProjectionPlane('xy|top-left'))).toBe(false);
    });

    it('is false for the same plane with another up', () => {
      const a = new ProjectionPlane(new THREE_Plane(new Vector3(0, 0, 1)), new Vector3(0, 1, 0));
      const b = new ProjectionPlane(new THREE_Plane(new Vector3(0, 0, 1)), new Vector3(1, 0, 0));
      expect(a.equals(b)).toBe(false);
    });
  });

  describe('applyRotation()', () => {
    const expectLooksAlong = (plane: ProjectionPlane) => {
      const camera = new PerspectiveCamera();
      plane.applyRotation(camera);

      const forward = camera.getWorldDirection(new Vector3());
      const expectedForward = plane.getForward();
      expect(forward.x).toBeCloseTo(expectedForward.x);
      expect(forward.y).toBeCloseTo(expectedForward.y);
      expect(forward.z).toBeCloseTo(expectedForward.z);

      const up = new Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
      expect(up.x).toBeCloseTo(plane.up.x);
      expect(up.y).toBeCloseTo(plane.up.y);
      expect(up.z).toBeCloseTo(plane.up.z);
    };

    it.each(['xy|bottom-left', 'xy|top-left', 'xz|top-left', 'xz|bottom-left'] as const)(
      'turns a camera without rotation to look along getForward() with up as its up (%s)',
      (description) => {
        expectLooksAlong(new ProjectionPlane(description));
      },
    );

    it('turns a camera without rotation to look along getForward() with up as its up (custom plane off the origin)', () => {
      expectLooksAlong(new ProjectionPlane(new THREE_Plane(new Vector3(0, 1, 0), -5), new Vector3(0, 0, -1)));
    });
  });
});

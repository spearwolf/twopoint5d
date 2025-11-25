import {Plane as THREE_Plane, Vector3} from 'three/webgpu';
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

    it('custom plane with offset (constant = 5)', () => {
      // A plane with normal pointing along +z and offset 5 units from origin
      const customPlane = new THREE_Plane(new Vector3(0, 0, 1), -5);
      const pp = new ProjectionPlane(customPlane, new Vector3(0, 1, 0));
      const origin = pp.getOrigin();
      expect(origin.equals(new Vector3(0, 0, 5))).toBeTruthy();
    });

    it('custom plane with negative offset', () => {
      // A plane with normal pointing along +y and offset -3 units
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
});

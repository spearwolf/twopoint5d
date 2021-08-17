import {Vector3} from 'three';

import {ProjectionPlane} from './ProjectionPlane';

describe('ProjectionPlane', () => {
  it('has predefined "xy" plane', () => {
    expect(ProjectionPlane.get('xy')).toBeInstanceOf(ProjectionPlane);
  });

  it('has predefined "xz" plane', () => {
    expect(ProjectionPlane.get('xz')).toBeInstanceOf(ProjectionPlane);
  });

  describe('getPointByDistance()', () => {
    it('xy', () => {
      const xy = ProjectionPlane.get('xy');
      const p = xy.getPointByDistance(7);
      expect(p.equals(new Vector3(0, 0, 7))).toBeTruthy();
    });

    it('xz', () => {
      const xz = ProjectionPlane.get('xz');
      const p = xz.getPointByDistance(7);
      expect(p.equals(new Vector3(0, 7, 0))).toBeTruthy();
    });
  });

  describe('getOrigin()', () => {
    it('xy', () => {
      const xy = ProjectionPlane.get('xy');
      const p = xy.getOrigin();
      expect(p.equals(new Vector3(0, 0, 0))).toBeTruthy();
    });

    it('xz', () => {
      const xz = ProjectionPlane.get('xz');
      const p = xz.getOrigin();
      expect(p.equals(new Vector3(0, 0, 0))).toBeTruthy();
    });
  });

  describe('getForward()', () => {
    it('xy', () => {
      const xy = ProjectionPlane.get('xy');
      const p = xy.getForward();
      expect(p.equals(new Vector3(0, 0, -1))).toBeTruthy();
    });

    it('xz', () => {
      const xz = ProjectionPlane.get('xz');
      const p = xz.getForward();
      expect(p.equals(new Vector3(0, -1, 0))).toBeTruthy();
    });
  });

  describe('getRight()', () => {
    it('xy', () => {
      const xy = ProjectionPlane.get('xy');
      const p = xy.getRight();
      expect(p.equals(new Vector3(1, 0, 0))).toBeTruthy();
    });

    it('xz', () => {
      const xz = ProjectionPlane.get('xz');
      const p = xz.getRight();
      expect(p.equals(new Vector3(1, 0, 0))).toBeTruthy();
    });
  });

  describe('getPoint()', () => {
    it('xy', () => {
      const xy = ProjectionPlane.get('xy');
      const p = xy.getPoint(5, 4);
      expect(p.equals(new Vector3(5, 4, 0))).toBeTruthy();
    });

    it('xz', () => {
      const xz = ProjectionPlane.get('xz');
      const p = xz.getPoint(5, 4);
      expect(p.equals(new Vector3(5, 0, -4))).toBeTruthy();
    });
  });
});

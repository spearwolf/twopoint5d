import {PerspectiveCamera} from 'three';

import {ParallaxProjection} from './ParallaxProjection';
import {ProjectionPlane} from './ProjectionPlane';

describe('ParallaxProjection', () => {
  describe('construction', () => {
    it('without arguments', () => {
      const projection = new ParallaxProjection();
      expect(projection).toBeDefined();
    });

    it('with plane and specs', () => {
      const projection = new ParallaxProjection(ProjectionPlane.get('xy|bottom-left'), {
        fit: 'contain',
        width: 640,
      });
      expect(projection).toBeDefined();
      expect(projection.viewSpecs).toBeDefined();
      expect(projection.projectionPlane).toBeDefined();
    });
  });

  it('updateViewRect + getViewRect', () => {
    const projection = new ParallaxProjection(ProjectionPlane.get('xy|bottom-left'), {
      fit: 'contain',
      width: 640,
    });
    projection.updateViewRect(800, 600);
    expect(projection.getViewRect()).toEqual([640, 480, 1.25, 1.25]);
  });

  it('getZoom', () => {
    const projection = new ParallaxProjection(ProjectionPlane.get('xy|bottom-left'), {
      fit: 'contain',
      width: 640,
      distanceToProjectionPlane: 300,
    });
    projection.updateViewRect(800, 600);

    expect(projection.getZoom(300)).toEqual(0);
    expect(projection.getZoom(333)).toBeLessThan(0);
    expect(projection.getZoom(150)).toBeGreaterThan(0);
    expect(projection.getZoom(75)).toBeGreaterThan(projection.getZoom(150));
    expect(projection.getZoom(75)).toBeLessThan(projection.getZoom(2));
    expect(projection.getZoom(2)).toBeLessThan(1);
    expect(projection.getZoom(0)).toEqual(1);
  });

  it('createCamera', () => {
    const projection = new ParallaxProjection(ProjectionPlane.get('xy|bottom-left'), {
      fit: 'contain',
      width: 640,
    });
    projection.updateViewRect(800, 600);
    expect(projection.createCamera()).toBeInstanceOf(PerspectiveCamera);
  });
});

import {PerspectiveCamera} from 'three/webgpu';
import {describe, expect, it} from 'vitest';

import {ParallaxProjection, type ParallaxProjectionSpecs} from './ParallaxProjection.js';
import {ProjectionPlane} from './ProjectionPlane.js';

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

    it('fills the container when built without specs', () => {
      const projection = new ParallaxProjection();
      expect(projection.viewSpecs).toEqual({fit: 'fill'});
      projection.updateViewRect(800, 600);
      expect(projection.getViewRect()).toEqual([800, 600, 1, 1]);

      const withPlane = new ParallaxProjection('xy|bottom-left');
      withPlane.updateViewRect(800, 600);
      const camera = withPlane.createCamera();
      expect(camera.aspect).toBeCloseTo(800 / 600);
      expect(Number.isFinite(camera.fov)).toBe(true);
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

  it('keeps its view while the container has no area', () => {
    const projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640});
    projection.updateViewRect(800, 600);
    const camera = projection.createCamera();
    expect(projection.getViewRect()).toEqual([640, 480, 1.25, 1.25]);
    const fov = camera.fov;
    const noArea: [number, number][] = [
      [0, 600],
      [800, 0],
      [0, 0],
      [-800, 600],
      [NaN, 600],
      [800, Infinity],
    ];
    for (const [w, h] of noArea) {
      projection.updateViewRect(w, h);
      expect(projection.getViewRect(), `${w}×${h}`).toEqual([640, 480, 1.25, 1.25]);

      projection.updateCamera(camera);
      expect(camera.aspect, `${w}×${h}`).toBeCloseTo(640 / 480);
      expect(camera.fov, `${w}×${h}`).toBe(fov);
    }
  });

  it('has no view before a container with area', () => {
    const projection = new ParallaxProjection('xy|bottom-left');
    projection.updateViewRect(0, 600);
    expect(projection.getViewRect()).toEqual([0, 0, 0, 0]);

    projection.updateViewRect(800, 600);
    expect(projection.getViewRect()).toEqual([800, 600, 1, 1]);
  });

  it.each([{}, {fit: 'contain'}, {fit: 'contain', width: -640}] as const satisfies Partial<ParallaxProjectionSpecs>[])(
    'has no view from the specs %j',
    (specs) => {
      const projection = new ParallaxProjection('xy|bottom-left', specs);
      projection.updateViewRect(800, 600);
      expect(projection.getViewRect()).toEqual([0, 0, 0, 0]);
    },
  );

  it('takes a pixelZoom of 0 as the container', () => {
    const projection = new ParallaxProjection('xy|bottom-left', {pixelZoom: 0});
    projection.updateViewRect(800, 600);
    expect(projection.getViewRect()).toEqual([800, 600, 1, 1]);
  });
});

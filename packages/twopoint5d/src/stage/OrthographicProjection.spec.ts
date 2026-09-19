import {OrthographicCamera} from 'three/webgpu';
import {describe, expect, it} from 'vitest';

import {OrthographicProjection, type OrthographicProjectionSpecs} from './OrthographicProjection.js';
import {ProjectionPlane} from './ProjectionPlane.js';

describe('OrthographicProjection', () => {
  describe('construction', () => {
    it('without arguments', () => {
      const projection = new OrthographicProjection();
      expect(projection).toBeDefined();
    });

    it('with plane and specs', () => {
      const projection = new OrthographicProjection(ProjectionPlane.get('xy|bottom-left'), {
        fit: 'contain',
        width: 640,
      });
      expect(projection).toBeDefined();
      expect(projection.viewSpecs).toBeDefined();
      expect(projection.projectionPlane).toBeDefined();
    });

    it('fills the container when built without specs', () => {
      const projection = new OrthographicProjection();
      expect(projection.viewSpecs).toEqual({fit: 'fill'});
      projection.updateViewRect(800, 600);
      expect(projection.getViewRect()).toEqual([800, 600, 1, 1]);

      const withPlane = new OrthographicProjection('xy|bottom-left');
      withPlane.updateViewRect(800, 600);
      const camera = withPlane.createCamera();
      expect(camera.right - camera.left).toBe(800);
      expect(camera.top - camera.bottom).toBe(600);
    });
  });

  it('updateViewRect + getViewRect', () => {
    const projection = new OrthographicProjection(ProjectionPlane.get('xy|bottom-left'), {
      fit: 'contain',
      width: 640,
    });
    projection.updateViewRect(800, 600);
    expect(projection.getViewRect()).toEqual([640, 480, 1.25, 1.25]);
  });

  it('getZoom', () => {
    const projection = new OrthographicProjection(ProjectionPlane.get('xy|bottom-left'), {
      fit: 'contain',
      width: 640,
      distanceToProjectionPlane: 300,
    });
    projection.updateViewRect(800, 600);

    expect(projection.getZoom(666)).toEqual(1);
    expect(projection.getZoom(300)).toEqual(1);
    expect(projection.getZoom(23)).toEqual(1);
    expect(projection.getZoom(0)).toEqual(1);
  });

  it('createCamera', () => {
    const projection = new OrthographicProjection(ProjectionPlane.get('xy|bottom-left'), {
      fit: 'contain',
      width: 640,
    });
    projection.updateViewRect(800, 600);
    expect(projection.createCamera()).toBeInstanceOf(OrthographicCamera);
  });

  it('keeps its view while the container has no area', () => {
    const projection = new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 640});
    projection.updateViewRect(800, 600);
    const camera = projection.createCamera();
    expect(projection.getViewRect()).toEqual([640, 480, 1.25, 1.25]);

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
      expect([camera.left, camera.right, camera.top, camera.bottom], `${w}×${h}`).toEqual([-320, 320, 240, -240]);
    }
  });

  it('has no view before a container with area', () => {
    const projection = new OrthographicProjection('xy|bottom-left');
    projection.updateViewRect(0, 600);
    expect(projection.getViewRect()).toEqual([0, 0, 0, 0]);

    projection.updateViewRect(800, 600);
    expect(projection.getViewRect()).toEqual([800, 600, 1, 1]);
  });

  it.each([{}, {fit: 'contain'}, {fit: 'contain', width: -640}] as const satisfies Partial<OrthographicProjectionSpecs>[])(
    'has no view from the specs %j',
    (specs) => {
      const projection = new OrthographicProjection('xy|bottom-left', specs);
      projection.updateViewRect(800, 600);
      expect(projection.getViewRect()).toEqual([0, 0, 0, 0]);
    },
  );

  it('takes a pixelZoom of 0 as the container', () => {
    const projection = new OrthographicProjection('xy|bottom-left', {pixelZoom: 0});
    projection.updateViewRect(800, 600);
    expect(projection.getViewRect()).toEqual([800, 600, 1, 1]);
  });
});

import {OrthographicCamera} from 'three';

import {OrthographicProjection} from './OrthographicProjection';
import {ProjectionPlane} from './ProjectionPlane';

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
});

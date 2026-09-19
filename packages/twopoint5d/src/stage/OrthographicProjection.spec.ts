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

  describe('camera values from the specs', () => {
    const plane = 'xy|bottom-left';
    const view = {fit: 'contain', width: 640} as const;

    const cameraFor = (specs: Partial<OrthographicProjectionSpecs>) => {
      const projection = new OrthographicProjection(plane, specs);
      projection.updateViewRect(800, 600);
      return {projection, camera: projection.createCamera()};
    };

    it.each([NaN, Infinity, -Infinity])('takes a distanceToProjectionPlane of %s as not given', (distance) => {
      const {camera} = cameraFor({...view, distanceToProjectionPlane: distance});

      expect(camera.position).toEqual(ProjectionPlane.get(plane).getPointByDistance(100));
    });

    it.each([0, -100, 300])('keeps a distanceToProjectionPlane of %s', (distance) => {
      const {camera} = cameraFor({...view, distanceToProjectionPlane: distance});

      expect(camera.position).toEqual(ProjectionPlane.get(plane).getPointByDistance(distance));
    });

    it.each<Partial<OrthographicProjectionSpecs>>([
      {near: NaN},
      {near: Infinity},
      {near: -Infinity},
      {far: NaN},
      {far: Infinity},
      {near: 10, far: 10},
      {near: 10, far: 5},
      {near: 200000},
    ])('takes a near of $near and a far of $far as 0.1 and 100000', (values) => {
      const {camera} = cameraFor({...view, ...values});

      expect([camera.near, camera.far]).toEqual([0.1, 100000]);
      expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
    });

    it.each<Partial<OrthographicProjectionSpecs>>([{near: 0, far: 1000}, {near: -1000, far: 1000}, {far: 50}])(
      'keeps a near of $near and a far of $far',
      (values) => {
        const {camera} = cameraFor({...view, ...values});

        expect([camera.near, camera.far]).toEqual([values.near ?? 0.1, values.far ?? 100000]);
      },
    );

    it('gives a camera it updates 0.1 and 100000 once its specs hold a far below the near', () => {
      const specs: Partial<OrthographicProjectionSpecs> = {...view, near: 1, far: 5000};
      const {projection, camera} = cameraFor(specs);
      expect([camera.near, camera.far]).toEqual([1, 5000]);

      specs.far = 0.5;
      projection.updateViewRect(800, 600);
      projection.updateCamera(camera);

      expect([camera.near, camera.far]).toEqual([0.1, 100000]);
    });
  });
});

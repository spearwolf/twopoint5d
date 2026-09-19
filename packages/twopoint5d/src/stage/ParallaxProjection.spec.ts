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

  describe('camera values from the specs', () => {
    const plane = 'xy|bottom-left';
    const view = {fit: 'contain', width: 640} as const;

    const cameraFor = (specs: Partial<ParallaxProjectionSpecs>) => {
      const projection = new ParallaxProjection(plane, specs);
      projection.updateViewRect(800, 600);
      return {projection, camera: projection.createCamera()};
    };

    it.each([0, -300, NaN, Infinity, -Infinity])('takes a distanceToProjectionPlane of %s as not given', (distance) => {
      const reference = cameraFor(view);
      const {projection, camera} = cameraFor({...view, distanceToProjectionPlane: distance});

      expect(camera.fov).toBe(reference.camera.fov);
      expect(camera.position).toEqual(reference.camera.position);
      expect(projection.getZoom(150)).toBe(reference.projection.getZoom(150));
      expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
    });

    it('keeps a distanceToProjectionPlane above 0', () => {
      const {camera} = cameraFor({...view, distanceToProjectionPlane: 150});

      expect(camera.fov).toBeCloseTo((2 * Math.atan(240 / 150) * 180) / Math.PI);
      expect(camera.position).toEqual(ProjectionPlane.get(plane).getPointByDistance(150));
    });

    it.each<Partial<ParallaxProjectionSpecs>>([
      {near: 0},
      {near: -1},
      {near: NaN},
      {near: Infinity},
      {far: NaN},
      {far: Infinity},
      {far: -Infinity},
      {near: 0.1, far: 0.1},
      {near: 10, far: 5},
      {near: 200000},
    ])('takes a near of $near and a far of $far as 0.1 and 100000', (values) => {
      const {camera} = cameraFor({...view, ...values});

      expect([camera.near, camera.far]).toEqual([0.1, 100000]);
      expect(camera.projectionMatrix.elements.every(Number.isFinite)).toBe(true);
    });

    it.each<Partial<ParallaxProjectionSpecs>>([{near: 1, far: 5000}, {far: 50}, {near: 2}])(
      'keeps a near of $near and a far of $far',
      (values) => {
        const {camera} = cameraFor({...view, ...values});

        expect([camera.near, camera.far]).toEqual([values.near ?? 0.1, values.far ?? 100000]);
      },
    );

    it('keeps the field of view of a camera it updates once its specs hold a distance of 0', () => {
      const specs: Partial<ParallaxProjectionSpecs> = {...view};
      const {projection, camera} = cameraFor(specs);
      const fov = camera.fov;

      specs.distanceToProjectionPlane = 0;
      projection.updateViewRect(800, 600);
      projection.updateCamera(camera);

      expect(camera.fov).toBe(fov);
    });
  });
});

import {OrthographicCamera, PerspectiveCamera} from 'three/webgpu';
import {describe, expect, it} from 'vitest';

import {OrthographicProjection, type OrthographicProjectionSpecs} from './OrthographicProjection.js';
import {ProjectionPlane, type ProjectionPlaneDescription} from './ProjectionPlane.js';

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
      expect(projection.getViewRect()).toEqual({width: 800, height: 600, pixelRatioX: 1, pixelRatioY: 1});

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
    expect(projection.getViewRect()).toEqual({width: 640, height: 480, pixelRatioX: 1.25, pixelRatioY: 1.25});
  });

  it('getViewRect() hands out a new object on every call', () => {
    const projection = new OrthographicProjection('xy|bottom-left', {fit: 'contain', width: 640});
    projection.updateViewRect(800, 600);

    const rect = projection.getViewRect();
    expect(projection.getViewRect()).not.toBe(rect);

    rect.width = 1;
    expect(projection.getViewRect().width).toBe(640);
  });

  it('getScaleFactor', () => {
    const projection = new OrthographicProjection(ProjectionPlane.get('xy|bottom-left'), {
      fit: 'contain',
      width: 640,
      distanceToProjectionPlane: 300,
    });
    projection.updateViewRect(800, 600);

    expect(projection.getScaleFactor(666)).toEqual(1);
    expect(projection.getScaleFactor(300)).toEqual(1);
    expect(projection.getScaleFactor(23)).toEqual(1);
    expect(projection.getScaleFactor(0)).toEqual(1);
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
    expect(projection.getViewRect()).toEqual({width: 640, height: 480, pixelRatioX: 1.25, pixelRatioY: 1.25});

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
      expect(projection.getViewRect(), `${w}×${h}`).toEqual({width: 640, height: 480, pixelRatioX: 1.25, pixelRatioY: 1.25});

      projection.updateCamera(camera);
      expect([camera.left, camera.right, camera.top, camera.bottom], `${w}×${h}`).toEqual([-320, 320, 240, -240]);
    }
  });

  describe('updateCamera()', () => {
    const plane = 'xy|bottom-left';

    // 'xy|bottom-left' looks along the default direction of a camera, so it carries no rotation
    // the orientation tests could tell apart from a camera nobody has turned
    const tiltedPlane = 'xz|top-left';

    const projectionFor = (specs: Partial<OrthographicProjectionSpecs>, projectionPlane: ProjectionPlaneDescription = plane) => {
      const projection = new OrthographicProjection(projectionPlane, specs);
      projection.updateViewRect(800, 600);
      return projection;
    };

    it('gives a camera it updates the frustum of the latest view', () => {
      const projection = projectionFor({fit: 'fill'});
      const camera = projection.createCamera();
      expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-400, 400, 300, -300]);

      projection.updateViewRect(400, 200);
      projection.updateCamera(camera);

      expect([camera.left, camera.right, camera.top, camera.bottom]).toEqual([-200, 200, 100, -100]);
    });

    it('moves a camera it updates to the distance the specs now name', () => {
      const specs: Partial<OrthographicProjectionSpecs> = {fit: 'contain', width: 640, distanceToProjectionPlane: 300};
      const projection = projectionFor(specs);
      const camera = projection.createCamera();

      specs.distanceToProjectionPlane = 150;
      projection.updateViewRect(800, 600);
      projection.updateCamera(camera);

      expect(camera.position).toEqual(ProjectionPlane.get(plane).getPointByDistance(150));
    });

    it('aims a camera it updates at the projection plane', () => {
      const projection = projectionFor({fit: 'contain', width: 640}, tiltedPlane);
      const reference = projection.createCamera();
      const camera = new OrthographicCamera();

      projection.updateCamera(camera);

      expect(camera.quaternion.toArray()).toEqual(reference.quaternion.toArray());
    });

    it('leaves the orientation where it is when it updates the same camera twice', () => {
      const projection = projectionFor({fit: 'contain', width: 640}, tiltedPlane);
      const camera = projection.createCamera();

      projection.updateCamera(camera);
      const once = camera.quaternion.toArray();
      projection.updateCamera(camera);

      expect(camera.quaternion.toArray()).toEqual(once);
    });

    it('refuses a camera that is no OrthographicCamera', () => {
      const projection = projectionFor({fit: 'contain', width: 640});

      expect(() => projection.updateCamera(new PerspectiveCamera())).toThrow(TypeError);
    });
  });

  describe('without a projection plane', () => {
    const projectionWithoutPlane = () => {
      const projection = new OrthographicProjection(undefined, {fit: 'contain', width: 640});
      projection.updateViewRect(800, 600);
      return projection;
    };

    it('refuses createCamera() with the class, the method and the field to set', () => {
      expect(() => projectionWithoutPlane().createCamera()).toThrow(
        'OrthographicProjection#createCamera() has no projectionPlane to aim the camera at: set OrthographicProjection#projectionPlane or hand one to the constructor',
      );
    });

    it('refuses updateCamera() with the class, the method and the field to set and leaves the camera alone', () => {
      const camera = new OrthographicCamera();
      camera.position.set(1, 2, 3);
      camera.near = 7;

      expect(() => projectionWithoutPlane().updateCamera(camera)).toThrow(
        'OrthographicProjection#updateCamera() has no projectionPlane to aim the camera at: set OrthographicProjection#projectionPlane or hand one to the constructor',
      );
      expect(camera.position.toArray()).toEqual([1, 2, 3]);
      expect(camera.near).toBe(7);
    });

    it('refuses a camera that is no OrthographicCamera with a TypeError first', () => {
      expect(() => projectionWithoutPlane().updateCamera(new PerspectiveCamera())).toThrow(TypeError);
    });
  });

  it('has no view before a container with area', () => {
    const projection = new OrthographicProjection('xy|bottom-left');
    projection.updateViewRect(0, 600);
    expect(projection.getViewRect()).toEqual({width: 0, height: 0, pixelRatioX: 0, pixelRatioY: 0});

    projection.updateViewRect(800, 600);
    expect(projection.getViewRect()).toEqual({width: 800, height: 600, pixelRatioX: 1, pixelRatioY: 1});
  });

  it.each([{}, {fit: 'contain'}, {fit: 'contain', width: -640}] as const satisfies Partial<OrthographicProjectionSpecs>[])(
    'has no view from the specs %j',
    (specs) => {
      const projection = new OrthographicProjection('xy|bottom-left', specs);
      projection.updateViewRect(800, 600);
      expect(projection.getViewRect()).toEqual({width: 0, height: 0, pixelRatioX: 0, pixelRatioY: 0});
    },
  );

  it('takes a pixelZoom of 0 as the container', () => {
    const projection = new OrthographicProjection('xy|bottom-left', {pixelZoom: 0});
    projection.updateViewRect(800, 600);
    expect(projection.getViewRect()).toEqual({width: 800, height: 600, pixelRatioX: 1, pixelRatioY: 1});
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

import {type Camera, OrthographicCamera, PerspectiveCamera, Vector3} from 'three/webgpu';
import {describe, expect, it} from 'vitest';

import {ParallaxProjection, type ParallaxProjectionSpecs} from './ParallaxProjection.js';
import {ProjectionPlane, type ProjectionPlaneDescription} from './ProjectionPlane.js';

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

    it('takes no anchorPosition: the view stands in the middle of the projection plane', () => {
      const projection = new ParallaxProjection('xy|bottom-left', {
        fit: 'contain',
        width: 640,
        height: 480,
        // @ts-expect-error a projection places no anchor
        anchorPosition: 'top left',
      });
      expect(projection.viewSpecs).toMatchObject({fit: 'contain', width: 640, height: 480});
    });

    it('fills the container when built without specs', () => {
      const projection = new ParallaxProjection();
      expect(projection.viewSpecs).toEqual({fit: 'fill'});
      projection.updateViewRect(800, 600);
      expect(projection.getViewRect()).toEqual({width: 800, height: 600, pixelRatioX: 1, pixelRatioY: 1, offsetX: 0, offsetY: 0});

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
    expect(projection.getViewRect()).toEqual({
      width: 640,
      height: 480,
      pixelRatioX: 1.25,
      pixelRatioY: 1.25,
      offsetX: 0,
      offsetY: 0,
    });
  });

  it('getViewRect() hands out a new object on every call', () => {
    const projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640});
    projection.updateViewRect(800, 600);

    const rect = projection.getViewRect();
    expect(projection.getViewRect()).not.toBe(rect);

    rect.width = 1;
    expect(projection.getViewRect().width).toBe(640);
  });

  it('getParallaxFactor', () => {
    const projection = new ParallaxProjection(ProjectionPlane.get('xy|bottom-left'), {
      fit: 'contain',
      width: 640,
      distanceToProjectionPlane: 300,
    });
    projection.updateViewRect(800, 600);

    expect(projection.getParallaxFactor(300)).toEqual(0);
    expect(projection.getParallaxFactor(333)).toBeLessThan(0);
    expect(projection.getParallaxFactor(150)).toBeGreaterThan(0);
    expect(projection.getParallaxFactor(75)).toBeGreaterThan(projection.getParallaxFactor(150));
    expect(projection.getParallaxFactor(75)).toBeLessThan(projection.getParallaxFactor(2));
    expect(projection.getParallaxFactor(2)).toBeLessThan(1);
    expect(projection.getParallaxFactor(0)).toEqual(1);
  });

  it('getScaleFactor', () => {
    const projection = new ParallaxProjection(ProjectionPlane.get('xy|bottom-left'), {
      fit: 'contain',
      width: 640,
      distanceToProjectionPlane: 300,
    });
    projection.updateViewRect(800, 600);

    expect(projection.getScaleFactor(300)).toBe(1);
    expect(projection.getScaleFactor(150)).toBe(2);
    expect(projection.getScaleFactor(600)).toBe(0.5);
    expect(projection.getScaleFactor(0)).toBe(Infinity);
    expect(projection.getScaleFactor(-300)).toBe(-1);

    expect(Number.isNaN(new ParallaxProjection('xy|bottom-left').getScaleFactor(150))).toBe(true);
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
    expect(projection.getViewRect()).toEqual({
      width: 640,
      height: 480,
      pixelRatioX: 1.25,
      pixelRatioY: 1.25,
      offsetX: 0,
      offsetY: 0,
    });
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
      expect(projection.getViewRect(), `${w}×${h}`).toEqual({
        width: 640,
        height: 480,
        pixelRatioX: 1.25,
        pixelRatioY: 1.25,
        offsetX: 0,
        offsetY: 0,
      });

      projection.updateCamera(camera);
      expect(camera.aspect, `${w}×${h}`).toBeCloseTo(640 / 480);
      expect(camera.fov, `${w}×${h}`).toBe(fov);
    }
  });

  describe('updateCamera()', () => {
    const plane = 'xy|bottom-left';

    // 'xy|bottom-left' looks along the default direction of a camera, so it carries no rotation
    // the orientation tests could tell apart from a camera nobody has turned
    const tiltedPlane = 'xz|top-left';

    const projectionFor = (specs: Partial<ParallaxProjectionSpecs>, projectionPlane: ProjectionPlaneDescription = plane) => {
      const projection = new ParallaxProjection(projectionPlane, specs);
      projection.updateViewRect(800, 600);
      return projection;
    };

    it('gives a camera it updates the field of view and the aspect of the latest view', () => {
      const projection = projectionFor({fit: 'fill'});
      const camera = projection.createCamera();
      expect(camera.aspect).toBeCloseTo(4 / 3);
      const fovBefore = camera.fov;

      projection.updateViewRect(400, 200);
      projection.updateCamera(camera);

      const reference = projection.createCamera();
      expect(camera.aspect).toBeCloseTo(2);
      expect(camera.fov).toBeCloseTo(reference.fov);
      expect(camera.fov).not.toBeCloseTo(fovBefore);
      camera.projectionMatrix.elements.forEach((element, i) => {
        expect(element).toBeCloseTo(reference.projectionMatrix.elements[i]!);
      });
    });

    it('carries the near and the far of the specs onto a camera it updates', () => {
      const specs: Partial<ParallaxProjectionSpecs> = {fit: 'contain', width: 640};
      const projection = projectionFor(specs);
      const camera = projection.createCamera();

      specs.near = 2;
      specs.far = 5000;
      projection.updateViewRect(800, 600);
      projection.updateCamera(camera);

      expect([camera.near, camera.far]).toEqual([2, 5000]);
    });

    it('moves a camera it updates to the distance the specs now name', () => {
      const specs: Partial<ParallaxProjectionSpecs> = {fit: 'contain', width: 640, distanceToProjectionPlane: 300};
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
      const camera = new PerspectiveCamera();

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

    it('refuses a camera that is no PerspectiveCamera', () => {
      const projection = projectionFor({fit: 'contain', width: 640});

      expect(() => projection.updateCamera(new OrthographicCamera())).toThrow(TypeError);
    });

    it.each([
      [new OrthographicCamera(), 'OrthographicCamera'],
      [undefined, 'undefined'],
      [{}, '{}'],
      ['cam', '"cam"'],
      [{type: 'PerspectiveCamera'}, '{type: "PerspectiveCamera"}'],
    ])('names a refused camera %s as it is: got %s', (camera, written) => {
      const projection = projectionFor({fit: 'contain', width: 640});

      expect(() => projection.updateCamera(camera as never)).toThrow(
        `ParallaxProjection: updateCamera() needs a PerspectiveCamera, got ${written}`,
      );
    });
  });

  describe('without a projection plane', () => {
    const projectionWithoutPlane = () => {
      const projection = new ParallaxProjection(undefined, {fit: 'contain', width: 640});
      projection.updateViewRect(800, 600);
      return projection;
    };

    it('refuses createCamera() with the class, the method and the field to set', () => {
      expect(() => projectionWithoutPlane().createCamera()).toThrow(
        'ParallaxProjection#createCamera() has no projectionPlane to aim the camera at: set ParallaxProjection#projectionPlane or hand one to the constructor',
      );
    });

    it('refuses updateCamera() with the class, the method and the field to set and leaves the camera alone', () => {
      const camera = new PerspectiveCamera();
      camera.position.set(1, 2, 3);
      camera.near = 7;

      expect(() => projectionWithoutPlane().updateCamera(camera)).toThrow(
        'ParallaxProjection#updateCamera() has no projectionPlane to aim the camera at: set ParallaxProjection#projectionPlane or hand one to the constructor',
      );
      expect(camera.position.toArray()).toEqual([1, 2, 3]);
      expect(camera.near).toBe(7);
    });

    it('refuses a camera that is no PerspectiveCamera with a TypeError first', () => {
      expect(() => projectionWithoutPlane().updateCamera(new OrthographicCamera())).toThrow(TypeError);
    });
  });

  it('has no view before a container with area', () => {
    const projection = new ParallaxProjection('xy|bottom-left');
    projection.updateViewRect(0, 600);
    expect(projection.getViewRect()).toEqual({width: 0, height: 0, pixelRatioX: 0, pixelRatioY: 0, offsetX: 0, offsetY: 0});

    projection.updateViewRect(800, 600);
    expect(projection.getViewRect()).toEqual({width: 800, height: 600, pixelRatioX: 1, pixelRatioY: 1, offsetX: 0, offsetY: 0});
  });

  it.each([{}, {fit: 'contain'}, {fit: 'contain', width: -640}] as const satisfies Partial<ParallaxProjectionSpecs>[])(
    'has no view from the specs %j',
    (specs) => {
      const projection = new ParallaxProjection('xy|bottom-left', specs);
      projection.updateViewRect(800, 600);
      expect(projection.getViewRect()).toEqual({width: 0, height: 0, pixelRatioX: 0, pixelRatioY: 0, offsetX: 0, offsetY: 0});
    },
  );

  it('takes a pixelZoom of 0 as the container', () => {
    const projection = new ParallaxProjection('xy|bottom-left', {pixelZoom: 0});
    projection.updateViewRect(800, 600);
    expect(projection.getViewRect()).toEqual({width: 800, height: 600, pixelRatioX: 1, pixelRatioY: 1, offsetX: 0, offsetY: 0});
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
      expect(projection.getParallaxFactor(150)).toBe(reference.projection.getParallaxFactor(150));
      expect(projection.getScaleFactor(150)).toBe(reference.projection.getScaleFactor(150));
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

  // the column and the row of the drawing buffer a point of the world lands on, through the
  // matrices the camera really has
  const toBufferPixel = (camera: Camera, x: number, y: number, bufferWidth: number, bufferHeight: number): [number, number] => {
    camera.updateMatrixWorld();
    const ndc = new Vector3(x, y, 0).project(camera);
    return [((ndc.x + 1) / 2) * bufferWidth, ((ndc.y + 1) / 2) * bufferHeight];
  };

  const isWhole = (value: number) => Math.abs(value - Math.round(value)) < 1e-6;

  describe('pixelSnap', () => {
    it('shifts the window of the camera so that whole units of the projection plane land on whole buffer pixels', () => {
      // 3 buffer pixels per unit of a buffer of 1250 × 750 pixels: 416.67 × 250 units
      const projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 400, height: 240, pixelSnap: true});
      projection.updateViewRect(1000, 600, 1.25);
      const view = projection.getViewRect();
      expect(view.offsetX).toBeCloseTo(1 / 3);
      expect(view.offsetY).toBe(0);

      const camera = projection.createCamera();
      expect(camera.view).toMatchObject({
        enabled: true,
        fullWidth: view.width,
        fullHeight: view.height,
        width: view.width,
        height: view.height,
      });
      expect(camera.view!.offsetX).toBeCloseTo(1 / 3);
      expect(camera.view!.offsetY).toBeCloseTo(0);

      for (const [x, y] of [
        [0, 0],
        [1, 1],
        [-7, 3],
        [100, -50],
        [207, 124],
      ] as [number, number][]) {
        const [column, row] = toBufferPixel(camera, x, y, 1250, 750);
        expect(isWhole(column) && isWhole(row), `${x}, ${y} lands on ${column}, ${row}`).toBe(true);
      }
    });

    it('moves the window up by the share of a unit an odd height leaves', () => {
      const projection = new ParallaxProjection('xy|bottom-left', {pixelZoom: 1, pixelSnap: true});
      projection.updateViewRect(801, 601);
      expect(projection.getViewRect()).toMatchObject({offsetX: 0.5, offsetY: 0.5});
      const camera = projection.createCamera();
      expect(camera.view).toMatchObject({offsetX: 0.5, offsetY: -0.5});
      for (const [x, y] of [
        [0, 0],
        [3, -2],
        [-400, 300],
      ] as [number, number][]) {
        const [column, row] = toBufferPixel(camera, x, y, 801, 601);
        expect(isWhole(column) && isWhole(row), `${x}, ${y} lands on ${column}, ${row}`).toBe(true);
      }
    });

    it('keeps the camera where it is and the field of view and the parallax factor as they are', () => {
      const snapped = new ParallaxProjection('xy|bottom-left', {pixelZoom: 1, pixelSnap: true});
      const centred = new ParallaxProjection('xy|bottom-left', {pixelZoom: 1});
      snapped.updateViewRect(801, 601);
      centred.updateViewRect(801, 601);
      const a = snapped.createCamera();
      const b = centred.createCamera();
      expect(a.position.toArray()).toEqual(b.position.toArray());
      expect([a.fov, a.aspect]).toEqual([b.fov, b.aspect]);
      expect(snapped.getParallaxFactor(150)).toBe(centred.getParallaxFactor(150));
    });

    it('leaves a view offset of the caller alone without pixelSnap', () => {
      const projection = new ParallaxProjection('xy|bottom-left', {pixelZoom: 1});
      projection.updateViewRect(800, 600);
      const camera = new PerspectiveCamera();
      camera.setViewOffset(1600, 600, 800, 0, 800, 600);
      projection.updateCamera(camera);
      expect(camera.view).toMatchObject({enabled: true, fullWidth: 1600, offsetX: 800});
    });

    it('clears the view offset it wrote once pixelSnap goes off', () => {
      const specs: Partial<ParallaxProjectionSpecs> = {pixelZoom: 1, pixelSnap: true};
      const projection = new ParallaxProjection('xy|bottom-left', specs);
      projection.updateViewRect(801, 601);
      const camera = projection.createCamera();
      expect(camera.view?.enabled).toBe(true);

      specs.pixelSnap = false;
      projection.updateViewRect(801, 601);
      projection.updateCamera(camera);
      expect(camera.view?.enabled ?? false).toBe(false);
      expect(projection.getViewRect()).toMatchObject({offsetX: 0, offsetY: 0});
    });
  });
});

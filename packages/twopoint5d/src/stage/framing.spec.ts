import {Box3, type Camera, Vector3} from 'three/webgpu';
import {describe, expect, it} from 'vitest';

import {OrthographicProjection} from './OrthographicProjection.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D} from './Stage2D.js';
import type {FramingSide} from './framing.js';

// not centred on the world origin, and different in every extent
const makeBox = () => new Box3(new Vector3(10, 20, 30), new Vector3(70, 50, 150));

// side -> [normal, up, centre of the face toward the camera, width, height of the face]
const SIDES: Record<FramingSide, [number[], number[], number[], number, number]> = {
  front: [[0, 0, 1], [0, 1, 0], [40, 35, 150], 60, 30],
  back: [[0, 0, -1], [0, 1, 0], [40, 35, 30], 60, 30],
  right: [[1, 0, 0], [0, 1, 0], [70, 35, 90], 120, 30],
  left: [[-1, 0, 0], [0, 1, 0], [10, 35, 90], 120, 30],
  top: [[0, 1, 0], [0, 0, -1], [40, 50, 90], 60, 120],
  bottom: [[0, -1, 0], [0, 0, 1], [40, 20, 90], 60, 120],
};

type Options = {side: FramingSide; margin?: number; pixelSnap?: boolean};

const FACTORIES = {
  ParallaxProjection: (box: Box3, options: Options) => ParallaxProjection.framing(box, options),
  OrthographicProjection: (box: Box3, options: Options) => OrthographicProjection.framing(box, options),
};

const corners = (box: Box3): Vector3[] => {
  const result: Vector3[] = [];
  for (const x of [box.min.x, box.max.x]) {
    for (const y of [box.min.y, box.max.y]) {
      for (const z of [box.min.z, box.max.z]) {
        result.push(new Vector3(x, y, z));
      }
    }
  }
  return result;
};

const EPSILON = 1e-6;

describe.each(Object.entries(FACTORIES))('%s.framing()', (_name, framing) => {
  describe.each(Object.entries(SIDES))('side %s', (side, [normal, up, centre, width, height]) => {
    it('lies the projection plane in the face toward the camera', () => {
      const {projectionPlane} = framing(makeBox(), {side: side as FramingSide});
      expect(projectionPlane).toBeDefined();
      expect(projectionPlane?.plane.normal.toArray()).toEqual(normal);
      expect(projectionPlane?.up.toArray()).toEqual(up);
      const origin = projectionPlane?.getOrigin() as Vector3;
      expect(origin.x).toBeCloseTo(centre[0] as number, 9);
      expect(origin.y).toBeCloseTo(centre[1] as number, 9);
      expect(origin.z).toBeCloseTo(centre[2] as number, 9);
      expect(projectionPlane?.plane.distanceToPoint(new Vector3(...(centre as [number, number, number])))).toBeCloseTo(0, 9);
    });

    it('places the camera in front of the face centre, looking at it', () => {
      const projection = framing(makeBox(), {side: side as FramingSide});
      projection.updateViewRect(width, height);
      const camera = projection.createCamera();
      const toCentre = new Vector3(...(centre as [number, number, number])).sub(camera.position).normalize();
      const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
      expect(forward.dot(toCentre)).toBeCloseTo(1, 9);
    });

    it.each([
      ['wider than the face', 4000, 300],
      ['narrower than the face', 300, 4000],
    ])('fits every corner of the box into the frustum, container %s', (_label, w, h) => {
      const box = makeBox();
      const projection = framing(box, {side: side as FramingSide});
      const stage = new Stage2D(projection);
      stage.resize(w, h);
      const camera = stage.camera as Camera;
      camera.updateMatrixWorld(true);
      for (const corner of corners(box)) {
        const ndc = corner.clone().project(camera);
        expect(Math.abs(ndc.x)).toBeLessThanOrEqual(1 + EPSILON);
        expect(Math.abs(ndc.y)).toBeLessThanOrEqual(1 + EPSILON);
      }
      stage.dispose();
    });

    it('shows the face as the view, fitted contain: at least width x height', () => {
      const projection = framing(makeBox(), {side: side as FramingSide});
      projection.updateViewRect(1000, 500);
      const view = projection.getViewRect();
      expect(view.width).toBeGreaterThanOrEqual(width - EPSILON);
      expect(view.height).toBeGreaterThanOrEqual(height - EPSILON);
      projection.updateViewRect(300, 600);
      const narrow = projection.getViewRect();
      expect(narrow.width).toBeGreaterThanOrEqual(width - EPSILON);
      expect(narrow.height).toBeGreaterThanOrEqual(height - EPSILON);
    });

    it('grows the face by margin on every edge', () => {
      const projection = framing(makeBox(), {side: side as FramingSide, margin: 0.1});
      // a container of the shape of the grown face: the view is exactly the face
      projection.updateViewRect(width * 12, height * 12);
      const view = projection.getViewRect();
      expect(view.width).toBeCloseTo(width * 1.2, 6);
      expect(view.height).toBeCloseTo(height * 1.2, 6);
    });
  });

  it('passes the other specs through', () => {
    const projection = framing(makeBox(), {side: 'front', pixelSnap: true});
    expect(projection.viewSpecs).toMatchObject({fit: 'contain', pixelSnap: true});
  });

  it('refuses an empty box', () => {
    expect(() => framing(new Box3(), {side: 'front'})).toThrow(/framing\(\): .*empty/);
  });

  it('refuses a box without a face toward the side', () => {
    const flat = new Box3(new Vector3(0, 0, 0), new Vector3(10, 0, 10));
    expect(() => framing(flat, {side: 'right'})).toThrow(
      /framing\(\): the face of the box toward "right" has no area, got 10 x 0$/,
    );
    expect(() => framing(flat, {side: 'top'})).not.toThrow();
  });

  it('refuses an unknown side', () => {
    expect(() => framing(makeBox(), {side: 'up' as FramingSide})).toThrow(
      /framing\(\): side must be 'front', 'back', 'right', 'left', 'top' or 'bottom', got "up"$/,
    );
  });

  it('refuses a negative margin or one that is not a number', () => {
    expect(() => framing(makeBox(), {side: 'front', margin: -0.1})).toThrow(
      /framing\(\): margin must be a finite number of 0 or more, got -0.1/,
    );
    expect(() => framing(makeBox(), {side: 'front', margin: Number.NaN})).toThrow(RangeError);
  });

  it('refuses a box that is none', () => {
    expect(() => framing({} as Box3, {side: 'front'})).toThrow(TypeError);
  });
});

it('names its class in the message', () => {
  expect(() => ParallaxProjection.framing(new Box3(), {side: 'front'})).toThrow(/^ParallaxProjection\.framing\(\)/);
  expect(() => OrthographicProjection.framing(new Box3(), {side: 'front'})).toThrow(/^OrthographicProjection\.framing\(\)/);
});

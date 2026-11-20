import {Mesh, Object3D, Vector3} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {ParallaxProjection} from '../stage/ParallaxProjection.js';
import type {ProjectionPlaneDescription} from '../stage/ProjectionPlane.js';
import {ProjectionPlane} from '../stage/ProjectionPlane.js';
import {type ArtFrame, type LayerBox, anchorOf, artFrameOf, depthScaleInto, layoutLayerInto, turnToPlane} from './artLayout.js';
import {POSE_DEG, POSE_DEPTH, POSE_SCALE_X, POSE_SCALE_Y, POSE_SIZE, POSE_X, POSE_Y} from './artPose.js';

const SUBJECT = 'StageArt "kitchen"';

function poseRow(rows: number, row: number, values: Partial<Record<number, number>>): Float64Array {
  const pose = new Float64Array(rows * POSE_SIZE);
  pose[row * POSE_SIZE + POSE_SCALE_X] = 1;
  pose[row * POSE_SIZE + POSE_SCALE_Y] = 1;
  for (const [slot, value] of Object.entries(values)) pose[row * POSE_SIZE + Number(slot)] = value as number;
  return pose;
}

describe('artFrameOf()', () => {
  test('defaults to the middle of the canvas, and to [0, 0] without a canvas', () => {
    expect(artFrameOf(SUBJECT, undefined, undefined, undefined, {width: 800, height: 600})).toEqual({
      pxPerUnit: 1,
      originX: 400,
      originY: 300,
      focusX: 0,
      focusY: 0,
    });
    expect(artFrameOf(SUBJECT, undefined, undefined, undefined, undefined)).toEqual({
      pxPerUnit: 1,
      originX: 0,
      originY: 0,
      focusX: 0,
      focusY: 0,
    });
  });

  test('works the focus out in units of the art frame, y turned up', () => {
    const frame = artFrameOf(SUBJECT, 2, [100, 50], [140, 30], {width: 800, height: 600});
    expect(frame).toEqual({pxPerUnit: 2, originX: 100, originY: 50, focusX: 20, focusY: 10});
  });

  test('refuses a pxPerUnit that is no finite number above 0', () => {
    for (const bad of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '2', null]) {
      expect(() => artFrameOf(SUBJECT, bad, undefined, undefined, undefined)).toThrow(
        /^StageArt "kitchen": pxPerUnit must be a finite number above 0, got /,
      );
    }
  });

  test('refuses an origin or a focus that is no pair of finite numbers, naming the option', () => {
    for (const bad of [[1], [1, 2, 3], [1, Number.NaN], [Number.POSITIVE_INFINITY, 0], ['1', 2], 5, null, {}]) {
      expect(() => artFrameOf(SUBJECT, 1, bad, undefined, undefined)).toThrow(
        /^StageArt "kitchen": origin must be a pair of finite numbers, got /,
      );
      expect(() => artFrameOf(SUBJECT, 1, undefined, bad, undefined)).toThrow(
        /^StageArt "kitchen": focus must be a pair of finite numbers, got /,
      );
    }
    expect(() => artFrameOf(SUBJECT, 1, [1], undefined, undefined)).toThrow('got [1]');
  });
});

describe('layoutLayerInto()', () => {
  const out = new Float64Array(6);
  const box: LayerBox = {x: 700, y: 100, w: 200, h: 80};

  test('a pivot at the canvas middle lands on the origin of the art', () => {
    const frame = artFrameOf(SUBJECT, 1, undefined, undefined, {width: 800, height: 600});
    layoutLayerInto(frame, poseRow(1, 0, {[POSE_X]: 400, [POSE_Y]: 300}), 0, box, 1, out);
    expect(out[0]).toBe(0);
    expect(out[1]).toBe(0);
    expect(out[2]).toBe(-0);
  });

  test('maps pixels to units with y turned up, depth to −z, and the box times the scale to the size', () => {
    const frame = artFrameOf(SUBJECT, 4, [400, 300], undefined, undefined);
    const pose = poseRow(2, 1, {[POSE_X]: 480, [POSE_Y]: 220, [POSE_DEPTH]: 40, [POSE_SCALE_X]: 2, [POSE_SCALE_Y]: 0.5});
    layoutLayerInto(frame, pose, 1, box, 1, out);
    expect(Array.from(out.subarray(0, 5))).toEqual([20, 20, -10, 100, 10]);
  });

  test('90 degrees clockwise is −π/2', () => {
    const frame = artFrameOf(SUBJECT, 1, [0, 0], undefined, undefined);
    layoutLayerInto(frame, poseRow(1, 0, {[POSE_DEG]: 90}), 0, box, 1, out);
    expect(out[5]).toBeCloseTo(-Math.PI / 2, 12);
    layoutLayerInto(frame, poseRow(1, 0, {[POSE_DEG]: -45}), 0, box, 1, out);
    expect(out[5]).toBeCloseTo(Math.PI / 4, 12);
  });

  test('scales position about the focus and size by k, leaving z at −δ', () => {
    const frame = artFrameOf(SUBJECT, 1, [0, 0], [10, -20], undefined);
    expect(frame.focusX).toBe(10);
    expect(frame.focusY).toBe(20);
    const pose = poseRow(1, 0, {[POSE_X]: 30, [POSE_Y]: -20, [POSE_DEPTH]: 100});
    layoutLayerInto(frame, pose, 0, box, 2, out);
    // unit position (30, 20): focus + ((30, 20) − focus) · 2 = (50, 20)
    expect(Array.from(out.subarray(0, 5))).toEqual([50, 20, -100, 400, 160]);
  });
});

describe('anchorOf()', () => {
  test('answers the fractions of the box from its top left', () => {
    const anchor = new Float64Array(2);
    anchorOf({x: 100, y: 200, w: 50, h: 40}, 125, 240, anchor);
    expect(Array.from(anchor)).toEqual([0.5, 1]);
    anchorOf({x: 100, y: 200, w: 50, h: 40}, 100, 200, anchor);
    expect(Array.from(anchor)).toEqual([0, 0]);
  });
});

describe('turnToPlane()', () => {
  const world = (mesh: Object3D, x: number, y: number, z: number) => {
    mesh.updateMatrixWorld(true);
    return mesh.localToWorld(new Vector3(x, y, z));
  };

  // §2.2: +z of the art frame, and y up on the screen, for each plane
  const table: [ProjectionPlaneDescription, [number, number, number], [number, number, number]][] = [
    ['xy|bottom-left', [0, 0, 1], [0, 1, 0]],
    ['xy|top-left', [0, 0, -1], [0, -1, 0]],
    ['xz|bottom-left', [0, -1, 0], [0, 0, 1]],
    ['xz|top-left', [0, 1, 0], [0, 0, -1]],
  ];

  test.each(table)('%s', (description, z, y) => {
    const plane = ProjectionPlane.get(description);
    const mesh = new Object3D();
    turnToPlane(mesh, plane);
    const right = plane.getRight();
    const expectNear = (actual: Vector3, expected: ArrayLike<number>) => {
      expect(actual.x).toBeCloseTo(expected[0]!, 12);
      expect(actual.y).toBeCloseTo(expected[1]!, 12);
      expect(actual.z).toBeCloseTo(expected[2]!, 12);
    };
    expectNear(world(mesh, 0, 0, 1), z);
    expectNear(world(mesh, 0, 1, 0), y);
    expectNear(world(mesh, 1, 0, 0), [right.x, right.y, right.z]);
  });

  test('resets the rotation first, so a second call does not turn twice', () => {
    const plane = ProjectionPlane.get('xz|top-left');
    const mesh = new Object3D();
    turnToPlane(mesh, plane);
    const once = mesh.quaternion.clone();
    turnToPlane(mesh, plane);
    expect(mesh.quaternion.equals(once)).toBe(true);
    turnToPlane(mesh, ProjectionPlane.get('xy|bottom-left'));
    expect(mesh.quaternion.equals(new Object3D().quaternion)).toBe(true);
  });
});

describe('the compensation of depth', () => {
  const D = 300;
  const frameOf = (focus: [number, number] | undefined): ArtFrame =>
    artFrameOf(SUBJECT, 2, [400, 300], focus, {width: 800, height: 600});

  function cornersNdc(
    projection: ParallaxProjection,
    frame: ArtFrame,
    depthPx: number,
    k: number,
    cameraShift: [number, number],
  ): number[] {
    const camera = projection.createCamera();
    camera.position.x += cameraShift[0];
    camera.position.y += cameraShift[1];
    camera.updateMatrixWorld();

    const mesh = new Mesh();
    turnToPlane(mesh, ProjectionPlane.get('xy|bottom-left'));
    mesh.updateMatrixWorld(true);

    // a layer of 120 × 80 px with its pivot at its middle, at (500, 250) on the canvas
    const box: LayerBox = {x: 440, y: 210, w: 120, h: 80};
    const out = new Float64Array(6);
    layoutLayerInto(frame, poseRow(1, 0, {[POSE_X]: 500, [POSE_Y]: 250, [POSE_DEPTH]: depthPx}), 0, box, k, out);

    const result: number[] = [];
    for (const [sx, sy] of [
      [-0.5, -0.5],
      [0.5, -0.5],
      [0.5, 0.5],
      [-0.5, 0.5],
    ] as const) {
      const corner = new Vector3(out[0]! + sx * out[3]!, out[1]! + sy * out[4]!, out[2]!);
      corner.applyMatrix4(mesh.matrixWorld).project(camera);
      result.push(corner.x, corner.y);
    }
    return result;
  }

  test.each([
    {focus: undefined, shift: [0, 0] as [number, number]},
    {focus: [440, 340] as [number, number], shift: [20, -20] as [number, number]},
  ])('a layer at δ of −120, 0 and 600 px covers the box it covers at δ = 0 (focus $focus)', ({focus, shift}) => {
    const projection = new ParallaxProjection('xy|bottom-left', {fit: 'fill', distanceToProjectionPlane: D});
    projection.updateViewRect(800, 600);
    expect(projection.distanceToProjectionPlane).toBe(D);
    const frame = frameOf(focus);
    const k = new Float64Array(1);

    const flat = cornersNdc(projection, frame, 0, 1, shift);
    for (const depthPx of [-120, 0, 600]) {
      depthScaleInto(D, depthPx, frame, k);
      expect(k[0]).toBeCloseTo((D + depthPx / 2) / D, 12);
      const compensated = cornersNdc(projection, frame, depthPx, k[0]!, shift);
      for (let i = 0; i < flat.length; i++) expect(compensated[i]).toBeCloseTo(flat[i]!, 6);
    }

    // negative control: without the compensation a layer at 600 px does not cover the flat box
    const uncompensated = cornersNdc(projection, frame, 600, 1, shift);
    expect(flat.some((value, i) => Math.abs(uncompensated[i]! - value) > 1e-3)).toBe(true);
  });

  test('k is 1 for a D of NaN', () => {
    const k = new Float64Array(1);
    depthScaleInto(Number.NaN, 600, frameOf(undefined), k);
    expect(k[0]).toBe(1);
  });

  test('a depth of 0 is k = 1', () => {
    const k = new Float64Array(1);
    depthScaleInto(D, 0, frameOf(undefined), k);
    expect(k[0]).toBe(1);
  });
});

import {vec3, vec4} from 'three/tsl';
import type {Node} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {evaluateNode, stubShaderContext} from '../../testing/spriteGraph.js';
import {lightFacingVertex, mirroredBillboardVertex} from './facing.js';
import {MirrorAtPlane} from './MirrorAtPlane.js';

type V3 = [number, number, number];
type V4 = [number, number, number, number];

const v3 = (v: V3) => vec3(...v) as unknown as Node<'vec3'>;
const v4 = (v: V4) => vec4(...v) as unknown as Node<'vec4'>;

const expectNear = (actual: number[], expected: number[]) =>
  expected.forEach((value, i) => expect(actual[i], `component ${i} of ${actual}`).toBeCloseTo(value, 5));

const dot = (a: number[], b: number[]) => a.reduce((sum, x, i) => sum + x * b[i]!, 0);
const minus = (a: number[], b: number[]) => a.map((x, i) => x - b[i]!);

describe('lightFacingVertex()', () => {
  // a camera that looks along -z, level with the ground
  const level = {cameraUp: [0, 1, 0] as V3, cameraBack: [0, 0, 1] as V3};

  const place = (
    vertex: V3,
    {
      instancePosition = [0, 0, 0],
      light,
      plane = [0, 1, 0, 0],
      cameraUp = level.cameraUp,
      cameraBack = level.cameraBack,
    }: {
      instancePosition?: V3;
      light: V4;
      plane?: V4;
      cameraUp?: V3;
      cameraBack?: V3;
    },
  ) =>
    evaluateNode(
      lightFacingVertex({
        vertex: v3(vertex),
        instancePosition: v3(instancePosition),
        light: v4(light),
        plane: v4(plane),
        cameraUp: v3(cameraUp),
        cameraBack: v3(cameraBack),
      }),
    ) as number[];

  test('turns the quad to face a directional light: x across the light, y up and away from it', () => {
    // the light comes from the front and above, at 45°
    const light: V4 = [0, 1, 1, 0];
    const s = Math.SQRT1_2;

    expectNear(place([1, 0, 0], {light}), [1, 0, 0]);
    expectNear(place([0, 1, 0], {light}), [0, s, -s]);
    // a normal of any length, the plane moved: the same directions
    expectNear(place([0, 1, 0], {light, plane: [0, 3, 0, 6]}), [0, s, -s]);
  });

  test('turns it about the instance position, towards a point light as seen from there', () => {
    const instancePosition: V3 = [5, 0, 2];
    const lamp: V3 = [1, 6, -3];
    const towards = minus(lamp, instancePosition);

    for (const vertex of [
      [1, 0, 0],
      [0, 1, 0],
      [0.5, -2, 0],
    ] as V3[]) {
      const offset = minus(place(vertex, {instancePosition, light: [...lamp, 1]}), instancePosition);
      expect(dot(offset, towards), `${vertex} lies across the light`).toBeCloseTo(0, 5);
      expect(Math.hypot(...offset), `${vertex} keeps its distance from the pivot`).toBeCloseTo(Math.hypot(...vertex), 5);
    }
    // x stays level with the plane, so the shadow runs straight away from the light
    expect(place([1, 0, 0], {instancePosition, light: [...lamp, 1]})[1]).toBeCloseTo(0, 5);
  });

  test('turns the face of the sprite to the light, a light behind the sprite as well', () => {
    // from behind: the light sees the sprite from the front, its right on the left of the camera
    expectNear(place([1, 0, 0], {light: [0, 1, -1, 0]}), [-1, 0, 0]);
  });

  test('takes the view of the camera for up once the light stands above the plane, the top away from the camera', () => {
    expectNear(place([1, 0, 0], {light: [0, 1, 0, 0]}), [1, 0, 0]);
    expectNear(place([0, 1, 0], {light: [0, 1, 0, 0]}), [0, 0, -1]);

    // a camera above, looking down at 45° along -z: the top still lies away from it
    const s = Math.SQRT1_2;
    expectNear(place([0, 1, 0], {light: [0, 1, 0, 0], cameraUp: [0, s, -s], cameraBack: [0, s, s]}), [0, 0, -1]);
  });

  test('leaves the camera out for a light more than 0.1 off the normal — a sine above 0.1', () => {
    const light: V4 = [0.2, 1, 0, 0];
    const turned = {cameraUp: [1, 0, 0] as V3, cameraBack: [0, 1, 0] as V3};

    expectNear(place([0, 1, 0], {light, ...turned}), place([0, 1, 0], {light}));
    expectNear(place([1, 0, 0], {light, ...turned}), place([1, 0, 0], {light}));
  });
});

describe('mirroredBillboardVertex()', () => {
  // the placed vertex, mirrored by MirrorAtPlane as the reflection pass does
  const reflect = (
    vertex: V3,
    {instancePosition, plane, cameraPosition, cameraUp}: {instancePosition: V3; plane: V4; cameraPosition: V3; cameraUp: V3},
  ) => {
    const placed = mirroredBillboardVertex({
      vertex: v3(vertex),
      instancePosition: v3(instancePosition),
      plane: v4(plane),
      cameraPosition: v3(cameraPosition),
      cameraUp: v3(cameraUp),
    });
    const ctx = {...stubShaderContext(), uniform: <T extends string>() => v4(plane) as unknown as Node<T>};
    return evaluateNode(MirrorAtPlane.mesh!.transform(placed, ctx)) as number[];
  };

  test('hangs the sprite upside down below a mirror on the ground, facing a level camera', () => {
    const scene = {instancePosition: [0, 1, 0] as V3, plane: [0, 1, 0, 0] as V4, cameraPosition: [0, -1, 10] as V3};
    const cameraUp: V3 = [0, 1, 0];

    expectNear(reflect([1, 0, 0], {...scene, cameraUp}), [1, -1, 0]);
    expectNear(reflect([0, 1, 0], {...scene, cameraUp}), [0, -2, 0]);
  });

  test('faces the camera above the mirror, not its mirror image, and keeps the height of the sprite', () => {
    // seen from 45° above the mirror image of the instance position, (0, -1, 0)
    const scene = {instancePosition: [0, 1, 0] as V3, plane: [0, 1, 0, 0] as V4, cameraPosition: [0, 5, 6] as V3};
    const s = Math.SQRT1_2;
    const cameraUp: V3 = [0, s, -s];

    expectNear(reflect([1, 0, 0], {...scene, cameraUp}), [1, -1, 0]);
    expectNear(reflect([0, 1, 0], {...scene, cameraUp}), [0, -1 - s, s]);

    const top = reflect([0, 1, 0], {...scene, cameraUp});
    const bottom = reflect([0, -1, 0], {...scene, cameraUp});
    expect(dot(minus(top, bottom), [0, s, s]), 'the reflection lies across the view').toBeCloseTo(0, 5);
    expect(Math.hypot(...minus(top, bottom)), 'its full height').toBeCloseTo(2, 5);
  });

  test('turns the sprite left for right and keeps it upright in a mirror beside it', () => {
    // the mirror x = 0, the sprite at x = 1; the camera looks along -z at the mirror image
    const scene = {instancePosition: [1, 0, 0] as V3, plane: [2, 0, 0, 0] as V4, cameraPosition: [-1, 0, 10] as V3};
    const cameraUp: V3 = [0, 1, 0];

    expectNear(reflect([1, 0, 0], {...scene, cameraUp}), [-2, 0, 0]);
    expectNear(reflect([0, 1, 0], {...scene, cameraUp}), [-1, 1, 0]);
  });
});

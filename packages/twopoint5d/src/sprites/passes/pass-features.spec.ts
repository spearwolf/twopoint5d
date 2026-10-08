import {uniform, vec3, vec4} from 'three/tsl';
import {DoubleSide, type Node, Vector4} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {attributeNamesOf, evaluateNode, nodesOf, stubShaderContext} from '../../testing/spriteGraph.js';
import {ColorOrder, MeshOrder} from '../SpriteFeature.js';
import {Darken} from './Darken.js';
import {LightFacingPlacement} from './LightFacingPlacement.js';
import {MirrorAtPlane} from './MirrorAtPlane.js';
import {MirroredBillboardPlacement} from './MirroredBillboardPlacement.js';
import {BillboardReflectionPass, ReflectionPass, ShadowPass, shadowFallsOnPlane} from './passPresets.js';
import {PlanarShadow} from './PlanarShadow.js';
import {ShadowMask} from './ShadowMask.js';

describe('the pass features', () => {
  test('declare their uniforms, slots and bands', () => {
    expect(PlanarShadow.uniforms).toEqual({shadowLight: [-0.4, 1, -0.3, 0], groundPlane: [0, 1, 0, 0]});
    expect(PlanarShadow.mesh!.order).toBe(MeshOrder.Project);
    expect(ShadowMask.uniforms).toEqual({shadowColor: [0, 0, 0, 0.5]});
    expect(ShadowMask.color!.order).toBe(ColorOrder.Mask);
    expect(MirrorAtPlane.uniforms).toEqual({mirrorPlane: [0, 1, 0, 0]});
    expect(MirrorAtPlane.mesh!.order).toBe(MeshOrder.Mirror);
    expect(Darken.uniforms).toEqual({reflectionColor: [0.5, 0.5, 0.5, 0.5]});
    expect(Darken.color!.order).toBe(ColorOrder.Fade);
  });

  test('the two placements read the uniforms of the feature they require and declare none', () => {
    const read = (feature: typeof LightFacingPlacement) => {
      const names: string[] = [];
      const stub = stubShaderContext();
      const ctx = {
        ...stub,
        uniform: <T extends string>(name: string) => {
          names.push(name);
          return stub.uniform<T>(name);
        },
      };
      const local = vec3(1, 2, 0) as unknown as Node<'vec3'>;
      const placed = feature.placement!(local, ctx);
      return {names: names.sort(), attributes: attributeNamesOf(placed), local: nodesOf(placed).has(local)};
    };

    expect(LightFacingPlacement.requires).toEqual(['instancePosition', 'planarShadow']);
    expect(LightFacingPlacement.uniforms).toBeUndefined();
    expect(read(LightFacingPlacement)).toEqual({
      names: ['groundPlane', 'shadowLight'],
      attributes: ['instancePosition'],
      local: true,
    });
    expect(MirroredBillboardPlacement.requires).toEqual(['instancePosition', 'mirrorAtPlane']);
    expect(MirroredBillboardPlacement.uniforms).toBeUndefined();
    expect(read(MirroredBillboardPlacement)).toEqual({names: ['mirrorPlane'], attributes: ['instancePosition'], local: true});
  });

  test('build their stages from the placed vertex or the color and their uniforms', () => {
    const ctx = stubShaderContext();
    const placed = vec3(1, 2, 3) as unknown as Node<'vec3'>;
    const color = vec4(1, 1, 1, 1) as unknown as Node<'vec4'>;

    expect(nodesOf(PlanarShadow.mesh!.transform(placed, ctx)).has(placed)).toBe(true);
    expect(nodesOf(MirrorAtPlane.mesh!.transform(placed, ctx)).has(placed)).toBe(true);
    expect(nodesOf(ShadowMask.color!.transform(color, ctx)).has(color)).toBe(true);
    expect(nodesOf(Darken.color!.transform(color, ctx)).has(color)).toBe(true);
  });

  test('MirrorAtPlane mirrors at the plane dot(n, p) = d, for a normal of any length', () => {
    const mirror = (plane: [number, number, number, number], p: [number, number, number]) => {
      const ctx = {...stubShaderContext(), uniform: <T extends string>() => vec4(...plane) as unknown as Node<T>};
      return evaluateNode(MirrorAtPlane.mesh!.transform(vec3(...p) as unknown as Node<'vec3'>, ctx));
    };

    expect(mirror([0, 1, 0, 0], [1, 3, 5])).toEqual([1, -3, 5]);
    // 2y = 4 is the plane y = 2
    expect(mirror([0, 2, 0, 4], [1, 3, 5])).toEqual([1, 1, 5]);
    expect(mirror([0, 0, -3, 6], [1, 3, 5])).toEqual([1, 3, -9]);
  });

  describe('PlanarShadow', () => {
    const shadow = (light: number[], plane: number[], p: [number, number, number]) => {
      const ctx = {
        ...stubShaderContext(),
        uniform: <T extends string>(name: string) =>
          (name === 'shadowLight'
            ? vec4(...(light as [number, number, number, number]))
            : vec4(...(plane as [number, number, number, number]))) as unknown as Node<T>,
      };
      return evaluateNode(PlanarShadow.mesh!.transform(vec3(...p) as unknown as Node<'vec3'>, ctx)) as number[];
    };
    const expectNear = (actual: number[], expected: number[]) =>
      expected.forEach((value, i) => expect(actual[i], `component ${i} of ${actual}`).toBeCloseTo(value, 5));

    test('projects along a direction towards the light (w = 0) as the light that travels the other way did', () => {
      // towards (-0.4, 1, -0.3): the light travels along (0.4, -1, 0.3); 2 units up land 0.8 and 0.6 off
      expectNear(shadow([-0.4, 1, -0.3, 0], [0, 1, 0, 0], [1, 2, 3]), [1.8, 0, 3.6]);
      // a normal of any length: 2y = 4 is the plane y = 2
      expectNear(shadow([-0.4, 1, -0.3, 0], [0, 2, 0, 4], [1, 4, 3]), [1.8, 2, 3.6]);
    });

    test('projects from a point light (w = 1) onto the plane', () => {
      // from (0, 10, 0) through (2, 5, 0) down to y = 0
      expectNear(shadow([0, 10, 0, 1], [0, 1, 0, 0], [2, 5, 0]), [4, 0, 0]);
    });

    test('keeps the shadow of a vertex at or above a point light finite, in the plane and on the far side', () => {
      // above the light: brought down to 0.95 of its height first, then projected — measured across
      // the normal, 19 times its offset from the light beyond it: from x = 1 to x = 20
      expectNear(shadow([0, 10, 0, 1], [0, 1, 0, 0], [1, 12, 0]), [20, 0, 0]);
      // exactly at the height of the light
      const atLight = shadow([0, 10, 0, 1], [0, 1, 0, 0], [1, 10, 0]);
      expect(atLight.every(Number.isFinite), `${atLight}`).toBe(true);
      expectNear(atLight, [20, 0, 0]);
    });
  });

  test('the two passes draw behind the sprites, transparent, without writing depth, from both sides', () => {
    expect([ReflectionPass.renderOrder, ReflectionPass.material]).toEqual([
      -1,
      {transparent: true, depthWrite: false, side: DoubleSide},
    ]);
    // the shadow lies in the ground plane: the offset pulls it in front of a ground mesh in that plane
    expect([ShadowPass.renderOrder, ShadowPass.material]).toEqual([
      -1,
      {
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      },
    ]);
    // the shadow of every sprite is that of a quad turned to the light, whatever its placement
    expect(ShadowPass.features).toEqual([LightFacingPlacement, PlanarShadow, ShadowMask]);
    expect(ReflectionPass.features).toEqual([MirrorAtPlane, Darken]);
    expect(BillboardReflectionPass.features).toEqual([MirroredBillboardPlacement, MirrorAtPlane, Darken]);
    expect([BillboardReflectionPass.name, BillboardReflectionPass.renderOrder, BillboardReflectionPass.material]).toEqual([
      'reflection',
      -1,
      {transparent: true, depthWrite: false, side: DoubleSide},
    ]);
    expect(BillboardReflectionPass.visible).toBeUndefined();
    expect(ShadowPass.visible).toBe(shadowFallsOnPlane);
    expect(ReflectionPass.visible).toBeUndefined();
  });

  describe('the hook of ShadowPass', () => {
    const judge = (light: [number, number, number, number], plane: [number, number, number, number] = [0, 1, 0, 0]) => {
      const nodes: Record<string, unknown> = {
        shadowLight: uniform(new Vector4(...light)),
        groundPlane: uniform(new Vector4(...plane)),
      };
      return shadowFallsOnPlane((name) => nodes[name] as never);
    };

    test('draws a shadow for a light above the plane, a direction or a point', () => {
      expect(judge([-0.4, 1, -0.3, 0])).toBe(true);
      expect(judge([0, 10, 0, 1])).toBe(true);
      expect(judge([0, 5, 0, 1], [0, 2, 0, 4])).toBe(true); // 5 above y = 2
    });

    test('leaves it out for a direction parallel to the plane or from below, and a point in or below it', () => {
      expect(judge([1, 0, 0, 0])).toBe(false);
      expect(judge([1, 0.0005, 0, 0])).toBe(false); // grazing: below the cosine 1e-3
      expect(judge([0.4, -1, 0.3, 0])).toBe(false);
      expect(judge([3, 0, 0, 1])).toBe(false);
      expect(judge([0, -1, 0, 1])).toBe(false);
      expect(judge([0, 1, 0, 1], [0, 2, 0, 4])).toBe(false); // y = 1 lies below y = 2
    });
  });
});

import {vec3, vec4} from 'three/tsl';
import {DoubleSide, type Node} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {evaluateNode, nodesOf, stubShaderContext} from '../../testing/spriteGraph.js';
import {ColorOrder, MeshOrder} from '../SpriteFeature.js';
import {Darken} from './Darken.js';
import {MirrorAtPlane} from './MirrorAtPlane.js';
import {ReflectionPass, ShadowPass} from './passPresets.js';
import {PlanarShadow} from './PlanarShadow.js';
import {ShadowMask} from './ShadowMask.js';

describe('the pass features', () => {
  test('declare their uniforms, slots and bands', () => {
    expect(PlanarShadow.uniforms).toEqual({lightDirection: [0.4, -1, 0.3], groundPlane: [0, 1, 0, 0]});
    expect(PlanarShadow.mesh!.order).toBe(MeshOrder.Project);
    expect(ShadowMask.uniforms).toEqual({shadowColor: [0, 0, 0, 0.5]});
    expect(ShadowMask.color!.order).toBe(ColorOrder.Mask);
    expect(MirrorAtPlane.uniforms).toEqual({mirrorPlane: [0, 1, 0, 0]});
    expect(MirrorAtPlane.mesh!.order).toBe(MeshOrder.Mirror);
    expect(Darken.uniforms).toEqual({reflectionColor: [0.5, 0.5, 0.5, 0.5]});
    expect(Darken.color!.order).toBe(ColorOrder.Fade);
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
    expect(ShadowPass.features).toEqual([PlanarShadow, ShadowMask]);
    expect(ReflectionPass.features).toEqual([MirrorAtPlane, Darken]);
  });
});

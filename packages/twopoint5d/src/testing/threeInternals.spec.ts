import {add, float, instanceIndex, uniform, vec4} from 'three/tsl';
import {type Node, OrthographicCamera, PerspectiveCamera, WebGPUCoordinateSystem} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {pickOutputOf, setReversedDepth} from './threeInternals.js';

describe('threeInternals', () => {
  test('setReversedDepth() is what Camera#reversedDepth reads, and updateProjectionMatrix() builds the reversed projection from it', () => {
    const [near, far] = [0.1, 100];
    const perspective = new PerspectiveCamera(60, 1, near, far);
    const orthographic = new OrthographicCamera(-4, 4, 4, -4, near, far);
    for (const camera of [perspective, orthographic]) {
      camera.coordinateSystem = WebGPUCoordinateSystem;
      setReversedDepth(camera, true);
      expect(camera.reversedDepth).toBe(true);
      camera.updateProjectionMatrix();
    }

    // the depth row of a projection onto a reversed depth buffer: the near plane at 1, the far plane at 0
    expect(perspective.projectionMatrix.elements[10]).toBeCloseTo(near / (far - near), 12);
    expect(perspective.projectionMatrix.elements[14]).toBeCloseTo((far * near) / (far - near), 12);
    expect(orthographic.projectionMatrix.elements[10]).toBeCloseTo(1 / (far - near), 12);
    expect(orthographic.projectionMatrix.elements[14]).toBeCloseTo(far / (far - near), 12);

    setReversedDepth(perspective, false);
    expect(perspective.reversedDepth).toBe(false);
  });

  test('pickOutputOf() finds the instance index and the mesh number of a pick output', () => {
    const output = pickOutputOf(vec4(add(float(instanceIndex), 1), uniform(3), 0, 1) as unknown as Node);
    expect(output.readsInstanceIndex).toBe(true);
    expect(output.meshNumber?.value).toBe(3);

    expect(pickOutputOf(vec4(1, 2, 0, 1) as unknown as Node)).toEqual({readsInstanceIndex: false, meshNumber: undefined});
  });
});

import {FloatType, type WebGPURenderer} from 'three/webgpu';
import {describe, expect, it, vi} from 'vitest';
import {StageRendererTargets} from './StageRendererTargets.js';

// the parts of a WebGPURenderer the targets read
function createRendererMock(pixelRatio = 1) {
  return {
    getPixelRatio: vi.fn(() => pixelRatio),
    getOutputBufferType: vi.fn(() => FloatType),
    samples: 0,
  } as unknown as WebGPURenderer;
}

const sizeOf = (rt: {width: number; height: number}) => [rt.width, rt.height];

describe('StageRendererTargets', () => {
  describe('scale', () => {
    it('defaults to 1', () => {
      const targets = new StageRendererTargets();
      expect(targets.scale).toBe(1);
      expect(sizeOf(targets.passTarget(createRendererMock(), 100, 50))).toEqual([100, 50]);
    });

    it('scale 0.5 halves the pass target, not the internal target', () => {
      const targets = new StageRendererTargets();
      targets.scale = 0.5;
      const renderer = createRendererMock();
      expect(sizeOf(targets.passTarget(renderer, 100, 50))).toEqual([50, 25]);
      const internal = targets.acquireInternalTarget(renderer, 100, 50);
      expect(sizeOf(internal)).toEqual([100, 50]);
      targets.returnInternalTarget();
      targets.dispose();
    });

    it('multiplies the device size: floor(size · pixelRatio · scale), at least 1', () => {
      const targets = new StageRendererTargets();
      targets.scale = 0.5;
      expect(sizeOf(targets.passTarget(createRendererMock(2), 101, 51))).toEqual([101, 51]);
      expect(sizeOf(targets.passTarget(createRendererMock(1), 101, 51))).toEqual([50, 25]);
      expect(sizeOf(targets.passTarget(createRendererMock(1), 1, 1))).toEqual([1, 1]);
    });

    it('brings a pass target that exists to the new scale, as the same target and texture', () => {
      const targets = new StageRendererTargets();
      const rt = targets.passTarget(createRendererMock(), 100, 50);
      const tex = rt.texture;
      targets.scale = 0.25;
      expect(sizeOf(rt)).toEqual([25, 12]);
      targets.scale = 1;
      expect(sizeOf(rt)).toEqual([100, 50]);
      expect(rt.texture).toBe(tex);
      expect(targets.passTarget(createRendererMock(), 100, 50)).toBe(rt);
    });

    it('takes the scale into resize() for the pass target, not for the internal target', () => {
      const targets = new StageRendererTargets();
      const renderer = createRendererMock();
      const pass = targets.passTarget(renderer, 100, 50);
      const internal = targets.acquireInternalTarget(renderer, 100, 50);
      targets.returnInternalTarget();
      targets.scale = 0.5;
      targets.resize(200, 100);
      expect(sizeOf(pass)).toEqual([100, 50]);
      expect(sizeOf(internal)).toEqual([200, 100]);
    });

    it('builds no pass target when the scale changes before there is one', () => {
      const targets = new StageRendererTargets();
      targets.scale = 0.5;
      targets.releasePassTarget();
      expect(sizeOf(targets.passTarget(createRendererMock(), 40, 40))).toEqual([20, 20]);
    });
  });
});

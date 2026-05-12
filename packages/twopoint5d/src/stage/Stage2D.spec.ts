import {describe, expect, it, vi} from 'vitest';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D} from './Stage2D.js';

describe('Stage2D', () => {
  it('has a scene by default', () => {
    const stage = new Stage2D(new ParallaxProjection('xz|top-left', {fit: 'contain', width: 600}));
    expect(stage.scene).toBeDefined();
  });

  it('after call to resize() a camera is created (by projection)', () => {
    const stage = new Stage2D(new ParallaxProjection('xz|top-left', {pixelZoom: 2}));
    stage.resize(320, 240);

    expect(stage.camera).toBeDefined();
  });

  describe('renderTo (IRenderable)', () => {
    it('is a no-op when there is no camera yet', () => {
      const stage = new Stage2D();
      const renderer = {render: vi.fn()};
      stage.renderTo(renderer as any);
      expect(renderer.render).not.toHaveBeenCalled();
    });

    it('calls renderer.render(scene, camera) once camera exists', () => {
      const stage = new Stage2D(new ParallaxProjection('xz|top-left', {pixelZoom: 1}));
      stage.resize(100, 100);
      const renderer = {render: vi.fn()};
      stage.renderTo(renderer as any);
      expect(renderer.render).toHaveBeenCalledTimes(1);
      expect(renderer.render).toHaveBeenCalledWith(stage.scene, stage.camera);
    });
  });

  it('does not expose the removed clearColor / clearAlpha / autoClear properties', () => {
    const stage = new Stage2D() as any;
    expect(stage.clearColor).toBeUndefined();
    expect(stage.clearAlpha).toBeUndefined();
    expect(stage.autoClear).toBeUndefined();
  });
});

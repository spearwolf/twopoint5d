import {describe, expect, it, vi} from 'vitest';
import {ClearStage} from './ClearStage.js';

describe('ClearStage', () => {
  it('defaults to clearing the depth buffer only', () => {
    const stage = new ClearStage();
    expect(stage.color).toBe(false);
    expect(stage.depth).toBe(true);
    expect(stage.stencil).toBe(false);
    const renderer = {clear: vi.fn()};
    stage.renderTo(renderer as any);
    expect(renderer.clear).toHaveBeenCalledWith(false, true, false);
  });

  it('honors explicit options', () => {
    const stage = new ClearStage({color: true, depth: false, stencil: true});
    const renderer = {clear: vi.fn()};
    stage.renderTo(renderer as any);
    expect(renderer.clear).toHaveBeenCalledWith(true, false, true);
  });

  it('uses a custom name when provided', () => {
    expect(new ClearStage().name).toBe('clear');
    expect(new ClearStage({}, 'clear-depth').name).toBe('clear-depth');
  });

  it('resize() and updateFrame() are no-ops', () => {
    const stage = new ClearStage();
    expect(() => stage.resize(100, 100)).not.toThrow();
    expect(() => stage.updateFrame(0, 0, 1)).not.toThrow();
  });

  it('clear flags can be flipped after construction', () => {
    const stage = new ClearStage();
    stage.color = true;
    stage.depth = false;
    const renderer = {clear: vi.fn()};
    stage.renderTo(renderer as any);
    expect(renderer.clear).toHaveBeenCalledWith(true, false, false);
  });
});

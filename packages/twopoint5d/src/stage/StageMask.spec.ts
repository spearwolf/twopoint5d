import {describe, expect, it, vi} from 'vitest';
import {ClearStage} from './ClearStage.js';
import type {StageDirectorLayer} from './StageDirector.js';
import {StageMask, type StageMaskCoverageSource} from './StageMask.js';

function layer(extra: object = {}): StageDirectorLayer & {dispose: ReturnType<typeof vi.fn>} {
  return {
    name: 'fog',
    resize: vi.fn(),
    updateFrame: vi.fn(),
    renderTo: vi.fn(),
    dispose: vi.fn(),
    ...extra,
  } as unknown as StageDirectorLayer & {dispose: ReturnType<typeof vi.fn>};
}

describe('StageMask', () => {
  it('defaults to alpha, not inverted', () => {
    const stage = layer();
    const mask = new StageMask(stage);
    expect(mask.stage).toBe(stage);
    expect(mask.source).toBe('alpha');
    expect(mask.invert).toBe(false);
    expect(mask.isDisposed).toBe(false);
  });

  it.each<StageMaskCoverageSource>(['alpha', 'luminance', 'red', 'green', 'blue'])(
    'reads source %s and invert back',
    (source) => {
      const mask = new StageMask(layer(), {source, invert: true});
      expect(mask.source).toBe(source);
      expect(mask.invert).toBe(true);
    },
  );

  it('refuses an unknown source', () => {
    expect(() => new StageMask(layer(), {source: 'lum' as any})).toThrow(
      `new StageMask(): source must be 'alpha', 'luminance', 'red', 'green' or 'blue', got "lum"`,
    );
  });

  it('refuses options that are no object and an invert that is no boolean', () => {
    expect(() => new StageMask(layer(), 'alpha' as any)).toThrow('new StageMask(): the options must be an object');
    expect(() => new StageMask(layer(), {invert: 1 as any})).toThrow('new StageMask(): invert must be a boolean, got 1');
  });

  it('refuses a stage without renderTo()', () => {
    expect(() => new StageMask({name: 'x', resize() {}, updateFrame() {}} as any)).toThrow(
      'new StageMask() cannot take the stage',
    );
    expect(() => new StageMask(undefined as any)).toThrow(TypeError);
  });

  it('refuses a ClearStage', () => {
    expect(() => new StageMask(new ClearStage() as any)).toThrow(
      'new StageMask() cannot take the stage "clear": a ClearStage draws no picture to read a coverage from',
    );
  });

  it('refuses a disposed stage', () => {
    expect(() => new StageMask(layer({isDisposed: true}))).toThrow(
      'new StageMask() cannot take the stage "fog": that stage has been disposed',
    );
  });

  it('starts at progress 0, with a float uniform of the same value', () => {
    const mask = new StageMask(layer());
    expect(mask.progress).toBe(0);
    expect(mask.progressNode.isUniformNode).toBe(true);
    expect(mask.progressNode.value).toBe(0);
    // one uniform per mask, the same at every read
    expect(mask.progressNode).toBe(mask.progressNode);
    expect(new StageMask(layer()).progressNode).not.toBe(mask.progressNode);
  });

  it('progress is read-only for the caller', () => {
    const mask = new StageMask(layer());
    expect(() => {
      (mask as {progress: number}).progress = 0.5;
    }).toThrow(TypeError);
    expect(mask.progress).toBe(0);
  });

  it('dispose() leaves a stage handed in undisposed', () => {
    const stage = layer();
    const mask = new StageMask(stage);
    mask.dispose();
    expect(mask.isDisposed).toBe(true);
    expect(stage.dispose).not.toHaveBeenCalled();
    expect(() => mask.dispose()).not.toThrow();
  });
});

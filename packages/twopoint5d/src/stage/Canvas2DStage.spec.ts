import {emit, on} from '@spearwolf/eventize';
import {createSandbox} from 'sinon';
import type {WebGPURenderer} from 'three/webgpu';
import {afterEach, describe, expect, test, vi} from 'vitest';

import {Canvas2DStage} from './Canvas2DStage.js';

// the stage asks the renderer for its anisotropy and hands it to the stage renderer, nothing else
function makeRenderer() {
  return {
    getMaxAnisotropy: () => 1,
    render: vi.fn(),
    dispose: vi.fn(),
  } as unknown as WebGPURenderer;
}

// this suite runs without a DOM, so the canvas is handed in: the [width, height] overload of the
// constructor would call document.createElement()
function makeCanvas(width = 32, height = 16) {
  return {width, height} as unknown as HTMLCanvasElement;
}

// without a setCanvasSize() the Stage2D has no camera and renderTo() falls through inside it, so
// render() runs to the end under node without three.js ever drawing
function makeStage() {
  return new Canvas2DStage(makeRenderer(), makeCanvas());
}

describe('Canvas2DStage', () => {
  const sandbox = createSandbox();

  afterEach(() => {
    sandbox.restore();
  });

  test('sends a dispose event and stops listening afterwards', () => {
    const stage = makeStage();
    const disposed = vi.fn();
    const rendered = vi.fn();
    on(stage, 'dispose', disposed);
    on(stage, 'render', rendered);

    stage.dispose();

    expect(disposed, 'the event goes out while the listeners are still attached').toHaveBeenCalledTimes(1);

    // straight into the emitter, past the guard in render(): the question here is whether anyone
    // is still subscribed, not whether the stage would emit
    emit(stage, 'render', stage);

    expect(rendered, 'no event follows the dispose').not.toHaveBeenCalled();
  });

  test('carries a canvas resize into the specs its projection reads', () => {
    const stage = makeStage();

    stage.setCanvasSize(128, 96);

    expect(stage.projection.viewSpecs).toMatchObject({fit: 'contain', width: 128, height: 96});
  });

  test('puts the new texture in place before it releases the one it replaces', () => {
    const stage = makeStage();

    stage.needsUpdate = true;
    stage.render();

    const first = stage.texture!;
    let mapAtRelease: unknown;
    let fieldAtRelease: unknown;

    // calls through: the question is when the release happens, not whether it happens
    const releaseFirst = first.dispose.bind(first);
    sandbox.stub(first, 'dispose').callsFake(() => {
      mapAtRelease = stage.sprite.material.map;
      fieldAtRelease = stage.texture;
      releaseFirst();
    });

    stage.needsUpdate = true;
    stage.render();

    expect(stage.texture, 'the factory built a second texture').not.toBe(first);
    expect(mapAtRelease, 'the material had already moved on').toBe(stage.texture);
    expect(fieldAtRelease, 'and so had the field').toBe(stage.texture);
  });

  describe('dispose()', () => {
    // (a) a resource the instance built itself is released exactly once
    test('disposes the material, both textures and the stage renderer it created itself', () => {
      const stage = makeStage();

      const materialDispose = sandbox.spy(stage.sprite.material, 'dispose');
      // the placeholder the constructor put behind the material — the first render() swaps it out
      const placeholderDispose = sandbox.spy(stage.sprite.material.map!, 'dispose');
      const stageRendererDispose = sandbox.spy(stage.stageRenderer, 'dispose');

      stage.needsUpdate = true;
      stage.render();
      const textureDispose = sandbox.spy(stage.texture!, 'dispose');

      stage.dispose();

      expect(materialDispose.calledOnce, 'the sprite material').toBe(true);
      expect(placeholderDispose.calledOnce, 'the placeholder texture').toBe(true);
      expect(textureDispose.calledOnce, 'the texture the factory built').toBe(true);
      expect(stageRendererDispose.calledOnce, 'the stage renderer').toBe(true);
    });

    // (b) a resource handed in belongs to the caller and is not touched
    test('does NOT dispose the renderer, the canvas or the shared sprite geometry', () => {
      const renderer = makeRenderer();
      const canvas = makeCanvas(64, 48);
      const stage = new Canvas2DStage(renderer, canvas);
      const geometryDispose = sandbox.spy(stage.sprite.geometry, 'dispose');

      stage.dispose();

      expect(renderer.dispose, 'the renderer belongs to the caller').not.toHaveBeenCalled();
      expect(canvas.width, 'the canvas keeps its size').toBe(64);
      expect(canvas.height).toBe(48);
      expect(geometryDispose.called, 'THREE.Sprite shares one geometry across every sprite').toBe(false);
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    test('behaves as documented after dispose()', () => {
      const stage = makeStage();
      const renderTo = sandbox.spy(stage.stageRenderer, 'renderTo');

      stage.dispose();

      expect(stage.isDisposed).toBe(true);
      expect(stage.texture, 'texture after dispose()').toBeUndefined();
      expect(stage.sprite.parent, 'the sprite left the scene').toBe(null);
      expect(stage.stageRenderer.isDisposed, 'the stage renderer went with it').toBe(true);

      expect(() => {
        stage.needsUpdate = true;
        stage.render();
        stage.setContainerSize(320, 240);
        stage.setCanvasSize(128, 128);
        stage.fit = 'cover';
      }).not.toThrow();

      expect(renderTo.called, 'a disposed stage drives nothing').toBe(false);
      expect(stage.width, 'the canvas keeps the size it had').toBe(32);
      expect(stage.height).toBe(16);
      expect(stage.fit, 'fit after a write').toBe('contain');
      expect(stage.texture, 'texture after a render()').toBeUndefined();
    });

    // (d) the second call throws nothing and releases nothing a second time
    test('is safe to call twice', () => {
      const stage = makeStage();

      const materialDispose = sandbox.spy(stage.sprite.material, 'dispose');
      const placeholderDispose = sandbox.spy(stage.sprite.material.map!, 'dispose');
      const stageRendererDispose = sandbox.spy(stage.stageRenderer, 'dispose');

      stage.needsUpdate = true;
      stage.render();
      const textureDispose = sandbox.spy(stage.texture!, 'dispose');

      expect(() => {
        stage.dispose();
        stage.dispose();
      }).not.toThrow();

      expect(materialDispose.calledOnce, 'the sprite material').toBe(true);
      expect(placeholderDispose.calledOnce, 'the placeholder texture').toBe(true);
      expect(textureDispose.calledOnce, 'the texture the factory built').toBe(true);
      expect(stageRendererDispose.calledOnce, 'the stage renderer').toBe(true);
    });

    // (e) has no subject here: no class in this module creates a signal or an effect.

    // (f) has no subject here: this stage takes no slot from a pool and no tile from a factory.
  });
});

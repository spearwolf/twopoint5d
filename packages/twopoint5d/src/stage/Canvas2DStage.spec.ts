import {emit, on} from '@spearwolf/eventize';
import {createSandbox} from 'sinon';
import type {WebGPURenderer} from 'three/webgpu';
import {afterEach, describe, expect, test, vi} from 'vitest';

import {OnStageResize, OnStageUpdateFrame, type StageUpdateFrameProps} from '../events.js';
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

// without a setContainerSize() the Stage2D has no camera and renderTo() falls through inside it, so
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

    // a canvas of another size is what makes the stage build a second texture
    stage.setCanvasSize(64, 32);
    stage.needsUpdate = true;
    stage.render();

    expect(stage.texture, 'the factory built a second texture').not.toBe(first);
    expect(mapAtRelease, 'the material had already moved on').toBe(stage.texture);
    expect(fieldAtRelease, 'and so had the field').toBe(stage.texture);
  });

  test('drives the stage renderer when the container size is set', () => {
    const stage = makeStage();

    stage.setContainerSize(320, 240);

    expect([stage.stageRenderer.width, stage.stageRenderer.height]).toEqual([320, 240]);
    expect([stage.stage.containerWidth, stage.stage.containerHeight]).toEqual([320, 240]);
  });

  test('a container size the stage renderer already carries reaches no stage again', () => {
    const stage = makeStage();
    stage.setContainerSize(320, 240);

    const resize = sandbox.spy(stage.stage, 'resize');
    const resized = vi.fn();
    on(stage.stage, OnStageResize, resized);

    stage.setContainerSize(320, 240);

    expect(resize.called).toBe(false);
    expect(resized).not.toHaveBeenCalled();
    expect([stage.stageRenderer.width, stage.stageRenderer.height]).toEqual([320, 240]);
  });

  test('a new fit reaches the projection and gives the stage the view of that fit', () => {
    const stage = makeStage();
    stage.setContainerSize(320, 240);
    expect([stage.stage.width, stage.stage.height]).toEqual([32, 24]);

    const resized = vi.fn();
    on(stage.stage, OnStageResize, resized);

    stage.fit = 'cover';

    expect(stage.projection.viewSpecs.fit).toBe('cover');
    expect(stage.stage.width).toBeCloseTo(64 / 3);
    expect(stage.stage.height).toBe(16);
    expect(resized).toHaveBeenCalledTimes(1);
    const props = resized.mock.calls[0]![0] as {width: number; height: number};
    expect(props.width).toBeCloseTo(64 / 3);
    expect(props.height).toBe(16);
  });

  test('writing the fit it has changes nothing', () => {
    const stage = makeStage();
    stage.setContainerSize(320, 240);

    const updateProjection = sandbox.spy(stage.stage, 'updateProjection');
    const resized = vi.fn();
    on(stage.stage, OnStageResize, resized);

    stage.fit = 'contain';

    expect(updateProjection.called).toBe(false);
    expect(resized).not.toHaveBeenCalled();
  });

  test('uploads a change of the same size into the texture it has', () => {
    const stage = makeStage();

    stage.render();
    const texture = stage.texture!;
    const materialVersion = stage.sprite.material.version;
    const textureVersion = texture.version;

    stage.needsUpdate = true;
    stage.render();

    expect(stage.texture, 'the same texture object').toBe(texture);
    expect(texture.version, 'flagged for another upload').toBeGreaterThan(textureVersion);
    expect(stage.sprite.material.version, 'the material is not rebuilt').toBe(materialVersion);
    expect(stage.needsUpdate, 'the flag is spent').toBe(false);
  });

  test('builds a new texture for a canvas of another size', () => {
    const stage = makeStage();

    stage.render();
    const first = stage.texture!;
    const firstDispose = sandbox.spy(first, 'dispose');

    stage.setCanvasSize(64, 32);
    stage.needsUpdate = true;
    stage.render();

    expect(stage.texture).not.toBe(first);
    expect(stage.sprite.material.map, 'the material shows the new texture').toBe(stage.texture);
    expect(firstDispose.calledOnce, 'the previous texture is released').toBe(true);
  });

  test('builds a new texture when a canvas handed in changes its size itself', () => {
    const canvas = makeCanvas();
    const stage = new Canvas2DStage(makeRenderer(), canvas);

    stage.render();
    const first = stage.texture!;

    canvas.width = 48;
    stage.needsUpdate = true;
    stage.render();

    expect(stage.texture).not.toBe(first);
    expect(stage.sprite.material.map).toBe(stage.texture);
  });

  test('shows the canvas on the first render() without needsUpdate', () => {
    const stage = makeStage();

    expect(stage.texture, 'nothing is built before the first render()').toBeUndefined();

    stage.render();

    expect(stage.texture).toBeDefined();
    expect(stage.texture).toBe(stage.sprite.material.map);
  });

  test('hands out its texture read-only', () => {
    const stage = makeStage();

    expect(() => {
      // @ts-expect-error texture has a getter and no setter
      stage.texture = undefined;
    }).toThrow(TypeError);
    expect(() => {
      (stage as unknown as {texture: unknown}).texture = undefined;
    }).toThrow(TypeError);
  });

  describe('render()', () => {
    test('render(now, deltaTime, frameNo) hands the frame to the stage renderer before it draws', () => {
      const stage = makeStage();
      const updateFrame = sandbox.spy(stage.stageRenderer, 'updateFrame');
      const renderTo = sandbox.stub(stage.stageRenderer, 'renderTo');

      stage.render(1.5, 0.25, 7);

      expect(updateFrame.calledOnceWithExactly(1.5, 0.25, 7)).toBe(true);
      expect(renderTo.calledOnce).toBe(true);
      expect(updateFrame.calledBefore(renderTo)).toBe(true);
    });

    test('render() without frame values counts frames of its own', () => {
      const stage = makeStage();
      const updateFrame = sandbox.spy(stage.stageRenderer, 'updateFrame');

      stage.render();
      stage.render();

      expect(updateFrame.firstCall.args).toEqual([0, 0, 1]);
      const [now, deltaTime, frameNo] = updateFrame.secondCall.args;
      expect(frameNo).toBe(2);
      expect(now).toBeGreaterThanOrEqual(0);
      expect(deltaTime).toBeGreaterThanOrEqual(0);
    });

    test('a call with values leaves the clock and the frame count alone', () => {
      const stage = makeStage();
      const updateFrame = sandbox.spy(stage.stageRenderer, 'updateFrame');

      stage.render();
      stage.render(10, 1, 99);
      stage.render();

      expect(updateFrame.thirdCall.args[2], 'the second call without values counts 2').toBe(2);
    });

    test('the Stage2D gets OnStageUpdateFrame once the container has a size', () => {
      const stage = makeStage();
      stage.setContainerSize(320, 240);
      // under node nothing draws
      sandbox.stub(stage.stageRenderer, 'renderTo');

      const frames: {now: number; deltaTime: number; frameNo: number}[] = [];
      on(stage.stage, OnStageUpdateFrame, ({now, deltaTime, frameNo}: StageUpdateFrameProps) => {
        frames.push({now, deltaTime, frameNo});
      });

      stage.render(2, 0.5, 3);

      expect(frames).toEqual([{now: 2, deltaTime: 0.5, frameNo: 3}]);
    });
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

    test('disposes the Stage2D its constructor built', () => {
      const stage = makeStage();
      const innerStageDispose = sandbox.spy(stage.stage, 'dispose');

      stage.dispose();

      expect(innerStageDispose.calledOnce).toBe(true);
    });

    test('a dispose listener that throws does not hold up the teardown', () => {
      const stage = makeStage();
      const boom = new Error('boom');
      const materialDispose = sandbox.spy(stage.sprite.material, 'dispose');
      const placeholderDispose = sandbox.spy(stage.sprite.material.map!, 'dispose');
      const heard = vi.fn();
      on(stage, 'dispose', () => {
        throw boom;
      });
      on(stage, 'dispose', heard);

      expect(() => stage.dispose()).toThrow(boom);

      expect(heard, 'a listener behind the one that throws').toHaveBeenCalledTimes(1);
      expect(materialDispose.calledOnce).toBe(true);
      expect(placeholderDispose.calledOnce).toBe(true);
      expect(stage.sprite.parent).toBe(null);
      expect(stage.stageRenderer.isDisposed).toBe(true);
      expect(stage.stage.isDisposed).toBe(true);
    });

    test('collects the errors of the dispose listeners of the stage, its stage renderer and its Stage2D', () => {
      const stage = makeStage();
      const stageError = new Error('stage');
      const rendererError = new Error('stage renderer');
      const stage2DError = new Error('Stage2D');
      on(stage, 'dispose', () => {
        throw stageError;
      });
      on(stage.stageRenderer, 'dispose', () => {
        throw rendererError;
      });
      on(stage.stage, 'dispose', () => {
        throw stage2DError;
      });

      let caught: unknown;
      try {
        stage.dispose();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect((caught as AggregateError).errors).toEqual([stageError, rendererError, stage2DError]);
      expect(stage.stageRenderer.isDisposed).toBe(true);
      expect(stage.stage.isDisposed).toBe(true);
    });

    // (e) has no subject here: no class in this module creates a signal or an effect.

    // (f) has no subject here: this stage takes no slot from a pool and no tile from a factory.
  });
});

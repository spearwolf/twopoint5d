import {emit, on} from '@spearwolf/eventize';
import {createSandbox} from 'sinon';
import {type PassNode, SpriteMaterial, type WebGPURenderer} from 'three/webgpu';
import {afterEach, describe, expect, test, vi} from 'vitest';

import {
  type ICanvas2DStageDispose,
  type ICanvas2DStageRender,
  type ICanvas2DStageResize,
  OnCanvas2DStageDispose,
  OnCanvas2DStageRender,
  OnCanvas2DStageResize,
  OnStageDispose,
  OnStageResize,
  OnStageUpdateFrame,
  type StageUpdateFrameProps,
} from '../events.js';
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

// a canvas as the DOM builds it: a width or a height it is given ends up a whole number, rounded down
function makeRoundingCanvas(width: number, height: number) {
  let w = width;
  let h = height;
  return {
    get width() {
      return w;
    },
    set width(value: number) {
      w = Math.trunc(value);
    },
    get height() {
      return h;
    },
    set height(value: number) {
      h = Math.trunc(value);
    },
  } as unknown as HTMLCanvasElement;
}

// a rounding canvas that counts the writes to its width and its height: each of them clears a
// canvas of the DOM
function makeCountingCanvas(width: number, height: number) {
  const canvas = makeRoundingCanvas(width, height);
  const writes = {count: 0};
  const counted = {
    get width() {
      return canvas.width;
    },
    set width(value: number) {
      writes.count += 1;
      canvas.width = value;
    },
    get height() {
      return canvas.height;
    },
    set height(value: number) {
      writes.count += 1;
      canvas.height = value;
    },
  } as unknown as HTMLCanvasElement;
  return {canvas: counted, writes};
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
    on(stage, OnCanvas2DStageDispose, disposed);
    on(stage, OnCanvas2DStageRender, rendered);

    stage.dispose();

    expect(disposed, 'the event goes out while the listeners are still attached').toHaveBeenCalledTimes(1);

    // straight into the emitter, past the guard in render(): the question here is whether anyone
    // is still subscribed, not whether the stage would emit
    emit(stage, OnCanvas2DStageRender, stage);

    expect(rendered, 'no event follows the dispose').not.toHaveBeenCalled();
  });

  test('emits OnCanvas2DStageResize before OnCanvas2DStageRender on the first render(), each with the stage', () => {
    const stage = makeStage();
    const log: [string, unknown][] = [];
    const listener: ICanvas2DStageResize & ICanvas2DStageRender = {
      [OnCanvas2DStageResize]: (s) => log.push([OnCanvas2DStageResize, s]),
      [OnCanvas2DStageRender]: (s) => log.push([OnCanvas2DStageRender, s]),
    };
    on(stage, listener);

    stage.render();

    expect(log).toEqual([
      ['resize', stage],
      ['render', stage],
    ]);

    stage.render();

    expect(log.slice(2), 'a second render() without a size change only renders').toEqual([['render', stage]]);
  });

  test('announces its dispose to a listener of ICanvas2DStageDispose with the stage', () => {
    const stage = makeStage();
    const heard = vi.fn();
    const listener: ICanvas2DStageDispose = {[OnCanvas2DStageDispose]: heard};
    on(stage, listener);

    stage.dispose();

    expect(heard).toHaveBeenCalledExactlyOnceWith(stage);
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

  test('the constructor refuses a fit it does not know with a TypeError, before anything is built', () => {
    const renderer = makeRenderer();

    for (const fit of ['fill', 5]) {
      const got = fit === 'fill' ? '"fill"' : '5';
      const failure = new TypeError(`new Canvas2DStage(): fit must be "contain" or "cover", got ${got}`);

      // the number arm throws before document.createElement(), which this suite has not got
      expect(() => new Canvas2DStage(renderer, 32, 16, fit as never)).toThrow(failure);
      expect(() => new Canvas2DStage(renderer, makeCanvas(), fit as never)).toThrow(failure);
    }

    expect(new Canvas2DStage(renderer, makeCanvas(), undefined as never).fit, 'undefined stands for the default').toBe('contain');
  });

  test('a write to fit refuses a value it does not know with a TypeError and keeps the fit it has, also after dispose()', () => {
    const stage = makeStage();
    stage.fit = 'cover';
    const failure = new TypeError('Canvas2DStage: fit must be "contain" or "cover", got "fill"');

    expect(() => {
      stage.fit = 'fill' as never;
    }).toThrow(failure);
    expect(stage.fit).toBe('cover');
    expect(stage.projection.viewSpecs.fit).toBe('cover');

    stage.dispose();

    expect(() => {
      stage.fit = 'fill' as never;
    }).toThrow(failure);
    expect(stage.fit).toBe('cover');
    expect(stage.projection.viewSpecs.fit).toBe('cover');
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

  describe('a canvas resized in place', () => {
    test('brings sprite and view to the new size before OnCanvas2DStageResize goes out', () => {
      const canvas = makeCanvas(64, 64);
      const stage = new Canvas2DStage(makeRenderer(), canvas);
      stage.render();
      const scaleAtResize: number[] = [];
      on(stage, OnCanvas2DStageResize, () => {
        scaleAtResize.push(stage.sprite.scale.x);
      });

      canvas.width = 48;
      canvas.height = 32;
      stage.render();

      expect(stage.sprite.scale.toArray()).toEqual([48, 32, 1]);
      expect(stage.projection.viewSpecs).toMatchObject({width: 48, height: 32});
      expect(scaleAtResize, 'a listener reads the new size already').toEqual([48]);
    });

    test('uploads no canvas without area, and keeps needsUpdate for the first render() with one', () => {
      const canvas = makeCanvas(32, 16);
      const stage = new Canvas2DStage(makeRenderer(), canvas);

      canvas.width = 0;
      stage.render();

      expect(stage.texture, 'no texture without area').toBeUndefined();
      expect(stage.needsUpdate).toBe(true);

      canvas.width = 32;
      stage.render();

      expect(stage.texture).toBeDefined();
      expect(stage.needsUpdate).toBe(false);
    });
  });

  describe('sizes', () => {
    test('the constructor refuses a width or a height that is no finite number of 1 or more', () => {
      expect(() => new Canvas2DStage(makeRenderer(), 0, 10)).toThrow(
        new RangeError('new Canvas2DStage(): width must be a finite number of 1 or more, got 0'),
      );
      expect(() => new Canvas2DStage(makeRenderer(), NaN, 10)).toThrow(
        new RangeError('new Canvas2DStage(): width must be a finite number of 1 or more, got NaN'),
      );
      expect(() => new Canvas2DStage(makeRenderer(), 10, -1)).toThrow(
        new RangeError('new Canvas2DStage(): height must be a finite number of 1 or more, got -1'),
      );
    });

    test('setCanvasSize() refuses a width that is no finite number of 1 or more, also after dispose()', () => {
      const stage = makeStage();
      const failure = new RangeError('Canvas2DStage#setCanvasSize(): width must be a finite number of 1 or more, got NaN');

      expect(() => stage.setCanvasSize(NaN, 10)).toThrow(failure);
      expect([stage.width, stage.height], 'the canvas keeps its size').toEqual([32, 16]);

      stage.dispose();

      expect(() => stage.setCanvasSize(NaN, 10)).toThrow(failure);
    });

    test('the constructor and setCanvasSize() refuse a width or a height below 1, which would leave a canvas without area', () => {
      expect(() => new Canvas2DStage(makeRenderer(), 0.5, 10)).toThrow(
        new RangeError('new Canvas2DStage(): width must be a finite number of 1 or more, got 0.5'),
      );
      expect(() => new Canvas2DStage(makeRenderer(), 10, 0.999)).toThrow(
        new RangeError('new Canvas2DStage(): height must be a finite number of 1 or more, got 0.999'),
      );

      const stage = makeStage();

      expect(() => stage.setCanvasSize(0.5, 10)).toThrow(
        new RangeError('Canvas2DStage#setCanvasSize(): width must be a finite number of 1 or more, got 0.5'),
      );
      expect(() => stage.setCanvasSize(10, 0.999)).toThrow(
        new RangeError('Canvas2DStage#setCanvasSize(): height must be a finite number of 1 or more, got 0.999'),
      );
      expect([stage.width, stage.height], 'the canvas keeps its size').toEqual([32, 16]);

      stage.dispose();

      expect(() => stage.setCanvasSize(0.5, 10)).toThrow(
        new RangeError('Canvas2DStage#setCanvasSize(): width must be a finite number of 1 or more, got 0.5'),
      );
    });

    test('takes a width of 1, and a fraction above it as the canvas rounds it down', () => {
      vi.stubGlobal('document', {createElement: () => makeRoundingCanvas(0, 0)});
      try {
        const built = new Canvas2DStage(makeRenderer(), 1.5, 1);

        expect([built.width, built.height]).toEqual([1, 1]);
        expect(built.sprite.scale.toArray()).toEqual([1, 1, 1]);
      } finally {
        vi.unstubAllGlobals();
      }

      const stage = new Canvas2DStage(makeRenderer(), makeRoundingCanvas(32, 16));
      stage.setCanvasSize(1, 1.5);

      expect([stage.width, stage.height]).toEqual([1, 1]);
      expect(stage.projection.viewSpecs).toMatchObject({width: 1, height: 1});
    });

    test('setCanvasSize() leaves a canvas of the size it is given, rounded down, as it is', () => {
      const {canvas, writes} = makeCountingCanvas(10, 8);
      const stage = new Canvas2DStage(makeRenderer(), canvas);

      stage.setCanvasSize(10.5, 8.9);

      expect(writes.count, 'a write would clear the canvas').toBe(0);
      expect([stage.width, stage.height]).toEqual([10, 8]);

      stage.setCanvasSize(12, 8);

      expect(writes.count).toBeGreaterThan(0);
      expect([stage.width, stage.height]).toEqual([12, 8]);
      expect(stage.sprite.scale.toArray()).toEqual([12, 8, 1]);
      expect(stage.projection.viewSpecs).toMatchObject({width: 12, height: 8});
    });

    test('setContainerSize() refuses a width or a height that is no finite number in its own name, also after dispose()', () => {
      const stage = makeStage();
      stage.setContainerSize(320, 240);
      const resize = sandbox.spy(stage.stageRenderer, 'resize');

      expect(() => stage.setContainerSize(NaN, 240)).toThrow(
        new RangeError('Canvas2DStage#setContainerSize(): width must be a finite number, got NaN'),
      );
      expect(() => stage.setContainerSize(320, Infinity)).toThrow(
        new RangeError('Canvas2DStage#setContainerSize(): height must be a finite number, got Infinity'),
      );
      expect(resize.called, 'the size does not reach the stage renderer').toBe(false);
      expect([stage.stageRenderer.width, stage.stageRenderer.height], 'the renderer keeps its size').toEqual([320, 240]);

      stage.dispose();

      expect(() => stage.setContainerSize(NaN, 240)).toThrow(
        new RangeError('Canvas2DStage#setContainerSize(): width must be a finite number, got NaN'),
      );
    });

    test('setContainerSize() hands a size of 0 and a negative one on to the stage renderer as they are', () => {
      const stage = makeStage();
      const resize = sandbox.stub(stage.stageRenderer, 'resize');

      stage.setContainerSize(0, 0);
      stage.setContainerSize(-320, 240);

      expect(resize.args).toEqual([
        [0, 0],
        [-320, 240],
      ]);
    });
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

    test('a listener of OnCanvas2DStageResize that throws: every listener hears it, the frame is drawn, the error comes out afterwards, and the next render() sends no second OnCanvas2DStageResize', () => {
      const stage = makeStage();
      const renderTo = sandbox.spy(stage.stageRenderer, 'renderTo');
      const boom = new Error('boom');
      const thrower = vi.fn(() => {
        throw boom;
      });
      const second = vi.fn();
      const rendered = vi.fn();
      on(stage, OnCanvas2DStageResize, thrower);
      on(stage, OnCanvas2DStageResize, second);
      on(stage, OnCanvas2DStageRender, rendered);

      expect(() => stage.render()).toThrow(boom);

      expect(second, 'the listener behind the one that throws').toHaveBeenCalledTimes(1);
      expect(rendered, 'the frame goes on').toHaveBeenCalledTimes(1);
      expect(renderTo.calledOnce, 'and is drawn').toBe(true);
      expect(stage.texture, 'the canvas is uploaded').toBeDefined();

      expect(() => stage.render()).not.toThrow();

      expect(thrower, 'no second resize for the same size').toHaveBeenCalledTimes(1);
      expect(second).toHaveBeenCalledTimes(1);
      expect(rendered).toHaveBeenCalledTimes(2);
    });

    test('a listener of OnCanvas2DStageResize and one of OnCanvas2DStageRender that throw come out together as an AggregateError', () => {
      const stage = makeStage();
      const resizeError = new Error('resize');
      const renderError = new Error('render');
      on(stage, OnCanvas2DStageResize, () => {
        throw resizeError;
      });
      on(stage, OnCanvas2DStageRender, () => {
        throw renderError;
      });

      let caught: unknown;
      try {
        stage.render();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect((caught as AggregateError).message).toMatch(/^Canvas2DStage#render\(\)/);
      expect((caught as AggregateError).errors).toEqual([resizeError, renderError]);
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

    // (b) a material set into the slot of the sprite belongs to the caller
    test('releases the sprite material it built, and leaves one set into the slot to the caller', () => {
      const stage = makeStage();
      const own = stage.sprite.material;
      const replacement = new SpriteMaterial();
      stage.sprite.material = replacement;
      const ownDispose = sandbox.spy(own, 'dispose');
      const replacementDispose = sandbox.spy(replacement, 'dispose');

      stage.render();

      expect(own.map, 'the canvas texture goes into the material of the stage').toBe(stage.texture);
      expect(replacement.map, 'and not into the one set into the slot').toBe(null);

      stage.dispose();

      expect(ownDispose.calledOnce, 'the material the stage built').toBe(true);
      expect(replacementDispose.called, 'the material of the caller').toBe(false);
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
      on(stage, OnCanvas2DStageDispose, () => {
        throw boom;
      });
      on(stage, OnCanvas2DStageDispose, heard);

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
      on(stage, OnCanvas2DStageDispose, () => {
        throw stageError;
      });
      on(stage.stageRenderer, OnStageDispose, () => {
        throw rendererError;
      });
      on(stage.stage, OnStageDispose, () => {
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

    test('hands on the error of each part as it was thrown: two listeners of the stage, and a listener and the release of the pass node of the Stage2D', () => {
      const stage = makeStage();
      stage.setContainerSize(320, 240);
      const first = new Error('first');
      const second = new Error('second');
      const stage2DError = new Error('Stage2D');
      const releaseFailure = new Error('the release failed');
      const passNode = stage.stage.asPassNode(stage.renderer) as PassNode;
      sandbox.stub(passNode, 'dispose').throws(releaseFailure);
      on(stage, OnCanvas2DStageDispose, () => {
        throw first;
      });
      on(stage, OnCanvas2DStageDispose, () => {
        throw second;
      });
      on(stage.stage, OnStageDispose, () => {
        throw stage2DError;
      });

      let caught: unknown;
      try {
        stage.dispose();
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect((caught as AggregateError).message).toMatch(/^Canvas2DStage#dispose\(\)/);
      const {errors} = caught as AggregateError;
      expect(errors).toHaveLength(2);
      expect(errors[0]).toBeInstanceOf(AggregateError);
      expect((errors[0] as AggregateError).errors).toEqual([first, second]);
      expect(errors[1]).toBeInstanceOf(AggregateError);
      expect((errors[1] as AggregateError).errors).toEqual([stage2DError, releaseFailure]);
      expect((errors[1] as AggregateError).message).toMatch(/^Stage2D#dispose\(\)/);
      expect(stage.stageRenderer.isDisposed).toBe(true);
      expect(stage.stage.isDisposed).toBe(true);
    });

    // (e) has no subject here: no class in this module creates a signal or an effect.

    // (f) has no subject here: this stage takes no slot from a pool and no tile from a factory.
  });
});

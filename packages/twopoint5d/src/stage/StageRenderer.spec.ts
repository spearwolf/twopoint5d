import {Color} from 'three/webgpu';
import {beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {OnAddToParent, OnRemoveFromParent, OnStageAdded, OnStageRemoved} from '../events.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import type {IStageRendererHost, StageRendererHostUnsubscribe} from './IStageRendererHost.js';
import {StageRenderer} from './StageRenderer.js';
import {on} from '@spearwolf/eventize';

interface RendererMock {
  autoClear: boolean;
  __clearColor: Color;
  __clearAlpha: number;
  setClearColor: Mock;
  getClearColor: Mock;
  setClearAlpha: Mock;
  getClearAlpha: Mock;
  clear: Mock;
  render: Mock;
}

function createRendererMock(): RendererMock {
  const m: RendererMock = {
    autoClear: true,
    __clearColor: new Color(0x111111),
    __clearAlpha: 0.5,
    setClearColor: vi.fn(),
    getClearColor: vi.fn(),
    setClearAlpha: vi.fn(),
    getClearAlpha: vi.fn(),
    clear: vi.fn(),
    render: vi.fn(),
  };
  m.setClearColor.mockImplementation((c: Color, a?: number) => {
    m.__clearColor.copy(c);
    if (typeof a === 'number') m.__clearAlpha = a;
  });
  m.getClearColor.mockImplementation((out: Color) => out.copy(m.__clearColor));
  m.setClearAlpha.mockImplementation((a: number) => {
    m.__clearAlpha = a;
  });
  m.getClearAlpha.mockImplementation(() => m.__clearAlpha);
  return m;
}

function fakeStage(name: string): IStage & IRenderable & {renderTo: Mock; resize: Mock; updateFrame: Mock} {
  return {
    name,
    resize: vi.fn(),
    updateFrame: vi.fn(),
    renderTo: vi.fn(),
  };
}

describe('StageRenderer', () => {
  let renderer: RendererMock;

  beforeEach(() => {
    renderer = createRendererMock();
  });

  describe('clear policy', () => {
    it('does not clear by default', () => {
      new StageRenderer().renderTo(renderer as any);
      expect(renderer.clear).not.toHaveBeenCalled();
    });

    it('clears once when clear=true with explicit color', () => {
      const sr = new StageRenderer();
      sr.setClearColor(new Color('#112233'), 0.25);
      sr.renderTo(renderer as any);
      expect(renderer.clear).toHaveBeenCalledTimes(1);
      expect(renderer.clear).toHaveBeenCalledWith(true, true, true);
      const callArgs = renderer.setClearColor.mock.calls[0];
      expect(callArgs[0]).toBeInstanceOf(Color);
      expect((callArgs[0] as Color).getHexString()).toBe('112233');
      expect(callArgs[1]).toBe(0.25);
    });

    it('clears with alpha only when clear=true and clearColor=null', () => {
      const sr = new StageRenderer();
      sr.clear = true;
      sr.clearAlpha = 0;
      sr.renderTo(renderer as any);
      expect(renderer.clear).toHaveBeenCalledTimes(1);
      expect(renderer.setClearColor).not.toHaveBeenCalled();
      expect(renderer.setClearAlpha).toHaveBeenCalledWith(0);
    });

    it('restores prior clear color and alpha after clearing', () => {
      const sr = new StageRenderer();
      sr.setClearColor(new Color('#aabbcc'), 1);
      renderer.__clearColor.set('#445566');
      renderer.__clearAlpha = 0.42;
      sr.renderTo(renderer as any);
      const restoreCall = renderer.setClearColor.mock.calls.at(-1)!;
      expect((restoreCall[0] as Color).getHexString()).toBe('445566');
      expect(restoreCall[1]).toBe(0.42);
    });

    it('does not touch renderer.setClearAlpha when clear=false', () => {
      new StageRenderer().renderTo(renderer as any);
      expect(renderer.setClearAlpha).not.toHaveBeenCalled();
      expect(renderer.setClearColor).not.toHaveBeenCalled();
    });

    it('setClearColor flips clear=true and is fluent', () => {
      const sr = new StageRenderer();
      expect(sr.clear).toBe(false);
      const ret = sr.setClearColor(new Color('#abcdef'));
      expect(ret).toBe(sr);
      expect(sr.clear).toBe(true);
    });

    it('assigning clearColor to a Color implicitly activates clear', () => {
      const sr = new StageRenderer();
      sr.clearColor = new Color('#ff00ff');
      expect(sr.clear).toBe(true);
    });

    it('assigning clearColor to null does not toggle clear off', () => {
      const sr = new StageRenderer();
      sr.clear = true;
      sr.clearColor = null;
      expect(sr.clear).toBe(true);
      expect(sr.clearColor).toBeNull();
    });

    it('honors clearColorBuffer / clearDepthBuffer / clearStencilBuffer flags', () => {
      const sr = new StageRenderer();
      sr.setClearColor(new Color('#000'));
      sr.clearColorBuffer = false;
      sr.clearStencilBuffer = false;
      sr.renderTo(renderer as any);
      expect(renderer.clear).toHaveBeenCalledWith(false, true, false);
    });
  });

  describe('rendering', () => {
    it('delegates to each stage.renderTo() in renderOrder', () => {
      const sr = new StageRenderer();
      const a = fakeStage('a');
      const b = fakeStage('b');
      sr.add(a).add(b);
      sr.renderTo(renderer as any);
      expect(a.renderTo).toHaveBeenCalledTimes(1);
      expect(b.renderTo).toHaveBeenCalledTimes(1);
      const callOrderA = a.renderTo.mock.invocationCallOrder[0];
      const callOrderB = b.renderTo.mock.invocationCallOrder[0];
      expect(callOrderA).toBeLessThan(callOrderB);
    });

    it('forces renderer.autoClear = false while iterating stages', () => {
      renderer.autoClear = true;
      const sr = new StageRenderer();
      const stage = fakeStage('s');
      stage.renderTo.mockImplementation(() => {
        expect(renderer.autoClear).toBe(false);
      });
      sr.add(stage).renderTo(renderer as any);
      expect(renderer.autoClear).toBe(true);
    });

    it('respects renderOrder', () => {
      const sr = new StageRenderer();
      const ui = fakeStage('ui');
      const world = fakeStage('world');
      const debug = fakeStage('debug');
      sr.add(ui).add(world).add(debug);
      sr.renderOrder = 'world,*,debug';
      sr.renderTo(renderer as any);
      const order = [world, ui, debug].map((s) => s.renderTo.mock.invocationCallOrder[0]);
      expect(order[0]).toBeLessThan(order[1]);
      expect(order[1]).toBeLessThan(order[2]);
    });
  });

  describe('add / remove', () => {
    it('is fluent and emits OnStageAdded / OnStageRemoved', () => {
      const sr = new StageRenderer();
      const added = vi.fn();
      const removed = vi.fn();
      on(sr, OnStageAdded, added);
      on(sr, OnStageRemoved, removed);
      const stage = fakeStage('one');
      expect(sr.add(stage)).toBe(sr);
      expect(added).toHaveBeenCalledWith({stage, renderer: sr});
      expect(sr.remove(stage)).toBe(sr);
      expect(removed).toHaveBeenCalledWith({stage, renderer: sr});
    });

    it('add() is idempotent', () => {
      const sr = new StageRenderer();
      const stage = fakeStage('x');
      sr.add(stage);
      sr.add(stage);
      expect(sr.stages.length).toBe(1);
    });

    it('warns on duplicate name when renderOrder is non-default', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sr = new StageRenderer();
      sr.renderOrder = 'a,b';
      sr.add(fakeStage('a'));
      sr.add(fakeStage('a'));
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('does NOT warn on duplicate name when renderOrder is default "*"', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sr = new StageRenderer();
      sr.add(fakeStage('a'));
      sr.add(fakeStage('a'));
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('propagates resize() to stages', () => {
      const sr = new StageRenderer();
      const stage = fakeStage('x');
      sr.add(stage);
      sr.resize(320, 240);
      expect(stage.resize).toHaveBeenLastCalledWith(320, 240);
    });
  });

  describe('parent / host wiring (3.7)', () => {
    function makeHost(): IStageRendererHost & {
      _emitResize: (w: number, h: number) => void;
      _emitFrame: (now: number, dt: number, frame: number) => void;
      _unsubs: number;
    } {
      let resizeHandler: any;
      let frameHandler: any;
      let unsubs = 0;
      const unsub: StageRendererHostUnsubscribe = () => {
        unsubs += 1;
      };
      return {
        onResize: (h) => {
          resizeHandler = h;
          return unsub;
        },
        onRenderFrame: (h) => {
          frameHandler = h;
          return unsub;
        },
        _emitResize(w, h) {
          resizeHandler({width: w, height: h, renderer, now: 0, deltaTime: 0, frameNo: 1});
        },
        _emitFrame(now, dt, frameNo) {
          frameHandler({renderer, now, deltaTime: dt, frameNo});
        },
        get _unsubs() {
          return unsubs;
        },
      };
    }

    it('auto-drives resize + updateFrame + renderTo via a custom host', () => {
      const host = makeHost();
      const sr = new StageRenderer(host);
      const stage = fakeStage('s');
      sr.add(stage);
      host._emitResize(100, 50);
      expect(sr.width).toBe(100);
      expect(stage.resize).toHaveBeenCalledWith(100, 50);
      host._emitFrame(1, 0.016, 1);
      expect(stage.updateFrame).toHaveBeenCalledWith(1, 0.016, 1);
      expect(stage.renderTo).toHaveBeenCalledTimes(1);
    });

    it('attach() returns this and detach() unsubscribes', () => {
      const host = makeHost();
      const sr = new StageRenderer();
      expect(sr.attach(host)).toBe(sr);
      expect(host._unsubs).toBe(0);
      sr.detach();
      expect(host._unsubs).toBe(2);
    });

    it('nesting: child StageRenderer is added as a stage of the parent', () => {
      const parent = new StageRenderer();
      const child = new StageRenderer(parent);
      expect(parent.hasStage(child)).toBe(true);
      const inner = fakeStage('inner');
      child.add(inner);
      parent.renderTo(renderer as any);
      expect(inner.renderTo).toHaveBeenCalledTimes(1);
    });

    it('emits OnAddToParent and OnRemoveFromParent on the child', () => {
      const host = makeHost();
      const sr = new StageRenderer();
      const added = vi.fn();
      const removed = vi.fn();
      on(sr, OnAddToParent, added);
      on(sr, OnRemoveFromParent, removed);
      sr.attach(host);
      expect(added).toHaveBeenCalledTimes(1);
      sr.detach();
      expect(removed).toHaveBeenCalledTimes(1);
    });
  });
});

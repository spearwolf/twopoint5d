import BloomNode from 'three/examples/jsm/tsl/display/BloomNode.js';
import {createSandbox} from 'sinon';
import {
  ACESFilmicToneMapping,
  Color,
  ColorManagement,
  FloatType,
  type Node,
  NoToneMapping,
  PerspectiveCamera,
  RenderTarget,
  Scene,
  SRGBColorSpace,
  type ColorSpace,
  type ToneMapping,
} from 'three/webgpu';
import {afterEach, beforeEach, describe, expect, it, vi, type Mock} from 'vitest';
import {type IStageDispose, OnAddToParent, OnRemoveFromParent, OnStageAdded, OnStageDispose, OnStageRemoved} from '../events.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';
import type {IStageRendererHost, StageRendererHostUnsubscribe} from './IStageRendererHost.js';
import {createBloomOutputNodeBuilder} from './outputNodeBuilders.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {RootRenderPipeline} from './RootRenderPipeline.js';
import {Stage2D} from './Stage2D.js';
import {StageRenderer} from './StageRenderer.js';
import {StageRenderTargetPool} from './StageRenderTargetPool.js';
import {getSubscriptionCount, on} from '@spearwolf/eventize';

// the BloomNodes reachable from `root`, found through Node#getChildren()
function findBlooms(root: Node): BloomNode[] {
  const seen = new Set<Node>();
  const blooms: BloomNode[] = [];
  const visit = (node: Node) => {
    if (seen.has(node)) return;
    seen.add(node);
    if (node instanceof BloomNode) blooms.push(node);
    for (const child of node.getChildren()) visit(child);
  };
  visit(root);
  return blooms;
}

interface RendererMock {
  autoClear: boolean;
  __clearColor: Color;
  __clearAlpha: number;
  __renderTarget: unknown;
  setClearColor: Mock;
  getClearColor: Mock;
  setClearAlpha: Mock;
  getClearAlpha: Mock;
  clear: Mock;
  render: Mock;
  setRenderTarget: Mock;
  getRenderTarget: Mock;
  getPixelRatio: Mock;
  samples: number;
  getOutputBufferType: Mock;
  toneMapping: ToneMapping;
  outputColorSpace: ColorSpace;
}

function createRendererMock(): RendererMock {
  const m: RendererMock = {
    autoClear: true,
    __clearColor: new Color(0x111111),
    __clearAlpha: 0.5,
    __renderTarget: null,
    setClearColor: vi.fn(),
    getClearColor: vi.fn(),
    setClearAlpha: vi.fn(),
    getClearAlpha: vi.fn(),
    clear: vi.fn(),
    render: vi.fn(),
    setRenderTarget: vi.fn(),
    getRenderTarget: vi.fn(),
    getPixelRatio: vi.fn(() => 1),
    samples: 4,
    // not the three.js default: the type of the internal targets has to come from the renderer
    getOutputBufferType: vi.fn(() => FloatType),
    toneMapping: ACESFilmicToneMapping,
    outputColorSpace: SRGBColorSpace,
  };
  m.setRenderTarget.mockImplementation((rt) => {
    m.__renderTarget = rt;
  });
  m.getRenderTarget.mockImplementation(() => m.__renderTarget);
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

// the very error the call threw, for an identity check that toThrow() does not make
function thrownBy(call: () => unknown): unknown {
  try {
    call();
  } catch (error) {
    return error;
  }
  throw new Error('the call threw nothing');
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

  // failures: onResize and onRenderFrame make the host throw that error before it takes a
  // handler; unsubscribeResize and unsubscribeFrame make the unsubscribe of that event
  // count the call and throw, and the host keeps its handler
  function makeHost(
    failures: {onResize?: Error; onRenderFrame?: Error; unsubscribeResize?: Error; unsubscribeFrame?: Error} = {},
  ): IStageRendererHost & {
    _emitResize: (w: number, h: number) => void;
    _emitFrame: (now: number, dt: number, frame: number) => void;
    _unsubs: number;
  } {
    let resizeHandler: any;
    let frameHandler: any;
    let unsubs = 0;
    // an honest unsubscribe: the host drops the handler, so a later event reaches nobody.
    // Counting the calls alone would let a renderer that never unsubscribed pass unnoticed.
    const makeUnsub = (forget: () => void, failure?: Error): StageRendererHostUnsubscribe => {
      return () => {
        unsubs += 1;
        if (failure) throw failure;
        forget();
      };
    };
    return {
      onResize: (h) => {
        if (failures.onResize) throw failures.onResize;
        resizeHandler = h;
        return makeUnsub(() => {
          resizeHandler = undefined;
        }, failures.unsubscribeResize);
      },
      onRenderFrame: (h) => {
        if (failures.onRenderFrame) throw failures.onRenderFrame;
        frameHandler = h;
        return makeUnsub(() => {
          frameHandler = undefined;
        }, failures.unsubscribeFrame);
      },
      _emitResize(w, h) {
        resizeHandler?.({width: w, height: h, renderer, now: 0, deltaTime: 0, frameNo: 1});
      },
      _emitFrame(now, dt, frameNo) {
        frameHandler?.({renderer, now, deltaTime: dt, frameNo});
      },
      get _unsubs() {
        return unsubs;
      },
    };
  }

  type LogEntry =
    | {kind: 'clear'; target: unknown; color: number; alpha: number; args: unknown[]}
    | {kind: 'draw'; target: unknown}
    | {kind: 'pipeline'; target: unknown};

  // every clear with the target and the clear state it hit, and every draw of the given stages
  function logClearsAndDraws(...stages: {renderTo: Mock}[]): LogEntry[] {
    const log: LogEntry[] = [];
    renderer.clear.mockImplementation((...args: unknown[]) =>
      log.push({
        kind: 'clear',
        target: renderer.__renderTarget,
        color: renderer.__clearColor.getHex(),
        alpha: renderer.__clearAlpha,
        args,
      }),
    );
    for (const stage of stages) {
      stage.renderTo.mockImplementation(() => log.push({kind: 'draw', target: renderer.__renderTarget}));
    }
    return log;
  }

  function makePipelineMock() {
    return {outputNode: undefined as unknown, needsUpdate: false, render: vi.fn(), dispose: vi.fn()};
  }

  function fakeRootPipeline() {
    const pipeline = makePipelineMock();
    Object.setPrototypeOf(pipeline, RootRenderPipeline.prototype);
    return pipeline;
  }

  function clearsBeforeFirstDraw(log: LogEntry[]): {draw: LogEntry; clears: LogEntry[]} {
    const drawIndex = log.findIndex((entry) => entry.kind === 'draw');
    expect(drawIndex, 'a stage is drawn').toBeGreaterThanOrEqual(0);
    return {draw: log[drawIndex]!, clears: log.slice(0, drawIndex).filter((entry) => entry.kind === 'clear')};
  }

  describe('clear policy', () => {
    it('clears nothing with clear = false, not even through the autoClear of the renderer', () => {
      renderer.autoClear = true;
      const sr = new StageRenderer();
      const a = fakeStage('a');
      const b = fakeStage('b');
      for (const stage of [a, b]) {
        stage.renderTo.mockImplementation(() => {
          expect(renderer.autoClear, `autoClear while ${stage.name} draws`).toBe(false);
        });
      }
      sr.add(a)
        .add(b)
        .renderTo(renderer as any);

      expect(a.renderTo).toHaveBeenCalledTimes(1);
      expect(b.renderTo).toHaveBeenCalledTimes(1);
      expect(renderer.clear).not.toHaveBeenCalled();
      expect(renderer.autoClear, 'autoClear restored').toBe(true);
    });

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
      const callArgs = renderer.setClearColor.mock.calls[0]!;
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
    it('answers the render order as an array on the first read', () => {
      const sr = new StageRenderer();
      expect(sr.renderOrderArray).toEqual(['*']);
    });

    it('delegates to each stage.renderTo() in renderOrder', () => {
      const sr = new StageRenderer();
      const a = fakeStage('a');
      const b = fakeStage('b');
      sr.add(a).add(b);
      sr.renderTo(renderer as any);
      expect(a.renderTo).toHaveBeenCalledTimes(1);
      expect(b.renderTo).toHaveBeenCalledTimes(1);
      const callOrderA = a.renderTo.mock.invocationCallOrder[0]!;
      const callOrderB = b.renderTo.mock.invocationCallOrder[0]!;
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
      expect(order[0]!).toBeLessThan(order[1]!);
      expect(order[1]!).toBeLessThan(order[2]!);
    });

    it('restores autoClear when a stage throws', () => {
      renderer.autoClear = true;
      const sr = new StageRenderer();
      const stage = fakeStage('s');
      stage.renderTo.mockImplementation(() => {
        throw new Error('stage failed');
      });
      sr.add(stage);
      expect(() => sr.renderTo(renderer as any)).toThrow('stage failed');
      expect(renderer.autoClear).toBe(true);
    });

    it('restores autoClear and the render target when a stage throws in the pipeline path', () => {
      renderer.autoClear = true;
      const before = {tag: 'screen'};
      renderer.__renderTarget = before;
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const stage = fakeStage('s');
      stage.renderTo.mockImplementation(() => {
        throw new Error('stage failed');
      });
      sr.add(stage);
      sr.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
      expect(() => sr.renderTo(renderer as any)).toThrow('stage failed');
      expect(renderer.autoClear).toBe(true);
      expect(renderer.__renderTarget).toBe(before);
      expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
      expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
    });

    it('restores the render state when a nested renderer throws while the composed mode pre-renders it', () => {
      renderer.autoClear = true;
      const before = {tag: 'screen'};
      renderer.__renderTarget = before;
      const parent = new StageRenderer();
      parent.resize(100, 100);
      const child = new StageRenderer();
      parent.add(child);
      const stage = fakeStage('s');
      stage.renderTo.mockImplementation(() => {
        throw new Error('stage failed');
      });
      child.add(stage);
      parent.buildOutputNode = (passes) => passes[0]!;
      parent.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;

      expect(() => parent.renderTo(renderer as any)).toThrow('stage failed');
      expect(renderer.autoClear).toBe(true);
      expect(renderer.__renderTarget).toBe(before);
      expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
      expect(renderer.outputColorSpace).toBe(SRGBColorSpace);
    });

    it('renders every stage of a listed name, in the order they were added', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sr = new StageRenderer();
      const a = fakeStage('a');
      const a2 = fakeStage('a');
      const b = fakeStage('b');
      sr.add(a).add(a2).add(b);
      sr.renderOrder = 'b,a';
      sr.renderTo(renderer as any);
      warn.mockRestore();

      for (const s of [a, a2, b]) expect(s.renderTo).toHaveBeenCalledTimes(1);
      const order = [b, a, a2].map((s) => s.renderTo.mock.invocationCallOrder[0]!);
      expect(order[0]).toBeLessThan(order[1]!);
      expect(order[1]).toBeLessThan(order[2]!);
    });

    it('places a name or wildcard listed twice once', () => {
      const sr = new StageRenderer();
      const stages = [fakeStage('a'), fakeStage('b'), fakeStage('c')];
      for (const stage of stages) sr.add(stage);
      sr.renderOrder = 'a,*,a,*';
      sr.renderTo(renderer as any);
      for (const stage of stages) expect(stage.renderTo, stage.name).toHaveBeenCalledTimes(1);
    });

    it('sorts a stage renamed after add() under its new name', () => {
      const sr = new StageRenderer();
      const a = fakeStage('a');
      const b = fakeStage('b');
      sr.add(a).add(b);
      sr.renderOrder = 'b,c';
      sr.renderTo(renderer as any);
      expect(a.renderTo).not.toHaveBeenCalled();
      expect(b.renderTo).toHaveBeenCalledTimes(1);

      a.name = 'c';
      sr.renderTo(renderer as any);
      expect(a.renderTo).toHaveBeenCalledTimes(1);
      expect(b.renderTo).toHaveBeenCalledTimes(2);
      expect(b.renderTo.mock.invocationCallOrder[1]!).toBeLessThan(a.renderTo.mock.invocationCallOrder[0]!);
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

    it('warns about a shared name when renderOrder is set after the stages', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sr = new StageRenderer();
      sr.add(fakeStage('a'));
      sr.add(fakeStage('a'));
      sr.renderOrder = 'a,b';
      expect(warn).toHaveBeenCalledTimes(1);
      warn.mockRestore();
    });

    it('does not warn about a shared name while renderOrder lists no name', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      for (const order of ['*,*', ' * ', ',']) {
        const early = new StageRenderer();
        early.renderOrder = order;
        early.add(fakeStage('a')).add(fakeStage('a'));

        const late = new StageRenderer();
        late.add(fakeStage('a')).add(fakeStage('a'));
        late.renderOrder = order;
      }
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('does not warn about a shared name that renderOrder does not list', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sr = new StageRenderer();
      sr.renderOrder = 'ui,*';
      sr.add(fakeStage('ui')).add(fakeStage('bg')).add(fakeStage('bg'));
      sr.renderOrder = 'ui';
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('warns about a shared name that renderOrder lists between blanks', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const sr = new StageRenderer();
      sr.renderOrder = ' a , * ';
      sr.add(fakeStage('a')).add(fakeStage('a'));
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

    it('leaves the renderer the size it had when a stage refuses it', () => {
      const sr = new StageRenderer();
      const stage1 = fakeStage('a');
      const stage2 = fakeStage('b');
      stage2.resize.mockImplementation(() => {
        throw new Error('stage refused the size');
      });
      sr.add(stage1).add(stage2);

      expect(() => sr.resize(320, 240)).toThrow('stage refused the size');

      expect(sr.width, 'the renderer keeps the size its stages took').toBe(0);
      expect(sr.height).toBe(0);

      stage2.resize.mockImplementation(() => {});
      sr.resize(320, 240);

      expect(stage2.resize).toHaveBeenLastCalledWith(320, 240);
      expect(sr.width).toBe(320);
      expect(sr.height).toBe(240);
    });

    it('asks every stage for its size even when one of them refuses', () => {
      const sr = new StageRenderer();
      const stage1 = fakeStage('a');
      const stage2 = fakeStage('b');
      const stage3 = fakeStage('c');
      stage2.resize.mockImplementation(() => {
        throw new Error('stage refused the size');
      });
      sr.add(stage1).add(stage2).add(stage3);

      expect(() => sr.resize(320, 240)).toThrow('stage refused the size');

      expect(stage1.resize).toHaveBeenLastCalledWith(320, 240);
      expect(stage3.resize).toHaveBeenLastCalledWith(320, 240);
    });

    it('asks a stage for the size the renderer fell back to', () => {
      const sr = new StageRenderer();
      const stage1 = fakeStage('a');
      const stage2 = fakeStage('b');
      stage2.resize.mockImplementation(() => {
        throw new Error('stage refused the size');
      });
      sr.add(stage1).add(stage2);

      expect(() => sr.resize(320, 240)).toThrow('stage refused the size');
      expect(stage1.resize, 'the first stage took the size').toHaveBeenLastCalledWith(320, 240);

      sr.resize(0, 0);

      expect(stage1.resize, 'and gives it up for the size the renderer carries').toHaveBeenLastCalledWith(0, 0);
      expect(sr.width).toBe(0);
      expect(sr.height).toBe(0);
    });

    it('several stages that refuse the size come out as one AggregateError in the order they were added', () => {
      const sr = new StageRenderer();
      const a = fakeStage('a');
      const b = fakeStage('b');
      const c = fakeStage('c');
      sr.add(a).add(b).add(c);
      // the order they draw in is not the order they are asked in
      sr.renderOrder = 'c,b,a';
      const errA = new Error('a refused the size');
      const errC = new Error('c refused the size');
      a.resize.mockImplementation(() => {
        throw errA;
      });
      c.resize.mockImplementation(() => {
        throw errC;
      });

      const caught = thrownBy(() => sr.resize(320, 240));

      expect(caught).toBeInstanceOf(AggregateError);
      const {errors, message} = caught as AggregateError;
      expect(errors).toHaveLength(2);
      expect(errors[0]).toBe(errA);
      expect(errors[1]).toBe(errC);
      expect(message).toBe('StageRenderer#resize(): 2 of 3 stages refused the size 320x240');
      expect([sr.width, sr.height], 'the renderer keeps the size it had').toEqual([0, 0]);

      for (const stage of [a, b, c]) stage.resize.mockReset();
      sr.resize(320, 240);

      expect(a.resize).toHaveBeenCalledExactlyOnceWith(320, 240);
      expect(c.resize).toHaveBeenCalledExactlyOnceWith(320, 240);
      expect(b.resize, 'b took the size in the first call').not.toHaveBeenCalled();
    });

    it('adds no stage that refuses the size', () => {
      const sr = new StageRenderer();
      sr.resize(320, 240);
      const added = vi.fn();
      on(sr, OnStageAdded, added);
      const refusal = new Error('stage refused the size');

      const stage = fakeStage('a');
      stage.resize.mockImplementation(() => {
        throw refusal;
      });

      expect(thrownBy(() => sr.add(stage))).toBe(refusal);
      expect(sr.hasStage(stage)).toBe(false);

      // an eventized stage keeps no listener of a renderer that did not take it
      const stage2D = new Stage2D();
      vi.spyOn(stage2D, 'resize').mockImplementation(() => {
        throw refusal;
      });
      const before = getSubscriptionCount(stage2D);

      expect(thrownBy(() => sr.add(stage2D))).toBe(refusal);
      expect(sr.hasStage(stage2D)).toBe(false);
      expect(getSubscriptionCount(stage2D)).toBe(before);

      expect(added).not.toHaveBeenCalled();
    });

    it('adds no renderer that refuses the size and leaves it with its host', () => {
      const host = makeHost();
      const child = new StageRenderer(host);
      const refusing = fakeStage('refusing');
      child.add(refusing);
      const refusal = new Error('stage refused the size');
      refusing.resize.mockImplementation(() => {
        throw refusal;
      });
      const root = new StageRenderer();
      root.resize(320, 240);

      expect(thrownBy(() => root.add(child))).toBe(refusal);

      expect(child.parent).toBe(host);
      expect(host._unsubs, 'the host still drives the child').toBe(0);
      expect(root.hasStage(child)).toBe(false);
    });

    it('refuses a stage that has been disposed', () => {
      const sr = new StageRenderer();
      const refused = /StageRenderer#add\(\) cannot take the stage .*: that stage has been disposed/;

      const stage = new Stage2D();
      stage.dispose();
      expect(() => sr.add(stage)).toThrow(refused);
      expect(sr.hasStage(stage)).toBe(false);

      const child = new StageRenderer();
      child.dispose();
      expect(() => sr.add(child)).toThrow(refused);
      expect(sr.hasStage(child)).toBe(false);
    });

    it('lets go of a Stage2D that is disposed while it holds it', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const removed = vi.fn();
      on(sr, OnStageRemoved, removed);
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 100}));
      const other = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 100}));
      sr.add(stage).add(other);
      const buildOutputNode = vi.fn((passes: any[]) => passes[0]);
      sr.buildOutputNode = buildOutputNode;
      sr.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
      sr.renderTo(renderer as any);
      expect(buildOutputNode.mock.calls[0]![0]).toHaveLength(2);

      stage.dispose();

      expect(sr.hasStage(stage)).toBe(false);
      expect(removed).toHaveBeenCalledExactlyOnceWith({stage, renderer: sr});

      expect(() => sr.renderTo(renderer as any)).not.toThrow();
      expect(buildOutputNode).toHaveBeenCalledTimes(2);
      expect(buildOutputNode.mock.calls[1]![0]).toEqual([other.asPassNode(renderer as any)]);
    });

    it('lets go of a Stage2D that is disposed in every renderer that holds it', () => {
      // each renderer unsubscribes its own dispose listener from within the dispose event
      const first = new StageRenderer();
      const second = new StageRenderer();
      const stage = new Stage2D();
      first.add(stage);
      second.add(stage);

      stage.dispose();

      expect(first.hasStage(stage)).toBe(false);
      expect(second.hasStage(stage)).toBe(false);
    });

    it('lets go of a Stage2D that is disposed even behind a dispose listener that throws', () => {
      const first = new StageRenderer();
      const second = new StageRenderer();
      const stage = new Stage2D();
      const failure = new Error('the listener failed');
      // ahead of both renderers: their own listeners come after it
      on(stage, OnStageDispose, () => {
        throw failure;
      });
      first.add(stage);
      second.add(stage);

      expect(thrownBy(() => stage.dispose())).toBe(failure);

      expect(first.hasStage(stage)).toBe(false);
      expect(second.hasStage(stage)).toBe(false);
    });

    for (const order of ['*', 'a,b,c']) {
      describe(`with renderOrder = ${JSON.stringify(order)}`, () => {
        function makeStages() {
          const sr = new StageRenderer();
          sr.renderOrder = order;
          const a = fakeStage('a');
          const b = fakeStage('b');
          const c = fakeStage('c');
          return {sr, a, b, c};
        }

        it('a stage removed during updateFrame() does not keep the next one from its updateFrame()', () => {
          const {sr, a, b, c} = makeStages();
          sr.add(a).add(b).add(c);
          a.updateFrame.mockImplementation(() => sr.remove(a));

          sr.updateFrame(1, 0.016, 1);

          expect(a.updateFrame, 'the removed stage has its call').toHaveBeenCalledTimes(1);
          expect(b.updateFrame).toHaveBeenCalledTimes(1);
          expect(c.updateFrame).toHaveBeenCalledTimes(1);

          sr.renderTo(renderer as any);

          expect(a.renderTo, 'and is not drawn').not.toHaveBeenCalled();
          expect(b.renderTo).toHaveBeenCalledTimes(1);
          expect(c.renderTo).toHaveBeenCalledTimes(1);
        });

        it('a stage added during updateFrame() updates from the next frame on', () => {
          const {sr, a, b, c} = makeStages();
          sr.add(a).add(b);
          a.updateFrame.mockImplementationOnce(() => sr.add(c));

          sr.updateFrame(1, 0.016, 1);

          expect(c.updateFrame, 'no call in the frame it was added in').not.toHaveBeenCalled();

          sr.renderTo(renderer as any);
          expect(c.renderTo, 'drawn by the renderTo() of that frame').toHaveBeenCalledTimes(1);

          sr.updateFrame(2, 0.016, 2);
          expect(c.updateFrame).toHaveBeenCalledExactlyOnceWith(2, 0.016, 2);
        });

        it('a stage removed during resize() does not keep the next one from the size', () => {
          const {sr, a, b, c} = makeStages();
          sr.add(a).add(b).add(c);
          a.resize.mockImplementation(() => sr.remove(a));

          sr.resize(320, 240);

          expect(a.resize).toHaveBeenCalledExactlyOnceWith(320, 240);
          expect(b.resize).toHaveBeenCalledExactlyOnceWith(320, 240);
          expect(c.resize).toHaveBeenCalledExactlyOnceWith(320, 240);
        });
      });
    }

    it('orderedStages hands out the same array until the stages change', () => {
      const sr = new StageRenderer();
      const a = fakeStage('a');
      const b = fakeStage('b');
      const c = fakeStage('c');
      sr.add(a).add(b);

      const first = sr.orderedStages;
      expect(sr.orderedStages).toBe(first);

      sr.add(c);
      const next = sr.orderedStages;

      expect(next).not.toBe(first);
      expect(next.map((item) => item.stage)).toEqual([a, b, c]);
      expect(
        first.map((item) => item.stage),
        'the array handed out before stays as it was',
      ).toEqual([a, b]);
    });

    it("a rename leaves the output node standing while renderOrder is '*'", () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const passNode = {isNode: true, label: 'a', type: 'pass'};
      const stage = {...fakeStage('a'), asPassNode: vi.fn(() => passNode)};
      sr.add(stage as any);
      const buildOutputNode = vi.fn((passes: any[]) => passes[0]);
      sr.buildOutputNode = buildOutputNode;
      const pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()};
      sr.pipeline = pipeline as any;
      sr.renderTo(renderer as any);
      pipeline.needsUpdate = false;

      stage.name = 'renamed';
      sr.renderTo(renderer as any);

      expect(pipeline.needsUpdate).toBe(false);
      expect(buildOutputNode).toHaveBeenCalledTimes(1);
    });

    it('renderOrderArray hands out a copy', () => {
      const sr = new StageRenderer();
      sr.renderOrder = 'a,b';
      const x = fakeStage('x');
      sr.add(fakeStage('a')).add(fakeStage('b')).add(x);

      sr.renderOrderArray.push('x');

      expect(sr.renderOrderArray).toEqual(['a', 'b']);
      sr.renderTo(renderer as any);
      expect(x.renderTo, 'the order is the one renderOrder names').not.toHaveBeenCalled();
    });

    describe('listeners that throw or dispose', () => {
      const sandbox = createSandbox();

      afterEach(() => {
        sandbox.restore();
      });

      it('remove() lets go of both sides of a child behind an OnStageRemoved listener that throws', () => {
        const parent = new StageRenderer();
        const child = new StageRenderer(parent);
        child.resize(50, 50);
        const passTarget = (child.asPassNode(renderer as any) as any).value.renderTarget;
        const failure = new Error('the listener failed');
        on(parent, OnStageRemoved, () => {
          throw failure;
        });
        const heard = vi.fn();
        on(parent, OnStageRemoved, heard);
        const left = vi.fn();
        on(child, OnRemoveFromParent, left);
        const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');

        expect(thrownBy(() => parent.remove(child))).toBe(failure);

        expect(heard).toHaveBeenCalledTimes(1);
        expect(left).toHaveBeenCalledTimes(1);
        expect(child.parent).toBeUndefined();
        expect(parent.hasStage(child)).toBe(false);
        expect(rtDispose.calledOn(passTarget)).toBe(true);
      });

      it('remove() hands on the errors of OnStageRemoved and of OnRemoveFromParent at the child as an AggregateError', () => {
        const parent = new StageRenderer();
        const child = new StageRenderer(parent);
        const e1 = new Error('removed');
        const e2 = new Error('left');
        on(parent, OnStageRemoved, () => {
          throw e1;
        });
        on(child, OnRemoveFromParent, () => {
          throw e2;
        });

        const error = thrownBy(() => parent.remove(child)) as AggregateError;

        expect(error).toBeInstanceOf(AggregateError);
        expect(error.message).toBe(
          'StageRenderer#remove(): more than one listener of OnStageRemoved and OnRemoveFromParent threw',
        );
        expect(error.errors).toHaveLength(2);
        expect(error.errors[0]).toBe(e1);
        expect(error.errors[1]).toBe(e2);
      });

      it('add() gives an added child its OnAddToParent behind an OnStageAdded listener that throws', () => {
        const root = new StageRenderer();
        const child = new StageRenderer();
        const failure = new Error('the listener failed');
        on(root, OnStageAdded, () => {
          throw failure;
        });
        const heard = vi.fn();
        on(root, OnStageAdded, heard);
        const joined = vi.fn();
        on(child, OnAddToParent, joined);

        expect(thrownBy(() => root.add(child))).toBe(failure);

        expect(heard).toHaveBeenCalledTimes(1);
        expect(joined).toHaveBeenCalledTimes(1);
        expect(child.parent).toBe(root);
        expect(root.hasStage(child)).toBe(true);
      });

      it('add() moves a child whose OnRemoveFromParent listener throws out of its previous holder and in', () => {
        const a = new StageRenderer();
        const b = new StageRenderer();
        const child = new StageRenderer(a);
        const failure = new Error('the listener failed');
        on(child, OnRemoveFromParent, () => {
          throw failure;
        });
        const joined = vi.fn();
        on(child, OnAddToParent, joined);

        expect(thrownBy(() => b.add(child))).toBe(failure);

        expect(a.hasStage(child)).toBe(false);
        expect(b.hasStage(child)).toBe(true);
        expect(child.parent).toBe(b);
        expect(joined).toHaveBeenCalledTimes(1);
      });

      it('add() hands on the errors of OnStageAdded and of OnAddToParent at the child as an AggregateError', () => {
        const root = new StageRenderer();
        const child = new StageRenderer();
        const e1 = new Error('added');
        const e2 = new Error('joined');
        on(root, OnStageAdded, () => {
          throw e1;
        });
        on(child, OnAddToParent, () => {
          throw e2;
        });

        const error = thrownBy(() => root.add(child)) as AggregateError;

        expect(error).toBeInstanceOf(AggregateError);
        expect(error.message).toBe(
          'StageRenderer#add(): more than one listener of OnRemoveFromParent, OnStageRemoved, OnStageAdded and OnAddToParent or unsubscribe of the previous host threw',
        );
        expect(error.errors).toHaveLength(2);
        expect(error.errors[0]).toBe(e1);
        expect(error.errors[1]).toBe(e2);
      });

      it('add() leaves out a child that a listener disposes while it leaves its previous holder', () => {
        const a = new StageRenderer();
        const b = new StageRenderer();
        const child = new StageRenderer(a);
        on(child, OnRemoveFromParent, () => child.dispose());

        expect(() => b.add(child)).not.toThrow();

        expect(b.hasStage(child)).toBe(false);
        expect(a.hasStage(child)).toBe(false);
        expect(child.parent).toBeUndefined();
        expect(child.isDisposed).toBe(true);
      });

      it('add() takes no child into a renderer that a listener disposes while the child leaves its previous holder', () => {
        const a = new StageRenderer();
        const b = new StageRenderer();
        const child = new StageRenderer(a);
        on(child, OnRemoveFromParent, () => b.dispose());

        expect(() => b.add(child)).not.toThrow();

        expect(b.isDisposed).toBe(true);
        expect(b.stages).toHaveLength(0);
        expect(child.parent).toBeUndefined();
        expect(child.isDisposed).toBe(false);
      });

      it('add() hands on the error of the move out when a listener disposes the child while it leaves its previous holder', () => {
        const a = new StageRenderer();
        const b = new StageRenderer();
        const child = new StageRenderer(a);
        const failure = new Error('the listener failed');
        // ahead of the listener that disposes the child: dispose() takes every listener
        // with it that the event has not reached yet
        on(child, OnRemoveFromParent, () => {
          throw failure;
        });
        on(child, OnRemoveFromParent, () => child.dispose());

        expect(thrownBy(() => b.add(child))).toBe(failure);

        expect(b.hasStage(child)).toBe(false);
        expect(a.hasStage(child)).toBe(false);
        expect(child.parent).toBeUndefined();
        expect(child.isDisposed).toBe(true);
      });

      it('add() hands on the errors of the move out as an AggregateError when a listener disposes this renderer while the child leaves its previous holder', () => {
        const a = new StageRenderer();
        const b = new StageRenderer();
        const child = new StageRenderer(a);
        const e1 = new Error('left');
        const e2 = new Error('removed');
        on(child, OnRemoveFromParent, () => {
          throw e1;
        });
        on(child, OnRemoveFromParent, () => b.dispose());
        on(a, OnStageRemoved, () => {
          throw e2;
        });

        const error = thrownBy(() => b.add(child)) as AggregateError;

        expect(error).toBeInstanceOf(AggregateError);
        expect(error.message).toBe(
          'StageRenderer#add(): more than one listener of OnRemoveFromParent, OnStageRemoved, OnStageAdded and OnAddToParent or unsubscribe of the previous host threw',
        );
        expect(error.errors).toHaveLength(2);
        expect(error.errors[0]).toBe(e1);
        expect(error.errors[1]).toBe(e2);
        expect(b.isDisposed).toBe(true);
        expect(b.stages).toHaveLength(0);
        expect(a.hasStage(child)).toBe(false);
        expect(child.parent).toBeUndefined();
        expect(child.isDisposed).toBe(false);
      });

      it('add() leaves out a child that a listener gives another holder while it leaves its previous one', () => {
        const a = new StageRenderer();
        const b = new StageRenderer();
        const hostC = makeHost();
        const child = new StageRenderer(a);
        on(child, OnRemoveFromParent, () => {
          child.parent = hostC;
        });

        expect(() => b.add(child)).not.toThrow();

        expect(b.hasStage(child)).toBe(false);
        expect(a.hasStage(child)).toBe(false);
        expect(child.parent).toBe(hostC);
        hostC._emitResize(80, 40);
        expect([child.width, child.height], 'the new host drives the child').toEqual([80, 40]);
      });

      it('add() takes a child off its host when a listener registered ahead of the host subscriptions disposes it', () => {
        const host = makeHost();
        const b = new StageRenderer();
        const child = new StageRenderer();
        // ahead of the host subscriptions: registered before attach()
        on(child, OnRemoveFromParent, () => child.dispose());
        child.attach(host);

        expect(() => b.add(child)).not.toThrow();

        expect(b.hasStage(child)).toBe(false);
        expect(child.isDisposed).toBe(true);
        expect(host._unsubs, 'both host subscriptions given up').toBe(2);
      });
    });
  });

  describe('parent / host wiring', () => {
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

    it('remove() clears the parent of the child it lets go', () => {
      const parent = new StageRenderer();
      const child = new StageRenderer(parent);
      const removed = vi.fn();
      on(child, OnRemoveFromParent, removed);

      parent.remove(child);

      expect(parent.hasStage(child)).toBe(false);
      expect(child.parent, 'the child let go of its holder as well').toBeUndefined();
      expect(removed, 'and it said so exactly once').toHaveBeenCalledTimes(1);
    });

    it('add() makes a StageRenderer the child of the renderer it joins', () => {
      const root = new StageRenderer();
      const child = new StageRenderer();
      const log: string[] = [];
      on(root, OnStageAdded, () => log.push('OnStageAdded at the parent'));
      on(child, OnAddToParent, () => log.push('OnAddToParent at the child'));

      root.add(child);

      expect(child.parent).toBe(root);
      expect(log).toEqual(['OnStageAdded at the parent', 'OnAddToParent at the child']);
    });

    it('attaching a child that add() took moves it out of its parent', () => {
      const host = makeHost();
      const root = new StageRenderer();
      const child = new StageRenderer();
      const inner = fakeStage('inner');
      child.add(inner);
      root.add(child);

      child.attach(host);

      expect(root.hasStage(child)).toBe(false);
      expect(child.parent).toBe(host);

      host._emitFrame(1, 0.016, 1);
      root.renderTo(renderer as any);

      expect(inner.renderTo, 'driven by one holder').toHaveBeenCalledTimes(1);
    });

    it('add() moves a StageRenderer out of the renderer that held it', () => {
      const a = new StageRenderer();
      const b = new StageRenderer();
      const child = new StageRenderer();
      const removedFromA = vi.fn();
      on(a, OnStageRemoved, removedFromA);

      a.add(child);
      b.add(child);

      expect(a.hasStage(child)).toBe(false);
      expect(b.hasStage(child)).toBe(true);
      expect(child.parent).toBe(b);
      expect(removedFromA).toHaveBeenCalledExactlyOnceWith({stage: child, renderer: a});
    });

    it('add() moves a StageRenderer off the host that drove it', () => {
      const host = makeHost();
      const child = new StageRenderer(host);
      const inner = fakeStage('inner');
      child.add(inner);
      const root = new StageRenderer();

      root.add(child);

      expect(child.parent).toBe(root);
      expect(host._unsubs, 'both host subscriptions given up').toBe(2);

      host._emitFrame(1, 0.016, 1);

      expect(inner.updateFrame).not.toHaveBeenCalled();
      expect(inner.renderTo).not.toHaveBeenCalled();
    });

    it('attach() moves a renderer from one host to another', () => {
      const hostA = makeHost();
      const hostB = makeHost();
      const sr = new StageRenderer(hostA);
      const stage = fakeStage('s');
      sr.add(stage);
      const removed = vi.fn();
      const added = vi.fn();
      on(sr, OnRemoveFromParent, removed);
      on(sr, OnAddToParent, added);

      sr.attach(hostB);

      expect(sr.parent).toBe(hostB);
      expect(hostA._unsubs, 'both subscriptions to the first host given up').toBe(2);
      expect(removed).toHaveBeenCalledTimes(1);
      expect(added).toHaveBeenCalledTimes(1);

      hostA._emitResize(100, 50);
      hostA._emitFrame(1, 1, 1);

      expect(sr.width, 'the first host reaches the renderer no more').toBe(0);
      expect(stage.resize).not.toHaveBeenCalled();
      expect(stage.updateFrame).not.toHaveBeenCalled();
      expect(stage.renderTo).not.toHaveBeenCalled();

      hostB._emitResize(100, 50);
      expect([sr.width, sr.height]).toEqual([100, 50]);

      hostB._emitFrame(1, 1, 1);
      expect(stage.updateFrame).toHaveBeenCalledTimes(1);
      expect(stage.updateFrame).toHaveBeenCalledWith(1, 1, 1);
      expect(stage.renderTo).toHaveBeenCalledTimes(1);
    });

    it('attach() to a new host behind an OnRemoveFromParent listener that throws leaves the old host and joins the new one', () => {
      const hostA = makeHost();
      const hostB = makeHost();
      const sr = new StageRenderer();
      const failure = new Error('the listener failed');
      // ahead of the host subscriptions: registered before attach()
      on(sr, OnRemoveFromParent, () => {
        throw failure;
      });
      sr.attach(hostA);
      const stage = fakeStage('s');
      sr.add(stage);

      expect(thrownBy(() => sr.attach(hostB))).toBe(failure);

      expect(hostA._unsubs).toBe(2);
      expect(sr.parent).toBe(hostB);
      hostA._emitFrame(1, 0.016, 1);
      expect(stage.renderTo, 'the old host drives the renderer no longer').not.toHaveBeenCalled();
      hostB._emitFrame(2, 0.016, 2);
      expect(stage.renderTo, 'the new host drives it').toHaveBeenCalledTimes(1);
    });

    it('a write to parent hands on the errors of OnRemoveFromParent and OnAddToParent as an AggregateError', () => {
      const hostA = makeHost();
      const hostB = makeHost();
      const sr = new StageRenderer(hostA);
      const e1 = new Error('left');
      const e2 = new Error('joined');
      on(sr, OnRemoveFromParent, () => {
        throw e1;
      });
      on(sr, OnAddToParent, () => {
        throw e2;
      });

      const error = thrownBy(() => {
        sr.parent = hostB;
      }) as AggregateError;

      expect(error).toBeInstanceOf(AggregateError);
      expect(error.message).toBe(
        'StageRenderer#parent: more than one listener of OnRemoveFromParent, OnStageRemoved and OnAddToParent or subscribe or unsubscribe at a host threw',
      );
      expect(error.errors).toHaveLength(2);
      expect(error.errors[0]).toBe(e1);
      expect(error.errors[1]).toBe(e2);
    });

    it('a write to parent leaves a renderer that a listener of OnRemoveFromParent disposes off the new host', () => {
      const hostA = makeHost();
      const hostB = makeHost();
      const sr = new StageRenderer(hostA);
      const stage = fakeStage('s');
      sr.add(stage);
      on(sr, OnRemoveFromParent, () => sr.dispose());
      const joined = vi.fn();
      on(sr, OnAddToParent, joined);

      expect(() => {
        sr.parent = hostB;
      }).not.toThrow();

      expect(sr.isDisposed).toBe(true);
      expect(sr.parent).toBeUndefined();
      expect(joined).not.toHaveBeenCalled();
      expect(hostA._unsubs, 'both subscriptions to the first host given up').toBe(2);
      const width = sr.width;
      hostB._emitResize(80, 40);
      expect(sr.width, 'the new host does not reach the renderer').toBe(width);
      hostB._emitFrame(1, 0.016, 1);
      expect(stage.renderTo).not.toHaveBeenCalled();
    });

    it('a write to parent leaves a renderer that a listener of OnRemoveFromParent gives another host off the host it was assigned', () => {
      const hostA = makeHost();
      const hostB = makeHost();
      const hostC = makeHost();
      const sr = new StageRenderer(hostA);
      on(sr, OnRemoveFromParent, () => {
        sr.parent = hostC;
      });

      expect(() => {
        sr.parent = hostB;
      }).not.toThrow();

      expect(sr.parent).toBe(hostC);
      expect(hostA._unsubs, 'both subscriptions to the first host given up').toBe(2);
      hostB._emitResize(10, 10);
      expect(sr.width, 'the assigned host does not reach the renderer').toBe(0);
      hostC._emitResize(80, 40);
      expect([sr.width, sr.height], 'the host the listener gave drives it').toEqual([80, 40]);
    });

    it('a write to parent takes a renderer off its host when a listener registered ahead of the host subscriptions disposes it', () => {
      const hostA = makeHost();
      const hostB = makeHost();
      const sr = new StageRenderer();
      // ahead of the host subscriptions: registered before attach()
      on(sr, OnRemoveFromParent, () => sr.dispose());
      sr.attach(hostA);

      expect(() => {
        sr.parent = hostB;
      }).not.toThrow();

      expect(sr.isDisposed).toBe(true);
      expect(hostA._unsubs, 'both subscriptions to the first host given up').toBe(2);
      const width = sr.width;
      hostA._emitResize(80, 40);
      expect(sr.width, 'the first host reaches the renderer no more').toBe(width);
    });

    it('a host whose onRenderFrame() throws gets its onResize() subscription back at once, and the renderer joins no holder', () => {
      const failure = new Error('the host refused the frame handler');
      const hostA = makeHost({onRenderFrame: failure});
      const hostB = makeHost();
      const sr = new StageRenderer();
      const added = vi.fn();
      on(sr, OnAddToParent, added);
      expect(thrownBy(() => sr.attach(hostA))).toBe(failure);

      expect(hostA._unsubs, 'the onResize subscription given up').toBe(1);
      expect(sr.parent).toBeUndefined();
      hostA._emitResize(80, 40);
      expect(sr.width, 'the first host reaches the renderer no more').toBe(0);

      sr.attach(hostB);

      expect(hostA._unsubs).toBe(1);
      hostB._emitResize(80, 40);
      expect([sr.width, sr.height], 'the new host drives it').toEqual([80, 40]);
      expect(added, 'only the join of the second host').toHaveBeenCalledTimes(1);
    });

    it('new StageRenderer(host) throws the error of a host whose onRenderFrame() throws, and the host keeps no subscription of it', () => {
      const failure = new Error('the host refused the frame handler');
      const host = makeHost({onRenderFrame: failure});

      expect(thrownBy(() => new StageRenderer(host))).toBe(failure);

      expect(host._unsubs).toBe(1);
    });

    it('a host whose onResize() throws takes nothing: the renderer joins no holder and hands the error on', () => {
      const failure = new Error('the host refused the resize handler');
      const host = makeHost({onResize: failure});
      const sr = new StageRenderer();
      const added = vi.fn();
      on(sr, OnAddToParent, added);

      expect(thrownBy(() => sr.attach(host))).toBe(failure);

      expect(sr.parent).toBeUndefined();
      expect(added).not.toHaveBeenCalled();
      expect(host._unsubs).toBe(0);
    });

    it('a write to parent that meets a host whose onRenderFrame() throws hands its error on after those of the move out, and the renderer joins no holder', () => {
      const eP = new Error('remove from parent');
      const eS = new Error('the host refused the frame handler');
      const hostA = makeHost();
      const sr = new StageRenderer(hostA);
      on(sr, OnRemoveFromParent, () => {
        throw eP;
      });
      const added = vi.fn();
      on(sr, OnAddToParent, added);
      const hostB = makeHost({onRenderFrame: eS});

      const error = thrownBy(() => {
        sr.parent = hostB;
      }) as AggregateError;

      expect(error).toBeInstanceOf(AggregateError);
      expect(error.message).toBe(
        'StageRenderer#parent: more than one listener of OnRemoveFromParent, OnStageRemoved and OnAddToParent or subscribe or unsubscribe at a host threw',
      );
      expect(error.errors).toEqual([eP, eS]);
      expect(sr.parent).toBeUndefined();
      expect(added).not.toHaveBeenCalled();
      expect(hostA._unsubs).toBe(2);
      expect(hostB._unsubs).toBe(1);
    });

    it('an unsubscribe that throws while the renderer gives back what a refusing host handed out joins the error of the host', () => {
      const eS = new Error('the host refused the frame handler');
      const eU = new Error('the host refused to let go');
      const host = makeHost({onRenderFrame: eS, unsubscribeResize: eU});
      const sr = new StageRenderer();

      const error = thrownBy(() => sr.attach(host)) as AggregateError;

      expect(error).toBeInstanceOf(AggregateError);
      expect(error.message).toBe(
        'StageRenderer#parent: more than one listener of OnRemoveFromParent, OnStageRemoved and OnAddToParent or subscribe or unsubscribe at a host threw',
      );
      expect(error.errors).toEqual([eS, eU]);
      expect(host._unsubs).toBe(1);
      expect(sr.parent).toBeUndefined();
    });

    it('detach() from a host whose unsubscribe throws gives up the other subscription, sends OnRemoveFromParent and hands the error on', () => {
      const failure = new Error('the host refused to let go');
      const host = makeHost({unsubscribeResize: failure});
      const sr = new StageRenderer(host);
      const stage = fakeStage('s');
      sr.add(stage);
      const heard = vi.fn();
      on(sr, OnRemoveFromParent, heard);

      expect(thrownBy(() => sr.detach())).toBe(failure);

      expect(host._unsubs).toBe(2);
      expect(sr.parent).toBeUndefined();
      expect(heard).toHaveBeenCalledTimes(1);
      host._emitFrame(1, 0.016, 1);
      expect(stage.renderTo).not.toHaveBeenCalled();
    });

    it('a write to parent hands on the error of an unsubscribe of the previous host ahead of those of the listeners', () => {
      const eU = new Error('unsubscribe');
      const eP = new Error('remove from parent');
      const eA = new Error('add to parent');
      const hostA = makeHost({unsubscribeResize: eU});
      const hostB = makeHost();
      const sr = new StageRenderer(hostA);
      on(sr, OnRemoveFromParent, () => {
        throw eP;
      });
      on(sr, OnAddToParent, () => {
        throw eA;
      });

      const error = thrownBy(() => {
        sr.parent = hostB;
      }) as AggregateError;

      expect(error).toBeInstanceOf(AggregateError);
      expect(error.message).toBe(
        'StageRenderer#parent: more than one listener of OnRemoveFromParent, OnStageRemoved and OnAddToParent or subscribe or unsubscribe at a host threw',
      );
      expect(error.errors).toEqual([eU, eP, eA]);
      expect(sr.parent).toBe(hostB);
      expect(hostA._unsubs).toBe(2);
      hostB._emitResize(80, 40);
      expect([sr.width, sr.height]).toEqual([80, 40]);
    });

    it('add() takes a child off a host whose unsubscribe throws and hands the error on', () => {
      const failure = new Error('the host refused to let go');
      const host = makeHost({unsubscribeResize: failure});
      const child = new StageRenderer(host);
      const inner = fakeStage('inner');
      child.add(inner);
      const root = new StageRenderer();

      expect(thrownBy(() => root.add(child))).toBe(failure);

      expect(root.hasStage(child)).toBe(true);
      expect(child.parent).toBe(root);
      expect(host._unsubs).toBe(2);
      host._emitFrame(1, 0.016, 1);
      expect(inner.updateFrame).not.toHaveBeenCalled();
      expect(inner.renderTo).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Pipeline integration — see "Post-processing" in ./README.md
  // ---------------------------------------------------------------------------

  describe('outputRenderTarget without a pipeline', () => {
    it('redirects rendering into the given RT and restores the previous target', () => {
      const sr = new StageRenderer();
      const rt = {isRenderTarget: true} as any;
      sr.outputRenderTarget = rt;
      const stage = fakeStage('s');
      stage.renderTo.mockImplementation(() => {
        // While rendering, the current render target must be our RT
        expect(renderer.__renderTarget).toBe(rt);
      });
      sr.add(stage);
      const beforeRT = {tag: 'screen'};
      renderer.__renderTarget = beforeRT;
      sr.renderTo(renderer as any);
      expect(stage.renderTo).toHaveBeenCalledTimes(1);
      // Restored
      expect(renderer.__renderTarget).toBe(beforeRT);
    });
  });

  describe('Mode C: a pipeline that samples the internal target', () => {
    function makePipelineMock() {
      return {
        outputNode: undefined as unknown,
        needsUpdate: false,
        render: vi.fn(),
        dispose: vi.fn(),
      };
    }

    it('renders stages into an internal RT, then runs the pipeline', () => {
      const sr = new StageRenderer();
      sr.resize(200, 100);
      const stage = fakeStage('s');
      sr.add(stage);
      const pipeline = makePipelineMock();
      sr.pipeline = pipeline as any;

      let rtDuringStageRender: unknown;
      stage.renderTo.mockImplementation(() => {
        rtDuringStageRender = renderer.__renderTarget;
      });

      let rtDuringPipelineRender: unknown;
      pipeline.render.mockImplementation(() => {
        rtDuringPipelineRender = renderer.__renderTarget;
      });

      sr.renderTo(renderer as any);

      // Stage rendered into an internal RT (non-null)
      expect(rtDuringStageRender).not.toBeNull();
      expect((rtDuringStageRender as any)?.isRenderTarget).toBe(true);
      // Pipeline rendered to the original target (null = screen)
      expect(rtDuringPipelineRender).toBeNull();
      expect(pipeline.render).toHaveBeenCalledTimes(1);
      expect(pipeline.needsUpdate).toBe(true);
      expect(pipeline.outputNode).toBeDefined();
    });

    it('keeps the output node of Mode C through changes of stages, order, names, scenes and cameras', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const stage = fakeStage('s');
      const stage2D = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 100}));
      sr.add(stage).add(stage2D);
      const pipeline = makePipelineMock();
      sr.pipeline = pipeline as any;

      sr.renderTo(renderer as any);
      const firstNode = pipeline.outputNode;
      pipeline.needsUpdate = false;

      const extra = fakeStage('t');
      const changes: [string, () => void][] = [
        ['add()', () => sr.add(extra)],
        ['remove()', () => sr.remove(extra)],
        ['a renderOrder write', () => (sr.renderOrder = 's,*')],
        ['a rename under an explicit renderOrder', () => (stage.name = 'u')],
        ['a camera change of a Stage2D', () => (stage2D.camera = new PerspectiveCamera())],
        ['a scene change of a Stage2D', () => (stage2D.scene = new Scene())],
      ];
      for (const [change, apply] of changes) {
        apply();
        sr.renderTo(renderer as any);
        expect(pipeline.outputNode, `output node after ${change}`).toBe(firstNode);
        expect(pipeline.needsUpdate, `needsUpdate after ${change}`).toBe(false);
      }
    });

    it('clears the internal target of Mode C without clear to transparent black, color and depth', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const stage = fakeStage('s');
      sr.add(stage);
      sr.pipeline = makePipelineMock() as any;
      const log = logClearsAndDraws(stage);

      sr.renderTo(renderer as any);

      const {draw, clears} = clearsBeforeFirstDraw(log);
      expect((draw.target as any)?.isRenderTarget, 'the stage draws into the internal target').toBe(true);
      expect(clears).toEqual([{kind: 'clear', target: draw.target, color: 0x000000, alpha: 0, args: [true, true, false]}]);
      expect(
        log.filter((entry) => entry.kind === 'clear'),
        'no clear anywhere else',
      ).toHaveLength(1);
      expect(renderer.__clearColor.getHex(), 'clear color restored').toBe(0x111111);
      expect(renderer.__clearAlpha, 'clear alpha restored').toBe(0.5);
    });

    it('clears the internal target of Mode C in full before its own clear leaves out the color buffer', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const stage = fakeStage('s');
      sr.add(stage);
      sr.setClearColor(new Color(0x123456), 0.25);
      sr.clearColorBuffer = false;
      sr.pipeline = makePipelineMock() as any;
      const log = logClearsAndDraws(stage);

      sr.renderTo(renderer as any);

      const {draw, clears} = clearsBeforeFirstDraw(log);
      expect(clears).toEqual([
        {kind: 'clear', target: draw.target, color: 0x000000, alpha: 0, args: [true, true, false]},
        {kind: 'clear', target: draw.target, color: 0x123456, alpha: 0.25, args: [false, true, true]},
      ]);
    });

    it('clears the internal target of Mode C once when its own clear covers color and depth', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const stage = fakeStage('s');
      sr.add(stage);
      sr.setClearColor(new Color(0x123456), 0.25);
      sr.pipeline = makePipelineMock() as any;
      const log = logClearsAndDraws(stage);

      sr.renderTo(renderer as any);

      const {draw, clears} = clearsBeforeFirstDraw(log);
      expect(clears).toEqual([{kind: 'clear', target: draw.target, color: 0x123456, alpha: 0.25, args: [true, true, true]}]);
    });

    it('applies its own clear to the target it writes to after the stages drew and before the pipeline runs', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const stage = fakeStage('s');
      sr.add(stage);
      sr.setClearColor(new Color(0x336699), 0.75);
      sr.clearStencilBuffer = false;
      const pipeline = makePipelineMock();
      sr.pipeline = pipeline as any;
      const log = logClearsAndDraws(stage);
      pipeline.render.mockImplementation(() => log.push({kind: 'pipeline', target: renderer.__renderTarget}));

      sr.renderTo(renderer as any);

      const lastDraw = log.map((entry) => entry.kind).lastIndexOf('draw');
      expect(lastDraw, 'the stage is drawn').toBeGreaterThanOrEqual(0);
      expect(log.slice(lastDraw + 1)).toEqual([
        {kind: 'clear', target: null, color: 0x336699, alpha: 0.75, args: [true, true, false]},
        {kind: 'pipeline', target: null},
      ]);
      expect(renderer.__clearColor.getHex(), 'clear color restored').toBe(0x111111);
      expect(renderer.__clearAlpha, 'clear alpha restored').toBe(0.5);
    });

    it('lets the stages of Mode C draw linear, and its own pipeline apply the output transform of the caller', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const stage = fakeStage('s');
      sr.add(stage);
      const pipeline = makePipelineMock();
      sr.pipeline = pipeline as any;

      const seen: Record<string, [unknown, unknown]> = {};
      stage.renderTo.mockImplementation(() => {
        seen['stage'] = [renderer.toneMapping, renderer.outputColorSpace];
      });
      pipeline.render.mockImplementation(() => {
        seen['pipeline'] = [renderer.toneMapping, renderer.outputColorSpace];
      });

      sr.renderTo(renderer as any);

      expect(seen['stage']).toEqual([NoToneMapping, ColorManagement.workingColorSpace]);
      expect(seen['pipeline']).toEqual([ACESFilmicToneMapping, SRGBColorSpace]);
      expect([renderer.toneMapping, renderer.outputColorSpace], 'after renderTo()').toEqual([
        ACESFilmicToneMapping,
        SRGBColorSpace,
      ]);
    });

    it('lets a nested renderer with a pipeline under Mode C write linear', () => {
      const parent = new StageRenderer();
      parent.resize(100, 100);
      parent.add(fakeStage('s'));
      const parentPipeline = makePipelineMock();
      parent.pipeline = parentPipeline as any;
      const child = new StageRenderer();
      child.resize(100, 100);
      child.add(fakeStage('inner'));
      const childPipeline = makePipelineMock();
      child.pipeline = childPipeline as any;
      parent.add(child);

      const seen: Record<string, [unknown, unknown]> = {};
      childPipeline.render.mockImplementation(() => {
        seen['child'] = [renderer.toneMapping, renderer.outputColorSpace];
      });
      parentPipeline.render.mockImplementation(() => {
        seen['parent'] = [renderer.toneMapping, renderer.outputColorSpace];
      });

      parent.renderTo(renderer as any);

      expect(seen['child']).toEqual([NoToneMapping, ColorManagement.workingColorSpace]);
      expect(seen['parent']).toEqual([ACESFilmicToneMapping, SRGBColorSpace]);
      expect([renderer.toneMapping, renderer.outputColorSpace], 'after renderTo()').toEqual([
        ACESFilmicToneMapping,
        SRGBColorSpace,
      ]);
    });

    it('builds the internal target with the output buffer type and the samples of the renderer', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const stage = fakeStage('s');
      sr.add(stage);
      sr.pipeline = makePipelineMock() as any;
      let rt: RenderTarget | undefined;
      stage.renderTo.mockImplementation(() => {
        rt = renderer.__renderTarget as RenderTarget;
      });

      sr.renderTo(renderer as any);
      const first = rt!;
      expect(first.texture.type).toBe(FloatType);
      expect(first.samples).toBe(4);

      renderer.samples = 0;
      sr.renderTo(renderer as any);
      expect(rt, 'the same target').toBe(first);
      expect(first.samples).toBe(0);
    });

    it('replacing the pipeline rebuilds the output node', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      sr.add(fakeStage('s'));
      sr.pipeline = makePipelineMock() as any;
      sr.renderTo(renderer as any);

      const next = makePipelineMock();
      sr.pipeline = next as any;
      sr.renderTo(renderer as any);

      expect(next.outputNode).toBeDefined();
      expect(next.needsUpdate).toBe(true);
      expect(next.render).toHaveBeenCalledTimes(1);
    });

    it('assigning the same pipeline again keeps the output node', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      sr.add(fakeStage('s'));
      const pipeline = makePipelineMock();
      sr.pipeline = pipeline as any;
      sr.renderTo(renderer as any);
      const firstNode = pipeline.outputNode;
      pipeline.needsUpdate = false;

      sr.pipeline = pipeline as any;
      sr.renderTo(renderer as any);

      expect(pipeline.outputNode).toBe(firstNode);
      expect(pipeline.needsUpdate).toBe(false);
    });

    it('assigning buildOutputNode after the first frame switches mode', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const passNode = {isNode: true, label: 's', type: 'pass'};
      sr.add({...fakeStage('s'), asPassNode: vi.fn(() => passNode)} as any);
      const pipeline = makePipelineMock();
      sr.pipeline = pipeline as any;
      sr.renderTo(renderer as any);

      const composed = {isNode: true, label: 'composed'};
      const buildOutputNode = vi.fn(() => composed);
      sr.buildOutputNode = buildOutputNode as any;
      sr.renderTo(renderer as any);
      expect(buildOutputNode).toHaveBeenCalledTimes(1);
      expect(buildOutputNode.mock.calls[0]).toEqual([[passNode]]);
      expect(pipeline.outputNode).toBe(composed);

      sr.buildOutputNode = undefined;
      pipeline.needsUpdate = false;
      sr.renderTo(renderer as any);
      expect(pipeline.outputNode).not.toBe(composed);
      expect(pipeline.needsUpdate).toBe(true);
    });

    it('runs pipeline into outputRenderTarget when set', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      sr.add(fakeStage('s'));
      const outRT = {isRenderTarget: true, tag: 'out'} as any;
      sr.outputRenderTarget = outRT;
      let rtDuringPipeline: unknown;
      const pipeline = {
        outputNode: undefined as unknown,
        needsUpdate: false,
        render: vi.fn(() => {
          rtDuringPipeline = renderer.__renderTarget;
        }),
        dispose: vi.fn(),
      };
      sr.pipeline = pipeline as any;
      sr.renderTo(renderer as any);
      expect(rtDuringPipeline).toBe(outRT);
    });

    it('the internal target keeps its device-pixel size when resize() moves it', () => {
      renderer.getPixelRatio.mockReturnValue(2);
      const sr = new StageRenderer();
      sr.resize(100, 50);
      const stage = fakeStage('s');
      sr.add(stage);
      sr.pipeline = makePipelineMock() as any;

      let rt: any;
      stage.renderTo.mockImplementation(() => {
        rt = renderer.__renderTarget;
      });
      sr.renderTo(renderer as any);

      expect([rt.width, rt.height], 'built in device pixels').toEqual([200, 100]);

      sr.resize(300, 150);
      expect([rt.width, rt.height], 'resized in device pixels').toEqual([600, 300]);
    });

    it('a resize() to the size the renderer and its stages already carry leaves the internal target and the stages alone', () => {
      const sr = new StageRenderer();
      sr.resize(100, 50);
      const stage = fakeStage('s');
      sr.add(stage);
      sr.pipeline = makePipelineMock() as any;

      let rt: any;
      stage.renderTo.mockImplementation(() => {
        rt = renderer.__renderTarget;
      });
      sr.renderTo(renderer as any);

      const setSize = vi.spyOn(rt, 'setSize');
      stage.resize.mockClear();

      sr.resize(100, 50);

      expect(setSize).not.toHaveBeenCalled();
      expect(stage.resize).not.toHaveBeenCalled();
    });

    it('a fractional css size reaches the internal target as whole device pixels', () => {
      const sr = new StageRenderer();
      sr.resize(100, 50);
      const stage = fakeStage('s');
      sr.add(stage);
      sr.pipeline = makePipelineMock() as any;

      let rt: any;
      stage.renderTo.mockImplementation(() => {
        rt = renderer.__renderTarget;
      });
      sr.renderTo(renderer as any);

      sr.resize(100.5, 50.5);
      expect([rt.width, rt.height]).toEqual([100, 50]);
    });

    it('counts only the stages that refused the size, not the render target', () => {
      const sr = new StageRenderer();
      sr.resize(100, 50);
      const stage1 = fakeStage('a');
      const stage2 = fakeStage('b');
      sr.add(stage1).add(stage2);
      sr.pipeline = makePipelineMock() as any;

      let rt: any;
      stage1.renderTo.mockImplementation(() => {
        rt = renderer.__renderTarget;
      });
      sr.renderTo(renderer as any);

      rt.setSize = () => {
        throw new Error('the render target refused the size');
      };
      stage2.resize.mockImplementation(() => {
        throw new Error('stage refused the size');
      });

      let caught: unknown;
      try {
        sr.resize(300, 150);
      } catch (error) {
        caught = error;
      }

      expect(caught).toBeInstanceOf(AggregateError);
      expect((caught as AggregateError).errors).toHaveLength(2);
      expect((caught as Error).message).toBe(
        'StageRenderer#resize(): the render target and 1 of 2 stages refused the size 300x150',
      );
    });

    it('invalidateOutputNode() forces a rebuild on next render', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      sr.add(fakeStage('a') as any);
      sr.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
      sr.renderTo(renderer as any);
      sr.pipeline!.needsUpdate = false;
      sr.invalidateOutputNode();
      sr.renderTo(renderer as any);
      expect(sr.pipeline!.needsUpdate).toBe(true);
    });
  });

  describe('Mode C with an internalTargetPool', () => {
    const sandbox = createSandbox();

    afterEach(() => {
      sandbox.restore();
    });

    function makePipelineMock() {
      return {outputNode: undefined as unknown, needsUpdate: false, render: vi.fn(), dispose: vi.fn()};
    }

    // a stage that notes every target it is drawn into
    function capturingStage(name: string) {
      const stage = fakeStage(name);
      const targets: unknown[] = [];
      stage.renderTo.mockImplementation(() => targets.push(renderer.__renderTarget));
      return {stage, targets};
    }

    function makeModeC(pool?: StageRenderTargetPool) {
      const sr = new StageRenderer();
      sr.resize(50, 50);
      const {stage, targets} = capturingStage('s');
      sr.add(stage);
      const pipeline = makePipelineMock();
      sr.pipeline = pipeline as any;
      if (pool) sr.internalTargetPool = pool;
      return {sr, stage, targets, pipeline};
    }

    it('borrows its internal target from the pool for the draw and gives it back once the pipeline has run', () => {
      const pool = new StageRenderTargetPool();
      const acquire = sandbox.spy(pool, 'acquire');
      const release = sandbox.spy(pool, 'release');
      const {sr, targets, pipeline} = makeModeC(pool);
      let releasedWhilePipelineRuns = -1;
      pipeline.render.mockImplementation(() => {
        releasedWhilePipelineRuns = release.callCount;
      });

      sr.renderTo(renderer as any);

      expect(acquire.callCount).toBe(1);
      const rt = acquire.firstCall.returnValue;
      expect(targets, 'the stage draws into the borrowed target').toEqual([rt]);
      expect(releasedWhilePipelineRuns, 'not given back while the pipeline runs').toBe(0);
      expect(release.calledOnceWithExactly(rt)).toBe(true);
    });

    it('asks the pool for the size in device pixels and the type and the samples of the renderer', () => {
      renderer.getPixelRatio.mockReturnValue(2);
      const pool = new StageRenderTargetPool();
      const acquire = sandbox.spy(pool, 'acquire');
      const {sr} = makeModeC(pool);
      sr.resize(200, 100);

      sr.renderTo(renderer as any);

      expect(acquire.calledOnceWithExactly(400, 200, FloatType, 4)).toBe(true);
    });

    it('lets two renderers of the same size that draw one after another draw through one target, frame after frame', () => {
      const pool = new StageRenderTargetPool();
      const a = makeModeC(pool);
      const b = makeModeC(pool);

      a.sr.renderTo(renderer as any);
      b.sr.renderTo(renderer as any);
      a.pipeline.needsUpdate = false;
      b.pipeline.needsUpdate = false;
      a.sr.renderTo(renderer as any);
      b.sr.renderTo(renderer as any);

      const rt = a.targets[0];
      expect((rt as any)?.isRenderTarget).toBe(true);
      expect(a.targets, 'a in both frames').toEqual([rt, rt]);
      expect(b.targets, 'b in both frames').toEqual([rt, rt]);
      expect(a.pipeline.needsUpdate, 'the Mode C node of a stays').toBe(false);
      expect(b.pipeline.needsUpdate, 'the Mode C node of b stays').toBe(false);
    });

    it('gives a nested Mode C renderer under a Mode C parent on the same pool a target of its own', () => {
      const pool = new StageRenderTargetPool();
      const parent = makeModeC(pool);
      const child = makeModeC(pool);
      parent.sr.add(child.sr);

      parent.sr.renderTo(renderer as any);
      parent.sr.renderTo(renderer as any);

      const [parentRT] = parent.targets;
      const [childRT] = child.targets;
      expect((childRT as any)?.isRenderTarget).toBe(true);
      expect(childRT, 'the child draws while the parent holds its target').not.toBe(parentRT);
      expect(parent.targets, 'the parent in both frames').toEqual([parentRT, parentRT]);
      expect(child.targets, 'the child in both frames').toEqual([childRT, childRT]);
    });

    it('gives the target back when a stage throws', () => {
      const pool = new StageRenderTargetPool();
      const acquire = sandbox.spy(pool, 'acquire');
      const release = sandbox.spy(pool, 'release');
      const {sr, stage} = makeModeC(pool);
      const failure = new Error('the stage failed');
      stage.renderTo.mockImplementation(() => {
        throw failure;
      });

      expect(thrownBy(() => sr.renderTo(renderer as any))).toBe(failure);

      const rt = acquire.firstCall.returnValue;
      expect(release.calledOnceWithExactly(rt)).toBe(true);
      expect(pool.acquire(50, 50, FloatType, 4), 'lent to the next borrower').toBe(rt);
    });

    it('releases its own internal target when a pool is assigned, and builds a new one when the pool is cleared', () => {
      const {sr, targets} = makeModeC();
      sr.renderTo(renderer as any);
      const own = targets[0];
      const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');
      const pool = new StageRenderTargetPool();
      const acquire = sandbox.spy(pool, 'acquire');

      sr.internalTargetPool = pool;

      expect(rtDispose.callCount).toBe(1);
      expect(rtDispose.firstCall.thisValue).toBe(own);

      sr.renderTo(renderer as any);
      const pooled = acquire.firstCall.returnValue;
      expect(targets.at(-1), 'the frame with a pool').toBe(pooled);

      sr.internalTargetPool = undefined;
      sr.renderTo(renderer as any);
      expect((targets.at(-1) as any)?.isRenderTarget).toBe(true);
      expect(targets.at(-1), 'not the old own target').not.toBe(own);
      expect(targets.at(-1), 'not the pooled target').not.toBe(pooled);
    });

    it('releases the own target it draws into once the draw ends when a pool is assigned during the draw', () => {
      const {sr, stage, targets} = makeModeC();
      const pool = new StageRenderTargetPool();
      const acquire = sandbox.spy(pool, 'acquire');
      const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');
      let releasedDuringDraw = -1;
      stage.renderTo.mockImplementation(() => {
        targets.push(renderer.__renderTarget);
        sr.internalTargetPool = pool;
        releasedDuringDraw = rtDispose.callCount;
      });

      sr.renderTo(renderer as any);

      const own = targets[0];
      expect(releasedDuringDraw, 'nothing released while the stage draws').toBe(0);
      expect(rtDispose.callCount, 'released once the draw ends').toBe(1);
      expect(rtDispose.firstCall.thisValue).toBe(own);
      expect(acquire.called, 'the pool counts from the next draw on').toBe(false);

      sr.renderTo(renderer as any);
      expect(targets.at(-1)).toBe(acquire.firstCall.returnValue);
    });

    it('uses the pool in Mode C only', () => {
      const pool = new StageRenderTargetPool();
      const acquire = sandbox.spy(pool, 'acquire');

      const plain = new StageRenderer();
      plain.resize(50, 50);
      plain.add(fakeStage('s'));
      plain.internalTargetPool = pool;
      plain.renderTo(renderer as any);
      expect(acquire.called, 'plain mode').toBe(false);

      const passNode = {isNode: true, label: 's', type: 'pass'};
      const composed = new StageRenderer();
      composed.resize(50, 50);
      composed.add({...fakeStage('s'), asPassNode: vi.fn(() => passNode)} as any);
      composed.pipeline = makePipelineMock() as any;
      composed.buildOutputNode = (passes) => passes[0]!;
      composed.internalTargetPool = pool;
      composed.renderTo(renderer as any);
      expect(acquire.called, 'composed mode').toBe(false);

      // a child in Mode C under a composing parent: its internal target is borrowed, the
      // pass-target the parent samples is its own
      const child = makeModeC(pool);
      const parent = new StageRenderer();
      parent.resize(50, 50);
      parent.add(child.sr);
      parent.pipeline = makePipelineMock() as any;
      parent.buildOutputNode = (passes) => passes[0]!;
      parent.internalTargetPool = pool;
      parent.renderTo(renderer as any);

      const passTarget = (child.sr.asPassNode(renderer as any) as any).value.renderTarget;
      expect(acquire.callCount, 'the internal target of the child alone').toBe(1);
      expect(acquire.firstCall.returnValue).toBe(child.targets[0]);
      expect(passTarget, 'the pass-target').not.toBe(acquire.firstCall.returnValue);
    });

    it('refuses a disposed pool with an error naming the call and the state, and keeps the pool it had', () => {
      const pool = new StageRenderTargetPool();
      const {sr} = makeModeC(pool);
      const disposed = new StageRenderTargetPool();
      disposed.dispose();

      expect(() => (sr.internalTargetPool = disposed)).toThrow(
        'StageRenderer#internalTargetPool cannot take the pool: that pool has been disposed',
      );
      expect(sr.internalTargetPool).toBe(pool);
    });

    it('throws the error of acquire() on the next Mode C frame when its pool has been disposed', () => {
      const pool = new StageRenderTargetPool();
      const {sr} = makeModeC(pool);
      sr.renderTo(renderer as any);

      pool.dispose();

      expect(() => sr.renderTo(renderer as any)).toThrow(
        'StageRenderTargetPool#acquire() is not available: this pool has been disposed',
      );
    });

    it('dispose() leaves the pool alone, and afterwards internalTargetPool answers undefined and takes no new pool', () => {
      const pool = new StageRenderTargetPool();
      const poolDispose = sandbox.spy(pool, 'dispose');
      const {sr} = makeModeC(pool);
      sr.renderTo(renderer as any);

      sr.dispose();

      expect(poolDispose.called).toBe(false);
      expect(pool.isDisposed).toBe(false);
      expect(sr.internalTargetPool).toBeUndefined();

      expect(() => (sr.internalTargetPool = new StageRenderTargetPool())).not.toThrow();
      expect(sr.internalTargetPool, 'after a write').toBeUndefined();
    });
  });

  describe('Mode D and E: composing the pass nodes of the stages', () => {
    const sandbox = createSandbox();

    afterEach(() => {
      sandbox.restore();
    });

    function fakePassNode(label: string) {
      return {isNode: true, label, type: 'pass'} as any;
    }

    it('Stage2D.asPassNode requires a camera: none before the first resize() with an area', () => {
      const stage = new Stage2D();
      expect(() => stage.asPassNode(renderer as any)).toThrow(/has no camera/);
      stage.projection = new ParallaxProjection('xy|bottom-left');
      expect(() => stage.asPassNode(renderer as any), 'a projection alone').toThrow(/has no camera/);
      stage.resize(100, 100);
      expect(() => stage.asPassNode(renderer as any), 'after resize(100, 100)').not.toThrow();
    });

    it('a composing renderer without stages draws its own clear and calls neither buildOutputNode nor the pipeline', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      sr.setClearColor(new Color(0xff0000), 1);
      const buildOutputNode = vi.fn((passes: any[]) => passes[0]);
      sr.buildOutputNode = buildOutputNode;
      const pipeline = makePipelineMock();
      sr.pipeline = pipeline as any;
      const log = logClearsAndDraws();

      expect(() => sr.renderTo(renderer as any)).not.toThrow();

      expect(buildOutputNode).not.toHaveBeenCalled();
      expect(pipeline.render).not.toHaveBeenCalled();
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({kind: 'clear', color: 0xff0000});
    });

    it('a RootRenderPipeline without stages draws the clear of its renderer and does not throw', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      sr.setClearColor(new Color(0xff0000), 1);
      const pipeline = fakeRootPipeline();
      sr.pipeline = pipeline as any;
      const log = logClearsAndDraws();

      expect(() => sr.renderTo(renderer as any)).not.toThrow();

      expect(pipeline.render).not.toHaveBeenCalled();
      expect(log).toHaveLength(1);
      expect(log[0]).toMatchObject({kind: 'clear', color: 0xff0000});
    });

    it('a composing renderer composes the first stage that joins it after frames without stages', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const buildOutputNode = vi.fn((passes: any[]) => passes[0]);
      sr.buildOutputNode = buildOutputNode;
      const pipeline = makePipelineMock();
      sr.pipeline = pipeline as any;

      sr.renderTo(renderer as any);
      sr.renderTo(renderer as any);

      const passNode = fakePassNode('first');
      sr.add({...fakeStage('first'), asPassNode: vi.fn(() => passNode)} as any);
      sr.renderTo(renderer as any);

      expect(buildOutputNode).toHaveBeenCalledTimes(1);
      expect(buildOutputNode).toHaveBeenCalledWith([passNode]);
      expect(pipeline.render).toHaveBeenCalledTimes(1);
    });

    function makeComposedSetup() {
      const sr = new StageRenderer();
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 100}));
      sr.add(stage);
      const buildOutputNode = vi.fn((passes: any[]) => passes[0]);
      sr.buildOutputNode = buildOutputNode;
      const pipeline = {outputNode: undefined as unknown, needsUpdate: false, render: vi.fn(), dispose: vi.fn()};
      sr.pipeline = pipeline as any;
      return {sr, stage, buildOutputNode, pipeline};
    }

    it('swapping the projection of a Stage2D after the first render rebuilds with a new pass node', () => {
      const {sr, stage, buildOutputNode} = makeComposedSetup();
      sr.resize(100, 100);
      sr.renderTo(renderer as any);
      expect(buildOutputNode).toHaveBeenCalledTimes(1);

      stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 50});
      sr.renderTo(renderer as any);

      expect(buildOutputNode).toHaveBeenCalledTimes(2);
      const firstPass = buildOutputNode.mock.calls[0]![0][0];
      const secondPass = buildOutputNode.mock.calls[1]![0][0];
      expect(secondPass).not.toBe(firstPass);
      expect(secondPass.camera).toBe(stage.camera);
    });

    it('assigning a camera to a Stage2D rebuilds the output node', () => {
      const {sr, stage, buildOutputNode} = makeComposedSetup();
      sr.resize(100, 100);
      sr.renderTo(renderer as any);

      const camera = new PerspectiveCamera();
      stage.camera = camera;
      sr.renderTo(renderer as any);

      expect(buildOutputNode).toHaveBeenCalledTimes(2);
      expect(buildOutputNode.mock.calls[1]![0][0].camera).toBe(camera);
    });

    it('assigning a scene to a Stage2D rebuilds the output node', () => {
      const {sr, stage, buildOutputNode} = makeComposedSetup();
      sr.resize(100, 100);
      sr.renderTo(renderer as any);

      stage.scene = new Scene();
      sr.renderTo(renderer as any);

      expect(buildOutputNode).toHaveBeenCalledTimes(2);
      const firstPass = buildOutputNode.mock.calls[0]![0][0];
      const secondPass = buildOutputNode.mock.calls[1]![0][0];
      expect(secondPass).not.toBe(firstPass);
      expect(secondPass.scene).toBe(stage.scene);
    });

    it('remove() stops listening to the camera and the scene of a stage', () => {
      const sr = new StageRenderer();
      const stage = new Stage2D(new ParallaxProjection('xy|bottom-left'));
      const before = getSubscriptionCount(stage);

      sr.add(stage);
      expect(getSubscriptionCount(stage), 'after add()').toBeGreaterThan(before);

      sr.remove(stage);
      expect(getSubscriptionCount(stage), 'after remove()').toBe(before);
    });

    it('a rebuild through a builder of createBloomOutputNodeBuilder() releases the bloom node of the build before', () => {
      const {sr, pipeline} = makeComposedSetup();
      const builder = createBloomOutputNodeBuilder();
      sr.buildOutputNode = builder;
      sr.resize(100, 100);
      sr.renderTo(renderer as any);

      const first = findBlooms(pipeline.outputNode as Node);
      expect(first).toHaveLength(1);
      const firstDispose = sandbox.spy(first[0]!, 'dispose');

      sr.invalidateOutputNode();
      sr.renderTo(renderer as any);

      const second = findBlooms(pipeline.outputNode as Node);
      expect(firstDispose.calledOnce).toBe(true);
      expect(second).toHaveLength(1);
      expect(second[0]).not.toBe(first[0]);

      builder.dispose();
    });

    it('refuses a disposed builder with an error naming the call and the state, and keeps the callback it had', () => {
      const {sr, buildOutputNode} = makeComposedSetup();
      const builder = createBloomOutputNodeBuilder();
      builder.dispose();

      expect(() => (sr.buildOutputNode = builder)).toThrow(
        'StageRenderer#buildOutputNode cannot take the builder: that builder has been disposed',
      );
      expect(sr.buildOutputNode).toBe(buildOutputNode);
    });

    it('a composing renderer draws nothing while it is 0×0', () => {
      const {sr, buildOutputNode, pipeline} = makeComposedSetup();
      expect(() => sr.renderTo(renderer as any)).not.toThrow();
      expect(buildOutputNode).not.toHaveBeenCalled();
      expect(pipeline.render).not.toHaveBeenCalled();

      sr.resize(100, 100);
      sr.renderTo(renderer as any);
      expect(buildOutputNode).toHaveBeenCalledTimes(1);
      expect(pipeline.render).toHaveBeenCalledTimes(1);
    });

    it('a composing renderer draws nothing while a Stage2D of the composition has no camera', () => {
      const {sr, stage, buildOutputNode, pipeline} = makeComposedSetup();
      // specs that give no view leave the projection, and so the stage, without a camera
      stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain'});
      const withCamera = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 100}));
      sr.add(withCamera);

      sr.resize(100, 100);
      expect(stage.camera, 'the stage without a view').toBeUndefined();
      expect(withCamera.camera, 'the stage with a view').toBeDefined();

      // every frame alike: nothing thrown, nothing composed, nothing drawn
      for (let frame = 1; frame <= 2; frame++) {
        expect(() => sr.renderTo(renderer as any), `frame ${frame}`).not.toThrow();
      }
      expect(buildOutputNode).not.toHaveBeenCalled();
      expect(pipeline.render).not.toHaveBeenCalled();

      // the composition is built on the first frame with a camera for every stage
      stage.projection = new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 50});
      sr.renderTo(renderer as any);
      expect(buildOutputNode).toHaveBeenCalledTimes(1);
      expect(buildOutputNode.mock.calls[0]![0]).toHaveLength(2);
      expect(pipeline.render).toHaveBeenCalledTimes(1);
    });

    it('a renamed stage rebuilds the output node', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const passA = fakePassNode('a');
      const passB = fakePassNode('b');
      const stageA = {...fakeStage('a'), asPassNode: vi.fn(() => passA)};
      const stageB = {...fakeStage('b'), asPassNode: vi.fn(() => passB)};
      sr.add(stageA as any).add(stageB as any);
      sr.renderOrder = 'b,a';
      const buildOutputNode = vi.fn((nodes: unknown[]) => nodes[0]);
      sr.buildOutputNode = buildOutputNode as any;
      sr.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
      sr.renderTo(renderer as any);
      expect(buildOutputNode.mock.calls[0]![0]).toEqual([passB, passA]);

      stageA.name = 'b';
      stageB.name = 'a';
      sr.renderTo(renderer as any);
      expect(buildOutputNode).toHaveBeenCalledTimes(2);
      expect(buildOutputNode.mock.calls[1]![0]).toEqual([passA, passB]);
    });

    it('buildOutputNode receives a pass node per stage (default renderOrder = "*", insertion order)', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const passA = fakePassNode('a');
      const passB = fakePassNode('b');
      const stageA = {...fakeStage('a'), asPassNode: vi.fn(() => passA)};
      const stageB = {...fakeStage('b'), asPassNode: vi.fn(() => passB)};
      sr.add(stageA as any).add(stageB as any);
      const buildOutputNode = vi.fn((nodes: unknown[]) => nodes[0]);
      sr.buildOutputNode = buildOutputNode as any;
      sr.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
      sr.renderTo(renderer as any);
      expect(buildOutputNode).toHaveBeenCalledTimes(1);
      expect(buildOutputNode.mock.calls[0]![0]).toEqual([passA, passB]);
    });

    it('applies its own clear to the target it writes to before the pipeline runs', () => {
      const {sr, pipeline} = makeComposedSetup();
      sr.resize(100, 100);
      sr.setClearColor(null, 0.25);
      const log = logClearsAndDraws();
      pipeline.render.mockImplementation(() => log.push({kind: 'pipeline', target: renderer.__renderTarget}));

      sr.renderTo(renderer as any);

      expect(log).toEqual([
        {kind: 'clear', target: null, color: 0x111111, alpha: 0.25, args: [true, true, true]},
        {kind: 'pipeline', target: null},
      ]);
      expect(renderer.__clearAlpha, 'clear alpha restored').toBe(0.5);
    });

    it('sizes the pass target of a nested renderer in device pixels, before and after a resize', () => {
      renderer.getPixelRatio.mockReturnValue(2);
      const parent = new StageRenderer();
      parent.resize(100, 50);
      parent.buildOutputNode = ((nodes: unknown[]) => nodes[0]) as any;
      parent.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
      const inner = fakeStage('s');
      let passTarget: any;
      inner.renderTo.mockImplementation(() => {
        passTarget = renderer.__renderTarget;
      });
      const child = new StageRenderer();
      child.add(inner);
      parent.add(child);

      parent.renderTo(renderer as any);

      expect([passTarget.width, passTarget.height], 'built in device pixels').toEqual([200, 100]);

      parent.resize(300, 150);
      expect([passTarget.width, passTarget.height], 'resized in device pixels').toEqual([600, 300]);
    });

    // -------------------------------------------------------------------------
    // renderOrder × buildOutputNode — the order the user reads in their pipeline
    // -------------------------------------------------------------------------
    describe('renderOrder controls the order of pass nodes passed to buildOutputNode', () => {
      function makeOrderedSetup(names: string[], renderOrder?: string) {
        const sr = new StageRenderer();
        sr.resize(100, 100);
        const passByName: Record<string, unknown> = {};
        for (const n of names) {
          passByName[n] = fakePassNode(n);
          const stage = {...fakeStage(n), asPassNode: vi.fn(() => passByName[n])};
          sr.add(stage as any);
        }
        if (renderOrder !== undefined) sr.renderOrder = renderOrder;
        const buildOutputNode = vi.fn((nodes: unknown[]) => nodes[0]);
        sr.buildOutputNode = buildOutputNode as any;
        sr.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
        return {sr, buildOutputNode, passByName};
      }

      it('explicit list reorders inserted stages: "ui,world,bg" → passes [ui, world, bg]', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], 'ui,world,bg');
        sr.renderTo(renderer as any);
        expect(buildOutputNode.mock.calls[0]![0]).toEqual([passByName['ui'], passByName['world'], passByName['bg']]);
      });

      it('wildcard splices the rest in insertion order: "ui,*" → [ui, bg, world]', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], 'ui,*');
        sr.renderTo(renderer as any);
        expect(buildOutputNode.mock.calls[0]![0]).toEqual([passByName['ui'], passByName['bg'], passByName['world']]);
      });

      it('wildcard between names: "bg,*,ui" → [bg, world, ui]', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], 'bg,*,ui');
        sr.renderTo(renderer as any);
        expect(buildOutputNode.mock.calls[0]![0]).toEqual([passByName['bg'], passByName['world'], passByName['ui']]);
      });

      it('names missing from renderOrder are dropped from the pass list: "ui,bg" → [ui, bg] (world omitted)', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], 'ui,bg');
        sr.renderTo(renderer as any);
        expect(buildOutputNode.mock.calls[0]![0]).toEqual([passByName['ui'], passByName['bg']]);
      });

      it('unknown names in renderOrder are ignored: "ui,nope,world,*" → [ui, world, bg]', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], 'ui,nope,world,*');
        sr.renderTo(renderer as any);
        expect(buildOutputNode.mock.calls[0]![0]).toEqual([passByName['ui'], passByName['world'], passByName['bg']]);
      });

      it('whitespace in renderOrder is trimmed: " ui , world , bg " → [ui, world, bg]', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], ' ui , world , bg ');
        sr.renderTo(renderer as any);
        expect(buildOutputNode.mock.calls[0]![0]).toEqual([passByName['ui'], passByName['world'], passByName['bg']]);
      });

      it('changing renderOrder after the first render rebuilds outputNode with the new order', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], 'bg,world,ui');
        sr.renderTo(renderer as any);
        expect(buildOutputNode).toHaveBeenCalledTimes(1);
        expect(buildOutputNode.mock.calls[0]![0]).toEqual([passByName['bg'], passByName['world'], passByName['ui']]);

        // Reorder
        sr.renderOrder = 'ui,world,bg';
        sr.renderTo(renderer as any);
        expect(buildOutputNode).toHaveBeenCalledTimes(2);
        expect(buildOutputNode.mock.calls[1]![0]).toEqual([passByName['ui'], passByName['world'], passByName['bg']]);
      });

      it('order matches the parallel call order of asPassNode() per stage', () => {
        const sr = new StageRenderer();
        sr.resize(100, 100);
        const order: string[] = [];
        const make = (name: string) => {
          const node = fakePassNode(name);
          const stage = {
            ...fakeStage(name),
            asPassNode: vi.fn(() => {
              order.push(name);
              return node;
            }),
          };
          return {stage, node};
        };
        const a = make('a');
        const b = make('b');
        const c = make('c');
        sr.add(a.stage as any)
          .add(b.stage as any)
          .add(c.stage as any);
        sr.renderOrder = 'c,a,b';
        const buildOutputNode = vi.fn((nodes: unknown[]) => nodes[0]);
        sr.buildOutputNode = buildOutputNode as any;
        sr.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
        sr.renderTo(renderer as any);
        // asPassNode() called in the same order the nodes appear in buildOutputNode's argument
        expect(order).toEqual(['c', 'a', 'b']);
        expect(buildOutputNode.mock.calls[0]![0]).toEqual([c.node, a.node, b.node]);
      });
    });

    it('throws when a stage in the build path has no asPassNode()', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      sr.add(fakeStage('bare'));
      sr.buildOutputNode = ((nodes: unknown[]) => nodes[0]) as any;
      sr.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
      expect(() => sr.renderTo(renderer as any)).toThrow(/StageRenderer#renderTo\(\) cannot compose the stage "bare"/);
    });

    it('throws the same error under a RootRenderPipeline without buildOutputNode', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      sr.add(fakeStage('bare'));
      sr.pipeline = fakeRootPipeline() as any;
      expect(() => sr.renderTo(renderer as any)).toThrow(/StageRenderer#renderTo\(\) cannot compose the stage "bare"/);
    });

    it('nested StageRenderer is pre-rendered into its pass target before parent pipeline runs', () => {
      const parent = new StageRenderer();
      parent.resize(100, 100);
      const child = new StageRenderer();
      // attach child as stage of parent
      parent.add(child as any);
      child.resize(100, 100);
      const inner = fakeStage('inner');
      child.add(inner);

      // Record the RT during child's inner rendering
      let rtDuringInner: unknown;
      inner.renderTo.mockImplementation(() => {
        rtDuringInner = renderer.__renderTarget;
      });

      let pipelineOutputNode: unknown;
      parent.buildOutputNode = ((nodes: unknown[]) => {
        pipelineOutputNode = nodes[0];
        return nodes[0];
      }) as any;
      parent.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;

      parent.renderTo(renderer as any);

      // Child's inner stage rendered into a non-null target (the child's pass-target)
      expect(rtDuringInner).not.toBeNull();
      expect((rtDuringInner as any)?.isRenderTarget).toBe(true);
      // buildOutputNode received exactly one pass node (the child as a texture node)
      expect(pipelineOutputNode).toBeDefined();
    });

    function makeNestedSetup() {
      const parent = new StageRenderer();
      parent.resize(100, 100);
      const child = new StageRenderer();
      parent.add(child as any);
      child.resize(100, 100);
      const inner = fakeStage('inner');
      child.add(inner);
      parent.buildOutputNode = ((nodes: unknown[]) => nodes[0]) as any;
      parent.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;

      const log = logClearsAndDraws(inner);

      return {parent, child, log};
    }

    it('a nested StageRenderer without clear gets its pass target cleared to transparent black on every frame', () => {
      const {parent, log} = makeNestedSetup();

      for (let frame = 1; frame <= 2; frame++) {
        log.length = 0;
        parent.renderTo(renderer as any);

        const drawIndex = log.findIndex((entry) => entry.kind === 'draw');
        expect(drawIndex, `frame ${frame}: the child is drawn`).toBeGreaterThanOrEqual(0);
        const draw = log[drawIndex]!;
        expect((draw.target as any)?.isRenderTarget, `frame ${frame}: into its pass target`).toBe(true);

        const clearsBeforeDraw = log.slice(0, drawIndex).filter((entry) => entry.kind === 'clear');
        expect(clearsBeforeDraw, `frame ${frame}: one clear before the draw`).toEqual([
          {kind: 'clear', target: draw.target, color: 0x000000, alpha: 0, args: [true, true, false]},
        ]);

        expect(renderer.__clearColor.getHex(), `frame ${frame}: clear color restored`).toBe(0x111111);
        expect(renderer.__clearAlpha, `frame ${frame}: clear alpha restored`).toBe(0.5);
      }
    });

    it('a nested StageRenderer whose own clear covers color and depth gets only that clear', () => {
      const {parent, child, log} = makeNestedSetup();
      child.setClearColor(new Color(0x123456), 0.25);

      parent.renderTo(renderer as any);

      const {draw, clears} = clearsBeforeFirstDraw(log);
      expect(clears).toEqual([{kind: 'clear', target: draw.target, color: 0x123456, alpha: 0.25, args: [true, true, true]}]);
    });

    it('a nested StageRenderer whose own clear leaves out the depth buffer gets the transparent black clear first', () => {
      const {parent, child, log} = makeNestedSetup();
      child.setClearColor(new Color(0x123456), 0.25);
      child.clearDepthBuffer = false;

      parent.renderTo(renderer as any);

      const {draw, clears} = clearsBeforeFirstDraw(log);
      expect(clears).toEqual([
        {kind: 'clear', target: draw.target, color: 0x000000, alpha: 0, args: [true, true, false]},
        {kind: 'clear', target: draw.target, color: 0x123456, alpha: 0.25, args: [true, false, true]},
      ]);
    });

    it('a composing nested StageRenderer that cannot compose yet gets the transparent black clear despite its own clear', () => {
      const parent = new StageRenderer();
      parent.resize(100, 100);
      const child = new StageRenderer();
      parent.add(child);
      // a Stage2D without projection has no camera: the child returns before its own clear
      child.add(new Stage2D());
      child.resize(100, 100);
      child.setClearColor(new Color(0x123456), 0.25);
      child.buildOutputNode = (passes) => passes[0]!;
      child.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
      parent.buildOutputNode = (passes) => passes[0]!;
      parent.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
      const log = logClearsAndDraws();

      parent.renderTo(renderer as any);

      const childRT = (child.asPassNode(renderer as any) as any).value.renderTarget;
      expect(log.filter((entry) => entry.target === childRT)).toEqual([
        {kind: 'clear', target: childRT, color: 0x000000, alpha: 0, args: [true, true, false]},
      ]);
    });

    it('lets a nested renderer with a pipeline under a composing parent write linear', () => {
      const {parent, child} = makeNestedSetup();
      const childPipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()};
      child.pipeline = childPipeline as any;

      const seen: Record<string, [unknown, unknown]> = {};
      childPipeline.render.mockImplementation(() => {
        seen['child'] = [renderer.toneMapping, renderer.outputColorSpace];
      });
      (parent.pipeline!.render as Mock).mockImplementation(() => {
        seen['parent'] = [renderer.toneMapping, renderer.outputColorSpace];
      });

      parent.renderTo(renderer as any);

      expect(seen['child']).toEqual([NoToneMapping, ColorManagement.workingColorSpace]);
      expect(seen['parent']).toEqual([ACESFilmicToneMapping, SRGBColorSpace]);
      expect([renderer.toneMapping, renderer.outputColorSpace], 'after renderTo()').toEqual([
        ACESFilmicToneMapping,
        SRGBColorSpace,
      ]);
    });

    it('builds the pass target with the output buffer type and the samples of the renderer', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);

      const rt = (sr.asPassNode(renderer as any) as any).value.renderTarget as RenderTarget;
      expect(rt.texture.type).toBe(FloatType);
      expect(rt.samples).toBe(4);

      renderer.samples = 0;
      const next = (sr.asPassNode(renderer as any) as any).value.renderTarget as RenderTarget;
      expect(next, 'the same target').toBe(rt);
      expect(rt.samples).toBe(0);
    });
  });

  describe('release of the internal render targets', () => {
    const sandbox = createSandbox();

    afterEach(() => {
      sandbox.restore();
    });

    // a Mode C renderer after its first frame, and the internal target its stage drew into
    function makeModeC() {
      const sr = new StageRenderer();
      sr.resize(50, 50);
      const passNode = {isNode: true, label: 's', type: 'pass', add: () => passNode};
      const stage = {...fakeStage('s'), asPassNode: vi.fn(() => passNode)};
      const targets: unknown[] = [];
      stage.renderTo.mockImplementation(() => targets.push(renderer.__renderTarget));
      sr.add(stage as any);
      sr.pipeline = makePipelineMock() as any;
      sr.renderTo(renderer as any);
      return {sr, targets, internalRT: targets[0]};
    }

    const leavingModeC: [string, (sr: StageRenderer) => void][] = [
      ['pipeline = undefined', (sr) => (sr.pipeline = undefined)],
      ['buildOutputNode', (sr) => (sr.buildOutputNode = (passes) => passes[0]!)],
      ['a RootRenderPipeline', (sr) => (sr.pipeline = fakeRootPipeline() as any)],
    ];

    for (const [leave, apply] of leavingModeC) {
      it(`releases the internal target of Mode C once on leaving it through ${leave}, and draws into it on return`, () => {
        const {sr, targets, internalRT} = makeModeC();
        const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');

        apply(sr);

        expect(rtDispose.callCount).toBe(1);
        expect(rtDispose.firstCall.thisValue).toBe(internalRT);

        sr.buildOutputNode = undefined;
        sr.pipeline = makePipelineMock() as any;
        sr.renderTo(renderer as any);

        expect(targets.at(-1), 'the same target').toBe(internalRT);
        expect(rtDispose.callCount, 'nothing released on return').toBe(1);
      });
    }

    it('releases nothing on a change between two Mode C pipelines', () => {
      const {sr} = makeModeC();
      const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');

      sr.pipeline = makePipelineMock() as any;

      expect(rtDispose.callCount).toBe(0);
    });

    type Relation = (parent: StageRenderer, child: StageRenderer) => void;
    const lettingGo: [string, join: Relation, part: Relation][] = [
      ['parent.remove(child) after add()', (parent, child) => parent.add(child), (parent, child) => parent.remove(child)],
      ['child.detach() after child.parent = parent', (parent, child) => (child.parent = parent), (_, child) => child.detach()],
    ];

    for (const [way, join, part] of lettingGo) {
      it(`releases the pass target of a nested renderer once through ${way}`, () => {
        const parent = new StageRenderer();
        parent.resize(50, 50);
        const child = new StageRenderer();
        child.add(fakeStage('inner'));
        join(parent, child);
        parent.buildOutputNode = (passes) => passes[0]!;
        parent.pipeline = makePipelineMock() as any;
        parent.renderTo(renderer as any);

        const passTexture = (child.asPassNode(renderer as any) as any).value;
        const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');

        part(parent, child);

        expect(rtDispose.callCount).toBe(1);
        expect(rtDispose.firstCall.thisValue).toBe(passTexture.renderTarget);
        expect((child.asPassNode(renderer as any) as any).value, 'a node on the same texture').toBe(passTexture);
      });
    }
  });

  describe('dispose()', () => {
    const sandbox = createSandbox();

    afterEach(() => {
      sandbox.restore();
    });

    function makePipelineMock() {
      return {outputNode: undefined as unknown, needsUpdate: false, render: vi.fn(), dispose: vi.fn()};
    }

    // (a) a resource the instance built itself is released exactly once
    it('disposes the render targets it built itself', () => {
      const sr = new StageRenderer();
      sr.resize(50, 50);
      sr.add(fakeStage('s'));
      sr.pipeline = makePipelineMock() as any;

      // the pipeline path drives the internal target into existence, asPassNode() the second one
      sr.renderTo(renderer as any);
      sr.asPassNode(renderer as any);

      const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');

      sr.dispose();

      expect(rtDispose.callCount).toBe(2);
    });

    // (b) a resource handed in belongs to the caller and is not touched
    it('does NOT dispose a pipeline or an output target that was handed in', () => {
      const sr = new StageRenderer();
      sr.resize(50, 50);
      sr.add(fakeStage('s'));
      const pipeline = makePipelineMock();
      sr.pipeline = pipeline as any;
      const outputRenderTarget = new RenderTarget(50, 50);
      sr.outputRenderTarget = outputRenderTarget;
      const outputRTDispose = sandbox.spy(outputRenderTarget, 'dispose');
      sr.renderTo(renderer as any);

      sr.dispose();

      expect(pipeline.dispose).not.toHaveBeenCalled();
      expect(sr.pipeline).toBeUndefined();
      expect(outputRTDispose.called, 'the output target belongs to the caller').toBe(false);
      expect(sr.outputRenderTarget).toBe(outputRenderTarget);
    });

    // (c) every public member behaves after dispose() as its TSDoc says
    it('behaves as documented after dispose()', () => {
      const host = makeHost();
      const sr = new StageRenderer(host);
      const stage = fakeStage('s');
      sr.add(stage);
      sr.pipeline = makePipelineMock() as any;

      host._emitResize(100, 50);
      host._emitFrame(1, 0.016, 1);
      expect(stage.renderTo, 'the renderer is driven while it is alive').toHaveBeenCalledTimes(1);

      const buildOutputNode = (passes: Node[]) => passes[0]!;
      sr.buildOutputNode = buildOutputNode;
      expect(sr.buildOutputNode, 'buildOutputNode before dispose()').toBe(buildOutputNode);

      sr.dispose();

      expect(sr.isDisposed).toBe(true);
      expect(sr.parent).toBeUndefined();
      expect(sr.pipeline).toBeUndefined();
      expect(sr.buildOutputNode).toBeUndefined();
      expect(sr.stages).toEqual([]);
      expect(sr.orderedStages).toEqual([]);

      // the renderer let go of both host subscriptions — the host has nothing left to call
      expect(host._unsubs, 'host subscriptions given up').toBe(2);

      // and the host keeps firing: a renderer still wired in would answer here
      host._emitResize(640, 480);
      host._emitFrame(2, 0.016, 2);

      expect(stage.updateFrame, 'updateFrame() after dispose()').toHaveBeenCalledTimes(1);
      expect(stage.renderTo, 'renderTo() after dispose()').toHaveBeenCalledTimes(1);
      expect(sr.width, 'width after dispose()').toBe(100);
      expect(sr.height, 'height after dispose()').toBe(50);

      // a disposed renderer takes neither a new host nor a new stage
      const otherHost = makeHost();
      expect(sr.attach(otherHost)).toBe(sr);
      expect(sr.parent, 'parent after attach()').toBeUndefined();

      otherHost._emitFrame(3, 0.016, 3);
      expect(stage.renderTo, 'renderTo() after attach()').toHaveBeenCalledTimes(1);

      expect(sr.add(fakeStage('late'))).toBe(sr);
      expect(sr.stages, 'stages after add()').toEqual([]);

      // and no new pipeline either: renderTo() has nothing left to drive it with
      sr.pipeline = makePipelineMock() as any;
      expect(sr.pipeline, 'pipeline after a write').toBeUndefined();
      sr.buildOutputNode = buildOutputNode;
      expect(sr.buildOutputNode, 'buildOutputNode after a write').toBeUndefined();
      expect(() => sr.renderTo(renderer as any), 'renderTo() on a disposed renderer').not.toThrow();
    });

    it('leaves a builder of createBloomOutputNodeBuilder() alone', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      sr.add(new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 100})));
      const pipeline = makePipelineMock();
      sr.pipeline = pipeline as any;
      const builder = createBloomOutputNodeBuilder();
      sr.buildOutputNode = builder;
      sr.renderTo(renderer as any);
      const bloomDispose = sandbox.spy(findBlooms(pipeline.outputNode as Node)[0]!, 'dispose');

      sr.dispose();

      expect(builder.isDisposed).toBe(false);
      expect(bloomDispose.called).toBe(false);
      expect(sr.buildOutputNode).toBeUndefined();

      builder.dispose();
    });

    it('announces its dispose to a listener of IStageDispose with the renderer', () => {
      const sr = new StageRenderer();
      const heard = vi.fn();
      const listener: IStageDispose = {[OnStageDispose]: heard};
      on(sr, listener);

      sr.dispose();

      expect(heard).toHaveBeenCalledExactlyOnceWith(sr);
    });

    it('emits dispose once before it stops listening', () => {
      const sr = new StageRenderer();
      const listening: number[] = [];
      const spy = vi.fn(() => listening.push(getSubscriptionCount(sr)));
      on(sr, OnStageDispose, spy);

      sr.dispose();

      expect(spy).toHaveBeenCalledExactlyOnceWith(sr);
      expect(listening[0], 'the listener is still attached when the event arrives').toBeGreaterThan(0);
      expect(getSubscriptionCount(sr), 'and nothing is attached afterwards').toBe(0);

      on(sr, OnStageDispose, spy);
      sr.dispose();
      expect(spy, 'a second dispose() emits nothing').toHaveBeenCalledTimes(1);
    });

    it('stops listening even when a dispose listener throws', () => {
      const sr = new StageRenderer();
      const failure = new Error('the listener failed');
      on(sr, OnStageDispose, () => {
        throw failure;
      });

      expect(thrownBy(() => sr.dispose())).toBe(failure);
      expect(getSubscriptionCount(sr)).toBe(0);
      expect(sr.isDisposed).toBe(true);
    });

    it('every dispose listener hears the event, even behind one that throws', () => {
      const sr = new StageRenderer();
      const failure = new Error('the listener failed');
      const heard = vi.fn();
      on(sr, OnStageDispose, () => {
        throw failure;
      });
      on(sr, OnStageDispose, heard);

      expect(thrownBy(() => sr.dispose())).toBe(failure);

      expect(heard).toHaveBeenCalledExactlyOnceWith(sr);
    });

    it('a listener of OnStageRemoved that throws does not hold up the teardown', () => {
      const h = makeHost();
      const sr = new StageRenderer(h);
      sr.resize(50, 50);
      const a = fakeStage('a');
      const b = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 100}));
      const onB = getSubscriptionCount(b);
      sr.add(a);
      sr.add(b);
      sr.pipeline = makePipelineMock() as any;
      // the pipeline path builds the internal target
      sr.renderTo(renderer as any);
      const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');
      const failure = new Error('the listener failed');
      on(sr, OnStageRemoved, ({stage}: {stage: IStage}) => {
        if (stage === a) throw failure;
      });
      const heard = vi.fn();
      on(sr, OnStageDispose, heard);

      expect(thrownBy(() => sr.dispose())).toBe(failure);

      expect(sr.stages).toHaveLength(0);
      expect(getSubscriptionCount(b), 'the renderer stopped listening to the stage behind it').toBe(onB);
      expect(rtDispose.callCount).toBe(1);
      expect(h._unsubs).toBe(2);
      expect(heard).toHaveBeenCalledExactlyOnceWith(sr);
      expect(getSubscriptionCount(sr)).toBe(0);
      expect(sr.pipeline).toBeUndefined();
      expect(() => sr.dispose()).not.toThrow();
    });

    it('a listener of OnRemoveFromParent that throws does not keep the renderer on its host', () => {
      const h = makeHost();
      const sr = new StageRenderer();
      const failure = new Error('the listener failed');
      // ahead of the host subscriptions: registered before attach()
      on(sr, OnRemoveFromParent, () => {
        throw failure;
      });
      sr.attach(h);
      const stage = fakeStage('s');
      sr.add(stage);
      const heard = vi.fn();
      on(sr, OnStageDispose, heard);

      expect(thrownBy(() => sr.dispose())).toBe(failure);

      expect(h._unsubs).toBe(2);
      h._emitFrame(1, 0.016, 1);
      expect(stage.renderTo).not.toHaveBeenCalled();
      expect(sr.parent).toBeUndefined();
      expect(heard).toHaveBeenCalledTimes(1);
      expect(getSubscriptionCount(sr)).toBe(0);
    });

    it('a listener of OnRemoveFromParent that throws does not keep the renderer among the stages of its parent', () => {
      const parent = new StageRenderer();
      const sr = new StageRenderer(parent);
      const failure = new Error('the listener failed');
      on(sr, OnRemoveFromParent, () => {
        throw failure;
      });

      expect(thrownBy(() => sr.dispose())).toBe(failure);

      expect(parent.hasStage(sr)).toBe(false);
      expect(sr.parent).toBeUndefined();
      expect(getSubscriptionCount(sr)).toBe(0);
    });

    it('a child whose OnRemoveFromParent listener throws leaves the renderer and releases its pass target', () => {
      const parent = new StageRenderer();
      const child = new StageRenderer(parent);
      child.resize(50, 50);
      const passTarget = (child.asPassNode(renderer as any) as any).value.renderTarget;
      const failure = new Error('the listener failed');
      on(child, OnRemoveFromParent, () => {
        throw failure;
      });
      const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');
      const heard = vi.fn();
      on(parent, OnStageDispose, heard);

      expect(thrownBy(() => parent.dispose())).toBe(failure);

      expect(child.parent).toBeUndefined();
      expect(rtDispose.calledOn(passTarget)).toBe(true);
      expect(heard).toHaveBeenCalledTimes(1);
      expect(getSubscriptionCount(parent)).toBe(0);
    });

    it('errors from several parts of the teardown reach the caller as an AggregateError in the order they arose', () => {
      const h = makeHost();
      const sr = new StageRenderer(h);
      const a = fakeStage('a');
      const b = fakeStage('b');
      sr.add(a).add(b);
      const eA = new Error('a');
      const eB = new Error('b');
      const eP = new Error('parent');
      const eD = new Error('dispose');
      on(sr, OnStageRemoved, ({stage}: {stage: IStage}) => {
        throw stage === a ? eA : eB;
      });
      on(sr, OnRemoveFromParent, () => {
        throw eP;
      });
      on(sr, OnStageDispose, () => {
        throw eD;
      });

      const error = thrownBy(() => sr.dispose()) as AggregateError;

      expect(error).toBeInstanceOf(AggregateError);
      expect(error.message).toBe(
        'StageRenderer#dispose(): more than one listener of OnStageRemoved, OnRemoveFromParent and OnStageDispose or unsubscribe of the host threw',
      );
      expect(error.errors).toHaveLength(4);
      expect(error.errors[0]).toBe(eA);
      expect(error.errors[1]).toBe(eB);
      expect(error.errors[2]).toBe(eP);
      expect(error.errors[3]).toBe(eD);
      expect(h._unsubs).toBe(2);
    });

    it('dispose() gives up the other subscription at a host whose unsubscribe throws and hands the error on between those of the stages and of OnRemoveFromParent', () => {
      const eU = new Error('unsubscribe');
      const eS = new Error('stage removed');
      const eP = new Error('remove from parent');
      const eD = new Error('dispose');
      const h = makeHost({unsubscribeResize: eU});
      const sr = new StageRenderer(h);
      sr.add(fakeStage('a'));
      on(sr, OnStageRemoved, () => {
        throw eS;
      });
      on(sr, OnRemoveFromParent, () => {
        throw eP;
      });
      on(sr, OnStageDispose, () => {
        throw eD;
      });

      const error = thrownBy(() => sr.dispose()) as AggregateError;

      expect(error).toBeInstanceOf(AggregateError);
      expect(error.message).toBe(
        'StageRenderer#dispose(): more than one listener of OnStageRemoved, OnRemoveFromParent and OnStageDispose or unsubscribe of the host threw',
      );
      expect(error.errors).toEqual([eS, eU, eP, eD]);
      expect(sr.isDisposed).toBe(true);
      expect(h._unsubs).toBe(2);
    });

    it('a remove() that threw twice stands as one AggregateError among the errors of dispose()', () => {
      const sr = new StageRenderer();
      const child = new StageRenderer(sr);
      const e1 = new Error('removed');
      const e2 = new Error('left');
      const e3 = new Error('dispose');
      on(sr, OnStageRemoved, () => {
        throw e1;
      });
      on(child, OnRemoveFromParent, () => {
        throw e2;
      });
      on(sr, OnStageDispose, () => {
        throw e3;
      });

      const error = thrownBy(() => sr.dispose()) as AggregateError;

      expect(error).toBeInstanceOf(AggregateError);
      expect(error.message).toBe(
        'StageRenderer#dispose(): more than one listener of OnStageRemoved, OnRemoveFromParent and OnStageDispose or unsubscribe of the host threw',
      );
      expect(error.errors).toHaveLength(2);
      const removed = error.errors[0] as AggregateError;
      expect(removed).toBeInstanceOf(AggregateError);
      expect(removed.message).toBe(
        'StageRenderer#remove(): more than one listener of OnStageRemoved and OnRemoveFromParent threw',
      );
      expect(removed.errors).toHaveLength(2);
      expect(removed.errors[0]).toBe(e1);
      expect(removed.errors[1]).toBe(e2);
      expect(error.errors[1]).toBe(e3);
    });

    // (d) the second call throws nothing and releases nothing a second time
    it('is safe to call twice', () => {
      const sr = new StageRenderer();
      sr.resize(50, 50);
      sr.add(fakeStage('s'));
      const pipeline = makePipelineMock();
      sr.pipeline = pipeline as any;
      sr.renderTo(renderer as any);

      const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');

      expect(() => {
        sr.dispose();
        sr.dispose();
      }).not.toThrow();

      expect(rtDispose.callCount).toBe(1);
      expect(pipeline.dispose).not.toHaveBeenCalled();
    });

    const joining: [string, (parent: StageRenderer) => StageRenderer][] = [
      ['new StageRenderer(parent)', (parent) => new StageRenderer(parent)],
      [
        'parent.add(child)',
        (parent) => {
          const child = new StageRenderer();
          parent.add(child);
          return child;
        },
      ],
    ];

    for (const [way, join] of joining) {
      it(`releases the pass target of a child that joined through ${way} once`, () => {
        const parent = new StageRenderer();
        const child = join(parent);
        child.resize(50, 50);
        const passTarget = (child.asPassNode(renderer as any) as any).value.renderTarget;
        const rtDispose = sandbox.spy(RenderTarget.prototype, 'dispose');

        child.dispose();

        expect(rtDispose.callCount).toBe(1);
        expect(rtDispose.firstCall.thisValue).toBe(passTarget);
      });
    }

    it('throws instead of building a pass target after dispose()', () => {
      const sr = new StageRenderer();
      sr.resize(50, 50);
      sr.dispose();

      expect(() => sr.asPassNode(renderer as any)).toThrow(/StageRenderer#asPassNode\(\) is not available/);
    });

    it('lets go of a child renderer that is disposed while it holds it', () => {
      const parent = new StageRenderer();
      parent.resize(50, 50);
      const passNode = {isNode: true, label: 'other', type: 'pass'};
      parent.add({...fakeStage('other'), asPassNode: vi.fn(() => passNode)} as any);
      const child = new StageRenderer();
      parent.add(child);
      parent.pipeline = makePipelineMock() as any;
      const buildOutputNode = vi.fn((passes: any[]) => passes[0]);
      parent.buildOutputNode = buildOutputNode;
      parent.renderTo(renderer as any);

      child.dispose();

      expect(parent.hasStage(child)).toBe(false);
      expect(child.parent).toBeUndefined();
      expect(() => parent.renderTo(renderer as any)).not.toThrow();
      expect(buildOutputNode.mock.calls.at(-1)![0]).toEqual([passNode]);
    });

    it('leaves the renderer alone after dispose()', () => {
      const sr = new StageRenderer();
      sr.resize(50, 50);
      sr.setClearColor(null, 0);
      sr.dispose();

      sr.renderTo(renderer as any);

      expect(renderer.clear, 'the target belongs to the caller').not.toHaveBeenCalled();
    });

    it('takes no pipeline after dispose()', () => {
      const sr = new StageRenderer();
      sr.resize(50, 50);
      sr.dispose();

      sr.pipeline = makePipelineMock() as any;
      sr.renderTo(renderer as any);

      expect(sr.pipeline).toBeUndefined();
    });

    // (e) has no subject here: this renderer creates neither signals nor effects.

    // (f) has no subject here: a target borrowed from an internalTargetPool goes back before
    // renderTo() returns, so dispose() finds none to give back — 'Mode C with an
    // internalTargetPool' covers the return. The renderer takes no tile from a factory. The
    // stages arrive through add() and stay the caller's; the render targets it builds are its
    // own, and case (a) covers them.
  });
});

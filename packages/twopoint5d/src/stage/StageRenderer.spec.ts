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

  // ---------------------------------------------------------------------------
  // Pipeline integration (§6 of Backlog-StageRenderer.md)
  // ---------------------------------------------------------------------------

  describe('outputRenderTarget (§6.4 RT only, no pipeline)', () => {
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

  describe('pipeline without buildOutputNode (§6.4 Mode C)', () => {
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

    it('rebuilds outputNode only when stage list changes', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      const stage = fakeStage('s');
      sr.add(stage);
      const pipeline = {outputNode: undefined as unknown, needsUpdate: false, render: vi.fn(), dispose: vi.fn()};
      sr.pipeline = pipeline as any;

      sr.renderTo(renderer as any);
      const firstNode = pipeline.outputNode;
      pipeline.needsUpdate = false;
      sr.renderTo(renderer as any);
      // outputNode kept (rebuild only when invalidated)
      expect(pipeline.outputNode).toBe(firstNode);
      expect(pipeline.needsUpdate).toBe(false);

      // Add a stage → invalidate
      sr.add(fakeStage('t'));
      pipeline.needsUpdate = false;
      sr.renderTo(renderer as any);
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

    it('dispose() releases internal RT and pipeline', () => {
      const sr = new StageRenderer();
      sr.resize(50, 50);
      sr.add(fakeStage('s'));
      const dispose = vi.fn();
      sr.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose} as any;
      sr.renderTo(renderer as any);
      sr.dispose();
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(sr.pipeline).toBeUndefined();
    });
  });

  describe('asPassNode + buildOutputNode (§6.2 / §6.3)', () => {
    function fakePassNode(label: string) {
      return {isNode: true, label, type: 'pass'} as any;
    }

    it('Stage2D.asPassNode requires a camera (throws without projection)', async () => {
      const {Stage2D} = await import('./Stage2D.js');
      const {ParallaxProjection} = await import('./ParallaxProjection.js');
      const stage = new Stage2D();
      expect(() => stage.asPassNode(renderer as any)).toThrowError(/no scene or camera/);
      stage.projection = new ParallaxProjection('xy|bottom-left');
      expect(() => stage.asPassNode(renderer as any)).not.toThrow();
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
      expect(buildOutputNode.mock.calls[0][0]).toEqual([passA, passB]);
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
        expect(buildOutputNode.mock.calls[0][0]).toEqual([passByName['ui'], passByName['world'], passByName['bg']]);
      });

      it('wildcard splices the rest in insertion order: "ui,*" → [ui, bg, world]', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], 'ui,*');
        sr.renderTo(renderer as any);
        expect(buildOutputNode.mock.calls[0][0]).toEqual([passByName['ui'], passByName['bg'], passByName['world']]);
      });

      it('wildcard between names: "bg,*,ui" → [bg, world, ui]', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], 'bg,*,ui');
        sr.renderTo(renderer as any);
        expect(buildOutputNode.mock.calls[0][0]).toEqual([passByName['bg'], passByName['world'], passByName['ui']]);
      });

      it('names missing from renderOrder are dropped from the pass list: "ui,bg" → [ui, bg] (world omitted)', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], 'ui,bg');
        sr.renderTo(renderer as any);
        expect(buildOutputNode.mock.calls[0][0]).toEqual([passByName['ui'], passByName['bg']]);
      });

      it('unknown names in renderOrder are ignored: "ui,nope,world,*" → [ui, world, bg]', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], 'ui,nope,world,*');
        sr.renderTo(renderer as any);
        expect(buildOutputNode.mock.calls[0][0]).toEqual([passByName['ui'], passByName['world'], passByName['bg']]);
      });

      it('whitespace in renderOrder is trimmed: " ui , world , bg " → [ui, world, bg]', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], ' ui , world , bg ');
        sr.renderTo(renderer as any);
        expect(buildOutputNode.mock.calls[0][0]).toEqual([passByName['ui'], passByName['world'], passByName['bg']]);
      });

      it('changing renderOrder after the first render rebuilds outputNode with the new order', () => {
        const {sr, buildOutputNode, passByName} = makeOrderedSetup(['bg', 'world', 'ui'], 'bg,world,ui');
        sr.renderTo(renderer as any);
        expect(buildOutputNode).toHaveBeenCalledTimes(1);
        expect(buildOutputNode.mock.calls[0][0]).toEqual([passByName['bg'], passByName['world'], passByName['ui']]);

        // Reorder
        sr.renderOrder = 'ui,world,bg';
        sr.renderTo(renderer as any);
        expect(buildOutputNode).toHaveBeenCalledTimes(2);
        expect(buildOutputNode.mock.calls[1][0]).toEqual([passByName['ui'], passByName['world'], passByName['bg']]);
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
        sr.add(a.stage as any).add(b.stage as any).add(c.stage as any);
        sr.renderOrder = 'c,a,b';
        const buildOutputNode = vi.fn((nodes: unknown[]) => nodes[0]);
        sr.buildOutputNode = buildOutputNode as any;
        sr.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
        sr.renderTo(renderer as any);
        // asPassNode() called in the same order the nodes appear in buildOutputNode's argument
        expect(order).toEqual(['c', 'a', 'b']);
        expect(buildOutputNode.mock.calls[0][0]).toEqual([c.node, a.node, b.node]);
      });
    });

    it('throws when a stage in the build path has no asPassNode()', () => {
      const sr = new StageRenderer();
      sr.resize(100, 100);
      sr.add(fakeStage('bare'));
      sr.buildOutputNode = ((nodes: unknown[]) => nodes[0]) as any;
      sr.pipeline = {outputNode: undefined, needsUpdate: false, render: vi.fn(), dispose: vi.fn()} as any;
      expect(() => sr.renderTo(renderer as any)).toThrowError(/asPassNode/);
    });

    it('nested StageRenderer is pre-rendered into its asPassNode-RT before parent pipeline runs', () => {
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

      // Child's inner stage rendered into a non-null target (the child's asPassNodeRT)
      expect(rtDuringInner).not.toBeNull();
      expect((rtDuringInner as any)?.isRenderTarget).toBe(true);
      // buildOutputNode received exactly one pass node (the child as a texture node)
      expect(pipelineOutputNode).toBeDefined();
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
});

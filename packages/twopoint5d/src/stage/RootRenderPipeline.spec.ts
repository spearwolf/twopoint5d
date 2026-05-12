import {describe, expect, it, vi} from 'vitest';
import {RootRenderPipeline} from './RootRenderPipeline.js';
import {StageRenderer} from './StageRenderer.js';
import type {IRenderable} from './IRenderable.js';
import type {IStage} from './IStage.js';

interface FakeNode {
  isFakeNode: true;
  label: string;
  add(other: FakeNode): FakeNode;
  parts: string[];
}

function makeNode(label: string): FakeNode {
  const node: FakeNode = {
    isFakeNode: true,
    label,
    parts: [label],
    add(other: FakeNode) {
      const combined = makeNode(`${this.label}+${other.label}`);
      combined.parts = [...this.parts, ...other.parts];
      return combined;
    },
  };
  return node;
}

function fakeStage(name: string, passNode: FakeNode): IStage & IRenderable & {asPassNode: ReturnType<typeof vi.fn>} {
  return {
    name,
    resize: vi.fn(),
    updateFrame: vi.fn(),
    renderTo: vi.fn(),
    asPassNode: vi.fn(() => passNode),
  };
}

describe('RootRenderPipeline.buildOutputNode', () => {
  it('returns the single pass as-is when there is exactly one stage', () => {
    const p = makeNode('a');
    const out = RootRenderPipeline.buildOutputNode([p as any]);
    expect(out).toBe(p);
  });

  it('combines two passes with .add()', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    const out = RootRenderPipeline.buildOutputNode([a, b] as any) as unknown as FakeNode;
    expect(out.label).toBe('a+b');
    expect(out.parts).toEqual(['a', 'b']);
  });

  it('combines three passes left-to-right: (a.add(b)).add(c)', () => {
    const a = makeNode('a');
    const b = makeNode('b');
    const c = makeNode('c');
    const out = RootRenderPipeline.buildOutputNode([a, b, c] as any) as unknown as FakeNode;
    expect(out.label).toBe('a+b+c');
    expect(out.parts).toEqual(['a', 'b', 'c']);
  });

  it('includes ALL passes (5 stages → 5 parts in result)', () => {
    const nodes = ['s0', 's1', 's2', 's3', 's4'].map(makeNode);
    const out = RootRenderPipeline.buildOutputNode(nodes as any) as unknown as FakeNode;
    expect(out.parts).toEqual(['s0', 's1', 's2', 's3', 's4']);
    expect(out.parts.length).toBe(5);
  });

  it('throws when called with an empty array', () => {
    expect(() => RootRenderPipeline.buildOutputNode([])).toThrowError(/no passes/);
  });
});

describe('StageRenderer + RootRenderPipeline (integration)', () => {
  function createRendererMock() {
    return {
      autoClear: true,
      setClearColor: vi.fn(),
      getClearColor: vi.fn(),
      setClearAlpha: vi.fn(),
      getClearAlpha: vi.fn(() => 1),
      clear: vi.fn(),
      render: vi.fn(),
      setRenderTarget: vi.fn(),
      getRenderTarget: vi.fn(() => null),
      getPixelRatio: vi.fn(() => 1),
    };
  }

  function fakeRootPipeline() {
    // Reuse the real RootRenderPipeline prototype without actually
    // constructing a RenderPipeline (no real WebGPURenderer needed).
    const fp = {
      outputNode: undefined as unknown,
      needsUpdate: false,
      render: vi.fn(),
      dispose: vi.fn(),
    };
    Object.setPrototypeOf(fp, RootRenderPipeline.prototype);
    return fp;
  }

  it('uses RootRenderPipeline.buildOutputNode as the default composer (no explicit buildOutputNode)', () => {
    const renderer = createRendererMock();
    const sr = new StageRenderer();
    sr.resize(100, 100);

    const passes = [makeNode('s0'), makeNode('s1'), makeNode('s2')];
    sr.add(fakeStage('s0', passes[0]) as any)
      .add(fakeStage('s1', passes[1]) as any)
      .add(fakeStage('s2', passes[2]) as any);

    sr.pipeline = fakeRootPipeline() as any;
    expect(sr.buildOutputNode).toBeUndefined();

    sr.renderTo(renderer as any);

    const out = sr.pipeline!.outputNode as unknown as FakeNode;
    expect(out).toBeDefined();
    // ALL three passes must appear in the composed output
    expect(out.parts).toEqual(['s0', 's1', 's2']);
    expect(sr.pipeline!.render).toHaveBeenCalledTimes(1);
  });

  it('a user-set buildOutputNode takes precedence over the RootRenderPipeline default', () => {
    const renderer = createRendererMock();
    const sr = new StageRenderer();
    sr.resize(100, 100);

    const passes = [makeNode('a'), makeNode('b')];
    sr.add(fakeStage('a', passes[0]) as any).add(fakeStage('b', passes[1]) as any);

    sr.pipeline = fakeRootPipeline() as any;
    const userBuilder = vi.fn((nodes: unknown[]) => nodes[0]);
    sr.buildOutputNode = userBuilder as any;

    sr.renderTo(renderer as any);

    expect(userBuilder).toHaveBeenCalledTimes(1);
    expect(userBuilder.mock.calls[0][0]).toEqual(passes);
    expect(sr.pipeline!.outputNode).toBe(passes[0]);
  });

  it('honors renderOrder when composing passes additively', () => {
    const renderer = createRendererMock();
    const sr = new StageRenderer();
    sr.resize(100, 100);

    const passes = {
      bg: makeNode('bg'),
      world: makeNode('world'),
      ui: makeNode('ui'),
    };
    sr.add(fakeStage('bg', passes.bg) as any)
      .add(fakeStage('world', passes.world) as any)
      .add(fakeStage('ui', passes.ui) as any);
    sr.renderOrder = 'ui,world,bg';

    sr.pipeline = fakeRootPipeline() as any;
    sr.renderTo(renderer as any);

    const out = sr.pipeline!.outputNode as unknown as FakeNode;
    expect(out.parts).toEqual(['ui', 'world', 'bg']);
  });

  it('rebuilds the outputNode when a new stage is added (still composes all passes including the new one)', () => {
    const renderer = createRendererMock();
    const sr = new StageRenderer();
    sr.resize(100, 100);

    const p1 = makeNode('s0');
    const p2 = makeNode('s1');
    sr.add(fakeStage('s0', p1) as any);
    sr.pipeline = fakeRootPipeline() as any;
    sr.renderTo(renderer as any);
    expect((sr.pipeline!.outputNode as unknown as FakeNode).parts).toEqual(['s0']);

    sr.add(fakeStage('s1', p2) as any);
    sr.renderTo(renderer as any);
    expect((sr.pipeline!.outputNode as unknown as FakeNode).parts).toEqual(['s0', 's1']);
  });
});
